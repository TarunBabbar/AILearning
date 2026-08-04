import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWorkspace, listRuns } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/workspaces/[id] — one workspace + its run history
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;

  const { id } = await ctx.params;
  const ws = await getWorkspace(id);
  if (!ws || ws.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const runs = await listRuns(id, 200);
  return NextResponse.json({ workspace: { id: ws.id, name: ws.name }, runs });
}
