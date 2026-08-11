import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export type ModelOption = { id: string; name: string };

// Free-model hard guard: refuse any model id that is not a free endpoint.
export function assertFreeModel(model: string): void {
  if (!model.endsWith(":free")) {
    throw new Error(`Model "${model}" is not a free model. Only :free models are allowed.`);
  }
}

// The project's .env.local file is the SINGLE source of truth in local dev —
// system/user environment variables are never consulted while the file exists,
// so a stale OPENROUTER_API_KEY exported elsewhere can't leak in.
// Only when the file is absent (e.g. Vercel, where env vars come from the
// dashboard via process.env and no .env.local exists on disk) do we fall back
// to process.env.
const envFromFile: Record<string, string> = {};
let hasEnvFile = false;
try {
  const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  Object.assign(envFromFile, dotenv.parse(raw));
  hasEnvFile = true;
} catch {
  // .env.local missing — fall back to process.env (Vercel)
}

function env(name: string): string | undefined {
  return hasEnvFile ? envFromFile[name] : process.env[name];
}

function parseModels(raw: string | undefined): ModelOption[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ModelOption[];
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (m) => m && typeof m.id === "string" && typeof m.name === "string"
      );
    }
  } catch {
    // invalid JSON — ignore
  }
  return [];
}

export function getConfig() {
  const freeModels = parseModels(env("FREE_MODELS_JSON"));
  // Enforce the free-model guard so a misconfigured env can't bill the user.
  for (const m of freeModels) {
    assertFreeModel(m.id);
  }

  return {
    // OpenRouter
    openrouterApiKey: env("OPENROUTER_API_KEY") || "",
    openrouterBaseUrl: env("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1",
    // Ordered free models — index 0 = fastest, tried first; falls to next on failure
    freeModels,
    // WhatsApp
    whatsappNumber: env("WHATSAPP_NUMBER") || "",
    whatsappPrefix: env("WHATSAPP_PREFIX") || "+91",
    // Bot persona
    botName: env("BOT_NAME") || "Tarun's AI Assistant",
    profileOwner: env("PROFILE_OWNER") || "Tarun Kumar Babbar",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
