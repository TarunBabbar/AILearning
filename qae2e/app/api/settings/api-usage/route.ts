import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

// GET /api/settings/api-usage — which free OpenRouter model is active, whether
// an API key is configured, and rate-limit status from the provider (best-effort).

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;

  const cfg = getConfig();
  const keyConfigured = Boolean(cfg.openrouterApiKey);

  let rateLimit: { limit?: string; remaining?: string; reset?: string } | null = null;
  let rateLimitError: string | null = null;
  if (keyConfigured) {
    try {
      const base = (cfg.openrouterBaseUrl || "https://openrouter.ai/api/v1").replace(/\/$/, "");
      const res = await fetch(`${base}/auth/key`, {
        headers: { Authorization: `Bearer ${cfg.openrouterApiKey}` },
      });
      if (res.ok) {
        const j = (await res.json().catch(() => null)) as {
          data?: { label?: string; limit?: number; usage?: number; is_free_tier?: boolean };
        };
        rateLimit = {
          limit: j?.data?.label || (j?.data?.limit != null ? String(j.data.limit) : undefined),
          remaining: j?.data?.usage != null ? String(Math.max(0, (j.data.limit || 0) - j.data.usage)) : undefined,
          reset: undefined,
        };
      } else {
        rateLimitError = `OpenRouter returned HTTP ${res.status}`;
      }
    } catch (err) {
      rateLimitError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    llmModel: cfg.llmModel,
    visionModel: cfg.visionModel,
    keyConfigured,
    rateLimit,
    rateLimitError,
  });
}
