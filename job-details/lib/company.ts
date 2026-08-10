import { callOpenRouter, extractJsonArray } from "./openrouter";
import { getConfig } from "./config";
import type { Prisma } from "@prisma-generated/client";

/**
 * Email domains treated as personal/free providers, not companies.
 * Driven by the GENERIC_EMAIL_DOMAINS env var (comma-separated).
 * A job whose email uses one of these has no resolvable company domain,
 * so its company info is left null on the dashboard.
 */
export const GENERIC_DOMAINS: Set<string> = new Set(
  getConfig().genericEmailDomains
);

export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1];
  if (!domain.includes(".")) return null;
  return domain;
}

export function isGenericDomain(domain: string | null): boolean {
  if (!domain) return true;
  const d = domain.toLowerCase();
  if (GENERIC_DOMAINS.has(d)) return true;
  // Co.UK / .in registrars that are free — treat as generic
  if (/^(gmail|yahoo|hotmail|outlook|live|icloud)\.(co\.uk|com\.au|in)$/.test(d))
    return true;
  return false;
}

export type CompanyInfo = {
  domain: string;
  company: string;
  personName?: string;
  location?: string;
  type?: string;
  description?: string;
  website?: string;
};

const COMPANY_SYSTEM_PROMPT =
  "You are a company research assistant. Extract company details from email domains. Respond with ONLY valid JSON. No markdown.";

function buildCompanyPrompt(domains: string[], sampleEmails: Record<string, string>): string {
  const lines = domains.map((d) => {
    const sample = sampleEmails[d];
    return `Domain: ${d}${sample ? " | Sample Email: " + sample : ""}`;
  });
  return `Given each email domain, return the company name, person name (from email prefix if useful), location, type (Product/Consulting/Staffing/Service/Unknown), a 1-2 sentence description of what the company does, and website if known.

Type guide:
- Product → builds its own software/product (e.g. an app, platform, SaaS)
- Consulting → sells consulting/outsourcing/professional services (e.g. IT services, tech consulting)
- Staffing → recruiting/staffing/talent placement agencies
- Service → other service businesses (non-software services)
- Unknown → cannot tell

If you cannot determine a field's value, leave it EMPTY STRING ("") — never write "Unknown", "N/A", or filler text. In particular: description must be "" when you don't know what the company does.

Respond JSON array only:
[{"domain":"...","company":"...","personName":"...","location":"...","type":"Product|Consulting|Staffing|Service|Unknown","description":"...","website":"..."}]

No markdown. No text before or after.

${lines.join("\n")}`;
}

/** True when a value is blank or an "unknown"/"n/a"-style placeholder. */
export function isUnknownValue(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = value.trim();
  if (!s) return true;
  if (/^(unknown|n\/?a|tbd|none|not\s+available|insufficient\s+information|information\s+is\s+insufficient.*|unknown\s+company.*|unknown\s+business.*|unknown\s+details.*|unknown\s+information.*|a\s+company\s+operating.*|a\s+domain\s+used.*)$/i.test(s)) {
    return true;
  }
  return /unknown|insufficient information|n\/a/i.test(s) && s.length < 80;
}

/** Normalize an LLM-resolved field: blank/unknown → "" so the UI can show "—". */
export function cleanCompanyDetail(value: string | null | undefined): string {
  return isUnknownValue(value) ? "" : value!.trim();
}

/**
 * Resolve company details for email domains using an LLM.
 * Generic/personal domains are skipped before calling.
 */
export async function resolveCompanyDetails(
  domains: string[],
  apiKey: string,
  model: string
): Promise<CompanyInfo[]> {
  const unique = [...new Set(domains.map((d) => d.toLowerCase()))];
  const valid = unique.filter((d) => !isGenericDomain(d));
  if (!valid.length) return [];

  const results: CompanyInfo[] = [];
  // Batch to keep each call manageable (aligned with resolve-companies LLM_BATCH)
  for (let i = 0; i < valid.length; i += 25) {
    const batch = valid.slice(i, i + 25);
    const prompt = buildCompanyPrompt(batch, {});
    const content = await callOpenRouter(prompt, COMPANY_SYSTEM_PROMPT, apiKey, {
      model,
      maxTokens: 4096,
      timeoutMs: 60000,
    });
    const parsed = extractJsonArray<CompanyInfo>(content);
    if (!parsed) continue;
    for (const entry of parsed) {
      if (entry.domain) {
        results.push({
          domain: entry.domain.toLowerCase(),
          company: entry.company || "Unknown",
          personName: entry.personName || undefined,
          location: cleanCompanyDetail(entry.location) || undefined,
          type: cleanCompanyDetail(entry.type) || undefined,
          description: cleanCompanyDetail(entry.description) || undefined,
          website: cleanCompanyDetail(entry.website) || undefined,
        });
      }
    }
  }
  return results;
}

export function titleCase(company: string): string {
  return company
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Common legal/structural suffixes removed when normalizing a company name. */
const COMPANY_SUFFIXES = [
  "technologies",
  "technology",
  "solutions",
  "services",
  "systems",
  "software",
  "consulting",
  "consultants",
  "group",
  "global",
  "international",
  "inc",
  "inc.",
  "ltd",
  "llc",
  "pvt",
  "pvt.",
  "private",
  "limited",
  "corp",
  "corporation",
  "co",
  "co.",
  "company",
  "labs",
  "lab",
  "tech",
  "digital",
  "it solutions",
  "it services",
  "infotech",
  "techno",
  "solutions inc",
];

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Derive a canonical company identity from a company-name string and/or an
 * email domain. The two are normalized and compared after removing TLDs and
 * common suffixes, so "INNOVENTES" + "innoventes.co" (or ".in", ".com", …)
 * both map to the same key. Returns null when nothing usable is found.
 */
export function deriveCompanyKey(
  companyText: string | null | undefined,
  email: string | null | undefined
): string | null {
  const candidates = new Set<string>();

  // From the email domain: strip TLD (and co.in / co.uk style multi-part TLDs).
  const domain = getEmailDomain(email);
  if (domain) {
    const parts = domain.split(".");
    // e.g. innoventes.co.in → ["innoventes","co","in"] → drop trailing co.in
    let label = parts[0];
    if (parts.length >= 3 && ["co", "com", "ac", "org", "net"].includes(parts[1])) {
      label = parts[0];
    }
    if (label && !isGenericDomain(domain)) {
      candidates.add(normalizeToken(label));
    }
  }

  // From the company text: strip common suffixes and normalize.
  if (companyText) {
    let t = normalizeToken(companyText);
    for (const suffix of COMPANY_SUFFIXES) {
      const pat = new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
      t = t.replace(pat, "").trim();
    }
    if (t) candidates.add(t);
    // Also add the raw normalized text as a fallback (e.g. multi-word names).
    candidates.add(normalizeToken(companyText));
  }

  return candidates.size ? [...candidates].sort((a, b) => b.length - a.length)[0] : null;
}

/**
 * Normalized duplicate key for a job: lowercase company + punctuation-
 * stripped, whitespace-collapsed description. Two jobs are the same posting
 * when both match (modulo punctuation/truncation differences from the LLM).
 */
export function jobDuplicateKey(company: string, description: string): string {
  const c = (company || "").trim().toLowerCase();
  const d = (description || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${c}||${d}`;
}

/**
 * Dedupe a job list in place of display: collapse jobs with the same
 * company + normalized description, keeping the first occurrence.
 */
export function dedupeJobs<T extends { company: string; description: string | null }>(
  jobs: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const j of jobs) {
    const key = jobDuplicateKey(j.company, j.description ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(j);
  }
  return unique;
}

/**
 * Count distinct companies using the SAME label-merge logic as the Company
 * Jobs view: groups are built by derived key, then groups whose labels
 * normalize to the same value are merged. Returns the merged count.
 */
export function countDistinctCompanies<
  T extends { company: string; email: string | null }
>(jobs: T[]): number {
  const grouped = groupJobsByCompany(jobs);
  const merged = new Set<string>();
  for (const { label } of grouped.values()) {
    merged.add(label.toLowerCase());
  }
  return merged.size;
}

/**
 * Group jobs into companies. The key is derived from the email domain when
 * available (most reliable), else from the company text.
 */
export function groupJobsByCompany<T extends { company: string; email: string | null }>(
  jobs: T[]
): Map<string, { label: string; jobs: T[] }> {
  const map = new Map<string, { label: string; jobs: T[] }>();
  for (const j of jobs) {
    const key = deriveCompanyKey(j.company, j.email);
    if (!key) continue;
    let entry = map.get(key);
    if (!entry) {
      // Prefer the email-derived label; fall back to the company text.
      const domain = getEmailDomain(j.email);
      const label = domain && !isGenericDomain(domain)
        ? titleCase(domain.split(".")[0])
        : titleCase(j.company);
      entry = { label, jobs: [] };
      map.set(key, entry);
    }
    entry.jobs.push(j);
  }
  return map;
}

/**
 * Build a Prisma `JobWhereInput` that matches a company label shown in the
 * filter dropdowns. The dropdown labels come from the email domain (e.g.
 * "akaasa.com" → "Akaasa"), so a plain match against the raw `company` text
 * misses jobs whose extracted company name differs (junk/promo text, phone
 * numbers, …). Matching the email domain too makes the filter find the same
 * jobs that produced the label.
 */
export function companyFilterWhere(label: string): Prisma.JobWhereInput {
  const domain = getEmailDomain(`${label}.com`); // "Akaasa" → "akaasa.com"
  const domainRoot = domain ? domain.split(".")[0] : label.toLowerCase();

  return {
    OR: [
      { company: { contains: label, mode: "insensitive" } },
      { email: { contains: domainRoot, mode: "insensitive" } },
    ],
  };
}
