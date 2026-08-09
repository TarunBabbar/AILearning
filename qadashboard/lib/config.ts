export type ModelOption = { id: string; name: string };

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
  // Short-TTL memo so repeated route calls stop re-parsing LLM_MODELS_JSON.
  const now = Date.now();
  if (configCache && now - configCache.at < 1000) return configCache.value;
  const value = buildConfig();
  configCache = { at: now, value };
  return value;
}

let configCache: { at: number; value: ReturnType<typeof buildConfig> } | null = null;

function buildConfig() {
  const embeddingDims = Number(process.env.EMBEDDING_DIMENSIONS);
  const sessionDays = Number(process.env.AUTH_SESSION_DAYS);
  // Sensible defaults so auth never breaks when the optional SCRYPT_* vars
  // are missing (e.g. fresh Vercel env setup). Matches the original seed.
  const scryptN = Number(process.env.SCRYPT_N || 16384);
  const scryptR = Number(process.env.SCRYPT_R || 8);
  const scryptP = Number(process.env.SCRYPT_P || 1);

  return {
    // OpenRouter
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || "",
    // Models — entirely env-driven
    llmModel: process.env.LLM_MODEL || "",
    llmModels: parseModels(process.env.LLM_MODELS_JSON),
    embeddingModel: process.env.EMBEDDING_MODEL || "",
    embeddingDimensions:
      Number.isFinite(embeddingDims) && embeddingDims > 0 ? embeddingDims : 0,
    // Pinecone
    pineconeApiKey: process.env.PINECONE_API_KEY || "",
    pineconeIndexName: process.env.PINECONE_INDEX_NAME || "",
    pineconeNamespace: process.env.PINECONE_NAMESPACE || "",
    // Auth
    authSecret: process.env.AUTH_SECRET || "",
    authCookieName: process.env.AUTH_COOKIE_NAME || "",
    authSessionDays:
      Number.isFinite(sessionDays) && sessionDays > 0 ? sessionDays : 0,
    scryptN: Number.isFinite(scryptN) && scryptN > 0 ? scryptN : 0,
    scryptR: Number.isFinite(scryptR) && scryptR > 0 ? scryptR : 0,
    scryptP: Number.isFinite(scryptP) && scryptP > 0 ? scryptP : 0,
    // Email
    gmailUser: process.env.GMAIL_USER || "",
    gmailPass: process.env.GMAIL_PASS || "",
    // App
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    appName: process.env.NEXT_PUBLIC_APP_NAME || "",
    isProduction: process.env.NODE_ENV === "production",
    // External job board — URL only from env (no hardcoded host)
    jobDetailsApiBase: (process.env.JOB_DETAILS_API_BASE || "").replace(/\/$/, ""),
    // Direct Postgres read access to the job board DB (qajobs). When set,
    // job/company reads bypass the HTTP hop entirely.
    jobBoardDatabaseUrl: process.env.JOB_BOARD_DATABASE_URL || "",
    // Public UI labels (NEXT_PUBLIC_* so client components can read them)
    jobBoardName:
      process.env.NEXT_PUBLIC_JOB_BOARD_NAME ||
      process.env.JOB_BOARD_NAME ||
      "job board",
    jobBoardUrl: (
      process.env.NEXT_PUBLIC_JOB_BOARD_URL ||
      process.env.JOB_DETAILS_API_BASE ||
      ""
    ).replace(/\/$/, ""),
  };
}

export type AppConfig = ReturnType<typeof buildConfig>;
