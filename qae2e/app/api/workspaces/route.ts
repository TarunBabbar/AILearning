import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createWorkspace, deleteWorkspace, getWorkspace, listWorkspaces } from "@/lib/db";
import { runStatsForWorkspaces } from "@/lib/runs/store";

export const runtime = "nodejs";

// GET /api/workspaces — current user's workspaces with run stats
export async function GET() {
  const auth = await requireUser(NextRequest as unknown as NextRequest);
  if (!auth.user) return auth.response;
  const workspaces = await listWorkspaces(auth.user.id);

  // Single query for run counts + latest run across all workspaces (no N+1).
  const stats = await runStatsForWorkspaces(workspaces.map((w) => w.id));

  const withStats = workspaces.map((w) => {
    const s = stats.get(w.id);
    const run = s?.lastRun as { startedAt?: string; status?: string } | undefined;
    return {
      id: w.id,
      name: w.name,
      description: w.description,
      createdAt: w.createdAt,
      runCount: s?.count || 0,
      lastRunAt: run?.startedAt,
      lastRunStatus: run?.status,
    };
  });

  return NextResponse.json({ workspaces: withStats });
}

// POST /api/workspaces — create a workspace
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const res = await createWorkspace({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    name,
    description: body?.description ? String(body.description) : undefined,
  });
  if (res === "duplicate") {
    return NextResponse.json({ error: "A workspace with that name already exists" }, { status: 409 });
  }
  if (res === "error") {
    return NextResponse.json({ error: "Could not create workspace" }, { status: 500 });
  }
  const workspaces = await listWorkspaces(auth.user.id);
  return NextResponse.json({ ok: true, workspaces });
}

// DELETE /api/workspaces?id=... — delete a workspace and ALL its data
// (artifacts, run history, settings, members). Owner-only.
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const sp = new URL(req.url).searchParams;
  const id = sp.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ws = await getWorkspace(id);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (ws.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "You don't own this workspace" }, { status: 403 });
  }

  await deleteWorkspace(id);
  const workspaces = await listWorkspaces(auth.user.id);
  return NextResponse.json({ ok: true, workspaces });
}
