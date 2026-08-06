import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/auth";
import { getConfig } from "@/lib/config";

/**
 * GET /api/settings — report whether an API key is configured (env-only).
 */
export async function GET() {
  const { apiKey, source } = resolveApiKey();
  const cfg = getConfig();
  return NextResponse.json({
    apiKeyConfigured: apiKey.length > 0,
    apiKeySource: source,
    llmModel: cfg.llmModel,
    llmModels: cfg.llmModels,
    appName: cfg.appName,
  });
}
