import { NextResponse } from "next/server";
import { listFreeOpenRouterModels } from "@/lib/free-models";
import { getConfig } from "@/lib/config";

/**
 * GET /api/models — list available models.
 * CMD mode: the CMD_MODEL (single entry) — OpenRouter free models are not used.
 * OpenRouter mode: models that are currently free on OpenRouter.
 */
export async function GET() {
  const cfg = getConfig();
  if (cfg.cmdApiKey) {
    return NextResponse.json({
      models: [{ id: cfg.cmdModel, name: cfg.cmdModel }],
      cached: false,
      provider: "cmd",
    });
  }
  try {
    const models = await listFreeOpenRouterModels();
    return NextResponse.json({ models, cached: false, provider: "openrouter" });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach OpenRouter." },
      { status: 502 }
    );
  }
}
