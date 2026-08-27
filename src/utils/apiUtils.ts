/**
 * Safe API request utility to handle JSON parsing, network timeouts,
 * and prevent HTML/Vite fallback errors from throwing JSON parse exceptions.
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 20000
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    const rawText = await res.text();

    if (!rawText || rawText.trim().startsWith('<')) {
      // Server returned HTML (e.g. 504 Gateway Timeout or 413 Payload Too Large)
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Server responded with non-JSON (${res.status})`
      };
    }

    try {
      const parsedData = JSON.parse(rawText) as T;
      return {
        ok: res.ok,
        status: res.status,
        data: parsedData,
        error: (parsedData as any)?.error
      };
    } catch (parseErr: any) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: 'Invalid JSON response from server'
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 408 : 0,
      data: null,
      error: isTimeout ? 'Request timed out' : (err.message || 'Network request failed')
    };
  }
}
