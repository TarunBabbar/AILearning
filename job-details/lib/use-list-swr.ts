"use client";

import useSWR, { mutate } from "swr";
import { isListCacheKey, swrFetcher } from "@/lib/swr-fetcher";

// Cache TTL for list pages (jobs, matches, contacts). 30 min — job data
// changes slowly, so a longer cache makes tab switches and revisits feel
// instant while the background refresh keeps it reasonably fresh.
const TTL_MS = 30 * 60 * 1000;

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

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cached JSON fetch for user-scoped lists (e.g. /api/user/matches) with
 * stale-while-revalidate semantics:
 * - If a cached value exists (even if older than TTL), return it IMMEDIATELY
 *   and revalidate in the background — so tab switches never block on the DB.
 * - Only when there's no cache at all do we wait for the network round-trip.
 */
export async function cachedListFetch<T>(url: string): Promise<T> {
  const cached = userListCache.get(url);

  // Cache present → return it right away, refresh in background if stale.
  if (cached) {
    if (Date.now() - cached.at < TTL_MS) {
      return cached.data as T;
    }
    // Stale — return old data now, then revalidate.
    void revalidate(url).catch(() => {});
    return cached.data as T;
  }

  // No cache → fetch (dedupe concurrent calls for the same URL).
  const pending = inFlight.get(url);
  if (pending) return pending as Promise<T>;
  const p = fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      return res.json();
    })
    .then((data) => {
      userListCache.set(url, { at: Date.now(), data });
      inFlight.delete(url);
      return data;
    })
    .catch((e) => {
      inFlight.delete(url);
      throw e;
    });
  inFlight.set(url, p);
  return p as Promise<T>;
}

async function revalidate(url: string): Promise<void> {
  const pending = inFlight.get(url);
  if (pending) return;
  const p = fetch(url, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      return res.json();
    })
    .then((data) => {
      userListCache.set(url, { at: Date.now(), data });
      inFlight.delete(url);
    })
    .catch((e) => {
      inFlight.delete(url);
      throw e;
    });
  inFlight.set(url, p);
  await p;
}

/** Clear the user-scoped list cache (call after scoring / resume changes). */
export function invalidateUserListCache() {
  userListCache.clear();
}
