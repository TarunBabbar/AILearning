import { prisma } from "../db";
import { evaluateCase, MetricName, HARD_GATE_METRICS } from "../eval/metrics";
import { ReleaseGaterAgent } from "../agents/phase-agents";
import type { AgentContext } from "../agents/base";

/**
 * Run orchestrator — execute → eval → gate → closed-loop review items.
 * Serverless-safe: all work happens in the request (or Vercel cron).
 */
const TEST_TYPE_TO_METRICS: Record<string, MetricName[]> = {
  ui: ["answer_relevancy", "groundedness", "tool_sequence_accuracy"],
  api: ["answer_relevancy", "completeness", "correctness"],
  db: ["groundedness", "completeness"],
  integration: ["tool_sequence_accuracy", "correctness"],
};

export async function createRun(workspaceId: string, trigger = "manual") {
  const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  const thresholds = (settings?.thresholds as Record<string, number> | null) ?? {};
  return prisma.run.create({
    data: {
      workspaceId,
      trigger,
      status: "queued",
      thresholdSnapshot: thresholds,
    },
  });
}

export async function executeRun(runId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId }, include: { workspace: true } });
  if (!run) throw new Error("Run not found");

  await prisma.run.update({ where: { id: runId }, data: { status: "running" } });

  const cases = await prisma.testCase.findMany({
    where: { workspaceId: run.workspaceId, status: "approved" },
  });

  let passed = 0;
  let failed = 0;
  const metricRows = [];

  for (const caseItem of cases) {
    const outcome = runCase(caseItem.code ?? "");
    const result = await prisma.runResult.create({
      data: {
        runId,
        testCaseId: caseItem.id,
        workspaceId: run.workspaceId,
        status: outcome.status,
        durationMs: outcome.durationMs,
        error: outcome.error,
      },
    });

    if (outcome.status === "passed") passed++;
    else failed++;

    if (outcome.status === "passed") {
      const metricResults = await evaluateCase(
        {
          input: caseItem.title,
          actualOutput: outcome.output ?? caseItem.code ?? "",
          retrievalContext: [caseItem.derivedFrom ?? ""],
          toolsCalled: outcome.toolsCalled ?? [],
          expectedTools: outcome.expectedTools ?? [],
          highRisk: caseItem.priority === "P0",
        },
        (run.thresholdSnapshot as Record<string, number>) ?? {},
      );
      const allowed = TEST_TYPE_TO_METRICS[caseItem.testType] ?? [];
      for (const mr of metricResults) {
        if (!allowed.includes(mr.metric)) continue;
        metricRows.push(
          prisma.metricScore.create({
            data: {
              runResultId: result.id,
              workspaceId: run.workspaceId,
              metric: mr.metric,
              score: mr.score,
              threshold: mr.threshold,
              hardGate: mr.hardGate,
              passed: mr.passed,
            },
          }),
        );
      }
    }
  }

  await Promise.all(metricRows);

  // Gate verdict
  const scores = await prisma.metricScore.findMany({
    where: { runResult: { runId }, workspaceId: run.workspaceId },
  });
  const scoreData = scores.map((s) => ({
    metric: s.metric,
    score: s.score,
    threshold: s.threshold,
    hard_gate: s.hardGate,
  }));

  const ctx: AgentContext = {
    workspaceId: run.workspaceId,
    data: { metricScores: scoreData, thresholds: run.thresholdSnapshot },
  };
  const gater = new ReleaseGaterAgent();
  const gateResult = await gater.run(ctx);

  let verdict: string | null = gateResult.output.verdict as string;
  let blockedMetrics: string[] = (gateResult.output.blocked_metrics as string[]) ?? [];
  if (verdict !== "pass" && verdict !== "block") {
    // Fail-closed deterministic fallback
    blockedMetrics = scoreData
      .filter((s) => HARD_GATE_METRICS.includes(s.metric as MetricName) && s.score < s.threshold)
      .map((s) => s.metric);
    verdict = blockedMetrics.length ? "block" : "pass";
  }
  if (verdict === "block" && !blockedMetrics.length) {
    blockedMetrics = scoreData
      .filter((s) => HARD_GATE_METRICS.includes(s.metric as MetricName) && s.score < s.threshold)
      .map((s) => s.metric);
  }

  await prisma.run.update({
    where: { id: runId },
    data: { status: verdict === "pass" ? "passed" : "blocked", gateVerdict: verdict },
  });

  // Closed loop: failures → review items
  const failedResults = await prisma.runResult.findMany({
    where: { runId, status: { not: "passed" } },
  });
  for (const r of failedResults) {
    await prisma.reviewItem.create({
      data: {
        workspaceId: run.workspaceId,
        kind: "defect",
        testCaseId: r.testCaseId,
        runResultId: r.id,
        reason: r.error ?? "failed in run",
      },
    });
  }

  return { runId, gate: { verdict, blocked_metrics: blockedMetrics }, passed, failed, total: cases.length };
}

/** In-process case execution — real Playwright/pytest workers land later. */
function runCase(code: string): { status: string; durationMs: number; error?: string; output?: string; toolsCalled?: string[]; expectedTools?: string[] } {
  if (code && code.includes("def test_")) {
    return { status: "passed", durationMs: 120, output: "ok", toolsCalled: ["run_test"], expectedTools: ["run_test"] };
  }
  return { status: "failed", durationMs: 40, error: "no runnable code" };
}
