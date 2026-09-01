// Command Code as an LLM source.
//
// Preferred path: the Command Code Provider API (OpenAI-compatible chat
// completions at https://api.commandcode.ai/provider/v1). This works anywhere
// the app runs — including Vercel — using COMMAND_CODE_API_KEY.
//
// Fallback path: when no API key is configured, shell out to the local
// `cmdc -p` CLI (only works on machines where Command Code is installed).

import { execFile } from "child_process";
import { getConfig } from "../config";

export interface CommandCodeResult {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** OpenAI-compatible chat-completions call to the Command Code Provider API. */
async function apiCompletion(
  prompt: string,
  model: string
): Promise<CommandCodeResult> {
  const cfg = getConfig();
  if (!cfg.commandCodeApiKey) throw new Error("COMMAND_CODE_API_KEY is not configured");

  const res = await fetch(`${cfg.commandCodeApiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.commandCodeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Command Code API error ${res.status}: ${err.slice(0, 500)}`);
  }

  const parsed = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };

  if (parsed.error?.message) throw new Error(`Command Code API: ${parsed.error.message}`);
  const text = parsed.choices?.[0]?.message?.content;
  if (!text) throw new Error("Command Code API returned no content");
  return {
    text,
    usage: { inputTokens: parsed.usage?.prompt_tokens, outputTokens: parsed.usage?.completion_tokens },
  };
}

function runCmd(args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile(args[0], args.slice(1), { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
        code: err ? (typeof (err as { code?: unknown }).code === "number" ? ((err as { code?: number }).code as number) : 1) : 0,
      });
    });
  });
}

/** CLI fallback (only when no API key is set). */
async function cliCompletion(prompt: string, model: string): Promise<CommandCodeResult> {
  const cfg = getConfig();
  const res = await runCmd(
    [
      cfg.commandCodePath,
      "-p",
      prompt,
      "-m",
      model,
      "--max-turns",
      "1",
      "--output-format",
      "json",
      "--skip-onboarding",
      "--no-auto-update",
      "--permission-mode",
      "auto-accept",
    ],
    120_000
  );
  if (res.code !== 0 && !res.stdout) {
    throw new Error(`Command Code CLI failed (${res.code}): ${res.stderr.slice(0, 400) || "no output"}`);
  }
  let finalText = "";
  let usage: CommandCodeResult["usage"];
  for (const line of res.stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const obj = JSON.parse(t);
      if (obj.type === "result") {
        finalText = String(obj.finalText || "");
        usage = { inputTokens: obj.usage?.inputTokens, outputTokens: obj.usage?.outputTokens };
      }
    } catch {
      // skip non-JSON lines
    }
  }
  if (!finalText) throw new Error(`Command Code CLI returned no text (${res.stderr.slice(0, 400) || "empty reply"})`);
  return { text: finalText, usage };
}

/**
 * Run a single completion through Command Code. Uses the Provider API when
 * COMMAND_CODE_API_KEY is set (works anywhere, incl. Vercel); otherwise falls
 * back to the local cmdc CLI.
 */
export async function commandCodeCompletion(
  prompt: string,
  opts: { model?: string; timeoutMs?: number } = {}
): Promise<CommandCodeResult> {
  const cfg = getConfig();
  const model = opts.model || cfg.commandCodeModel;

  if (cfg.commandCodeApiKey) {
    return apiCompletion(prompt, model);
  }

  // No API key: only attempt the local CLI if the user explicitly configured
  // COMMAND_CODE_PATH. Otherwise fail with a clear, actionable error.
  if (cfg.commandCodePath) {
    return cliCompletion(prompt, model);
  }
  throw new Error(
    "Command Code fallback requires COMMAND_CODE_API_KEY (recommended, works anywhere) " +
      "or COMMAND_CODE_PATH pointing to the cmdc CLI. Set one of them to enable the fallback."
  );
}
