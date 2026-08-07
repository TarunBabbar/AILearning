import { getConfig } from "./config";
import { createLogger, ms, type Logger } from "./logger";

const MAX_RETRIES = 4;
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
};

export class OpenRouterError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

function retryDelayMs(attempt: number): number {
  // 1.5s, 3s, 6s, 12s — exponential backoff
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
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
  log: Logger = createLogger()
): Promise<string> {
  const cfg = getConfig();
  const key = apiKey || cfg.openrouterApiKey;
  if (!key) {
    throw new OpenRouterError(
      "OpenRouter API key is missing. Set OPENROUTER_API_KEY in the environment.",
      400
    );
  }

  const model = opts.model || cfg.llmModel;
  if (!model) {
    throw new OpenRouterError(
      "No OpenRouter model configured. Set OPENROUTER_MODEL in the environment.",
      400
    );
  }

  const maxTokens = opts.maxTokens ?? 8192;
  const temperature = opts.temperature ?? 0.1;
  const timeoutMs = opts.timeoutMs ?? ABORT_TIMEOUT_MS;
  const url = `${cfg.openrouterBaseUrl}/chat/completions`;
  const keyPreview = key.length > 14 ? `${key.slice(0, 11)}…${key.slice(-3)}` : "***";

  log.info("llm", `Calling OpenRouter · model=${model}`, `key=${keyPreview} maxTokens=${maxTokens}`);

  let lastError: Error | null = null;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": "https://job-details.vercel.app",
          "X-Title": "Job Details",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body.slice(0, 400);
        if (response.status === 401) {
          throw new OpenRouterError(
            "OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY.",
            401
          );
        }
        if (response.status === 402) {
          throw new OpenRouterError(
            "OpenRouter returned 402 — the model may require credits/top-up, or no free variant exists for it.",
            402
          );
        }
        throw new OpenRouterError(
          `OpenRouter API ${response.status}: ${detail}`,
          response.status
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
        `OpenRouter responded OK in ${ms(Date.now() - startedAt)} (attempt ${attempt})`,
        `${content.length} chars · ${usage}`
      );
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof OpenRouterError) throw err; // don't retry 4xx

      if (lastError.name === "AbortError") {
        lastError = new Error(`Request aborted after ${ms(timeoutMs)} (safety timeout)`);
      }

      const retryable = isRetryableStatus((err as { status?: number })?.status ?? 0);
      if (retryable && attempt < MAX_RETRIES) {
        const delay = retryDelayMs(attempt);
        log.warn(
          "llm",
          `Attempt ${attempt}/${MAX_RETRIES} failed (${lastError.message}) — retrying in ${ms(delay)}`,
          `elapsed ${ms(Date.now() - attemptStart)}`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (attempt < MAX_RETRIES) {
        const delay = retryDelayMs(attempt);
        log.warn(
          "llm",
          `Attempt ${attempt}/${MAX_RETRIES} failed (${lastError.message}) — retrying in ${ms(delay)}`,
          `elapsed ${ms(Date.now() - attemptStart)}`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      log.error(
        "llm",
        `All ${MAX_RETRIES} attempts failed after ${ms(Date.now() - startedAt)}`,
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
