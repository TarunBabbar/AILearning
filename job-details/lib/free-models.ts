/** Shared free OpenRouter model list (cached). */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — free pool changes often
let cache: { at: number; models: FreeModelInfo[] } | null = null;

export type FreeModelInfo = {
  id: string;
  name: string;
  context: number | null;
};

/**
 * Order free models so fast/small ones come first — parallel work pools
 * start at index 0, so a speed-first order spreads the load sensibly:
 *   1. `:free`-tagged models beat `$0` (non-tagged) — the free pool is the
 *      intended tier and is more reliable for zero-cost usage.
 *   2. Smaller context window first — fewer tokens to generate, faster.
 *   3. Stable id sort as tiebreaker so ordering is deterministic.
 */
function speedFirst(a: FreeModelInfo, b: FreeModelInfo): number {
  const aTagged = a.id.includes(":free") ? 1 : 0;
  const bTagged = b.id.includes(":free") ? 1 : 0;
  if (aTagged !== bTagged) return bTagged - aTagged;
  const aCtx = a.context ?? Infinity;
  const bCtx = b.context ?? Infinity;
  if (aCtx !== bCtx) return aCtx - bCtx;
  return a.id.localeCompare(b.id);
}

/**
 * Currently free OpenRouter model ids (prompt+completion price = 0).
 * Prefers `:free` suffix pool when any exist (more reliable for free tier).
 * Cached in-memory for 15 minutes; call `clearFreeModelsCache` to force
 * a refresh mid-process.
 */
export async function listFreeOpenRouterModels(): Promise<FreeModelInfo[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.models;
  }

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    next: { revalidate: CACHE_TTL_MS / 1000 },
  });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);

  const data = await res.json();
  const all: {
    id: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
  }[] = data.data || [];

  const zeroPrice = all
    .filter(
      (m) =>
        m.id &&
        parseFloat(m.pricing?.prompt || "0") === 0 &&
        parseFloat(m.pricing?.completion || "0") === 0
    )
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      context: m.context_length || null,
    }));

  const tagged = zeroPrice.filter((m) => m.id.includes(":free"));
  const free = (tagged.length ? tagged : zeroPrice).sort(speedFirst);

  cache = { at: Date.now(), models: free };
  return free;
}

export async function listFreeOpenRouterModelIds(): Promise<string[]> {
  const models = await listFreeOpenRouterModels();
  return models.map((m) => m.id);
}

/** Drop the cached list so the next call refetches from OpenRouter. */
export function clearFreeModelsCache(): void {
  cache = null;
}
