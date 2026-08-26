import { askLlmJson } from "./openrouter.mjs";

/**
 * Classify a company into Product / Service / Consulting / Staffing / Startup
 * and return concise "good" and "bad" bullet summaries from its sample reviews.
 * Uses the LLM with a closed choice set for `type`.
 */
export async function analyzeCompany(llm) {
  const system = [
    "You analyze employee review text for a company.",
    "You MUST return ONLY JSON with these exact keys:",
    '"type" (one of: Product, Service, Consulting, Staffing, Startup, Other),',
    '"industry" (short, e.g. "IT Services"),',
    '"good" (array of 2-4 short positive bullet strings from the reviews),',
    '"bad" (array of 2-4 short negative bullet strings from the reviews).',
    "Base statements strictly on the provided reviews.",
    "If there is not enough evidence for a side, return an empty array.",
    "Keep every bullet under 12 words. Write in English.",
  ].join(" ");

  const user = [
    "Company name: " + llm.name,
    "Rating: " + (llm.rating ?? "unknown"),
    "",
    "SAMPLE REVIEWS:",
    JSON.stringify(llm.reviews.slice(0, 30), null, 1),
  ].join("\n");

  return askLlmJson({
    system,
    user,
  });
}

const TYPE_CHOICES = [
  "Product",
  "Service",
  "Consulting",
  "Staffing",
  "Startup",
  "Other",
];

/** Purely local heuristic fallback used when LLM is unavailable. */
export function heuristicType(company) {
  const name = (company.name || "").toLowerCase();
  const reviews = (company.reviews || []).join(" ").toLowerCase();
  const hay = `${name} ${reviews}`;

  if (/(consulting|delloit|accenture|mckinsey|pwc|kpmg|cognizant?)/.test(hay)) {
    return "Consulting";
  }
  if (/(startup|grow quickly|series [abcd] funding|hypergrowth)/.test(hay)) {
    return "Startup";
  }
  if (/(staffing|placement|recruitment firm|temp)/.test(hay)) {
    return "Staffing";
  }
  if (/(product|feature|roadmap|saas|app release|user-facing)/.test(hay)) {
    return "Product";
  }
  if (/(outsourc|body.?shop|service desk|support|it services)/.test(hay)) {
    return "Service";
  }
  return "Other";
}

export { TYPE_CHOICES };