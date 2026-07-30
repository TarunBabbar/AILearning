import { getConfig } from "./config";

function getApiKey(): string {
  const cfg = getConfig();
  return cfg.openrouterApiKey;
}

function getBaseUrl(): string {
  return getConfig().openrouterBaseUrl;
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  model?: string,
  temperature = 0.7,
  maxTokens = 4096
): Promise<string> {
  const cfg = getConfig();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://qa-dashboard.vercel.app",
      "X-Title": cfg.appName,
    },
    body: JSON.stringify({
      model: model || cfg.llmModel,
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://qa-dashboard.vercel.app",
      "X-Title": cfg.appName,
    },
    body: JSON.stringify({
      model: model || cfg.llmModel,
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
