// Env config. Reads .env file live on every getConfig() call (cached by mtime),
// so editing .env takes effect WITHOUT a server restart. No secrets hardcoded.

import { readFileSync, statSync } from "fs";
import { join } from "path";

let cachedMtime = -1;
let cachedEnv: Record<string, string> = {};

function loadDotEnv(): void {
  try {
    const envPath = join(process.cwd(), ".env");
    const st = statSync(envPath);
    if (st.mtimeMs === cachedMtime) return;
    const raw = readFileSync(envPath, "utf-8");
    const parsed: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      // strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      parsed[m[1]] = value;
    }
    cachedEnv = parsed;
    cachedMtime = st.mtimeMs;
  } catch {
    // no .env — fall back to process.env only
  }
}

// Resolve a value: .env file first, then process.env (deployment), then default.
function env(key: string, fallback = ""): string {
  loadDotEnv();
  return cachedEnv[key] !== undefined && cachedEnv[key] !== ""
    ? cachedEnv[key]
    : process.env[key] !== undefined && process.env[key] !== ""
      ? (process.env[key] as string)
      : fallback;
}

export function getConfig() {
  return {
    // ---- LLM (free models, with automatic fallback rotation) ----
    openrouterApiKey: env("OPENROUTER_API_KEY"),
    openrouterBaseUrl: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    // Which LLM source to use: "openrouter" | "commandcode" | "auto".
    // "auto" prefers the fast Command Code provider model (LLM_MODEL /
    // EVAL_MODEL when they are Command Code ids) and falls back to the
    // OpenRouter free pool when Command Code is unavailable.
    llmSource: env("LLM_SOURCE", "auto"),
    // Command Code Provider API — the FAST path. Works on Vercel (plain HTTP),
    // unlike the cmdc CLI which needs a local install. When LLM_MODEL / EVAL_MODEL
    // are Command Code ids (e.g. deepseek/deepseek-v4-flash-fast) this key is
    // required — without it the run falls back to the slow OpenRouter free pool.
    commandCodeApiKey: env("COMMAND_CODE_API_KEY"),
    commandCodeApiUrl: env("COMMAND_CODE_API_URL", "https://api.commandcode.ai/provider/v1"),
    commandCodeModel: env("COMMAND_CODE_MODEL", "deepseek/deepseek-v4-flash-fast"),
    // Legacy: local cmdc CLI path. Empty by default — the CLI is only used
    // when explicitly configured (the Provider API is the preferred path).
    commandCodePath: env("COMMAND_CODE_PATH"),
    // Default model for the agent pipeline. Command Code id = fast provider
    // path (needs COMMAND_CODE_API_KEY). An OpenRouter ":free" id = free pool.
    llmModel: env("LLM_MODEL", "deepseek/deepseek-v4-flash-fast"),
    // Fallback pool used only when the primary model is unavailable. With the
    // Command Code fast path this stays an OpenRouter free-model safety net.
    llmModels: env("LLM_MODELS", "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,z-ai/glm-5.2:free,cohere/north-mini-code:free,openai/gpt-oss-20b:free")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    // Judge model for AI stage evaluation. Same fast-path semantics as LLM_MODEL.
    evalModel: env("EVAL_MODEL", "deepseek/deepseek-v4-flash-fast"),
    // Fallback pool for the AI-evaluation judge (OpenRouter free models).
    evalModels: env("EVAL_MODELS", "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    visionModel: env("VISION_MODEL", "google/gemma-4-26b-a4b-it:free"),

    // ---- App ----
    dataDir: env("DATA_DIR", "data"),
    appName: env("NEXT_PUBLIC_APP_NAME", "QAE2E Agentic Quality Engineering"),
    // Public app URL (optional) — used as the OpenRouter HTTP-Referer.
    appUrl: env("NEXT_PUBLIC_APP_URL"),

    // ---- Local / remote test execution ----
    dockerImage: env("DOCKER_IMAGE", "mcr.microsoft.com/playwright:v1.51.0-jammy"),
    // Command run inside the container (after the node/npm/playwright preflight).
    // `npm test` prefers the suite's own package.json script; falls back to the
    // pinned Playwright runner when the suite has no scripts.
    testCommand: env("TEST_COMMAND", "npm test || npx --yes playwright@1.51.0 test --project=chromium"),
    // Optional remote Docker runner (e.g. your own machine / VPS): the app
    // POSTs the suite to this URL instead of running docker locally. This is
    // how Vercel (no Docker) still runs real Playwright suites.
    testRunnerUrl: env("TEST_RUNNER_URL"),
    testRunnerToken: env("TEST_RUNNER_TOKEN"),
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
