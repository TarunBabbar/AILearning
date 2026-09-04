import { getConfig } from "../config";

export interface ToolCallMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ToolResultMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | ToolCallMessage
  | ToolResultMessage;

export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ChatTool[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  signal?: AbortSignal;
  /**
   * Called whenever the request falls back to another model in the pool
   * (overloaded / rate-limited / upstream error). Lets the UI log
   * "Switching LLM → ..." lines.
   */
  onModelSwitch?: (from: string, to: string, reason: string) => void;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: ChatMessage;
    finish_reason: string | null;
  }>;
}

export class LlmError extends Error {}

function getApiKey(): string {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) {
    throw new LlmError("OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env");
  }
  return cfg.openrouterApiKey;
}

/**
 * Safety guard: only FREE OpenRouter models (:free suffix) may be used.
 * A paid model in config is a hard error — never spend money by accident.
 */
function assertFreeModel(model: string): void {
  if (!model.endsWith(":free")) {
    throw new LlmError(
      `Refusing to use paid model "${model}". Only :free models are allowed (see LLM_MODEL in .env).`
    );
  }
}

/**
 * Errors that won't be fixed by trying another model — auth, bad request,
 * model not found, invalid API key. Everything else (overload, rate limit,
 * upstream/provider errors) is retryable by rotating to the next free model.
 */
function isNonRetryableError(err: LlmError): boolean {
  const m = err.message.toLowerCase();
  return (
    /401/i.test(m) ||
    /403/i.test(m) ||
    /400/i.test(m) ||
    /invalid api key/i.test(m) ||
    /authentication/i.test(m) ||
    /unauthorized/i.test(m) ||
    /not found/i.test(m) ||
    /unknown model/i.test(m) ||
    /invalid request/i.test(m)
  );
}

/** Single attempt against one model. Returns the response or throws LlmError. */
async function requestModel(
  model: string,
  messages: ChatMessage[],
  opts: ChatCompletionOptions,
  cfg: ReturnType<typeof getConfig>
): Promise<ChatCompletionResponse> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 8192,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  }

  const res = await fetch(`${cfg.openrouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}),
      "X-Title": cfg.appName.replace(/[^\x20-\x7E]/g, ""),
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new LlmError(`OpenRouter error ${res.status} (${model}): ${err.slice(0, 500)}`);
  }

  const parsed = (await res.json()) as ChatCompletionResponse & { error?: { message?: string } };

  if (parsed.error?.message) {
    throw new LlmError(`OpenRouter (${model}): ${parsed.error.message}`);
  }
  if (!Array.isArray(parsed.choices) || parsed.choices.length === 0) {
    throw new LlmError(
      `OpenRouter returned no completion (model: ${model}). The free provider may be out of capacity — try again.`
    );
  }

  return parsed;
}

/**
 * Fetch the current list of free (:free) OpenRouter models. Best-effort —
 * returns [] on any failure (network/unauth).
 */
async function fetchFreeModels(cfg: ReturnType<typeof getConfig>): Promise<string[]> {
  try {
    const res = await fetch(`${cfg.openrouterBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data || []).map((m) => m.id).filter((id) => id.endsWith(":free"));
    // Prefer larger-context models for the agent pipeline, but keep the whole
    // free set as a last-resort pool. We just need ids here.
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

function isCommandCodeModel(model: string): boolean {
  return !model.endsWith(":free");
}

function commandCodeAvailable(cfg: ReturnType<typeof getConfig>): boolean {
  return Boolean(cfg.commandCodeApiKey || cfg.commandCodePath);
}

/** Shared opts that the Command Code client understands (forwarded as-is). */
function ccRequestOpts(opts: ChatCompletionOptions) {
  return {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    tools: opts.tools,
    toolChoice: opts.toolChoice,
    signal: opts.signal,
  };
}

/**
 * Route one completion. Decision tree:
 *
 *   LLM_SOURCE=commandcode           → Command Code provider, always
 *   requested model is not ":free"   → Command Code provider (paid model)
 *   requested model is ":free"       → OpenRouter free pool (with rotation),
 *                                      then Command Code fallback when auto
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const cfg = getConfig();
  const requested = opts.model || cfg.llmModel || "";
  const isFree = requested.endsWith(":free");
  const ccOpts = ccRequestOpts(opts);

  // --- 1. Explicit Command Code source ------------------------------------
  if (cfg.llmSource === "commandcode") {
    if (!commandCodeAvailable(cfg)) {
      throw new LlmError(
        "LLM_SOURCE=commandcode but no Command Code credentials. Add COMMAND_CODE_API_KEY to .env."
      );
    }
    opts.onModelSwitch?.("openrouter", cfg.commandCodeModel, "LLM_SOURCE=commandcode");
    const { commandCodeChat } = await import("./commandcode");
    return commandCodeChat(messages, { model: cfg.commandCodeModel, ...ccOpts });
  }

  // --- 2. Paid / Command Code model requested explicitly -------------------
  let ccPaidError: Error | null = null;
  if (requested && isCommandCodeModel(requested)) {
    if (!commandCodeAvailable(cfg)) {
      throw new LlmError(
        `"${requested}" is a Command Code model (not an OpenRouter :free model). ` +
          `Set COMMAND_CODE_API_KEY in .env to use it via the Command Code provider API, ` +
          `or use an OpenRouter :free model in LLM_MODEL.`
      );
    }
    try {
      opts.onModelSwitch?.(requested, requested, "Command Code provider model (paid)");
      const { commandCodeChat } = await import("./commandcode");
      return await commandCodeChat(messages, { model: requested, ...ccOpts });
    } catch (err) {
      ccPaidError = err instanceof Error ? err : new Error(String(err));
      if (cfg.llmSource !== "auto") {
        throw new LlmError(`Command Code (${requested}) failed: ${ccPaidError.message}`);
      }
      // auto: fall through to the free pool as a last resort.
      opts.onModelSwitch?.(
        requested,
        "OpenRouter free pool",
        `Command Code (${requested}) failed — ${ccPaidError.message}`
      );
    }
  }

  // --- 3. OpenRouter free pool with rotation -------------------------------
  let pool: string[] = [];
  const push = (m: string) => {
    if (m && !pool.includes(m)) pool.push(m);
  };
  if (isFree) push(requested);
  for (const m of cfg.llmModels) push(m);
  if (!pool.includes(requested) || cfg.llmModels.length <= 1) {
    const live = await fetchFreeModels(cfg);
    for (const m of live) push(m);
  }

  let lastErr: LlmError | null = null;
  for (const model of pool) {
    if (opts.signal?.aborted) throw new LlmError("Request aborted");
    try {
      return await requestModel(model, messages, opts, cfg);
    } catch (err) {
      lastErr = err instanceof LlmError ? err : new LlmError(String(err));
      // Auth / bad-request errors won't be fixed by another model — fail fast.
      if (isNonRetryableError(lastErr)) throw lastErr;
      const next = pool[pool.indexOf(model) + 1];
      if (next) opts.onModelSwitch?.(model, next, lastErr.message);
    }
  }

  // --- 4. LLM_SOURCE=auto → Command Code fallback --------------------------
  if (cfg.llmSource === "auto") {
    if (!commandCodeAvailable(cfg)) {
      throw (
        lastErr ??
        new LlmError(
          "All OpenRouter free models failed and Command Code fallback is not configured. Add COMMAND_CODE_API_KEY to .env."
        )
      );
    }
    try {
      const from = pool[pool.length - 1] || requested || cfg.llmModel;
      opts.onModelSwitch?.(
        from,
        cfg.commandCodeModel,
        ccPaidError?.message || lastErr?.message || "free pool exhausted"
      );
      const { commandCodeChat } = await import("./commandcode");
      return await commandCodeChat(messages, { model: cfg.commandCodeModel, ...ccOpts });
    } catch (ccErr) {
      const why = ccErr instanceof Error ? ccErr.message : String(ccErr);
      const paidNote = ccPaidError
        ? `Command Code (${requested}) failed first: ${ccPaidError.message}; then free pool failed: ${lastErr?.message ?? "unknown"}.`
        : "";
      throw new LlmError(
        paidNote ||
          `All OpenRouter free models failed, and the Command Code fallback (${cfg.commandCodeModel}) also failed: ${why}`
      );
    }
  }

  throw lastErr ?? new LlmError("All models in the fallback pool failed.");
}

export function extractToolCalls(message: ToolCallMessage | undefined): NonNullable<ToolCallMessage["tool_calls"]> {
  if (!message || !message.tool_calls?.length) return [];
  return message.tool_calls;
}

export function extractContent(message: ChatMessage | undefined): string {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  return "";
}
