import OpenAI from "openai";
import { getConfig } from "./config";

let client: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI {
  if (client) return client;

  const config = getConfig();

  if (!config.openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Please add it to your .env.local file."
    );
  }

  client = new OpenAI({
    baseURL: config.openrouterBaseUrl,
    apiKey: config.openrouterApiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://qa-interview-prep.vercel.app",
      "X-OpenRouter-Title": "QA Interview Assistant",
    },
  });

  return client;
}
