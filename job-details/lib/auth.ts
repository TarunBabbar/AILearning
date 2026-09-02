import { getConfig } from "./config";

/**
 * Resolve the LLM API key. Env-only:
 *  - Command Code mode (CMD_API_KEY set) → returns that key, source "cmd"
 *  - otherwise OPENROUTER_API_KEY → source "env"
 * No UI/cookie flow: the key must be set in the deployment's environment.
 */
export function resolveApiKey(): { apiKey: string; source: "env" | "cmd" | "none" } {
  const cfg = getConfig();
  if (cfg.cmdApiKey) return { apiKey: cfg.cmdApiKey, source: "cmd" };
  if (cfg.openrouterApiKey) return { apiKey: cfg.openrouterApiKey, source: "env" };
  return { apiKey: "", source: "none" };
}
