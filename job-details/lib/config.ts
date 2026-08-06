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

  return {
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openrouterBaseUrl:
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    llmModel: process.env.OPENROUTER_MODEL || "",
    llmModels: parseModels(process.env.LLM_MODELS_JSON),
    maxPdfPages: Number.isFinite(maxPdfPages) && maxPdfPages > 0 ? maxPdfPages : 50,
    maxJobs: Number.isFinite(maxJobs) && maxJobs > 0 ? maxJobs : 200,
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Job Details",
    isProduction: process.env.NODE_ENV === "production",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
