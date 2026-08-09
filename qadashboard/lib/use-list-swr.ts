"use client";

import useSWR, { mutate } from "swr";
import { isListCacheKey, swrFetcher } from "./swr-fetcher";

const TTL_MS = 5 * 60 * 1000;

/** Module-level timestamps so TTL survives page remounts within the SPA. */
const lastFetchAt = new Map<string, number>();

function markFetched(key: string) {
  lastFetchAt.set(key, Date.now());
}

function isFresh(key: string): boolean {
  const at = lastFetchAt.get(key);
  if (at == null) return false;
  return Date.now() - at < TTL_MS;
}

/**
 * SWR wrapper for list pages.
 * Within TTL (~5 min), remounting a tab uses memory cache with no network/DB hit.
 * A key is only "fresh" after a SUCCESSFUL fetch with data — errors never mark
 * it fresh, so a transient failure is retried on the next mount.
 * Mutations call `invalidateListCaches()` to force a refresh.
 */
export function useListSWR<T>(key: string | null) {
  const fresh = key ? isFresh(key) : false;

  return useSWR<T>(key, swrFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: !fresh,
    // Fetch on mount only when there's no fresh cached data yet.
    revalidateOnMount: key ? !isFresh(key) : false,
    keepPreviousData: true,
    dedupingInterval: 2000,
    onSuccess: (data) => {
      if (key && data != null && (Array.isArray(data) ? data.length : true)) markFetched(key);
    },
    onError: () => {
      if (key) lastFetchAt.delete(key);
    },
  });
}

/** Clear list caches after upload / delete / status change so next visit refetches. */
export async function invalidateListCaches() {
  for (const k of [...lastFetchAt.keys()]) {
    if (isListCacheKey(k)) lastFetchAt.delete(k);
  }
  await mutate(isListCacheKey, undefined, { revalidate: true });
}
