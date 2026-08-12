import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { isAdminRequest } from "@/lib/admin-auth";
import { resolveAndStoreCompanyDetails } from "@/lib/resolve-companies";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Domains per request — keeps under Vercel Hobby / Pro time limits. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 40;

/**
 * POST /api/companies/resolve
 * Body: { model?: string, limit?: number }
 *
 * Resolves company details for a **batch** of unresolved email domains
 * (default 10). Call repeatedly until `remaining` is 0. A single call that
 * tries hundreds of domains will hit FUNCTION_INVOCATION_TIMEOUT on Vercel.
 *
 * Admin-only — this spends LLM quota per domain.
 */
export async function POST(req: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      model?: string;
      limit?: number;
    };

    const { apiKey } = resolveApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "No OpenRouter API key configured. Set OPENROUTER_API_KEY in the environment.",
        },
        { status: 400 }
      );
    }

    const rawLimit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.floor(body.limit)
        : DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

    const cfg = getConfig();
    const result = await resolveAndStoreCompanyDetails(
      apiKey,
      body.model || cfg.llmModel,
      limit
    );

    return NextResponse.json({
      message: `Resolved ${result.resolved} of ${result.attempted} domain(s) this batch; ${result.remaining} remaining.`,
      companies: result.resolved,
      created: result.created,
      total: result.total,
      attempted: result.attempted,
      remaining: result.remaining,
      done: result.remaining === 0,
    });
  } catch (e) {
    console.error("[companies/resolve] error:", e);
    return NextResponse.json(
      { error: "Failed to resolve companies." },
      { status: 500 }
    );
  }
}
