// Auto-healing test run: materialize generated scripts to a temp dir, run them
// in Docker, and if tests fail, use the LLM (from .env — free model only) to
// fix the failing files and re-run. Up to MAX_ATTEMPTS rounds.

import { runTests, hasDocker } from "./index";
import { chatCompletion, LlmError } from "../llm/openrouter";
import { getConfig } from "../config";
import type { Script } from "../types";

export interface DetailedFailure {
  test: string; // "suite class" / test name
  message: string; // failure/error message
}

export interface FixRunResult {
  ok: boolean;
  summary: { passed: number; failed: number; skipped: number; total: number };
  attempts: number;
  failures: DetailedFailure[];
  logs: string[]; // human-readable run + fix log
  repoDir: string;
}

const MAX_ATTEMPTS = 3;

/**
 * Parse a JUnit XML document into per-test failures with classname + message.
 */
export function parseJunitDetailed(xml: string): DetailedFailure[] {
  const out: DetailedFailure[] = [];
  const re = /<(?:\w+:)?testcase\b[^>]*classname="([^"]*)"[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?testcase>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const body = m[3] || "";
    const fm = body.match(/<(?:\w+:)?(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?(?:failure|error)>/);
    if (fm) {
      out.push({
        test: `${m[1] || "?"} / ${m[2] || "?"}`,
        message: (fm[1] || "").trim().slice(0, 600),
      });
    }
  }
  return out;
}

/**
 * Ask the free LLM to fix a failing test file. Returns the fixed file content
 * (or null if the model returned nothing usable).
 */
async function llmFixFile(filePath: string, source: string, failures: DetailedFailure[], command: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) return null;

  const prompt = `You are fixing a failing automated test written for a QA pipeline.
The test command is: ${command}

Failing tests:
${failures.map((f) => `- ${f.test}: ${f.message}`).join("\n")}

Here is the current content of ${filePath}:
\`\`\`
${source.slice(0, 8000)}
\`\`\`

Fix the file so the failing tests pass. Common causes: wrong selectors, missing imports,
incorrect test IDs, async issues. Return ONLY the complete fixed file content in a single
markdown code block. Do not explain.`;

  try {
    const res = await chatCompletion(
      [
        { role: "system", content: "You are an expert Playwright/Jest test fixer. Return only the fixed file content in a code block." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.1, maxTokens: 6000 }
    );
    const text = res.choices[0]?.message?.content;
    if (!text || typeof text !== "string") return null;
    // Extract from markdown fence if present.
    const fence = text.match(/```(?:typescript|ts|js|javascript)?\s*([\s\S]*?)```/);
    return (fence ? fence[1] : text).trim();
  } catch (err) {
    if (err instanceof LlmError) return null;
    return null;
  }
}

/**
 * Write generated scripts to disk in a minimal runnable layout:
 *   <tmp>/tests/<path>  +  package.json (playwright + @playwright/test deps)
 * Returns the temp dir.
 */
export function materializeScripts(script: Script): { repoDir: string; files: { path: string; content: string }[] } {
  const { mkdirSync, writeFileSync } = require("fs") as typeof import("fs");
  const { join } = require("path") as typeof import("path");
  const base = process.env.TEMP || process.env.TMP || ".";
  const repoDir = join(base, `qae2e-autofix-${Date.now()}-${script.id.slice(0, 6)}`);
  mkdirSync(repoDir, { recursive: true });

  const files: { path: string; content: string }[] = [];
  for (const f of script.files) {
    const safe = (f.path || "test.spec.ts").replace(/^\/+/, "");
    const abs = join(repoDir, safe);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, f.code, "utf-8");
    files.push({ path: safe, content: f.code });
  }

  // Minimal package.json so `npx playwright test` resolves inside the container.
  const pkg = {
    name: "qae2e-autofix",
    private: true,
    version: "1.0.0",
    dependencies: { "@playwright/test": "^1.45.0", "playwright": "^1.45.0" },
    scripts: { test: "playwright test --reporter=junit" },
  };
  writeFileSync(join(repoDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");
  // Empty config so Playwright picks up tests/*.spec.ts by default.
  writeFileSync(join(repoDir, "playwright.config.ts"), `import { defineConfig } from "@playwright/test";\nexport default defineConfig({ testDir: ".", reporter: "junit", use: { headless: true } });\n`, "utf-8");

  return { repoDir, files };
}

/**
 * Run generated tests in Docker with LLM auto-fix on failure.
 * `command` overrides the default (e.g. `npx playwright test --reporter=junit`).
 */
export async function runTestsWithAutofix(
  script: Script,
  opts: { command?: string; emitLog?: (line: string) => void } = {}
): Promise<FixRunResult> {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    opts.emitLog?.(line);
  };

  const dockerOk = await hasDocker();
  if (!dockerOk) {
    return {
      ok: false,
      summary: { passed: 0, failed: 0, skipped: 0, total: 0 },
      attempts: 0,
      failures: [],
      logs: ["Docker is not running. Start Docker Desktop, then retry."],
      repoDir: "",
    };
  }

  const { repoDir, files } = materializeScripts(script);
  log(`Materialized ${files.length} script(s) → ${repoDir}`);

  // The Playwright Docker image ships @playwright/test globally; run via npx
  // so the local package.json deps are used if present, else the global one.
  const command = opts.command || "npx playwright test --reporter=junit";

  let finalSummary = { passed: 0, failed: 0, skipped: 0, total: 0 };
  let finalFailures: DetailedFailure[] = [];
  let ok = false;
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    log(`Run #${attempt}: ${command}`);

    // Re-materialize the (possibly fixed) files before each run.
    const { writeFileSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    for (const f of files) {
      const abs = join(repoDir, f.path);
      const { mkdirSync } = require("fs") as typeof import("fs");
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, f.content, "utf-8");
    }

    const result = await runTests({
      requirementId: script.requirementId,
      repoDir,
      command,
    });

    finalSummary = result.summary;
    finalFailures = parseJunitDetailed(result.stdout);
    if (result.ok && result.summary.failed === 0) {
      ok = true;
      log(`Run #${attempt} passed: ${result.summary.passed} passed, ${result.summary.skipped} skipped.`);
      break;
    }

    log(`Run #${attempt} had ${result.summary.failed} failure(s).`);
    if (attempt === MAX_ATTEMPTS) break;

    // LLM auto-fix: find the file matching a failing test and ask the LLM to fix it.
    const fixedAny = await fixFailures(files, finalFailures, command, log);
    if (!fixedAny) {
      log("LLM produced no fix — stopping autofix loop.");
      break;
    }
  }

  return { ok, summary: finalSummary, attempts, failures: finalFailures, logs, repoDir };
}

async function fixFailures(
  files: { path: string; content: string }[],
  failures: DetailedFailure[],
  command: string,
  log: (line: string) => void
): Promise<boolean> {
  let fixed = false;
  for (const f of files) {
    const relevant = failures.some((x) => f.path.includes(x.test.split("/")[0]) || x.test.includes(f.path));
    if (!relevant && failures.length > 1) continue;
    const improved = await llmFixFile(f.path, f.content, failures, command);
    if (improved && improved.length > 10 && improved !== f.content) {
      f.content = improved;
      log(`LLM fixed ${f.path}`);
      fixed = true;
    }
  }
  return fixed;
}
