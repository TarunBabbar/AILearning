import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/auth";
import { getConfig } from "@/lib/config";

/**
 * GET /api/settings — report whether the extraction service is configured and
 * the default model id (used by the admin Upload page). Never exposes keys or
 * key sources to the client.
 */
export async function GET() {
  const { apiKey } = resolveApiKey();
  const cfg = getConfig();
  // Effective default model: CMD_MODEL in CMD mode, else OPENROUTER_MODEL.
  const llmModel = cfg.cmdApiKey ? cfg.cmdModel : cfg.llmModel;
  return NextResponse.json({
    apiKeyConfigured: apiKey.length > 0,
    llmModel,
    provider: cfg.cmdApiKey ? "cmd" : "openrouter",
    appName: cfg.appName,
  });
}
