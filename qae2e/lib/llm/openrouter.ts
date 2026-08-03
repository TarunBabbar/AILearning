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

export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  const cfg = getConfig();
  const model = opts.model || cfg.llmModel;
  assertFreeModel(model);
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
      "HTTP-Referer": "https://qae2e.vercel.app",
      "X-Title": cfg.appName.replace(/[^\x20-\x7E]/g, ""),
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new LlmError(`OpenRouter error ${res.status}: ${err.slice(0, 500)}`);
  }

  const parsed = (await res.json()) as ChatCompletionResponse & { error?: { message?: string } };

  // OpenRouter can 200 with { error: {...} } (provider down / model out of
  // capacity) or with an empty choices array — surface it instead of blowing
  // up with "Cannot read properties of undefined (reading '0')".
  if (parsed.error?.message) {
    throw new LlmError(`OpenRouter: ${parsed.error.message}`);
  }
  if (!Array.isArray(parsed.choices) || parsed.choices.length === 0) {
    throw new LlmError(
      `OpenRouter returned no completion (model: ${model}). The free provider may be out of capacity — try again.`
    );
  }

  return parsed;
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
