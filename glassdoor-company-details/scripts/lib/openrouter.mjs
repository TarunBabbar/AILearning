import "./env.mjs";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL =
  process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";
const TEMPERATURE = Number(process.env.OPENROUTER_TEMPERATURE ?? "0.2");

export function hasOpenRouterKey() {
  return Boolean(API_KEY);
}

/**
 * Ask the configured OpenRouter model to produce JSON for a prompt.
 * We explicitly ask for JSON and strip code fences.
 */
export async function askLlmJson({ system, user }) {
  if (!API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local to run analysis."
    );
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      // Force English output regardless of default locale.
      "X-Title": "Glassdoor Company Details Portal",
      "HTTP-Referer": "http://localhost:3000",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      // Encourage deterministic, English JSON.
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a data analyst. Always respond with valid JSON only, no markdown, no commentary. Answer in English.",
        },
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = await res.json();
  const content =
    data?.choices?.[0]?.message?.content ?? "{}";

  // Strip ```json fences if present.
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}