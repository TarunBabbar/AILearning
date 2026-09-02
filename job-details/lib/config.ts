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
  const maxPdfPages = Number(process.env.MAX_PDF_PAGES);
  const maxJobs = Number(process.env.MAX_JOBS_PER_UPLOAD);
  const maxFileSizeMb = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB);

  return {
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openrouterBaseUrl:
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    // Command Code provider (billed to the Command Code plan). When
    // CMD_API_KEY is set, ALL LLM calls route here — OpenRouter free
    // models are NOT used (they're flaky/429-prone).
    cmdApiKey: process.env.CMD_API_KEY || "",
    cmdBaseUrl:
      process.env.CMD_BASE_URL || "https://api.commandcode.ai/provider/v1",
    // Explicit Command Code model; defaults to DeepSeek V4 Flash.
    cmdModel: process.env.CMD_MODEL || "deepseek/deepseek-v4-flash",
    // Default model for OpenRouter mode only (upload page default, etc.).
    llmModel: process.env.OPENROUTER_MODEL || "",
    llmModels: parseModels(process.env.LLM_MODELS_JSON),
    chatbotModel:
      process.env.CHATBOT_MODEL ||
      process.env.OPENROUTER_MODEL ||
      (process.env.CMD_API_KEY ? process.env.CMD_MODEL || "deepseek/deepseek-v4-flash" : ""),
    maxPdfPages: Number.isFinite(maxPdfPages) && maxPdfPages > 0 ? maxPdfPages : 50,
    maxJobs: Number.isFinite(maxJobs) && maxJobs > 0 ? maxJobs : 200,
    maxFileSizeMb:
      Number.isFinite(maxFileSizeMb) && maxFileSizeMb > 0 ? maxFileSizeMb : 50,
    genericEmailDomains: (process.env.GENERIC_EMAIL_DOMAINS || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    appName: process.env.NEXT_PUBLIC_APP_NAME || "QA Tracker",
    smtp: {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      fromName: process.env.SMTP_FROM_NAME || "QA Jobs Portal",
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",
    },
    isProduction: process.env.NODE_ENV === "production",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
