export function getConfig() {
  return {
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openrouterBaseUrl:
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    llmModel: process.env.LLM_MODEL || "google/gemma-4-26b-a4b-it:free",
    embeddingModel:
      process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS) || 1536,
    pineconeApiKey: process.env.PINECONE_API_KEY || "",
    pineconeIndexName: process.env.PINECONE_INDEX_NAME || "qa-dashboard",
    isProduction: process.env.NODE_ENV === "production",
    appName: process.env.NEXT_PUBLIC_APP_NAME || "QA AI Dashboard",
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
