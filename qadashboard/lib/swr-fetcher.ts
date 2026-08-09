/** Shared SWR fetcher and cache-key helpers for list pages. */

export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  // Bypass browser HTTP cache so SWR + invalidateListCaches stay correct
  // after mutations. Edge/CDN can still use Cache-Control on the response.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json() as Promise<T>;
}

/** Prefix matcher used with `mutate(key => …)` after uploads / mutations. */
export function isListCacheKey(key: unknown): boolean {
  if (typeof key === "string") {
    return (
      key.startsWith("/api/jobs") ||
      key.startsWith("/api/companies") ||
      key.startsWith("/api/resume") ||
      key.startsWith("/api/documents") ||
      key.startsWith("/api/projects") ||
      key.startsWith("/api/conversations")
    );
  }
  if (Array.isArray(key) && typeof key[0] === "string") {
    return isListCacheKey(key[0]);
  }
  return false;
}

export const CACHE_CONTROL_LIST = "private, max-age=10";
