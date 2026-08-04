import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { createWorkspace, listWorkspaces, listRuns } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/workspaces — current user's workspaces with run stats
export async function GET() {
  const auth = await requireUser(NextRequest as unknown as NextRequest);
  if (!auth.user) return auth.response;
  const workspaces = await listWorkspaces(auth.user.id);

  const withStats = await Promise.all(
    workspaces.map(async (w) => {
      const runs = await listRuns(w.id, 1);
      const run = (runs[0] as { startedAt?: string; status?: string } | undefined) || undefined;
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        createdAt: w.createdAt,
        runCount: (await listRuns(w.id, 200)).length,
        lastRunAt: run?.startedAt,
        lastRunStatus: run?.status,
      };
    })
  );

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
