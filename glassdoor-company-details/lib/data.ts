import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EnrichedDatasetSchema,
  type Company,
  type EnrichedDataset,
} from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const ENRICHED_PATH = path.join(DATA_DIR, "companies.enriched.json");
const RAW_PATH = path.join(DATA_DIR, "companies.raw.json");

/**
 * Read the enriched dataset straight from disk. Runs on the server
 * (Server Components / API routes) so the UI always reflects the latest
 * generated JSON without a rebuild.
 */
export async function getEnrichedDataset(): Promise<EnrichedDataset> {
  try {
    const raw = await fs.readFile(ENRICHED_PATH, "utf8");
    const parsed = EnrichedDatasetSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      companies: [],
    };
  }
}

export async function getCompanies(): Promise<Company[]> {
  const ds = await getEnrichedDataset();
  return ds.companies;
}

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const companies = await getCompanies();
  return companies.find((c) => c.slug === slug);
}

export function getCompanyTypes(companies: Company[]): string[] {
  return Array.from(new Set(companies.map((c) => c.type))).sort();
}

export async function getRawPath(): Promise<string> {
  return RAW_PATH;
}

export async function getEnrichedPath(): Promise<string> {
  return ENRICHED_PATH;
}