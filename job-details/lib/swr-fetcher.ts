/** Shared SWR fetcher and cache-key helpers for list pages. */

export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  // Bypass browser HTTP cache so SWR + invalidateListCaches stay correct
  // after uploads. Edge/CDN can still use Cache-Control on the response.
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return res.json() as Promise<T>;
}

/** Prefix matcher used with `mutate(key => …)` after uploads. */
export function isListCacheKey(key: unknown): boolean {
  if (typeof key === "string") {
    return (
      key.startsWith("/api/jobs") ||
      key.startsWith("/api/jobs/filters") ||
      key.startsWith("/api/contacts")
    );
  }
  if (Array.isArray(key) && typeof key[0] === "string") {
    return isListCacheKey(key[0]);
  }
  return false;
}

/** Shared session key — sidebar + contacts page + score page all read/write it. */
export const SESSION_KEY = "/api/user/me";

export const CACHE_CONTROL_LIST =
  "public, s-maxage=60, stale-while-revalidate=300";
