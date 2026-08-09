/** Shared free OpenRouter model list (cached). */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — free pool changes often
let cache: { at: number; models: FreeModelInfo[] } | null = null;

export type FreeModelInfo = {
  id: string;
  name: string;
  context: number | null;
};

/**
 * Currently free OpenRouter model ids (prompt+completion price = 0).
 * Prefers `:free` suffix pool when any exist (more reliable for free tier).
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
  const free = (tagged.length ? tagged : zeroPrice).sort((a, b) =>
    a.id.localeCompare(b.id)
  );

  cache = { at: Date.now(), models: free };
  return free;
}

export async function listFreeOpenRouterModelIds(): Promise<string[]> {
  const models = await listFreeOpenRouterModels();
  return models.map((m) => m.id);
}
