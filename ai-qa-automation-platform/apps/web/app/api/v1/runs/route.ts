import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { createRun, executeRun } from "@/lib/exec/orchestrator";

export async function POST(req: NextRequest) {
  const { workspaceId } = await requireAuth();
  const body = await req.json();
  const { trigger = "manual" } = body as { trigger?: string };

  const run = await createRun(workspaceId, trigger);
  const summary = await executeRun(run.id);

  return NextResponse.json({
    id: run.id,
    trigger: run.trigger,
    status: summary.gate.verdict === "pass" ? "passed" : "blocked",
    gate_verdict: summary.gate.verdict,
    created_at: run.createdAt.toISOString(),
    passed: summary.passed,
    failed: summary.failed,
    total: summary.total,
  });
}

export async function GET() {
  const { workspaceId } = await requireAuth();
  const runs = await prisma.run.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  });
  return NextResponse.json(
    runs.map((r) => ({
      id: r.id,
      trigger: r.trigger,
      status: r.status,
      gate_verdict: r.gateVerdict,
      created_at: r.createdAt.toISOString(),
      passed: r.results.filter((x) => x.status === "passed").length,
      failed: r.results.filter((x) => x.status !== "passed").length,
      total: r.results.length,
    }))
  );
}
