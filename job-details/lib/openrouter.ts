import { getConfig } from "./config";
import { createLogger, ms, type Logger } from "./logger";

const MAX_RETRIES = 6;
const BASE_RETRY_DELAY_MS = 1500;
// No hard timeout on the model call itself — OpenRouter responses for large
// jobs can legitimately take a few minutes. We rely on retries for
// transient failures (429/5xx/network) instead of aborting mid-generation.
const ABORT_TIMEOUT_MS = 10 * 60 * 1000; // 10 min safety net only

type CallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Retry limit per call; defaults to MAX_RETRIES (6). */
  maxRetries?: number;
  /** Hard cap on retry backoff in ms; defaults to 120s. */
  maxRetryDelayMs?: number;
};

/** A prior exchange in the conversation, for chat memory. */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export class OpenRouterError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status = 500, retryAfterMs?: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryDelayMs(
  attempt: number,
  status: number | undefined,
  maxDelayMs: number,
  retryAfterMs?: number
): number {
  // Respect the provider's Retry-After header when present (OpenRouter
  // returns it for 429s so clients don't hammer the shared free pool).
  let base: number;
  if (retryAfterMs != null) {
    base = Math.min(maxDelayMs, Math.max(0, retryAfterMs));
  } else if (status === 429) {
    // Rate limits need much longer waits. 10s, 20s, 40s…
    base = Math.min(maxDelayMs, 10_000 * Math.pow(2, attempt - 1));
  } else {
    // 1.5s, 3s, 6s, 12s — exponential backoff, capped at maxDelayMs
    base = Math.min(maxDelayMs, BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
  }

  // Add up to ±25% jitter so N parallel chunks don't all retry at the same
  // instant and re-hammer the provider in lockstep after a 429.
  const jitter = 0.75 + Math.random() * 0.5; // 0.75 → 1.25
  return Math.round(base * jitter);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Call the OpenRouter chat completions API. Resolves with the raw text content.
 * Emits detailed progress events via the logger for both the server console
 * and (optionally) the streaming client.
 */
export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  opts: CallOptions = {},
  log: Logger = createLogger(),
  history: ChatMessage[] = []
): Promise<string> {
  const cfg = getConfig();
  const usingCmd = Boolean(cfg.cmdApiKey);
  // Command Code provider mode: use CMD_API_KEY + CMD_MODEL and the CMD
  // endpoint. OpenRouter free models are NOT used in this mode.
  const key = usingCmd ? cfg.cmdApiKey : apiKey || cfg.openrouterApiKey;
  if (!key) {
    throw new OpenRouterError(
      usingCmd
        ? "CMD_API_KEY is missing. Set it in the environment."
        : "OpenRouter API key is missing. Set OPENROUTER_API_KEY in the environment.",
      400
    );
  }

  const model = opts.model || (usingCmd ? cfg.cmdModel : cfg.llmModel);
  if (!model) {
    throw new OpenRouterError(
      "No LLM model configured. Set OPENROUTER_MODEL in the environment.",
      400
    );
  }

  const maxTokens = opts.maxTokens ?? 8192;
  const temperature = opts.temperature ?? 0.1;
  const timeoutMs = opts.timeoutMs ?? ABORT_TIMEOUT_MS;
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  const maxRetryDelayMs = opts.maxRetryDelayMs ?? 60_000;
  const baseUrl = usingCmd ? cfg.cmdBaseUrl : cfg.openrouterBaseUrl;
  const url = `${baseUrl}/chat/completions`;
  const keyPreview = key.length > 14 ? `${key.slice(0, 11)}…${key.slice(-3)}` : "***";
  const referer = cfg.appUrl || "https://openrouter.ai";

  log.info(
    "llm",
    `Calling ${usingCmd ? "Command Code" : "OpenRouter"} · model=${model}`,
    `key=${keyPreview} maxTokens=${maxTokens}`
  );

  let lastError: Error | null = null;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        headers: usingCmd
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
            }
          : {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              "HTTP-Referer": referer,
              "X-Title": "QA Tracker",
            },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
          stream: false,
          // DeepSeek V4 Flash (reasoning model) thinks for minutes on
          // structured tasks and can return empty content when reasoning
          // eats the token budget. Disable reasoning for deterministic
          // JSON work so responses come back fast and complete.
          ...(usingCmd ? { reasoning: { enabled: false } } : {}),
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body.slice(0, 400);
        const providerName = usingCmd ? "Command Code" : "OpenRouter";
        if (response.status === 401) {
          throw new OpenRouterError(
            `${providerName} rejected the API key (401). Check ${usingCmd ? "CMD_API_KEY" : "OPENROUTER_API_KEY"}.`,
            401
          );
        }
        if (response.status === 402) {
          throw new OpenRouterError(
            `${providerName} returned 402 — the model may require credits/top-up, or no free variant exists for it.`,
            402
          );
        }
        // Capture the provider's retry-after so the backoff can honor it.
        const retryAfterSec = response.headers.get("retry-after");
        const retryAfterMs = retryAfterSec
          ? Number(retryAfterSec) * 1000
          : undefined;
        throw new OpenRouterError(
          `${providerName} API ${response.status}: ${detail}`,
          response.status,
          Number.isFinite(retryAfterMs) ? retryAfterMs : undefined
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const usage = data.usage
        ? `in:${data.usage.prompt_tokens ?? "?"} out:${data.usage.completion_tokens ?? "?"}`
        : "usage:n/a";
      if (!content.trim()) throw new Error("Empty response from model");

      log.info(
        "llm",
        `${usingCmd ? "Command Code" : "OpenRouter"} responded OK in ${ms(Date.now() - startedAt)} (attempt ${attempt})`,
        `${content.length} chars · ${usage}`
      );
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const status =
        err instanceof OpenRouterError
          ? err.status
          : ((err as { status?: number })?.status ?? 0);

      // Retry 429 / 408 / 5xx. Do not retry auth/payment (401/402) or other 4xx.
      const retryable =
        err instanceof OpenRouterError
          ? isRetryableStatus(status)
          : true; // network / abort / empty — retry

      if (!retryable) throw err;

      if (attempt < maxRetries) {
        const retryAfterMs =
          err instanceof OpenRouterError ? err.retryAfterMs : undefined;
        const delay = retryDelayMs(attempt, status, maxRetryDelayMs, retryAfterMs);
        log.warn(
          "llm",
          `Attempt ${attempt}/${maxRetries} failed (${lastError.message}) — retrying in ${ms(delay)}`,
          `elapsed ${ms(Date.now() - attemptStart)}`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      log.error(
        "llm",
        `All ${maxRetries} attempts failed after ${ms(Date.now() - startedAt)}`,
        lastError.message
      );
    }
  }

  throw lastError ?? new Error("Unknown OpenRouter error");
}

/**
 * Parse a JSON array out of a model response that may contain
 * markdown fences or surrounding prose.
 */
export function extractJsonArray<T = unknown>(content: string): T[] | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const match = candidate.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function extractJsonObject<T = Record<string, unknown>>(
  content: string
): T | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
