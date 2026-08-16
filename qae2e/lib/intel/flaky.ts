// Flaky test detection: track pass/fail history per test across runs and
// compute a flakiness ratio. Tests that alternate between pass and fail are
// flagged as flaky and can be auto-quarantined (excluded from future runs via
// --grep-invert, stored in workspace_settings).

import type { RunRecord } from "../runs/store";

export interface FlakyAnalysis {
  test: string;
  runs: number; // number of runs this test appeared in
  passed: number;
  failed: number;
  skipped: number;
  ratio: number; // failed / (passed + failed), 0 when no executed runs
  flaky: boolean; // ratio > threshold && runs >= minRuns
}

const FLAKY_RATIO = 0.3; // >30% failure rate across ≥3 runs = flaky
const MIN_RUNS = 3;

/** Aggregate per-test history across runs that carried per-test results. */
export function analyzeFlakiness(runs: RunRecord[]): FlakyAnalysis[] {
  const byTest = new Map<
    string,
    { passed: number; failed: number; skipped: number; runs: number }
  >();

  for (const run of runs) {
    const results = run.testRun?.results;
    if (!results?.length) continue;
    // De-dupe identical test names within one run (parallel projects).
    const seen = new Set<string>();
    for (const r of results) {
      if (seen.has(r.test)) continue;
      seen.add(r.test);
      const entry = byTest.get(r.test) || { passed: 0, failed: 0, skipped: 0, runs: 0 };
      entry.runs += 1;
      if (r.status === "passed") entry.passed += 1;
      else if (r.status === "failed" || r.status === "timedOut" || r.status === "interrupted") entry.failed += 1;
      else entry.skipped += 1;
      byTest.set(r.test, entry);
    }
  }

  const out: FlakyAnalysis[] = [];
  for (const [test, s] of byTest) {
    const executed = s.passed + s.failed;
    const ratio = executed > 0 ? s.failed / executed : 0;
    out.push({
      test,
      runs: s.runs,
      passed: s.passed,
      failed: s.failed,
      skipped: s.skipped,
      ratio: Math.round(ratio * 100) / 100,
      flaky: s.runs >= MIN_RUNS && ratio > FLAKY_RATIO,
    });
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}

/** Names of tests currently quarantined for a workspace. */
export function getQuarantined(settings: Record<string, unknown>): string[] {
  const q = settings.flakyQuarantine;
  return Array.isArray(q) ? (q as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

/** Tests that are flaky per analysis AND not already quarantined — candidates. */
export function quarantineCandidates(analysis: FlakyAnalysis[]): string[] {
  return analysis.filter((a) => a.flaky).map((a) => a.test);
}

/** Playwright --grep-invert filter from a quarantined test list (or undefined). */
export function grepInvertFor(quarantined: string[]): string | undefined {
  if (!quarantined.length) return undefined;
  // Escape regex chars; each test title is a full path "Suite › spec".
  const parts = quarantined.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return parts.map((p) => `(?=.*${p})`).join("|");
}

/** Update the quarantine list in workspace settings (add/remove one test). */
export function toggleQuarantine(
  settings: Record<string, unknown>,
  test: string,
  enabled: boolean
): Record<string, unknown> {
  const current = getQuarantined(settings);
  const next = enabled
    ? Array.from(new Set([...current, test]))
    : current.filter((t) => t !== test);
  return { ...settings, flakyQuarantine: next };
}
