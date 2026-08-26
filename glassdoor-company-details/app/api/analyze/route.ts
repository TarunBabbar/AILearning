import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EnrichedDatasetSchema,
  type Company,
  type RawDataset,
} from "@/lib/types";
import { analyzeCompany } from "../../../scripts/lib/categories.mjs";
import { hasOpenRouterKey } from "../../../scripts/lib/openrouter.mjs";
import {
  parseSalaryToLpa,
  isPlausibleSalaryLine,
  average,
} from "../../../scripts/lib/salary.mjs";

const ROOT = process.cwd();
const RAW_PATH = path.join(ROOT, "data", "companies.raw.json");
const ENRICHED_PATH = path.join(ROOT, "data", "companies.enriched.json");

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "company"
  );
}

function toLpaSalaries(rawSalaries: string[], llmSalaries?: unknown[]) {
  const rows: Array<{ designation: string; avgLPA: number; rangeLPA: string; sampleSize: number }> = [];
  for (const d of llmSalaries || []) {
    const dd = d as { label?: string; valueLpa?: number };
    const v = Number(dd.valueLpa);
    if (dd.label && !Number.isNaN(v) && v > 0) {
      rows.push({ designation: dd.label, avgLPA: Math.round(v * 10) / 10, rangeLPA: `—`, sampleSize: 1 });
    }
  }
  const parsed: number[] = [];
  for (const line of rawSalaries) {
    const lpa = parseSalaryToLpa(line);
    if (lpa != null && isPlausibleSalaryLine(line)) parsed.push(lpa);
  }
  const avg = average(parsed);
  if (avg != null) {
    rows.push({ designation: "Overall / Unspecified", avgLPA: Math.round(avg * 10) / 10, rangeLPA: "—", sampleSize: parsed.length });
  }
  rows.sort((a, b) => b.avgLPA - a.avgLPA);
  return rows;
}

export async function POST(req: Request) {
  if (!hasOpenRouterKey()) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  // Enriched dataset to update.
  let enriched;
  try {
    enriched = EnrichedDatasetSchema.parse(
      JSON.parse(await fs.readFile(ENRICHED_PATH, "utf8"))
    );
  } catch {
    return NextResponse.json({ error: "enriched dataset not found or invalid" }, { status: 500 });
  }

  const target = enriched.companies.find((c) => c.slug === slug);
  if (!target) {
    return NextResponse.json({ error: `Company "${slug}" not found` }, { status: 404 });
  }

  // Find matching raw company by slug.
  let raw: RawDataset["companies"][number] | null = null;
  try {
    const rawData = JSON.parse(await fs.readFile(RAW_PATH, "utf8")) as RawDataset;
    raw =
      rawData.companies.find((c) => slugify(c.name) === slug) ??
      rawData.companies.find((c) => c.name.toLowerCase() === target.name.toLowerCase()) ??
      null;
  } catch {
    raw = null;
  }

  const sample = raw?.reviews ?? [];
  const salaries = raw?.salaries ?? [];

  let llm;
  try {
    llm = await analyzeCompany({
      name: target.name,
      rating: target.rating,
      reviews: sample,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "LLM analysis failed" },
      { status: 502 }
    );
  }

  const updated: Company = {
    ...target,
    good: Array.isArray(llm.good) ? llm.good : target.good,
    bad: Array.isArray(llm.bad) ? llm.bad : target.bad,
    industry: llm.industry || target.industry,
    sourceReviews: sample.length,
    salaries: toLpaSalaries(salaries, llm.salaries),
    analyzedAt: new Date().toISOString(),
  };

  const idx = enriched.companies.findIndex((c) => c.slug === slug);
  enriched.companies[idx] = updated;
  enriched.generatedAt = new Date().toISOString();

  await fs.writeFile(ENRICHED_PATH, JSON.stringify(enriched, null, 2), "utf8");

  return NextResponse.json({ ok: true, slug });
}