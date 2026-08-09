import { getConfig } from "./config";

// Free-model hard guard: refuse any model id that is not a free endpoint.
export function assertFreeModel(model: string): void {
  if (!model.endsWith(":free")) {
    throw new Error(`Model "${model}" is not a free model. Only :free models are allowed.`);
  }
}

export function getApiKey(): string {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }
  return cfg.openrouterApiKey;
}

function resolveModel(model?: string): string {
  const cfg = getConfig();
  const id = model || cfg.llmModel;
  if (!id) throw new Error("LLM_MODEL not configured");
  assertFreeModel(id);
  return id;
}

function baseUrl(): string {
  const cfg = getConfig();
  if (!cfg.openrouterBaseUrl) {
    throw new Error("OPENROUTER_BASE_URL not configured");
  }
  return cfg.openrouterBaseUrl;
}

function headers() {
  const cfg = getConfig();
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": cfg.appUrl,
    "X-Title": cfg.appName,
  };
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  model?: string,
  temperature = 0.7,
  maxTokens = 4096,
  timeoutMs = 60_000
): Promise<string> {
  const cfg = getConfig();
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: resolveModel(model),
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function* chatCompletionStream(
  messages: { role: string; content: string }[],
  model?: string,
  temperature = 0.7,
  maxTokens = 4096
): AsyncGenerator<string> {
  const cfg = getConfig();
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: resolveModel(model),
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed chunks
      }
    }
  }
}
