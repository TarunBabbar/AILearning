import { getConfig } from "./config";

const RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const DEFAULT_TIMEOUT_MS = 90000;

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

/**
 * Call the OpenRouter chat completions API. Resolves with the raw text content.
 */
export async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  opts: CallOptions = {}
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
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${cfg.openrouterBaseUrl}/chat/completions`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
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
      if (!content.trim()) throw new Error("Empty response from model");
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof OpenRouterError) throw err; // don't retry 4xx
      if (lastError.name === "AbortError") {
        lastError = new Error(`Request timed out after ${timeoutMs}ms`);
      }
      if (attempt < RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
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
