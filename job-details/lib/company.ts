import { callOpenRouter, extractJsonArray } from "./openrouter";
import { getConfig } from "./config";

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
  website?: string;
};

const COMPANY_SYSTEM_PROMPT =
  "You are a company research assistant. Extract company details from email domains. Respond with ONLY valid JSON. No markdown.";

function buildCompanyPrompt(domains: string[], sampleEmails: Record<string, string>): string {
  const lines = domains.map((d) => {
    const sample = sampleEmails[d];
    return `Domain: ${d}${sample ? " | Sample Email: " + sample : ""}`;
  });
  return `Given each email domain, return the company name, person name (from email prefix if useful), location, type (Product/Service/Unknown), and website if known.

Respond JSON array only:
[{"domain":"...","company":"...","personName":"...","location":"...","type":"Product|Service|Unknown","website":"..."}]

Unknown → use "Unknown". No markdown. No text before or after.

${lines.join("\n")}`;
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
  // Batch to keep each call small
  for (let i = 0; i < valid.length; i += 10) {
    const batch = valid.slice(i, i + 10);
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
          location: entry.location || undefined,
          type: entry.type || undefined,
          website: entry.website || undefined,
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
