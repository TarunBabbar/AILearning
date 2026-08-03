// Auto-healing test run: materialize generated scripts to a temp dir, run them
// in Docker, and if tests fail, use the LLM (from .env — free model only) to
// fix the failing files and re-run. Up to MAX_ATTEMPTS rounds.

import { runTests, hasDocker, type DetailedFailure } from "./index";
import { chatCompletion, LlmError } from "../llm/openrouter";
import { getConfig } from "../config";
import type { Script } from "../types";

export type { DetailedFailure };

export interface FixRunResult {
  ok: boolean;
  summary: { passed: number; failed: number; skipped: number; total: number };
  attempts: number;
  failures: DetailedFailure[];
  logs: string[];
  repoDir: string;
}

const MAX_ATTEMPTS = 3;

/**
 * Ask the free LLM to fix a failing test file. Returns the fixed file content
 * (or null if the model returned nothing usable).
 */
async function llmFixFile(filePath: string, source: string, failures: DetailedFailure[], command: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) return null;

  const prompt = `You are fixing a failing Playwright + TypeScript POM automation suite.
The test command is: ${command}

Failing tests:
${failures.map((f) => `- ${f.test}: ${f.message}`).join("\n")}

Here is the current content of ${filePath}:
\`\`\`
${source.slice(0, 8000)}
\`\`\`

Fix the file so tests pass while preserving Page Object Model:
- Specs must keep using fixtures/page methods (no new raw locators in specs unless this IS a page object).
- Prefer getByRole/getByLabel/getByTestId.
- No waitForTimeout.
Return ONLY the complete fixed file content in a single markdown code block. Do not explain.`;

  try {
    const res = await chatCompletion(
      [
        { role: "system", content: "You are an expert Playwright TypeScript POM fixer. Return only the fixed file content in a code block." },
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
 * Write generated scripts to disk in a runnable layout.
 * Prefers files from the Script artifact (POM scaffold). Only fills missing
 * package.json / playwright.config.ts when the agent omitted them.
 */
export function materializeScripts(script: Script): { repoDir: string; files: { path: string; content: string }[] } {
  const { mkdirSync, writeFileSync } = require("fs") as typeof import("fs");
  const { join } = require("path") as typeof import("path");
  const base = process.env.TEMP || process.env.TMP || ".";
  const repoDir = join(base, `qae2e-autofix-${Date.now()}-${script.id.slice(0, 6)}`);
  mkdirSync(repoDir, { recursive: true });

  const files: { path: string; content: string }[] = [];
  const written = new Set<string>();
  for (const f of script.files) {
    const safe = (f.path || "test.spec.ts").replace(/^\/+/, "").replace(/\\/g, "/");
    const abs = join(repoDir, safe);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, f.code, "utf-8");
    files.push({ path: safe, content: f.code });
    written.add(safe.toLowerCase());
  }

  if (!written.has("package.json")) {
    const pkg = {
      name: "qae2e-autofix",
      private: true,
      version: "1.0.0",
      scripts: {
        test: "playwright test",
        "test:headed": "playwright test --headed",
      },
      devDependencies: {
        "@playwright/test": "^1.49.0",
        typescript: "^5.7.0",
        "@types/node": "^22.10.0",
      },
    };
    const content = JSON.stringify(pkg, null, 2);
    writeFileSync(join(repoDir, "package.json"), content, "utf-8");
    files.push({ path: "package.json", content });
  }

  if (!written.has("playwright.config.ts") && !written.has("playwright.config.js")) {
    const content = `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
`;
    writeFileSync(join(repoDir, "playwright.config.ts"), content, "utf-8");
    files.push({ path: "playwright.config.ts", content });
  }

  if (!written.has("tsconfig.json")) {
    const content = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          rootDir: ".",
        },
        include: ["tests/**/*.ts", "playwright.config.ts"],
      },
      null,
      2
    );
    writeFileSync(join(repoDir, "tsconfig.json"), content, "utf-8");
    files.push({ path: "tsconfig.json", content });
  }

  mkdirSync(join(repoDir, "test-results"), { recursive: true });
  return { repoDir, files };
}

/**
 * Run generated tests in Docker with LLM auto-fix on failure.
 * `command` overrides the default Playwright run (TypeScript UI only — no JUnit).
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

  const command = opts.command || "npm test || npx --yes playwright@1.51.0 test --project=chromium";

  let finalSummary = { passed: 0, failed: 0, skipped: 0, total: 0 };
  let finalFailures: DetailedFailure[] = [];
  let ok = false;
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    log(`Run #${attempt}: ${command}`);

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
    finalFailures = result.failures || [];
    if (result.summary.total === 0) {
      log(`Run #${attempt} found 0 tests — suite empty or wrong testDir. Not treating as pass.`);
      break;
    }
    if (result.ok && result.summary.failed === 0) {
      ok = true;
      log(`Run #${attempt} passed: ${result.summary.passed} passed, ${result.summary.skipped} skipped.`);
      break;
    }

    log(`Run #${attempt} had ${result.summary.failed} failure(s).`);
    if (attempt === MAX_ATTEMPTS) break;

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
