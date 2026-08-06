import { NextResponse } from "next/server";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let cache: { at: number; models: ModelInfo[] } | null = null;

export type ModelInfo = {
  id: string;
  name: string;
  context: number | null;
};

/**
 * GET /api/models — list models that are currently free on OpenRouter.
 * Fetches from the OpenRouter models endpoint and caches for 6 hours.
 */
export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.models, cached: true });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: CACHE_TTL_MS },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models from OpenRouter." },
        { status: 502 }
      );
    }
    const data = await res.json();
    const all: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }[] =
      data.data || [];

    const models: ModelInfo[] = all
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
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    cache = { at: Date.now(), models };
    return NextResponse.json({ models, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach OpenRouter." },
      { status: 502 }
    );
  }
}
