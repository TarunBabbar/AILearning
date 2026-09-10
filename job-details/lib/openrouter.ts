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
  /**
   * Absolute epoch-ms after which retries stop. Prevents a slow upstream from
   * burning the caller's whole time budget on attempts that cannot finish
   * (e.g. repeated gateway 524s during a long-running extraction).
   */
  deadlineMs?: number;
  /**
   * Stream the completion (SSE) instead of waiting for the whole body.
   * Long generations otherwise sit silent for minutes, which the provider's
   * gateway kills with HTTP 524. Streaming keeps bytes flowing so the
   * connection stays alive. Falls back to non-streaming if streaming fails.
   */
  stream?: boolean;
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

type StreamDelta = {
  content?: string | null;
  /** Some providers stream reasoning models with a separate field. */
  reasoning_content?: string | null;
  reasoning?: string | null;
};

type StreamChunk = {
  choices?: {
    delta?: StreamDelta;
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string; code?: number | string };
};

type StreamedCompletion = {
  content: string;
  finishReason?: string;
  usage: string;
  /** Diagnostics: SSE frames seen, and the raw body prefix (for empty results). */
  frames: number;
  rawPreview: string;
};

/** Extract text from a message.content that may be a string or content parts. */
function readMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : ""
      )
      .join("");
  }
  return "";
}

/**
 * Read a streamed (SSE) chat completion, accumulating the assistant content.
 * `onData` is called for every chunk so the caller can re-arm its idle
 * watchdog while tokens are still flowing.
 *
 * Deliberately tolerant, because providers vary here:
 *  - mid-stream `{"error":...}` frames are surfaced (they used to be dropped,
 *    which looked like an empty completion);
 *  - a 200 response that is plain JSON rather than SSE (some gateways ignore
 *    `stream:true`) is parsed as a normal completion;
 *  - `reasoning_content`/`reasoning` deltas count as content when the model
 *    puts no text in `content`.
 */
async function readStreamedCompletion(
  response: Response,
  onData: () => void
): Promise<StreamedCompletion> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming response had no body");

  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  let content = "";
  let reasoning = "";
  let finishReason: string | undefined;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let frames = 0;
  let streamError: StreamChunk["error"] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onData();
    const text = decoder.decode(value, { stream: true });
    // Keep a bounded copy — enough for a non-SSE body or diagnostics.
    if (raw.length < 128_000) raw += text;
    buffer += text;
    // SSE frames are newline-delimited; keep the trailing partial line.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      frames++;
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        continue; // partial/garbled frame — the next one carries the rest
      }
      if (chunk.error) {
        streamError = chunk.error;
        continue;
      }
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;
      if (typeof delta?.content === "string") content += delta.content;
      const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning;
      if (typeof reasoningDelta === "string") reasoning += reasoningDelta;
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }
  }

  // No SSE frames at all — the gateway/Cmd provider sent a plain JSON body.
  if (frames === 0) {
    const trimmedRaw = raw.trim();
    if (trimmedRaw) {
      let body: StreamChunk | null = null;
      try {
        body = JSON.parse(trimmedRaw) as StreamChunk;
      } catch {
        body = null;
      }
      if (body?.error) {
        throw new OpenRouterError(
          `Provider stream error: ${body.error.message ?? "unknown error"}`,
          typeof body.error.code === "number" ? body.error.code : 500
        );
      }
      const message = body?.choices?.[0]?.message?.content;
      const fromBody = readMessageContent(message);
      if (fromBody) {
        if (body?.usage) {
          promptTokens = body.usage.prompt_tokens;
          completionTokens = body.usage.completion_tokens;
        }
        finishReason = body?.choices?.[0]?.finish_reason ?? undefined;
        content = fromBody;
      }
    }
  }

  // A mid-stream error frame: surface it so the retry layer can react
  // (5xx is retryable) instead of silently returning nothing.
  if (streamError && !content) {
    throw new OpenRouterError(
      `Provider stream error: ${streamError.message ?? "unknown error"}`,
      typeof streamError.code === "number" ? streamError.code : 500
    );
  }

  // Fall back to reasoning text when the model emitted no user-visible content.
  if (!content && reasoning) content = reasoning;

  const usage =
    completionTokens != null
      ? `in:${promptTokens ?? "?"} out:${completionTokens}`
      : "usage:n/a";
  return { content, finishReason, usage, frames, rawPreview: raw.slice(0, 200) };
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
  const deadlineMs = opts.deadlineMs;
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
  // Streaming is what keeps long generations alive through the provider
  // gateway. It is retried on failure, and only abandoned after repeated
  // failures (then the call falls back to non-streamed requests).
  let streamEnabled = opts.stream === true;
  let streamFailures = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    const controller = new AbortController();
    // Idle watchdog: abort when the provider goes quiet for timeoutMs.
    // Re-armed on every streamed chunk, so a long-but-healthy generation is
    // never killed while silence never exceeds the timeout.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), timeoutMs);
    };
    try {
      armIdle();

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
          stream: streamEnabled,
          // DeepSeek V4 Flash (reasoning model) thinks for minutes on
          // structured tasks and can return empty content when reasoning
          // eats the token budget. Disable reasoning for deterministic
          // JSON work so responses come back fast and complete.
          ...(usingCmd ? { reasoning: { enabled: false } } : {}),
        }),
      });

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

      let content: string;
      let finishReason: string | undefined;
      let usage: string;
      let streamDiag = "";
      if (streamEnabled) {
        const streamed = await readStreamedCompletion(response, armIdle);
        content = streamed.content;
        finishReason = streamed.finishReason;
        usage = streamed.usage;
        streamDiag = ` frames=${streamed.frames} raw=${JSON.stringify(streamed.rawPreview)}`;
      } else {
        armIdle();
        const data = await response.json();
        content = readMessageContent(data.choices?.[0]?.message?.content);
        finishReason = data.choices?.[0]?.finish_reason as string | undefined;
        usage = data.usage
          ? `in:${data.usage.prompt_tokens ?? "?"} out:${data.usage.completion_tokens ?? "?"}`
          : "usage:n/a";
      }
      if (!content.trim()) {
        throw new Error(
          finishReason === "length"
            ? `Model hit the output limit (finish_reason=length, max_tokens=${maxTokens}) and returned no content — raise EXTRACT_MAX_TOKENS or use smaller chunks.`
            : `Empty response from model (finish_reason=${finishReason ?? "unknown"}${streamEnabled ? ", streamed" : ""})${streamDiag}`
        );
      }
      if (finishReason === "length") {
        log.warn(
          "llm",
          "Response was truncated at the output limit — JSON may be incomplete",
          `max_tokens=${maxTokens}`
        );
      }

      log.info(
        "llm",
        `${usingCmd ? "Command Code" : "OpenRouter"} responded OK in ${ms(Date.now() - startedAt)} (attempt ${attempt}${streamEnabled ? ", streamed" : ""})`,
        `${content.length} chars · ${usage}`
      );
      if (idleTimer) clearTimeout(idleTimer);
      return content;
    } catch (err) {
      if (idleTimer) clearTimeout(idleTimer);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Streaming is what keeps long generations from being cut off by the
      // gateway, so prefer retrying WITH streaming. Only fall back to plain
      // (non-streamed) requests after it fails repeatedly.
      if (streamEnabled) {
        streamFailures += 1;
        if (streamFailures >= 2) {
          streamEnabled = false;
          log.warn(
            "llm",
            `Streaming failed ${streamFailures}× (${lastError.message}) — falling back to non-streamed requests`,
            `elapsed ${ms(Date.now() - attemptStart)}`
          );
        } else {
          log.warn(
            "llm",
            `Streaming attempt failed (${lastError.message}) — retrying with streaming`,
            `elapsed ${ms(Date.now() - attemptStart)}`
          );
        }
      }

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
        // Past the caller's budget the retry cannot finish in time — fail now
        // so the chunk is skipped instead of stalling the whole run.
        if (deadlineMs && Date.now() + delay >= deadlineMs) {
          log.warn(
            "llm",
            `Attempt ${attempt}/${maxRetries} failed (${lastError.message}) — deadline reached, not retrying`,
            `elapsed ${ms(Date.now() - attemptStart)}`
          );
          throw lastError;
        }
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
