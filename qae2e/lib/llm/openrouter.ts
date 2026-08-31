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

interface ChatCompletionResponse {
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

/** A request that failed for a model-availability reason (overloaded/rate limit). */
function isRetryableModelError(err: LlmError): boolean {
  const m = err.message.toLowerCase();
  return (
    /overload/i.test(m) ||
    /rate\s*limit/i.test(m) ||
    /429/i.test(m) ||
    /503/i.test(m) ||
    /upstream error/i.test(m) ||
    /no completion/i.test(m) ||
    /out of capacity/i.test(m) ||
    /temporarily/i.test(m)
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

export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const cfg = getConfig();
  const requested = opts.model || cfg.llmModel;
  assertFreeModel(requested);

  // Rotation pool: requested model first, then the configured LLM_MODELS pool,
  // then (as a last resort) the live free list from OpenRouter.
  let pool: string[] = [];
  const push = (m: string) => {
    if (m && !pool.includes(m)) pool.push(m);
  };
  push(requested);
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
      // Non-retryable (auth, bad request, model not found) — no point cycling.
      if (!isRetryableModelError(lastErr)) throw lastErr;
      const next = pool[pool.indexOf(model) + 1];
      if (next) {
        opts.onModelSwitch?.(model, next, lastErr.message);
      }
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
