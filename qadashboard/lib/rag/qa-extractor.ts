import { chatCompletion } from "@/lib/openrouter";

export async function extractQAPairs(
  text: string,
  sourceDoc: string,
  model?: string
): Promise<{ question: string; answer: string }[]> {
  const systemPrompt = `Extract all question and answer pairs from the following interview preparation document. Return ONLY a JSON array of objects with "question" and "answer" fields. If no clear Q&A pairs exist, return an empty array. Do not include any explanatory text.

Example:
[{"question": "What is Selenium?", "answer": "Selenium is an open-source tool for automating web browsers."}]`;

  try {
    const raw = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extract Q&A pairs from this document (truncated to 60000 chars):\n\n${text.slice(0, 60000)}`,
        },
      ],
      model,
      0.3,
      8192
    );

    const parsed = parseJSONArray(raw);
    if (parsed.length > 0) return parsed;
  } catch {
    // fall through to fallback
  }

  return fallbackExtract(text);
}

function fallbackExtract(text: string): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  const lines = text.split("\n");
  let currentQ = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes("?") && trimmed.length < 200) {
      if (currentQ) {
        pairs.push({ question: currentQ, answer: "" });
      }
      currentQ = trimmed;
    } else if (currentQ) {
      const last = pairs[pairs.length - 1];
      if (last) last.answer += trimmed + " ";
    }
  }

  if (currentQ) pairs.push({ question: currentQ, answer: "" });
  return pairs;
}

function parseJSONArray(raw: string): { question: string; answer: string }[] {
  // Strip markdown fences
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].startsWith("```")) lines.pop();
    cleaned = lines.join("\n");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try brace balancing for truncated responses
    const open = (cleaned.match(/\[/g) || []).length;
    const close = (cleaned.match(/\]/g) || []).length;
    if (open > close) cleaned += "]".repeat(open - close);

    try {
      return JSON.parse(cleaned);
    } catch {
      return [];
    }
  }
}
