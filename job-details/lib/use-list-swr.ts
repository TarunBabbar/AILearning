"use client";

import useSWR, { mutate } from "swr";
import { isListCacheKey, swrFetcher } from "@/lib/swr-fetcher";

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
 * SWR wrapper for Jobs / Browse / Contacts lists.
 * Within TTL (~5 min), remounting a tab uses memory cache with no network/DB hit.
 * Upload calls `invalidateListCaches()` to force a refresh.
 */
export function useListSWR<T>(key: string | null) {
  const fresh = key ? isFresh(key) : false;

  return useSWR<T>(key, swrFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: !fresh,
    revalidateOnMount: !fresh,
    keepPreviousData: true,
    dedupingInterval: 2000,
    onSuccess: () => {
      if (key) markFetched(key);
    },
  });
}

/** Clear list caches after upload / delete so next visit refetches. */
export async function invalidateListCaches() {
  for (const k of [...lastFetchAt.keys()]) {
    if (isListCacheKey(k)) lastFetchAt.delete(k);
  }
  await mutate(isListCacheKey, undefined, { revalidate: true });
}

/**
 * Cached JSON fetch for user-scoped lists (e.g. /api/user/matches).
 * Within TTL (~5 min) repeated calls with the same URL reuse the in-memory
 * result instead of hitting the DB — so tab switches on Match by Resume are
 * as fast as the QA Jobs page. Call `invalidateUserListCache()` after scoring
 * completes to force a fresh fetch.
 */
const userListCache = new Map<string, { at: number; data: unknown }>();

export async function cachedListFetch<T>(url: string): Promise<T> {
  const cached = userListCache.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.data as T;
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  const data = (await res.json()) as T;
  userListCache.set(url, { at: Date.now(), data });
  return data;
}

/** Clear the user-scoped list cache (call after scoring / resume changes). */
export function invalidateUserListCache() {
  userListCache.clear();
}
