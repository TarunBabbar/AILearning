import { getConfig } from "./config";

/**
 * Resolve the OpenRouter API key. Env-only — reads OPENROUTER_API_KEY.
 * No UI/cookie flow: the key must be set in the deployment's environment.
 */
export function resolveApiKey(): { apiKey: string; source: "env" | "none" } {
  const cfg = getConfig();
  if (cfg.openrouterApiKey) return { apiKey: cfg.openrouterApiKey, source: "env" };
  return { apiKey: "", source: "none" };
}
