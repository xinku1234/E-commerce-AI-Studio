/** Monotonic counter so ids minted inside the same millisecond never collide. */
let sequence = 0;

/**
 * Returns a process-unique id. `Date.now()` alone collides when a handler mints
 * several ids in one tick (or the user double-clicks), and duplicate React keys
 * in a reorderable list can corrupt reconciliation.
 */
export function uniqueId(prefix = 'id'): string {
  sequence += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}_${random}`;
}

/**
 * Forces every id in a list to be unique while preserving the original value
 * when possible, so server payloads with repeated ids cannot produce duplicate
 * React keys.
 */
export function withUniqueIds<T extends { id?: string }>(items: T[], prefix = 'item'): (T & { id: string })[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const candidate = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : '';
    const id = candidate && !seen.has(candidate) ? candidate : uniqueId(`${prefix}_${index}`);
    seen.add(id);
    return { ...item, id };
  });
}
