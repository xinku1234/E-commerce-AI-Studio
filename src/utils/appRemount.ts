/**
 * Lets a render-time recovery path rebuild the entire React root. A DOM desync
 * usually leaves React internal bookkeeping inconsistent, so remounting a single
 * subtree can fail again; discarding the root and the container markup gives
 * React a clean slate.
 */
let remountHandler: (() => void) | null = null;

export function registerAppRemount(handler: () => void): void {
  remountHandler = handler;
}

export function requestAppRemount(): boolean {
  if (!remountHandler) return false;
  remountHandler();
  return true;
}
