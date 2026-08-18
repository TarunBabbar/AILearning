import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { workspaceId } = await requireAuth();
  const { runId } = await params;
  const run = await prisma.run.findFirst({ where: { id: runId, workspaceId } });
  if (!run) return NextResponse.json({ detail: "Run not found" }, { status: 404 });

  const metrics = await prisma.metricScore.findMany({
    where: { runResult: { runId } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    metrics.map((m) => ({
      metric: m.metric,
      score: m.score,
      threshold: m.threshold,
      hard_gate: m.hardGate,
      passed: m.passed,
    }))
  );
}
