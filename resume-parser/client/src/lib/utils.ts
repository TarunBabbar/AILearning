import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(d: string | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-IN", { 
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function getScoreColor(score: number) {
  if (score >= 60) return "text-emerald-700";
  if (score >= 30) return "text-amber-700";
  return "text-red-600";
}

export function getScoreBg(score: number) {
  if (score >= 60) return "bg-emerald-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-red-500";
}

export const GENERIC_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "ymail.com", "live.com"];

export function isCompanyEmail(email: string, company?: string) {
  if (!email) return false;
  if (!company || company.toLowerCase() === "unknown company") return false;
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1];
  if (!domain || GENERIC_DOMAINS.includes(domain)) return false;
  const comp = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dom = domain.split(".")[0];
  return comp.includes(dom) || dom.includes(comp);
}

const BAD_TITLES = /^(unknown position|job application|undefined|null|na|n\/a|tbd|none|test)$/i;
const QA_KEYWORDS = /automation|test|testing|qa|qe|lead|software|sdet|engineer|developer|manager|architect|analyst|specialist|consultant|administrator|coordinator|director|head|principal|staff|devops|performance|security|etl|data|cloud|api|ui|ux|mobile|web|fullstack|backend|frontend|scrum|agile|sap|salesforce|tosca|playwright|selenium|guidewire|mainframe|servicenow/i;

export function isValidJobTitle(title: string | undefined) {
  if (!title) return false;
  const t = title.trim();
  if (BAD_TITLES.test(t)) return false;
  return QA_KEYWORDS.test(t);
}

export function isGenericEmail(email: string) {
  if (!email) return true;
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return true;
  return GENERIC_DOMAINS.includes(domain) || domain === "google.com";
}

const QA_ONLY_PATTERN = /test|testing|qa\b|qe\b|automation|sdet/i;
const FALLBACK_TITLE = "Test / AI-Agentic Test Lead";

export function normalizeJobTitle(title: string | undefined) {
  if (!title) return FALLBACK_TITLE;
  const t = title.trim();
  if (t.length > 80) return FALLBACK_TITLE;
  if (/software testing studio|disclaimer|interview prep|subscribe/i.test(t)) return FALLBACK_TITLE;
  if (/unknown position|job application|undefined|null|na|n\/a|tbd|none/i.test(t)) return FALLBACK_TITLE;
  if (QA_ONLY_PATTERN.test(t)) return t;
  return FALLBACK_TITLE;
}
