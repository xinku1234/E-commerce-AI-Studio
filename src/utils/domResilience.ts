/**
 * Makes the few DOM mutation methods React relies on fault tolerant.
 *
 * React keeps a reference to the sibling it wants to insert before. When code
 * outside React moves or removes managed nodes (page translators, reader modes
 * and similar extensions do exactly this), that reference is no longer a child
 * of the parent and the browser throws:
 *
 *   Failed to execute 'insertBefore' on 'Node': The node before which the new
 *   node is to be inserted is not a child of this node.
 *
 * The insert itself is still meaningful, so instead of letting the exception
 * tear down the React tree we complete the operation in the closest correct way
 * and log it. Genuine application bugs still surface through the warning.
 */

const FLAG = '__ecomStudioDomResilience';

interface ResilienceStats {
  insertBeforeRepairs: number;
  removeChildRepairs: number;
}

const stats: ResilienceStats = { insertBeforeRepairs: 0, removeChildRepairs: 0 };

/** Warnings are throttled; a misbehaving extension can fire hundreds per second. */
let lastWarnAt = 0;
function warnThrottled(message: string, detail: unknown) {
  const now = Date.now();
  if (now - lastWarnAt < 2000) return;
  lastWarnAt = now;
  console.warn(`[dom-resilience] ${message}`, detail);
}

export function getDomResilienceStats(): ResilienceStats {
  return { ...stats };
}

export function installDomResilience(): void {
  const target = window as any;
  if (target[FLAG]) return;
  target[FLAG] = true;

  const nativeInsertBefore = Node.prototype.insertBefore;
  const nativeRemoveChild = Node.prototype.removeChild;

  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) {
      stats.insertBeforeRepairs += 1;
      warnThrottled(
        'insertBefore reference node was detached by code outside React; appending instead.',
        { parent: (this as Element).tagName, inserted: (node as unknown as Element).tagName, repairs: stats.insertBeforeRepairs }
      );
      // Falling back to append keeps the node in the tree. Ordering may differ
      // from the virtual tree until the next full render, which is far better
      // than losing the whole workspace.
      return nativeInsertBefore.call(this, node, null) as T;
    }
    return nativeInsertBefore.call(this, node, reference) as T;
  };

  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child && child.parentNode !== this) {
      stats.removeChildRepairs += 1;
      warnThrottled(
        'removeChild target was already detached by code outside React; skipping.',
        { parent: (this as Element).tagName, repairs: stats.removeChildRepairs }
      );
      // The node is already gone from this parent, so the caller's intent holds.
      if (child.parentNode) {
        return nativeRemoveChild.call(child.parentNode, child) as T;
      }
      return child;
    }
    return nativeRemoveChild.call(this, child) as T;
  };
}
