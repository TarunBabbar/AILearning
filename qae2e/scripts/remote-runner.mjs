#!/usr/bin/env node
// Standalone remote Docker test runner for QAE2E.
//
// Run this on a machine that HAS Docker (dev box / VPS / home server):
//   node scripts/remote-runner.mjs [port] [token]
//   (default port 8787, token optional — pass the same value as TEST_RUNNER_TOKEN)
//
// The app (localhost or Vercel) POSTs { files, command, image } to /run.
// The runner writes the files to a temp dir, runs them in Docker with a
// preflight (npm install + Playwright Chromium), parses the Playwright JSON
// reporter, and returns the normalized result.
//
// Endpoints:
//   POST /run    — run a suite (JSON body, see below)
//   GET  /health — liveness probe
//
// Body: { files: [{path, content}], command, image?, requirementId? }

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const PORT = Number(process.argv[2] || 8787);
const TOKEN = process.argv[3] || "";
const IMAGE = process.env.DOCKER_IMAGE || "mcr.microsoft.com/playwright:v1.51.0-jammy";
const COMMAND = process.env.TEST_COMMAND || "npm test || npx --yes playwright@1.51.0 test --project=chromium";

const PREFLIGHT = [
  "node -v",
  "npm -v",
  "if [ -f package.json ] && [ ! -d node_modules ]; then echo '[preflight] installing npm dependencies…'; npm install --no-audit --no-fund; fi",
  "if ! [ -d /ms-playwright ] || ! ls /ms-playwright/chromium* >/dev/null 2>&1; then echo '[preflight] installing playwright chromium…'; npx --yes playwright@1.51.0 install chromium; fi",
].join(" && ");

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 }, (err, stdout, stderr) => {
      resolve({
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        exitCode: err ? (typeof err.code === "number" ? err.code : 1) : 0,
      });
    });
  });
}

function parsePlaywrightJson(raw) {
  const failures = [];
  const results = [];
  let passed = 0, failed = 0, skipped = 0;
  try {
    const data = JSON.parse(raw);
    if (data.stats) {
      passed = Number(data.stats.expected || 0);
      failed = Number(data.stats.unexpected || 0);
      skipped = Number(data.stats.skipped || 0);
    }
    const walk = (suites, prefix = "") => {
      for (const s of suites) {
        const next = [prefix, s.title].filter(Boolean).join(" › ");
        if (s.suites?.length) walk(s.suites, next);
        for (const spec of s.specs || []) {
          for (const t of spec.tests || []) {
            const first = t.results?.[0];
            const status = (first?.status || t.status || "").toLowerCase();
            const name = [next, spec.title, t.projectName].filter(Boolean).join(" › ");
            if (status === "skipped" || status === "pending") {
              results.push({ test: name || "unknown", status: "skipped", durationMs: first?.duration });
            } else if (status === "failed" || status === "timedOut" || status === "interrupted") {
              failures.push({ test: name || "unknown", message: (first?.error?.message || status).slice(0, 600) });
              results.push({ test: name || "unknown", status, durationMs: first?.duration });
            } else if (status === "passed") {
              results.push({ test: name || "unknown", status: "passed", durationMs: first?.duration });
            }
          }
        }
      }
    };
    if (Array.isArray(data.suites)) walk(data.suites);
    if (!data.stats) {
      failed = failures.length;
      let totalSpecs = 0;
      const count = (suites) => {
        for (const s of suites) {
          totalSpecs += s.specs?.length || 0;
          if (s.suites) count(s.suites);
        }
      };
      if (Array.isArray(data.suites)) count(data.suites);
      passed = Math.max(0, totalSpecs - failed - skipped);
    }
  } catch { /* empty */ }
  return { summary: { passed, failed, skipped, total: passed + failed + skipped }, failures, results };
}

function parsePlaywrightList(stdout) {
  const passed = Number(stdout.match(/(\d+)\s+passed/i)?.[1] || 0);
  const failed = Number(stdout.match(/(\d+)\s+failed/i)?.[1] || 0);
  const skipped = Number(stdout.match(/(\d+)\s+skipped/i)?.[1] || 0);
  return { passed, failed, skipped, total: passed + failed + skipped };
}

function readResultsJson(repoDir) {
  for (const p of ["test-results/results.json", "results.json", "playwright-report/results.json"]) {
    const abs = join(repoDir, p);
    if (existsSync(abs)) {
      try { return readFileSync(abs, "utf-8"); } catch { /* continue */ }
    }
  }
  return null;
}

async function handleRun(body) {
  const files = Array.isArray(body?.files) ? body.files : [];
  if (!files.length) return { status: 400, json: { ok: false, error: "No files in payload" } };

  const repoDir = join(tmpdir(), `qae2e-remote-${randomUUID()}`);
  mkdirSync(repoDir, { recursive: true });
  for (const f of files) {
    const safe = String(f.path || "test.spec.ts").replace(/^\/+/, "").replace(/\\/g, "/");
    const abs = join(repoDir, safe);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, String(f.content ?? ""), "utf-8");
  }
  mkdirSync(join(repoDir, "test-results"), { recursive: true });

  const image = body.image || IMAGE;
  const command = body.command || COMMAND;
  const mount = process.platform === "win32" ? `${repoDir.replace(/\\/g, "/")}:/app` : `${repoDir}:/app`;
  const logs = [];

  // Ensure image present (pull when missing).
  const inspect = await run("docker", ["image", "inspect", image]);
  if (inspect.exitCode !== 0) {
    logs.push(`[runner] pulling image ${image}…`);
    const pull = await run("docker", ["pull", image]);
    if (pull.exitCode !== 0) {
      return {
        status: 200,
        json: { ok: false, exitCode: pull.exitCode, stdout: "", stderr: `Image pull failed: ${pull.stderr.slice(0, 400)}`, summary: { passed: 0, failed: 0, skipped: 0, total: 0 }, failures: [], logs },
      };
    }
  }

  const preflight = await run("docker", ["run", "--rm", "-v", mount, "-w", "/app", image, "sh", "-c", PREFLIGHT]);
  if (preflight.exitCode !== 0) {
    return {
      status: 200,
      json: { ok: false, exitCode: preflight.exitCode, stdout: preflight.stdout, stderr: `Preflight failed: ${(preflight.stderr || preflight.stdout).slice(0, 1200)}`, summary: { passed: 0, failed: 0, skipped: 0, total: 0 }, failures: [], logs: [...logs, preflight.stdout] },
    };
  }

  const result = await run("docker", ["run", "--rm", "-v", mount, "-w", "/app", image, "sh", "-c", command]);
  const jsonRaw = readResultsJson(repoDir);
  const parsed = jsonRaw ? parsePlaywrightJson(jsonRaw) : null;
  const summary = parsed?.summary || parsePlaywrightList(result.stdout + "\n" + result.stderr);
  const failures = parsed?.failures || [];
  const results = parsed?.results || [];

  return {
    status: 200,
    json: {
      ok: result.exitCode === 0 && summary.failed === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      summary,
      failures,
      results,
      logs,
    },
  };
}

const server = createServer(async (req, res) => {
  // CORS for browser-driven calls (optional; the app calls server-side).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // Auth: bearer token when configured.
  if (TOKEN) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
    }
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, docker: true }));
  }

  if (req.method === "POST" && url.pathname === "/run") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    if (!parsed) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }));
    }
    const { status, json } = await handleRun(parsed);
    res.writeHead(status, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(json));
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`QAE2E remote Docker runner listening on :${PORT}`);
  console.log(`  image:   ${IMAGE}`);
  console.log(`  command: ${COMMAND}`);
  console.log(`  token:   ${TOKEN ? "set" : "none"}`);
  console.log("POST /run with { files, command, image } to execute a suite.");
});
