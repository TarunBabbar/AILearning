import { getConfig, type ModelOption } from "./config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function headers() {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }
  return {
    Authorization: `Bearer ${cfg.openrouterApiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://tarunbabbar.com",
    "X-Title": cfg.botName,
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string,
  timeoutMs = 60_000
): Promise<string> {
  const cfg = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.openrouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: headers(),
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "unknown error");
      throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 300)}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;
    // Some free models stream reasoning into `reasoning` and leave `content` null.
    const content = message?.content || message?.reasoning || "";
    return typeof content === "string" ? content.trim() : "";
  } finally {
    clearTimeout(timer);
  }
}

// Try the ordered free models (index 0 = fastest, tried first). On any failure
// (rate limit, delisted model, network error, empty reply, timeout) fall back
// to the next model until the chain is exhausted.
export async function chatCompletionWithFallback(
  messages: ChatMessage[],
  orderedModels: ModelOption[]
): Promise<{ content: string; model: string; modelName: string }> {
  const failures: string[] = [];

  for (const model of orderedModels) {
    try {
      const content = await chatCompletion(messages, model.id);
      if (!content.trim()) {
        throw new Error("Empty response from model");
      }
      return { content, model: model.id, modelName: model.name };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      failures.push(`${model.name} (${model.id}): ${reason}`);
      console.error(`[TarunBot] Model "${model.id}" failed → ${reason}`);
    }
  }

  throw new Error(
    `All free models failed. Tried ${orderedModels.length}: ${failures.join("; ")}`
  );
}
