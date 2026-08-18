import OpenAI from "openai";

/**
 * LLM provider abstraction — Vercel-friendly.
 * LLM_PROVIDER=openrouter (HTTP, serverless-safe) | command-code (local CLI only)
 * Adding a provider = one class + one registry entry.
 */
export interface LLMProvider {
  name: string;
  complete(opts: {
    prompt: string;
    system?: string;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
  }): Promise<string>;
}

class OpenRouterProvider implements LLMProvider {
  name = "openrouter";
  private client: OpenAI;

  constructor() {
    const key = process.env.LLM_API_KEY;
    if (!key) throw new Error("LLM_API_KEY missing for openrouter provider");
    this.client = new OpenAI({
      apiKey: key,
      baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    });
  }

  async complete({ prompt, system, temperature = 0.2, jsonMode, model }: {
    prompt: string;
    system?: string;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
  }): Promise<string> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const resp = await this.client.chat.completions.create({
      model: model || process.env.LLM_MODEL || "openrouter/auto",
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    });
    return resp.choices[0]?.message?.content ?? "";
  }
}

/** Command Code — local dev only (not usable in Vercel serverless). */
class CommandCodeProvider implements LLMProvider {
  name = "command-code";

  async complete({ prompt, system, model }: {
    prompt: string;
    system?: string;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
  }): Promise<string> {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(execFile);

    const binary = process.env.CMDCODE_BIN || "cmdc";
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    const args = ["-p", fullPrompt, "--output-format", "json"];
    if (model || process.env.LLM_MODEL) args.push("-m", model || process.env.LLM_MODEL!);

    const { stdout } = await exec(binary, args, { timeout: 300_000 });
    // NDJSON events + final result line; extract first text field.
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const event = JSON.parse(trimmed);
        const content = event.text || event.content || event.output || event.message;
        if (typeof content === "string" && content) return content;
      } catch {
        /* skip malformed event lines */
      }
    }
    return stdout.trim();
  }
}

export const PROVIDER_REGISTRY: Record<string, new () => LLMProvider> = {
  openrouter: OpenRouterProvider,
  "command-code": CommandCodeProvider,
};

export function getProvider(): LLMProvider {
  const name = process.env.LLM_PROVIDER || "openrouter";
  const Ctor = PROVIDER_REGISTRY[name];
  if (!Ctor) throw new Error(`Unknown LLM_PROVIDER: ${name}. Registered: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`);
  return new Ctor();
}
