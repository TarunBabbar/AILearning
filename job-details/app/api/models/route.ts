import { NextResponse } from "next/server";
import { listFreeOpenRouterModels } from "@/lib/free-models";

/**
 * GET /api/models — list models that are currently free on OpenRouter.
 */
export async function GET() {
  try {
    const models = await listFreeOpenRouterModels();
    return NextResponse.json({ models, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach OpenRouter." },
      { status: 502 }
    );
  }
}
