import { getProvider } from "./client";

/** Structured completion — guarantees a parsed JSON object. */
export async function completeJson(opts: {
  prompt: string;
  system?: string;
  model?: string;
}): Promise<Record<string, unknown>> {
  const provider = getProvider();
  const raw = await provider.complete({
    ...opts,
    temperature: 0.2,
    jsonMode: true,
  });
  return parseJson(raw);
}

export function parseJson(raw: string): Record<string, unknown> {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.split("\n").slice(1).join("\n");
    s = s.replace(/```$/, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Model returned non-JSON: ${raw.slice(0, 300)}`);
  }
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    throw new Error(`Invalid JSON from model: ${raw.slice(0, 300)}`);
  }
}
