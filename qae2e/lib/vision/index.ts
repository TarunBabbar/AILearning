// Image → text extraction via a FREE OpenRouter vision model.
// Used to back image_extract and the Figma/screenshot requirement path.

import { getConfig } from "../config";
import { LlmError } from "../llm/openrouter";

export async function extractTextFromImage(
  imageBase64: string,
  mime = "image/png"
): Promise<string> {
  const cfg = getConfig();
  if (!cfg.openrouterApiKey) throw new LlmError("OpenRouter API key not configured");

  const model = cfg.visionModel; // free vision model, e.g. google/gemma-4-26b-a4b-it:free
  if (!model.endsWith(":free")) {
    throw new LlmError(`Refusing to use paid vision model "${model}". Only :free models allowed.`);
  }

  const res = await fetch(`${cfg.openrouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.openrouterApiKey}`,
      "Content-Type": "application/json",
      ...(cfg.appUrl ? { "HTTP-Referer": cfg.appUrl } : {}),
      "X-Title": cfg.appName,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all requirement/acceptance-criteria text from this image verbatim. Return only the extracted text." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new LlmError(`Vision model error ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}
