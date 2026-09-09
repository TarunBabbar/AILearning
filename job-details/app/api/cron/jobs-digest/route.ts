import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runArchitectDigest } from "@/lib/jobs-digest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET/POST /api/cron/jobs-digest
 * Mon-Fri 9 PM IST (Vercel cron "30 15 * * 1-5"): emails today's QA / Test /
 * Automation architect jobs to DIGEST_TO_EMAIL. On days with no matches it
 * sends a short "no architect jobs today" confirmation instead.
 *
 * Vercel Cron fires a GET request; POST is supported for manual curl runs.
 *
 * Auth: header must match non-empty CRON_SECRET from .env
 *   - Authorization: Bearer <secret>
 *   - or x-api-key: <secret>
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

async function handle(req: Request) {
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

    const result = await runArchitectDigest();
    if (!result.ok && result.error?.includes("DIGEST_TO_EMAIL")) {
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (e) {
    console.error("[cron/jobs-digest]", e);
    return NextResponse.json(
      { error: "Architect digest failed.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
