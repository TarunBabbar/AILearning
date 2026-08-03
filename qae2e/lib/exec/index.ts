// Local Docker test runner for Playwright + TypeScript UI tests.
// Parses Playwright JSON reporter output (no JUnit / Java).
//
// Before running, the container gets a "preflight" command that checks for the
// toolchain (node / npm), installs npm dependencies when needed, installs the
// Chromium browser when missing, and pulls the configured Docker image first if
// it is not already present locally.

import { execFile, type ExecFileOptions } from "child_process";
import { getConfig } from "../config";
import { insertOne, getOne, updateOne } from "../store";
import type { Cycle, ExecutionStatus } from "../types";
import { jiraCreateDefect, testrailAddResult } from "../connectors/client";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export interface RunRequest {
  requirementId: string;
  cycleId?: string;
  repoDir?: string;
  repoUrl?: string;
  command?: string;
  framework?: string;
  jiraProjectKey?: string;
  testrailRunId?: number;
  testrailProjectId?: string;
}

export interface RunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  summary: RunSummary;
  failures?: Array<{ test: string; message: string }>;
}

export interface DetailedFailure {
  test: string;
  message: string;
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

/**
 * Command that runs INSIDE the container before the test command. It verifies
 * the toolchain (node / npm / npx), installs npm dependencies when a
 * package.json is present and node_modules is missing, and installs the
 * Playwright Chromium browser when it is not already available (the official
 * `mcr.microsoft.com/playwright` images already ship browsers under
 * /ms-playwright, so this is a no-op there and only matters on generic
 * node-based images).
 */
export const PREFLIGHT_COMMAND = [
  "node -v",
  "npm -v",
  "if [ -f package.json ] && [ ! -d node_modules ]; then echo '[preflight] installing npm dependencies…'; npm install --no-audit --no-fund; fi",
  "if ! [ -d /ms-playwright ] || ! ls /ms-playwright/chromium* >/dev/null 2>&1; then echo '[preflight] installing playwright chromium…'; npx --yes playwright@1.51.0 install chromium; fi",
].join(" && ");

/**
 * True when the Docker image is already present locally. Uses `docker image
 * inspect` (never triggers a pull by itself).
 */
function hasImageLocally(image: string): Promise<boolean> {
  return runProcess("docker", ["image", "inspect", image], { timeout: 15000 }).then(
    (r) => r.exitCode === 0
  );
}

/**
 * Ensure the configured image is present locally; pull it when missing.
 * `docker run` pulls implicitly, but doing it explicitly first gives the user
 * a clear "pulling image…" status instead of a cryptic error deep inside the
 * container run.
 */
async function ensureImage(image: string): Promise<{ ok: boolean; message?: string }> {
  if (await hasImageLocally(image)) return { ok: true };
  const res = await runProcess("docker", ["pull", image], { timeout: 0 });
  return res.exitCode === 0
    ? { ok: true }
    : { ok: false, message: (res.stderr || res.stdout).trim().slice(0, 800) };
}

/** Parse Playwright JSON reporter file (test-results/results.json). */
export function parsePlaywrightJson(raw: string): {
  summary: RunSummary;
  failures: DetailedFailure[];
} {
  const failures: DetailedFailure[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const data = JSON.parse(raw) as {
      suites?: unknown[];
      stats?: { expected?: number; unexpected?: number; skipped?: number; flaky?: number };
    };

    if (data.stats) {
      passed = Number(data.stats.expected || 0);
      failed = Number(data.stats.unexpected || 0);
      skipped = Number(data.stats.skipped || 0);
    }

    const walk = (suites: unknown[], titlePrefix = "") => {
      for (const s of suites) {
        const suite = s as {
          title?: string;
          suites?: unknown[];
          specs?: Array<{
            title?: string;
            tests?: Array<{
              status?: string;
              results?: Array<{ status?: string; error?: { message?: string } }>;
              projectName?: string;
            }>;
          }>;
        };
        const nextPrefix = [titlePrefix, suite.title].filter(Boolean).join(" › ");
        if (suite.suites?.length) walk(suite.suites, nextPrefix);
        for (const spec of suite.specs || []) {
          for (const t of spec.tests || []) {
            const status = t.results?.[0]?.status || t.status || "";
            const name = [nextPrefix, spec.title, t.projectName].filter(Boolean).join(" › ");
            if (status === "skipped" || status === "pending") {
              // counted via stats when present
            } else if (status === "failed" || status === "timedOut" || status === "interrupted") {
              failures.push({
                test: name || "unknown",
                message: (t.results?.[0]?.error?.message || status).slice(0, 600),
              });
            }
          }
        }
      }
    };
    if (Array.isArray(data.suites)) walk(data.suites);

    // If stats missing, derive from failures + walk counts
    if (!data.stats) {
      failed = failures.length;
      // rough total from specs
      let totalSpecs = 0;
      const countSpecs = (suites: unknown[]) => {
        for (const s of suites) {
          const suite = s as { suites?: unknown[]; specs?: unknown[] };
          totalSpecs += suite.specs?.length || 0;
          if (suite.suites) countSpecs(suite.suites);
        }
      };
      if (Array.isArray(data.suites)) countSpecs(data.suites);
      passed = Math.max(0, totalSpecs - failed - skipped);
    }
  } catch {
    // fall through empty
  }

  return {
    summary: { passed, failed, skipped, total: passed + failed + skipped },
    failures,
  };
}

/** Fallback: scrape Playwright list reporter lines from stdout. */
export function parsePlaywrightList(stdout: string): RunSummary {
  // e.g. "  3 passed (12.3s)" or "  2 failed" / "  1 skipped"
  const passed = Number(stdout.match(/(\d+)\s+passed/i)?.[1] || 0);
  const failed = Number(stdout.match(/(\d+)\s+failed/i)?.[1] || 0);
  const skipped = Number(stdout.match(/(\d+)\s+skipped/i)?.[1] || 0);
  return { passed, failed, skipped, total: passed + failed + skipped };
}

function readResultsJson(repoDir: string): string | null {
  const candidates = [
    join(repoDir, "test-results", "results.json"),
    join(repoDir, "results.json"),
    join(repoDir, "playwright-report", "results.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return readFileSync(p, "utf-8");
      } catch {
        // continue
      }
    }
  }
  return null;
}

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
      failures: [],
    };
  }

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
        failures: [],
      };
    }
  }
  if (!repoDir) repoDir = process.cwd();

  const command = req.command || cfg.testCommand;
  const mount = process.platform === "win32" ? `${repoDir.replace(/\\/g, "/")}:/app` : `${repoDir}:/app`;

  // 1) Make sure the image exists locally — pull it first when missing so the
  //    user sees a clear "pulling image…" instead of a cryptic run error.
  const image = await ensureImage(cfg.dockerImage);
  if (!image.ok) {
    return {
      ok: false,
      stdout: "",
      stderr: `Docker image "${cfg.dockerImage}" is not available locally and could not be pulled: ${image.message || "unknown error"}. Check your network connection, then retry.`,
      exitCode: 1,
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
      failures: [],
    };
  }

  // 2) Preflight inside the container: verify node/npm, install npm
  //    dependencies when needed, install the Chromium browser when missing.
  const preflight = await runProcess(
    "docker",
    ["run", "--rm", "-v", mount, "-w", "/app", cfg.dockerImage, "sh", "-c", PREFLIGHT_COMMAND],
    { timeout: 0 }
  );
  if (preflight.exitCode !== 0) {
    return {
      ok: false,
      stdout: preflight.stdout,
      stderr: `Container preflight failed (missing node/npm, npm install, or Playwright Chromium install). ${preflight.stderr || preflight.stdout}`.slice(0, 2000),
      exitCode: preflight.exitCode,
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
      failures: [],
    };
  }

  // 3) Run the actual test command.
  const { stdout, stderr, exitCode } = await runProcess(
    "docker",
    ["run", "--rm", "-v", mount, "-w", "/app", cfg.dockerImage, "sh", "-c", command],
    { timeout: 0 }
  );

  let summary: RunSummary = { passed: 0, failed: 0, skipped: 0, total: 0 };
  let failures: DetailedFailure[] = [];

  const jsonRaw = readResultsJson(repoDir);
  if (jsonRaw) {
    const parsed = parsePlaywrightJson(jsonRaw);
    summary = parsed.summary;
    failures = parsed.failures;
  } else {
    summary = parsePlaywrightList(stdout + "\n" + stderr);
  }

  if (req.cycleId) {
    recordOnCycle(req.cycleId, req.requirementId, summary, exitCode);
  }

  await syncResults(req, summary, exitCode);

  return {
    ok: exitCode === 0 && summary.failed === 0,
    stdout,
    stderr,
    exitCode,
    summary,
    failures,
  };
}

async function syncResults(req: RunRequest, summary: RunSummary, exitCode: number | null) {
  const cfg = getConfig();
  const logs: string[] = [];

  if (summary.failed > 0 && (req.jiraProjectKey || cfg.jiraProjectKey)) {
    const key = req.jiraProjectKey || cfg.jiraProjectKey;
    const res = await jiraCreateDefect(
      key,
      `[QAE2E] ${summary.failed} test(s) failed for requirement ${req.requirementId}`,
      `Playwright run exit ${exitCode}. Passed: ${summary.passed}, Failed: ${summary.failed}, Skipped: ${summary.skipped}.`
    );
    logs.push(`jira: ${res.ok ? "defect created" : `failed ${JSON.stringify(res.data).slice(0, 120)}`}`);
  }

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

function recordOnCycle(cycleId: string, requirementId: string, summary: RunSummary, exitCode: number | null) {
  const cycle = getOne<Cycle>("cycles", cycleId);
  if (!cycle) {
    const c: Cycle = {
      id: cycleId,
      requirementId,
      name: "Local Playwright run",
      status: "completed",
      executions: [],
      createdAt: new Date().toISOString(),
    };
    recordExecutions(c, summary, exitCode);
    insertOne("cycles", c);
    return;
  }
  recordExecutions(cycle, summary, exitCode);
  updateOne("cycles", cycle);
}

function recordExecutions(c: Cycle, summary: RunSummary, exitCode: number | null) {
  const stamp = new Date().toISOString();
  const push = (caseTitle: string, status: ExecutionStatus, evidence: string) => {
    c.executions.push({
      id: crypto.randomUUID(),
      caseId: crypto.randomUUID(),
      caseTitle,
      status,
      evidence,
      executedBy: "playwright-runner",
      executedAt: stamp,
    });
  };
  if (summary.passed) push(`Passed (${summary.passed})`, "passed", "Playwright JSON reporter");
  if (summary.failed) push(`Failed (${summary.failed})`, "failed", `exit=${exitCode}`);
  if (summary.skipped) push(`Skipped (${summary.skipped})`, "skipped", "");
  c.status = "completed";
}

export { hasDocker };
