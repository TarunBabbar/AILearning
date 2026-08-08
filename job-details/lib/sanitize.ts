import { getEmailDomain, isGenericDomain, titleCase } from "./company";

/**
 * Display-time sanitization. The database keeps the raw extracted text —
 * it is never modified. These helpers clean job fields only in the API
 * response layer, so junk like "Software Testing Studio" or WhatsApp
 * numbers never shows up as a company name, title, or description.
 */

/** Phrases that are promo/contact boilerplate, never a real company name. */
const JUNK_COMPANY_PHRASES = [
  "software testing studio",
  "software-testing-studio",
  "software_testing_studio",
  "whatsapp",
  "telegram",
  "interview prep kit",
  "interview preparation kit",
  "prep kit",
  "download kit",
  "subscribe",
  "newsletter",
  "job alert",
  "job update",
  "daily jobs",
  "free jobs",
  "unknown company",
  "unknown",
  "n/a",
  "tbd",
  "none",
  "join our",
  "join us",
];

/** True when a company-name string is promo/contact junk, not a company. */
export function isJunkCompanyName(
  company: string | null | undefined
): boolean {
  const s = (company || "").trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (JUNK_COMPANY_PHRASES.some((p) => lower.includes(p))) return true;
  // 5+ digit run = a phone number, not a company name.
  if (/\d{5,}/.test(s.replace(/[^\d]/g, ""))) return true;
  return false;
}

/**
 * Display name for a job's company. Junk names are replaced with the name
 * derived from the job's email domain (LLM-resolved companyInfo.name first,
 * else the domain label), falling back to "Unknown Company".
 */
export function displayCompanyName(
  company: string,
  email: string | null | undefined,
  resolvedName?: string | null
): string {
  // The extracted "company" is actually an email address.
  const companyDomain = getEmailDomain(company);
  if (companyDomain) {
    if (!isGenericDomain(companyDomain)) {
      return titleCase(companyDomain.split(".")[0]);
    }
    return "Unknown Company";
  }

  if (isJunkCompanyName(company)) {
    if (resolvedName && !isJunkCompanyName(resolvedName)) {
      return resolvedName;
    }
    const domain = getEmailDomain(email);
    if (domain && !isGenericDomain(domain)) {
      return titleCase(domain.split(".")[0]);
    }
    return "Unknown Company";
  }

  return company;
}

/**
 * Spam / contact boilerplate that gets mixed into job text — WhatsApp
 * numbers, "Software-Testing-Studio" promos, Telegram groups, etc.
 * Shared by the upload-time cleaner and the display-time sanitizer.
 */
export const SPAM_PATTERNS = [
  /\bwhatsapp\b[^.\n]*/gi,
  /\b91[- ]?\d{8,10}\b/g, // Indian mobile numbers
  /\btelegram\b[^.\n]*/gi,
  /(?:interview\s*prep\s*kit|interview\s*preparation\s*kit|prep\s*kit)[^.\n]*/gi,
  /\b(?:subscribe|newsletter|download\s*kit|join\s*our\s*telegram|join\s*whatsapp)\b[^.\n]*/gi,
  /\bsoftware[- ]testing[- ]studio\b[^.\n]*/gi,
  /\b64,\d{3}\s*\+?\s*tester/gi,
];

/**
 * Strip spam/contact boilerplate lines (line-eating) — for descriptions.
 */
export function stripSpamText(text: string): string {
  let t = text || "";
  for (const pattern of SPAM_PATTERNS) {
    t = t.replace(pattern, " ");
  }
  return t
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * Strip junk phrases while keeping the surrounding text — for titles,
 * where "Software Testing Studio QA Engineer" should keep "QA Engineer".
 */
export function stripSpamPhrases(text: string): string {
  let t = text || "";
  t = t
    .replace(/\bsoftware[\s-]*testing[\s-]*studio\b/gi, " ")
    .replace(/\bwhatsapp\b/gi, " ")
    .replace(/\btelegram\b/gi, " ")
    .replace(/\b91[- ]?\d{8,10}\b/g, " ")
    .replace(/\b\d{9,12}\b/g, " ")
    .replace(
      /\b(?:interview\s*(?:prep|preparation)\s*kit|prep\s*kit|download\s*kit)\b/gi,
      " "
    )
    .replace(/\b(?:subscribe|newsletter|join\s*our\s*(?:telegram|whatsapp))\b[^.\n]*/gi, " ")
    .replace(/\(\s*\)/g, " ");
  return t.replace(/[ \t]+/g, " ").replace(/\s+/g, " ").trim();
}

export type SanitizableJob = {
  company: string;
  title: string;
  description: string | null;
  email: string | null;
  companyInfo?: { name: string } | null;
};

/**
 * Build a display-safe copy of a job: replace junk company names with the
 * email-derived name, and strip spam text from title/description. The
 * original object (and the database row behind it) is untouched.
 */
export function sanitizeJobForDisplay<T extends SanitizableJob>(job: T): T {
  const company = displayCompanyName(job.company, job.email, job.companyInfo?.name);
  const title = stripSpamPhrases(job.title);
  const description = job.description ? stripSpamText(job.description) : job.description;
  const companyInfo =
    job.companyInfo && isJunkCompanyName(job.companyInfo.name)
      ? {
          ...job.companyInfo,
          name: displayCompanyName(job.companyInfo.name, job.email),
        }
      : job.companyInfo;
  return { ...job, company, title, description, companyInfo } as T;
}
