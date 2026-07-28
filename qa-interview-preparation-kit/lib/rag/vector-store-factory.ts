import { getConfig } from "../config";
import type { IVectorStore } from "./vector-store";

let store: IVectorStore | null = null;

export async function getVectorStore(): Promise<IVectorStore> {
  if (store) return store;

  const config = getConfig();

  if (config.vectorDb === "pinecone" || config.isProduction) {
    const { PineconeStore } = await import("./pinecone-store");
    store = new PineconeStore();
  } else {
    const { LocalStore } = await import("./local-store");
    store = new LocalStore();
  }

  return store;
}

// For seed script: allow store override
export function setVectorStore(override: IVectorStore) {
  store = override;
}
