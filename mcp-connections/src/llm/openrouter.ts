import { Config } from '../config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Lightweight summary of tokens used by a run, for logging. */
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

/** How one agent call responded. `content` is the model's raw text reply. */
export interface ChatResult {
  content: string;
  usage?: Usage;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Minimal, dependency-light OpenAI-compatible client for OpenRouter.
 * Agents pass their full system + user prompt; we return the text reply.
 */
export class OpenRouterClient {
  constructor(private readonly config: Config) {}

  private get auth(): string {
    return `Bearer ${this.config.openRouterApiKey}`;
  }

  async chat(system: string, user: string, opts?: { temperature?: number }): Promise<ChatResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.auth,
        'X-Title': 'figma-to-playwright-agents',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: opts?.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `OpenRouter request failed (${res.status}): ${body.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenRouter returned an empty completion.');
    }

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }
}