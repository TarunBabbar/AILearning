import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWorkspace, getWorkspaceSettings, listWorkspaces, saveWorkspaceSettings } from "@/lib/db";
import { listRuns } from "@/lib/runs/store";
import {
  analyzeFlakiness,
  getQuarantined,
  quarantineCandidates,
  toggleQuarantine,
  type FlakyAnalysis,
} from "@/lib/intel/flaky";

export const runtime = "nodejs";

// GET /api/intel/flaky?workspaceId=... — flaky test analysis + quarantine state
// POST /api/intel/flaky — { workspaceId, test, enabled } toggle quarantine
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") || "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const ws = await getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const runs = await listRuns(200, workspaceId);
  const analysis: FlakyAnalysis[] = analyzeFlakiness(runs);
  const settings = await getWorkspaceSettings(workspaceId);
  const quarantined = getQuarantined(settings);
  const candidates = quarantineCandidates(analysis);

  return NextResponse.json({
    analysis,
    quarantined,
    candidates,
    // Tests that are flaky and NOT yet quarantined — auto-quarantine suggestions.
    suggestAutoQuarantine: candidates.filter((t) => !quarantined.includes(t)),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  const workspaceId = String(body?.workspaceId || "");
  const test = String(body?.test || "");
  if (!workspaceId || !test) return NextResponse.json({ error: "workspaceId and test required" }, { status: 400 });

  const owned = (await listWorkspaces(auth.user.id)).find((w) => w.id === workspaceId);
  if (!owned) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const settings = await getWorkspaceSettings(workspaceId);
  const next = toggleQuarantine(settings, test, Boolean(body.enabled));
  await saveWorkspaceSettings(workspaceId, next);
  return NextResponse.json({ ok: true, quarantined: getQuarantined(next) });
}
