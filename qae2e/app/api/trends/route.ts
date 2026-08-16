import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWorkspace, listArtifacts } from "@/lib/db";
import { listRuns } from "@/lib/runs/store";
import { analyzeFlakiness, getQuarantined, type FlakyAnalysis } from "@/lib/intel/flaky";

export const runtime = "nodejs";

// GET /api/trends?workspaceId=... — time series for release confidence, pass
// rate, coverage %, plus flaky-test analysis and recent release reports.

interface ReleasePoint {
  date: string; // YYYY-MM-DD
  confidence: number;
  coveragePercent: number;
  passRate: number;
  openDefects: number;
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.user) return auth.response;
  const workspaceId = new URL(req.url).searchParams.get("workspaceId") || "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  const ws = await getWorkspace(workspaceId);
  if (!ws || ws.ownerId !== auth.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Runs: time series of test pass rate + run status.
  const runs = await listRuns(200, workspaceId);
  const runSeries = runs
    .filter((r) => r.testRun?.total)
    .map((r) => ({
      date: (r.startedAt || r.finishedAt || "").slice(0, 10),
      id: r.id,
      title: r.title,
      status: r.status,
      passed: r.testRun!.passed,
      failed: r.testRun!.failed,
      skipped: r.testRun!.skipped,
      total: r.testRun!.total,
      passRate: Math.round((r.testRun!.passed / r.testRun!.total) * 100),
    }));

  // Releases: confidence / coverage / pass-rate over time.
  const releases = await listArtifacts<ReleasePoint & { createdAt: string; requirementId: string }>("releases", workspaceId);
  const releaseSeries = releases.map((r) => ({
    date: (r.createdAt || "").slice(0, 10),
    requirementId: r.requirementId,
    confidence: r.confidence,
    coveragePercent: r.coveragePercent,
    passRate: r.passRate,
    openDefects: r.openDefects,
  }));

  // Flaky analysis from per-test results.
  const flaky: FlakyAnalysis[] = analyzeFlakiness(runs);
  const { getWorkspaceSettings } = await import("@/lib/db");
  const settings = await getWorkspaceSettings(workspaceId);
  const quarantined = getQuarantined(settings);

  return NextResponse.json({
    runSeries,
    releaseSeries,
    flaky,
    quarantined,
    totals: {
      runs: runs.length,
      releases: releases.length,
      flakyTests: flaky.filter((f) => f.flaky).length,
    },
  });
}
