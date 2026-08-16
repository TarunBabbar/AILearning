// Remote test runner — lets a Vercel/serverless deployment run Playwright
// suites on a machine that HAS Docker (your dev box, a VPS, a home server).
//
// Flow: the app POSTs the full suite (files + command) to TEST_RUNNER_URL;
// the runner writes it to a temp dir, runs it in Docker, and returns the same
// normalized result shape the local runner produces (summary, failures,
// results, logs). The runner is a tiny standalone Node HTTP server
// (scripts/remote-runner.mjs).
//
// Env:
//   TEST_RUNNER_URL   — e.g. http://192.168.1.50:8787/run  (required to enable)
//   TEST_RUNNER_TOKEN — optional bearer token shared with the runner
//
// When unset, remote dispatch is a no-op and the local Docker path is used.

import { getConfig } from "../config";

export interface RemoteRunPayload {
  files: Array<{ path: string; content: string }>;
  command: string;
  image?: string;
  requirementId?: string;
}

export function remoteRunnerConfigured(): boolean {
  return Boolean(getConfig().testRunnerUrl);
}

/**
 * Dispatch a suite to the remote Docker runner. Returns a normalized result in
 * the same shape as the local runTests(). Throws only on transport/auth errors
 * (callers decide whether to fall back).
 */
export async function runRemote(payload: RemoteRunPayload): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  summary: { passed: number; failed: number; skipped: number; total: number };
  failures: Array<{ test: string; message: string }>;
  results?: Array<{ test: string; status: string; durationMs?: number }>;
  logs: string[];
}> {
  const cfg = getConfig();
  const url = cfg.testRunnerUrl;
  if (!url) throw new Error("TEST_RUNNER_URL is not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.testRunnerToken ? { Authorization: `Bearer ${cfg.testRunnerToken}` } : {}),
    },
    body: JSON.stringify(payload),
    // Suites can take minutes; give the runner generous time.
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Remote runner HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    ok?: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    summary?: { passed?: number; failed?: number; skipped?: number; total?: number };
    failures?: Array<{ test: string; message: string }>;
    results?: Array<{ test: string; status: string; durationMs?: number }>;
    logs?: string[];
  };

  return {
    ok: Boolean(data.ok),
    stdout: data.stdout || "",
    stderr: data.stderr || "",
    exitCode: data.exitCode ?? 1,
    summary: {
      passed: data.summary?.passed || 0,
      failed: data.summary?.failed || 0,
      skipped: data.summary?.skipped || 0,
      total: data.summary?.total || 0,
    },
    failures: data.failures || [],
    results: data.results,
    logs: data.logs || [],
  };
}
