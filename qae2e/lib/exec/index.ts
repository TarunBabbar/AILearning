// Local Docker test runner + JUnit XML parser.
// User starts Docker; "Run tests" spawns a container, runs the command,
// captures output, parses JUnit results, records executions on a cycle.

import { execFile, type ExecFileOptions } from "child_process";
import { getConfig } from "../config";
import { insertOne, getOne, updateOne, listAll } from "../store";
import type { Cycle, ExecutionStatus } from "../types";
import { jiraCreateDefect, testrailAddResult } from "../connectors/client";
import { join } from "path";

export interface RunRequest {
  requirementId: string;
  cycleId?: string;
  repoDir?: string;
  repoUrl?: string; // if provided, clone into a temp dir first
  command?: string;
  framework?: string;
  jiraProjectKey?: string;
  testrailRunId?: number;
  testrailProjectId?: string;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  summary: { passed: number; failed: number; skipped: number; total: number };
}

function hasDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("docker", ["info"], { timeout: 8000 }, (err) => resolve(!err));
  });
}

function runProcess(
  cmd: string,
  args: string[],
  opts: ExecFileOptions
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { ...opts, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        exitCode: err ? (typeof (err as { code?: unknown }).code === "number" ? ((err as { code?: number }).code as number) : 1) : 0,
      });
    });
  });
}

// --- JUnit XML parsing (handles multi-suite, errors, namespaced tags) ---

function parseJunit(xml: string): { passed: number; failed: number; skipped: number; total: number } {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Split into individual <testcase> blocks, tolerant of namespaces (junit:testcase, x:testcase).
  const re = /<(?:[a-zA-Z0-9_-]+:)?testcase\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?testcase>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const body = m[1] || "";
    // failure / error → failed; skipped / disabled → skipped; else passed
    if (/<(?:[a-zA-Z0-9_-]+:)?(failure|error)\b/.test(body)) failed++;
    else if (/<(?:[a-zA-Z0-9_-]+:)?(skipped|disabled)\b/.test(body)) skipped++;
    else passed++;
  }

  // Fallback: no testcase tags but suites with tests/failures attributes (e.g. some reporters).
  if (passed + failed + skipped === 0) {
    const suiteRe = /<(?:[a-zA-Z0-9_-]+:)?testsuite\b[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*(?:errors="(\d+)")?[^>]*skipped="(\d+)"/g;
    let sm: RegExpExecArray | null;
    while ((sm = suiteRe.exec(xml)) !== null) {
      const total = Number(sm[1]) || 0;
      const fails = Number(sm[2]) || 0;
      const skips = Number(sm[4]) || 0;
      passed += Math.max(0, total - fails - skips);
      failed += fails;
      skipped += skips;
    }
  }

  return { passed, failed, skipped, total: passed + failed + skipped };
}

// --- Main run ---

export async function runTests(req: RunRequest): Promise<RunResult> {
  const cfg = getConfig();
  const dockerAvailable = await hasDocker();
  if (!dockerAvailable) {
    return {
      ok: false,
      stdout: "",
      stderr: "Docker is not running. Start Docker Desktop, then retry.",
      exitCode: 1,
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
    };
  }

  // Clone the repo into a temp dir if a repoUrl is provided (no hardcoded paths).
  let repoDir = req.repoDir;
  if (!repoDir && req.repoUrl) {
    const base = process.env.TEMP || process.env.TMP || ".";
    repoDir = join(base, `qae2e-run-${Date.now()}`);
    const { execFileSync } = await import("child_process");
    try {
      execFileSync("git", ["clone", "--depth", "1", "--branch", cfg.githubBranch, req.repoUrl, repoDir], { stdio: "ignore" });
    } catch (err) {
      return {
        ok: false,
        stdout: "",
        stderr: `Repo clone failed: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: 1,
        summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
      };
    }
  }
  if (!repoDir) repoDir = process.cwd();

  const command = req.command || cfg.testCommand;
  const mount = process.platform === "win32" ? `${repoDir.replace(/\\/g, "/")}:/app` : `${repoDir}:/app`;

  const { stdout, stderr, exitCode } = await runProcess(
    "docker",
    ["run", "--rm", "-v", mount, "-w", "/app", cfg.dockerImage, "sh", "-c", command],
    { timeout: 0 } // no timeout — long test runs
  );

  const summary = parseJunit(stdout);

  if (req.cycleId) {
    recordOnCycle(req.cycleId, req.requirementId, summary, exitCode);
  }

  // Post-run sync to external tools (only if configured).
  await syncResults(req, summary, exitCode);

  return { ok: exitCode === 0, stdout, stderr, exitCode, summary };
}

// Push run outcomes back to Jira (defects for failures) and/or TestRail (results).
async function syncResults(req: RunRequest, summary: RunResult["summary"], exitCode: number | null) {
  const cfg = getConfig();
  const logs: string[] = [];

  // Jira: raise a defect if there are failures (requires JIRA_PROJECT_KEY).
  if (summary.failed > 0 && (req.jiraProjectKey || cfg.jiraProjectKey)) {
    const key = req.jiraProjectKey || cfg.jiraProjectKey;
    const res = await jiraCreateDefect(
      key,
      `[QAE2E] ${summary.failed} test(s) failed for requirement ${req.requirementId}`,
      `Automated run completed with exit code ${exitCode}.\nPassed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}.`
    );
    logs.push(`jira: ${res.ok ? "defect created" : `failed ${JSON.stringify(res.data).slice(0, 120)}`}`);
  }

  // TestRail: post per-category results to a run (requires TESTRAIL_RUN_ID).
  if (req.testrailRunId && req.testrailProjectId) {
    for (const [label, count, status] of [
      ["passed", summary.passed, "passed" as const],
      ["failed", summary.failed, "failed" as const],
    ] as const) {
      if (count > 0) {
        const res = await testrailAddResult(req.testrailRunId, count, status, `[QAE2E] ${label} (${count}) for ${req.requirementId}`);
        logs.push(`testrail: ${label} → ${res.ok ? "recorded" : `failed ${JSON.stringify(res.data).slice(0, 120)}`}`);
      }
    }
  }

  if (logs.length) {
    try {
      const { appendFileSync } = await import("fs");
      appendFileSync(join(process.cwd(), "data", "run-sync.log"), `[${new Date().toISOString()}] ${req.requirementId} ${logs.join(" | ")}\n`);
    } catch {
      // best effort
    }
  }
}

function recordOnCycle(cycleId: string, requirementId: string, summary: RunResult["summary"], exitCode: number | null) {
  const cycle = getOne<Cycle>("cycles", cycleId);
  if (!cycle) {
    // create a cycle if the run was requested without one
    const c: Cycle = {
      id: cycleId,
      requirementId,
      name: "Automated run",
      status: exitCode === 0 ? "completed" : "running",
      executions: [],
      createdAt: new Date().toISOString(),
    };
    insertOne("cycles", c);
    recordExecutions(c, summary, exitCode);
    return;
  }
  recordExecutions(cycle, summary, exitCode);
  cycle.status = exitCode === 0 ? "completed" : "completed";
  updateOne("cycles", cycle);
}

function recordExecutions(cycle: Cycle, summary: RunResult["summary"], exitCode: number | null) {
  const baseStatus: ExecutionStatus = exitCode === 0 ? "passed" : "failed";
  // One aggregate execution entry per run category for traceability.
  const entries = [
    { caseId: "suite-passed", caseTitle: `Passed (${summary.passed})`, status: "passed" as ExecutionStatus },
    { caseId: "suite-failed", caseTitle: `Failed (${summary.failed})`, status: "failed" as ExecutionStatus },
    { caseId: "suite-skipped", caseTitle: `Skipped (${summary.skipped})`, status: "skipped" as ExecutionStatus },
  ].filter((e) => (e.caseId === "suite-passed" ? summary.passed > 0 : e.caseId === "suite-failed" ? summary.failed > 0 : summary.skipped > 0));
  void baseStatus;
  cycle.executions = entries.map((e) => ({
    id: crypto.randomUUID(),
    caseId: e.caseId,
    caseTitle: e.caseTitle,
    status: e.status,
    evidence: `Automated run completed with exit code ${exitCode}.`,
    executedBy: "docker-runner",
    executedAt: new Date().toISOString(),
  }));
  updateOne("cycles", cycle);
}

export { hasDocker };
