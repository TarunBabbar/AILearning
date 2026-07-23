import { config } from "dotenv";
config({ override: true });

const RETRIES = parseInt(process.env.OPENROUTER_RETRIES || "3");
const RETRY_DELAY_MS = parseInt(process.env.OPENROUTER_RETRY_DELAY_MS || "2000");
const DEFAULT_TEMPERATURE = parseFloat(process.env.OPENROUTER_TEMPERATURE || "0.1");

function getProviderConfig() {
  const provider = (process.env.LLM_PROVIDER || "openrouter").toLowerCase();
  if (provider === "omniroute") {
    return {
      base: process.env.OMNIROUTE_BASE || "http://localhost:20128/v1",
      apiKey: process.env.OMNIROUTE_API_KEY,
      defaultModel: process.env.OMNIROUTE_MODEL,
      defaultMaxTokens: parseInt(process.env.OMNIROUTE_MAX_TOKENS || "65536"),
      label: "OmniRoute",
    };
  }
  return {
    base: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_MODEL,
    defaultMaxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || "4096"),
    label: "OpenRouter",
  };
}

export async function callOpenRouter(prompt, systemPrompt, opts = {}) {
  const cfg = getProviderConfig();
  if (!cfg.apiKey) throw new Error(`${cfg.label} API key not set in .env file`);
  if (!cfg.defaultModel) throw new Error(`${cfg.label} model not set in .env file (set ${cfg.label === "OmniRoute" ? "OPENROUTER_MODEL" : "OMNIROUTE_MODEL"})`);

  const model = opts.model || cfg.defaultModel;
  const maxTokens = opts.maxTokens || cfg.defaultMaxTokens;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = opts.timeout || parseInt(process.env.OPENROUTER_TIMEOUT_MS || "120000");

  const keyPreview = cfg.apiKey.slice(0, 12) + "...";
  console.log(`[${cfg.label}] model=${model} | key=${keyPreview} | maxTokens=${maxTokens} | timeout=${timeoutMs}ms`);

  const url = `${cfg.base}/chat/completions`;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature,
          stream: false,
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error(`[${cfg.label}] API error ${response.status} attempt ${attempt + 1}: ${errBody.slice(0, 300)}`);
        throw new Error(`${cfg.label} API ${response.status}: ${errBody.slice(0, 500)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const usage = data.usage
        ? `(in:${data.usage.prompt_tokens} out:${data.usage.completion_tokens} total:${data.usage.total_tokens})`
        : "";
      console.log(`[${cfg.label}] Success attempt ${attempt + 1} — ${content.length} chars ${usage}`);

      if (!content.trim()) throw new Error("Empty response");
      return content;
    } catch (err) {
      if (err.name === "AbortError") {
        console.error(`[${cfg.label}] Timed out (${timeoutMs}ms) attempt ${attempt + 1}`);
      } else {
        console.error(`[${cfg.label}] Attempt ${attempt + 1} failed: ${err.message}`);
      }
      if (attempt === RETRIES - 1) throw err;
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.log(`[${cfg.label}] Retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
