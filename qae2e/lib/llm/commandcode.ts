// Command Code as an LLM provider (REST / Provider API).
//
// Preferred path: the Command Code Provider API (OpenAI-compatible chat
// completions at https://api.commandcode.ai/provider/v1). This works anywhere
// the app runs — including Vercel — using COMMAND_CODE_API_KEY, and supports
// tool calling (needed by the agent loop).
//
// Fallback path: when no API key is configured, shell out to the local
// `cmdc -p` CLI (only works on machines where Command Code is installed).
// The CLI path is best-effort for plain completions (tool calling unsupported).

import { execFile } from "child_process";
import { getConfig } from "../config";
import type {
  ChatCompletionResponse,
  ChatCompletionOptions,
  ChatMessage,
  ChatTool,
} from "./openrouter";

export interface CommandCodeResult {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

interface CcOpts {
  model?: string;
  timeoutMs?: number;
}

/** Build the OpenAI-compatible request body, forwarding tool definitions. */
function buildBody(
  messages: ChatMessage[],
  model: string,
  cfg: ReturnType<typeof getConfig>,
  opts: { temperature?: number; maxTokens?: number; tools?: ChatTool[]; toolChoice?: ChatCompletionOptions["toolChoice"] }
): Record<string, unknown> {
  // Command Code provider DeepSeek models run in thinking mode, which rejects
  // a FORCED SPECIFIC tool_choice (tool_choice: {type:"function",...}) with a
  // 400 ("Thinking mode does not support this tool_choice"). The established
  // provider fix (omp, Amazon Bedrock, openai-completions) is to downgrade the
  // named-function force to "auto" — the tool stays advertised and the strong
  // system prompt steers the call. "required" (no specific function) is left
  // alone. OpenRouter is unaffected (this is the CC client).
  let toolChoice = opts.toolChoice;
  if (typeof toolChoice === "object" && toolChoice && "function" in toolChoice) {
    toolChoice = "auto";
  }

  return {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 8192,
    ...(opts.tools?.length
      ? {
          tools: opts.tools,
          ...(toolChoice ? { tool_choice: toolChoice } : {}),
        }
      : {}),
  };
}

/** OpenAI-compatible chat-completions call to the Command Code Provider API. */
async function apiChat(
  messages: ChatMessage[],
  model: string,
  cfg: ReturnType<typeof getConfig>,
  opts: CcOpts & { temperature?: number; maxTokens?: number; tools?: ChatTool[]; toolChoice?: ChatCompletionOptions["toolChoice"]; signal?: AbortSignal }
): Promise<ChatCompletionResponse> {
  if (!cfg.commandCodeApiKey) throw new Error("COMMAND_CODE_API_KEY is not configured");

  const res = await fetch(`${cfg.commandCodeApiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.commandCodeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildBody(messages, model, cfg, opts)),
    signal: opts.signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Command Code API error ${res.status}: ${err.slice(0, 500)}`);
  }

  const parsed = (await res.json()) as ChatCompletionResponse & {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };

  if (parsed.error?.message) throw new Error(`Command Code API: ${parsed.error.message}`);
  if (!Array.isArray(parsed.choices) || parsed.choices.length === 0) {
    throw new Error("Command Code API returned no completion");
  }
  return parsed;
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

/** CLI fallback (only when no API key is set). Plain-text completions only. */
async function cliChat(messages: ChatMessage[], model: string, cfg: ReturnType<typeof getConfig>, opts: CcOpts): Promise<ChatCompletionResponse> {
  const prompt = messages
    .map((m) =>
      m.role === "system" || m.role === "user" ? m.content : typeof m.content === "string" ? m.content : JSON.stringify(m)
    )
    .join("\n");
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
    opts.timeoutMs ?? 120_000
  );
  if (res.code !== 0 && !res.stdout) {
    throw new Error(`Command Code CLI failed (${res.code}): ${res.stderr.slice(0, 400) || "no output"}`);
  }
  let finalText = "";
  for (const line of res.stdout.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const obj = JSON.parse(t);
      if (obj.type === "result") {
        finalText = String(obj.finalText || "");
      }
    } catch {
      // skip non-JSON lines
    }
  }
  if (!finalText) throw new Error(`Command Code CLI returned no text (${res.stderr.slice(0, 400) || "empty reply"})`);
  return {
    choices: [{ message: { role: "assistant", content: finalText }, finish_reason: "stop" }],
  };
}

/**
 * Run a chat completion through Command Code. Uses the Provider API when
 * COMMAND_CODE_API_KEY is set (works anywhere, incl. Vercel, supports tools);
 * otherwise falls back to the local cmdc CLI (plain text only).
 */
export async function commandCodeChat(
  messages: ChatMessage[],
  opts: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const cfg = getConfig();
  const model = opts.model || cfg.commandCodeModel;

  if (cfg.commandCodeApiKey) {
    return apiChat(messages, model, cfg, opts);
  }

  if (cfg.commandCodePath) {
    return cliChat(messages, model, cfg, opts);
  }
  throw new Error(
    "Command Code provider requires COMMAND_CODE_API_KEY (recommended, works anywhere) " +
      "or COMMAND_CODE_PATH pointing to the cmdc CLI. Set one of them."
  );
}

// Legacy export: plain-text completion helper used by callers that only need
// prose (not the agent tool loop).
export async function commandCodeCompletion(
  prompt: string,
  opts: CcOpts = {}
): Promise<CommandCodeResult> {
  const cfg = getConfig();
  const model = opts.model || cfg.commandCodeModel;
  const r = await commandCodeChat([{ role: "user", content: prompt }], { model });
  const text = typeof r.choices[0]?.message?.content === "string" ? r.choices[0].message.content : "";
  return { text };
}
