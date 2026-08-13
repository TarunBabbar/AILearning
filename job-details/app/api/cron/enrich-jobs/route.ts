import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enrichIncompleteJobs } from "@/lib/enrich-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/cron/enrich-jobs
 * Background enrichment: re-runs the LLM to fill missing job fields
 * (description, location, experience, email).
 *
 * Auth: header must match non-empty CRON_SECRET from .env
 *   - Authorization: Bearer <secret>
 *   - or x-api-key: <secret>
 *
 * Callable from Vercel Cron or manually via curl. Bounded by `limit` so it
 * finishes inside the function timeout; repeat runs continue where it left off.
 */
function extractSecret(req: Request): string {
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  const auth = req.headers.get("authorization")?.trim() || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

function secretsMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const expected = (process.env.CRON_SECRET || "").trim();
    if (!expected) {
      return NextResponse.json(
        { error: "CRON_SECRET is not set — configure it to enable this endpoint." },
        { status: 503 }
      );
    }
    const provided = extractSecret(req);
    if (!provided || !secretsMatch(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const rawLimit =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.floor(body.limit)
        : 25;
    const limit = Math.min(100, Math.max(1, rawLimit));

    const result = await enrichIncompleteJobs(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron/enrich-jobs]", e);
    return NextResponse.json(
      { error: "Enrichment failed.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
