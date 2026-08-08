import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { resolveAndStoreCompanyDetails } from "@/lib/resolve-companies";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/companies/resolve
 * Body: { model?: string }
 * Resolves company details (name, type, description, location, website) for
 * email domains found on jobs, stores them in the Company table, and links
 * jobs → companyInfo. Can be re-run safely: existing fields are preserved and
 * only missing ones are backfilled.
 */
export async function POST(req: Request) {
  try {
    const { model } = (await req.json()) as { model?: string };

    const { apiKey } = resolveApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key configured. Set OPENROUTER_API_KEY in the environment." },
        { status: 400 }
      );
    }

    const cfg = getConfig();
    const { resolved, created, total } = await resolveAndStoreCompanyDetails(
      apiKey,
      model || cfg.llmModel
    );

    return NextResponse.json({
      message: `Resolved ${resolved} company domain(s), created ${created} new.`,
      companies: resolved,
      created,
      total,
    });
  } catch (e) {
    console.error("[companies/resolve] error:", e);
    return NextResponse.json({ error: "Failed to resolve companies." }, { status: 500 });
  }
}
