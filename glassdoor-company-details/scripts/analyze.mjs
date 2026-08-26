import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/env.mjs";

import { hasOpenRouterKey } from "./lib/openrouter.mjs";
import { analyzeCompany, heuristicType } from "./lib/categories.mjs";
import {
  parseSalaryToLpa,
  isPlausibleSalaryLine,
  average,
  range,
  fmtLpa,
} from "./lib/salary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_PATH = path.join(ROOT, "data", "companies.raw.json");
const ENRICHED_PATH = path.join(ROOT, "data", "companies.enriched.json");

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "company";
}

/** Build the salary table from raw salary strings + LLM designation hints. */
function consolidateSalaries(rawSalaries = [], llmDesignations = []) {
  const map = new Map();

  const add = (designation, value) => {
    const norm = (designation || "Unspecified").trim();
    if (!map.has(norm)) map.set(norm, []);
    map.get(norm).push(value);
  };

  for (const line of rawSalaries) {
    const lpa = parseSalaryToLpa(line);
    if (lpa != null && isPlausibleSalaryLine(line)) {
      // Without context we cannot know the designation; group as generic.
      add("Overall / Unspecified", lpa);
    }
  }

  for (const d of llmDesignations || []) {
    if (d && d.label && d.valueLpa) {
      const v = Number(d.valueLpa);
      if (!Number.isNaN(v) && v > 0) add(d.label, v);
    }
  }

  const rows = [];
  for (const [designation, values] of map.entries()) {
    if (values.length === 0) continue;
    const avg = average(values);
    const rng = range(values);
    if (avg == null) continue;
    rows.push({
      designation,
      avgLPA: Math.round(avg * 10) / 10,
      rangeLPA: rng ? fmtLpa(avg) : `${fmtLpa(avg)}`,
      sampleSize: values.length,
    });
  }

  rows.sort((a, b) => b.avgLPA - a.avgLPA);
  return rows;
}

async function loadRaw() {
  try {
    const text = await fs.readFile(RAW_PATH, "utf8");
    return JSON.parse(text).companies;
  } catch {
    return [];
  }
}

async function main({ seedStub = false } = {}) {
  const companies = seedStub ? [] : await loadRaw();

  if (!seedStub && companies.length === 0) {
    console.log(
      "[analyze] No raw data found at data/companies.raw.json.\n" +
        "  Run `npm run scrape` first, or paste Glassdoor data into that file " +
        "(see README), or use `--seed-stub` to write a sample dataset."
    );
    if (!hasOpenRouterKey()) {
      console.log("[analyze] No OPENROUTER_API_KEY set either — nothing to analyze.");
    }
    return;
  }

  const llm = hasOpenRouterKey();
  if (!llm && !seedStub) {
    console.warn("[analyze] OPENROUTER_API_KEY is missing. Falling back to heuristic types.");
  }

  const enriched = [];

  for (const company of companies) {
    const rawSalaries = company.salaries || [];
    let llmResult = null;

    if (llm) {
      try {
        llmResult = await analyzeCompany(company);
      } catch (err) {
        console.warn(`[analyze] LLM failed for ${company.name}: ${err.message}`);
      }
    }

    const good = Array.isArray(llmResult?.good) ? llmResult.good : [];
    const bad = Array.isArray(llmResult?.bad) ? llmResult.bad : [];

    // Fall back to leaving them empty but note the source is raw if LLM off.
    const salaries = consolidateSalaries(rawSalaries, llmResult?.salaries);

    enriched.push({
      name: company.name,
      slug: slugify(company.name),
      industry: llmResult?.industry || company.industry || "—",
      type: (llmResult?.type && ["Product","Service","Consulting","Staffing","Startup","Other"].includes(llmResult.type))
        ? llmResult.type
        : heuristicType(company),
      rating: company.rating ?? 0,
      ratingBreakdown: company.ratingBreakdown,
      totalReviews: company.totalReviews,
      headcount: company.headcount,
      good,
      bad,
      salaries,
      sourceReviews: (company.reviews || []).length,
      analyzedAt: new Date().toISOString(),
    });
  }

  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    companies: enriched,
  };

  await fs.mkdir(path.dirname(ENRICHED_PATH), { recursive: true });
  await fs.writeFile(ENRICHED_PATH, JSON.stringify(dataset, null, 2), "utf8");
  console.log(`[analyze] Wrote ${enriched.length} companies to data/companies.enriched.json`);
  if (!llm) {
    console.log("[analyze] Types were classified with local heuristics (no LLM key).");
  }
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seedStub = process.argv.includes("--seed-stub");
  main({ seedStub })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[analyze] Fatal:", err);
      process.exit(1);
    });
}

export { main as runAnalyze }; // reusable for on-demand re-analysis