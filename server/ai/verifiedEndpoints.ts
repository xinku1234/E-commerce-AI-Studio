const VERIFICATION_TTL_MS = 6 * 60 * 60 * 1000;
const verifiedEndpoints = new Map<string, number>();

function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function markEndpointVerified(url: string): void {
  verifiedEndpoints.set(normalizeEndpoint(url), Date.now());
}

export function isEndpointVerified(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  const key = normalizeEndpoint(url);
  const verifiedAt = verifiedEndpoints.get(key);
  if (!verifiedAt) return false;
  if (Date.now() - verifiedAt > VERIFICATION_TTL_MS) {
    verifiedEndpoints.delete(key);
    return false;
  }
  return true;
}

export function hasVerifiedEndpoint(): boolean {
  for (const [key, verifiedAt] of verifiedEndpoints) {
    if (Date.now() - verifiedAt <= VERIFICATION_TTL_MS) return true;
    verifiedEndpoints.delete(key);
  }
  return false;
}
