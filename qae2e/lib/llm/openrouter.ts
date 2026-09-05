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
 * returns [] on any failure (network/unauth). Cached for FREE_MODELS_TTL_MS so
 * the agent loop doesn't hit /models on every single completion.
 */
const FREE_MODELS_TTL_MS = 60_000;
let freeModelsCache: { at: number; ids: string[] } = { at: 0, ids: [] };

async function fetchFreeModels(cfg: ReturnType<typeof getConfig>): Promise<string[]> {
  const age = Date.now() - freeModelsCache.at;
  if (age >= 0 && age < FREE_MODELS_TTL_MS) return freeModelsCache.ids;
  try {
    const res = await fetch(`${cfg.openrouterBaseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}),
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return freeModelsCache.ids;
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (data.data || []).map((m) => m.id).filter((id) => id.endsWith(":free"));
    freeModelsCache = { at: Date.now(), ids: [...new Set(ids)] };
    return freeModelsCache.ids;
  } catch {
    // Network failure: reuse whatever we cached (possibly empty) rather than
    // blocking the pipeline with another slow /models call.
    return freeModelsCache.ids;
  }
}

function isCommandCodeModel(model: string): boolean {
  return !model.endsWith(":free");
}

/** Non-retryable Command Code errors — auth / bad request. */
function isCcNonRetryable(err: Error): boolean {
  const m = err.message.toLowerCase();
  return /401|403|400|invalid api key|unauthorized|invalid request/i.test(m);
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
 * Route one completion. Decision tree (fast-path first):
 *
 *   LLM_SOURCE=commandcode                        → Command Code always
 *   requested model is a Command Code id (paid)   → Command Code first, then
 *                                                     free pool fallback (auto)
 *   requested model is ":free"                    → OpenRouter free pool only
 *
 * When LLM_SOURCE=auto and the requested model is a Command Code id (the new
 * default), the fast paid model is attempted FIRST and the OpenRouter free
 * pool is only a fallback if Command Code is down. An explicit ":free" model
 * never touches Command Code (no accidental spend).
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

  // --- 2. Command Code (paid, fast) model requested -----------------------
  let ccErr: Error | null = null;
  if (requested && isCommandCodeModel(requested)) {
    if (cfg.llmSource === "openrouter") {
      // Explicitly opted into OpenRouter-only → never route a paid model there.
      throw new LlmError(
        `"${requested}" is a Command Code model (not an OpenRouter :free model). ` +
          `Set LLM_SOURCE=auto and COMMAND_CODE_API_KEY in .env to use it, ` +
          `or use an OpenRouter :free model.`
      );
    }
    if (!commandCodeAvailable(cfg)) {
      if (cfg.llmSource === "commandcode") {
        throw new LlmError(
          `"${requested}" needs the Command Code provider. Set COMMAND_CODE_API_KEY in .env.`
        );
      }
      // auto + no CC key → cannot use the paid model; drop to the free pool.
      opts.onModelSwitch?.(requested, "OpenRouter free pool", "COMMAND_CODE_API_KEY not set");
    } else {
      try {
        const { commandCodeChat } = await import("./commandcode");
        return await commandCodeChat(messages, { model: requested, ...ccOpts });
      } catch (err) {
        ccErr = err instanceof Error ? err : new Error(String(err));
        // Auth / bad-request won't be fixed by the free pool — fail fast.
        if (isCcNonRetryable(ccErr)) throw new LlmError(`Command Code (${requested}) failed: ${ccErr.message}`);
        if (cfg.llmSource === "commandcode") {
          throw new LlmError(`Command Code (${requested}) failed: ${ccErr.message}`);
        }
        // auto: fall through to the OpenRouter free pool as a last resort.
        opts.onModelSwitch?.(
          requested,
          "OpenRouter free pool",
          `Command Code (${requested}) failed — ${ccErr.message}`
        );
      }
    }
  }

  // --- 3. OpenRouter free pool with rotation (only :free models) ----------
  let pool: string[] = [];
  const push = (m: string) => {
    if (m && m.endsWith(":free") && !pool.includes(m)) pool.push(m);
  };
  if (isFree) push(requested);
  for (const m of cfg.llmModels) push(m);
  // Only fetch the live free list when we actually need more candidates AND we
  // have no fresh cache (fetchFreeModels caches internally for 60s).
  if (pool.length <= 1) {
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

  if (ccErr) {
    throw new LlmError(
      `Command Code (${requested}) failed: ${ccErr.message}; free pool also exhausted` +
        (lastErr ? ` (${lastErr.message})` : "") +
        "."
    );
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
