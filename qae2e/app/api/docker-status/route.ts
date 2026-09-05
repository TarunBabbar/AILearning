import { NextRequest } from "next/server";
import { dockerInstalled, hasDocker } from "@/lib/exec";

export const runtime = "nodejs";

// Cache the probe briefly — checking docker on every request is wasteful and
// docker state rarely changes mid-session.
let cached: { at: number; available: boolean } = { at: 0, available: false };
const TTL = 5000;

/**
 * GET /api/docker-status → { available: boolean }
 * True when this server can actually run Docker containers (i.e. the app is
 * running on a machine with a live Docker daemon — typically localhost). On
 * Vercel / any serverless host this is false, so the UI hides the
 * "Run on Docker" option and the pipeline reports "not executed".
 */
export async function GET(_req: NextRequest) {
  const age = Date.now() - cached.at;
  if (age < TTL) {
    return Response.json({ available: cached.available });
  }
  let available = false;
  try {
    available = (await dockerInstalled()) && (await hasDocker());
  } catch {
    available = false;
  }
  cached = { at: Date.now(), available };
  return Response.json({ available });
}
