import type { Config } from './config.ts';
import { log } from './logger.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  content: string;
  raw: unknown;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Minimal OpenRouter chat-completions client with retry + JSON repair.
 * All agents route through this; the model tier is chosen by the caller.
 */
export class OpenRouterClient {
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  get configured(): boolean {
    return Boolean(this.cfg.openRouterKey);
  }

  async chat(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'json_object' };
    retries?: number;
  }): Promise<OpenRouterResponse> {
    const { model, messages, temperature = 0.2, maxTokens = 4096, responseFormat, retries = 3 } = params;

    if (!this.configured) {
      throw new Error('OPENROUTER_API_KEY is not set; add it to .env or run in sample mode');
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.cfg.openRouterKey}`,
            'HTTP-Referer': 'https://github.com/figma-ui-automation',
            'X-Title': 'figma-ui-automation',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status === 429 && attempt < retries) {
            const delay = 1000 * 2 ** attempt;
            log.warn('openrouter', `429 rate-limited, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 300)}`);
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content ?? '';
        if (!content) throw new Error('OpenRouter returned empty content');

        return { content, raw: data };
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          const delay = 500 * 2 ** attempt;
          log.warn('openrouter', `attempt ${attempt} failed: ${(err as Error).message}. retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw new Error(`OpenRouter call failed after ${retries} retries: ${(lastError as Error)?.message ?? String(lastError)}`);
  }

  /**
   * Ask the model for a JSON object and parse it defensively.
   * Strips markdown fences and trailing commas before JSON.parse.
   */
  async chatJSON<T>(params: Parameters<OpenRouterClient['chat']>[0]): Promise<T> {
    const { content } = await this.chat(params);
    return parseJSON<T>(content);
  }
}

export function parseJSON<T>(text: string): T {
  let cleaned = text.trim();
  // strip ```json ... ``` fences
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(cleaned);
  if (fence) cleaned = fence[1].trim();
  // strip trailing commas (common LLM artifact)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // try to find the first {...} or [...] block
    const block = /[\[{][\s\S]*[\]}]/.exec(cleaned);
    if (block) {
      try {
        return JSON.parse(block[0].replace(/,\s*([}\]])/g, '$1')) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Failed to parse LLM JSON output: ${(err as Error).message}\n---\n${text.slice(0, 800)}`);
  }
}
