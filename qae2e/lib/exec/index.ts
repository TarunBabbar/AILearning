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
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export interface RunRequest {
  requirementId: string;
  cycleId?: string;
  repoDir?: string;
  repoUrl?: string;
  command?: string;
  framework?: string;
  branch?: string;
}

export interface RunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

/** One test's outcome, captured per run so flaky detection / trends can track
 *  pass/fail history per test name across runs. */
export interface TestOutcome {
  test: string; // full title, e.g. "Login › shows error on bad password"
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  durationMs?: number;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  summary: RunSummary;
  failures?: Array<{ test: string; message: string }>;
  /** Per-test outcomes (populated when the JSON reporter is available). */
  results?: TestOutcome[];
  /** Screenshot diff artifacts from visual regression (test-results/**-snapshots). */
  visualDiffs?: string[];
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

/** True when the `docker` binary exists (even if the daemon is stopped).
 *  False on machines with no Docker installed (e.g. serverless/Vercel). */
export function dockerInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("docker", ["--version"], { timeout: 5000 }, (err) => resolve(!err));
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
  results: TestOutcome[];
} {
  const failures: DetailedFailure[] = [];
  const results: TestOutcome[] = [];
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
              results?: Array<{ status?: string; error?: { message?: string }; duration?: number }>;
              projectName?: string;
            }>;
          }>;
        };
        const nextPrefix = [titlePrefix, suite.title].filter(Boolean).join(" › ");
        if (suite.suites?.length) walk(suite.suites, nextPrefix);
        for (const spec of suite.specs || []) {
          for (const t of spec.tests || []) {
            const first = t.results?.[0];
            const status = (first?.status || t.status || "").toLowerCase();
            const name = [nextPrefix, spec.title, t.projectName].filter(Boolean).join(" › ");
            if (status === "skipped" || status === "pending") {
              results.push({ test: name || "unknown", status: "skipped", durationMs: first?.duration });
            } else if (status === "failed" || status === "timedOut" || status === "interrupted") {
              failures.push({
                test: name || "unknown",
                message: (first?.error?.message || status).slice(0, 600),
              });
              results.push({ test: name || "unknown", status, durationMs: first?.duration });
            } else if (status === "passed") {
              results.push({ test: name || "unknown", status: "passed", durationMs: first?.duration });
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
    results,
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

  // Remote runner configured (Vercel/self-hosted): dispatch the suite to the
  // machine that has Docker instead of running docker locally.
  if (cfg.testRunnerUrl) {
    try {
      const { runRemote } = await import("./remote");
      const files = await collectSuiteFiles(req.repoDir, req.repoUrl, req.branch);
      const res = await runRemote({
        files,
        command: req.command || cfg.testCommand,
        image: cfg.dockerImage,
        requirementId: req.requirementId,
      });
      if (req.cycleId) {
        await recordOnCycle(req.cycleId, req.requirementId, res.summary, res.exitCode);
      }
      return {
        ok: res.ok,
        stdout: res.stdout,
        stderr: res.stderr,
        exitCode: res.exitCode,
        summary: res.summary,
        failures: res.failures,
        results: res.results as TestOutcome[] | undefined,
      };
    } catch (err) {
      return {
        ok: false,
        stdout: "",
        stderr: `Remote runner failed: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: 1,
        summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
        failures: [],
      };
    }
  }

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
      execFileSync("git", ["clone", "--depth", "1", "--branch", req.branch || "main", req.repoUrl, repoDir], { stdio: "ignore" });
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
  let results: TestOutcome[] = [];

  const jsonRaw = readResultsJson(repoDir);
  if (jsonRaw) {
    const parsed = parsePlaywrightJson(jsonRaw);
    summary = parsed.summary;
    failures = parsed.failures;
    results = parsed.results;
  } else {
    summary = parsePlaywrightList(stdout + "\n" + stderr);
  }

  // Visual regression: surface screenshot diff file names as evidence (the
  // JSON reporter already flags the failure; this lists the generated diffs).
  const visualDiffs = collectScreenshotDiffs(repoDir);

  if (req.cycleId) {
    await recordOnCycle(req.cycleId, req.requirementId, summary, exitCode);
  }

  return {
    ok: exitCode === 0 && summary.failed === 0,
    stdout,
    stderr,
    exitCode,
    summary,
    failures,
    results,
    visualDiffs,
  };
}

/**
 * Collect a runnable suite as a file list for the remote runner. Prefers the
 * local repoDir when given; otherwise clones repoUrl into a temp dir and walks
 * it (excluding node_modules/.git/test-results).
 */
async function collectSuiteFiles(
  repoDir?: string,
  repoUrl?: string,
  branch?: string
): Promise<Array<{ path: string; content: string }>> {
  let dir = repoDir;
  if (!dir && repoUrl) {
    const base = process.env.TEMP || process.env.TMP || ".";
    dir = join(base, `qae2e-remote-${Date.now()}`);
    const { execFileSync } = await import("child_process");
    execFileSync("git", ["clone", "--depth", "1", "--branch", branch || "main", repoUrl, dir], { stdio: "ignore" });
  }
  if (!dir) dir = process.cwd();

  const { readdirSync, statSync } = await import("fs");
  const out: Array<{ path: string; content: string }> = [];
  const walk = (d: string, rel: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "test-results") continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p, `${rel}/${entry.name}`);
      else {
        try {
          const st = statSync(p);
          if (st.size > 2 * 1024 * 1024) continue; // skip huge binaries
          out.push({ path: `${rel}/${entry.name}`.replace(/^\//, ""), content: readFileSync(p, "utf-8") });
        } catch {
          // skip unreadable
        }
      }
    }
  };
  walk(dir, "");
  return out;
}

/** List screenshot diff artifacts from a Playwright run (test-results/**-snapshots).
 *  Used to surface visual-regression diffs; the files themselves stay in the
 *  temp repo dir (they're not copied back into the app). */
function collectScreenshotDiffs(repoDir: string): string[] {
  try {
    const { readdirSync } = require("fs") as typeof import("fs");
    const base = join(repoDir, "test-results");
    if (!existsSync(base)) return [];
    const out: string[] = [];
    const scan = (dir: string, depth: number) => {
      if (depth > 4) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) scan(p, depth + 1);
        else if (/\.(png|jpg|jpeg)$/i.test(entry.name) && /snapshot/i.test(p)) out.push(p);
      }
    };
    scan(base, 0);
    return out.slice(0, 20).map((p) => p.replace(/\\/g, "/").replace(`${repoDir.replace(/\\/g, "/")}/`, ""));
  } catch {
    return [];
  }
}

async function recordOnCycle(cycleId: string, requirementId: string, summary: RunSummary, exitCode: number | null) {
  const cycle = await getOne<Cycle>("cycles", cycleId);
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
    await insertOne("cycles", c);
    return;
  }
  recordExecutions(cycle, summary, exitCode);
  await updateOne("cycles", cycle.id, cycle);
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
