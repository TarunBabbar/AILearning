import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

/** GET /api/v1/webhooks/gate/{runId} — CI polls gate status. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { workspaceId } = await requireAuth();
  const { runId } = await params;
  const run = await prisma.run.findFirst({ where: { id: runId, workspaceId } });
  if (!run) return NextResponse.json({ detail: "Run not found" }, { status: 404 });
  return NextResponse.json({
    run_id: run.id,
    status: run.status,
    gate_verdict: run.gateVerdict,
  });
}
