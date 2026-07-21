import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { callOpenRouter } from "./openrouter.js";
import { config } from "dotenv";
config({ override: true });

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const PARSE_CHUNK_CHARS = parseInt(process.env.PARSE_CHUNK_CHARS || "4000");
const PARSE_CHUNK_OVERLAP = parseInt(process.env.PARSE_CHUNK_OVERLAP || "400");
const PARSE_TIMEOUT_MS = parseInt(process.env.PARSE_TIMEOUT_MS || "120000");
const PARSE_MAX_TOKENS = parseInt(process.env.PARSE_MAX_TOKENS || "8192");

export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return extractPdfText(filePath);
  if (ext === ".docx") return extractDocxText(filePath);
  throw new Error("Unsupported file type: " + ext);
}

async function extractPdfText(filePath) {
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return (data.text || "").trim();
}

async function extractDocxText(filePath) {
  const buf = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value.trim();
}

// ─── LLM-based job extraction (via OpenRouter) ──────────

function chunkText(text, size, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

function dedupeJobs(jobs) {
  const seen = new Set();
  const out = [];
  for (const j of jobs) {
    const key = `${(j.title || "").toLowerCase()}|${(j.email || "").toLowerCase()}|${(j.company || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(j);
  }
  return out;
}

async function extractJobsViaLLM(rawText) {
  const systemPrompt = "You are a precise job listing extractor. Extract all job listings from the user-provided text. Respond with ONLY valid JSON. No markdown. No code fences. No explanation before or after the JSON.";

  // Split large job files into chunks so the LLM output never exceeds the token limit.
  const chunks = chunkText(rawText, PARSE_CHUNK_CHARS, PARSE_CHUNK_OVERLAP);
  const allJobs = [];

  let succeededCount = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    const prompt = `Extract ALL job listings from the text below. Do NOT miss any job.

For each job, identify:
- company (company name)
- title (job title / position)
- email (contact / application email)
- location (city/locations mentioned — e.g. "Pune", "Bangalore", "Chennai/Pune", "Hyderabad", "Remote", etc.)
- experience (years of experience required, e.g. "2+ years", "5-8 Yrs", "10+ yrs", "7–12 Yrs", "Fresher", etc. Use the exact text found)
- description (full job description text — include ALL details)

CRITICAL: Respond with ONLY a valid JSON array. NO markdown, NO code blocks, NO explanation, NO text before or after. Just the JSON array:
[{"company":"...","title":"...","email":"...","location":"...","experience":"...","description":"..."}]

TEXT:
${chunk}`;

    console.log(`[Parser] Calling OpenRouter to extract jobs from chunk ${c + 1}/${chunks.length} (${chunk.length} chars)...`);
    const content = await callOpenRouter(prompt, systemPrompt, { timeout: PARSE_TIMEOUT_MS, maxTokens: PARSE_MAX_TOKENS });
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error(`[Parser] OpenRouter returned no JSON for job chunk ${c + 1}/${chunks.length}`);
      console.error(`[Parser] Raw content (first 500 chars): ${content.substring(0, 500)}`);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (jsonError) {
      console.error(`[Parser] JSON parse error for chunk ${c + 1}: ${jsonError.message}`);
      console.error(`[Parser] Raw content (first 500 chars): ${content.substring(0, 500)}`);
      continue;
    }
    if (!Array.isArray(parsed)) {
      console.error(`[Parser] OpenRouter returned invalid data for job chunk ${c + 1}/${chunks.length}`);
      continue;
    }
    succeededCount++;
    for (const j of parsed) {
      allJobs.push({
        title: j.title || "Unknown Position",
        company: j.company || "Unknown Company",
        email: j.email || "",
        location: j.location || "",
        experience: j.experience || "",
        description: j.description || "",
      });
    }
  }

  if (succeededCount === 0) {
    console.error(`[Parser] All ${chunks.length} chunks failed. Returning null for regex fallback.`);
    return null;
  }

  const deduped = dedupeJobs(allJobs);
  console.log(`[Parser] Extracted ${deduped.length} jobs via OpenRouter (${allJobs.length} before dedupe)`);
  return deduped;
}

// ─── Regex fallback ─────────────────────────────────────
function extractJobsViaRegex(raw) {
  const jobs = [];
  const emails = raw.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];

  if (emails.length >= 2) {
    const parts = raw.split(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    for (let i = 1; i < parts.length; i++) {
      if (i - 1 >= emails.length) continue;
      const text = parts[i].trim();
      if (text.length < 30) continue;
      const email = emails[i - 1];
      const company = extractCompanyFallback(text, email);
      jobs.push({
        title: extractTitleFallback(text),
        company,
        email,
        location: extractLocationFallback(text),
        experience: extractExperienceFallback(text),
        description: text,
      });
    }
  } else {
    const email = emails[0] || "";
    const company = extractCompanyFallback(raw, email);
    jobs.push({
      title: extractTitleFallback(raw),
      company,
      email,
      location: extractLocationFallback(raw),
      experience: extractExperienceFallback(raw),
      description: raw,
    });
  }
  return jobs;
}

function extractTitleFallback(text) {
  const pat = [
    /(?:Job Title|Title|Position|Role|Designation)\s*[:：]\s*(.+?)[\n\r]/i,
    /(?:Hiring\s*(?:for|:|–|-))\s*(.+?)[\n\r]/i,
    /(?:Looking\s*for\s*(?:a|an)?)\s*(.+?)(?:\s*(?:with|to|for|–|-)\s|[\n\r])/i,
    /^\s*(.+?(?:Engineer|Developer|Designer|Manager|Analyst|Architect|Lead|Head|Director|Specialist|Consultant|Intern|Associate|Officer|Coordinator|Administrator|Scientist|Assistant|Tester|QA|Test|Automation|DevOps|SDE|SDET))\b/m,
    /^\s*(Senior|Junior|Lead|Principal|Staff|Entry\s*Level|Mid\s*Level)?\s*(.+?(?:Engineer|Developer|Designer|Manager|Analyst))\b/m,
  ];
  for (const p of pat) { const m = text.match(p); if (m) return (m[1] || m[2] || "").trim(); }

  // Last resort: grab first line that looks like a title
  const lines = text.split("\n").filter(l => l.trim().length > 10 && l.trim().length < 100);
  for (const line of lines) {
    if (/[A-Z]/.test(line) && !/^http|@|www\./i.test(line)) return line.trim();
  }
  return "Unknown Position";
}

function extractCompanyFallback(text, email) {
  // Try patterns in the text first
  const pat = [
    /(?:Company|Organization|Employer|Client|Company Name)\s*[:：]\s*(.+?)[\n\r]/i,
    /(?:Position\s*(?:at|@|with|–|-))\s*(.+?)[\n\r]/i,
  ];
  for (const p of pat) { const m = text.match(p); if (m) return cleanCompany(m[1].trim()); }

  // Fallback to email domain, skip generic ones
  if (email) {
    const domain = email.split("@")[1].split(".")[0].toLowerCase();
    const generic = ["gmail", "yahoo", "hotmail", "outlook", "rediffmail", "ymail", "mail"];
    if (!generic.includes(domain)) {
      return domain.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  // Try to extract a company-like word (capitalized, after non-email line)
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 3);
  for (const line of lines) {
    if (/^[A-Z][a-zA-Z0-9 ]{2,30}$/.test(line) && !/^Interview|WhatsApp|Download|Software|Testing|Studio|Prep|Kit|Disclaimer/i.test(line)) {
      return line;
    }
  }
  return "Unknown Company";
}

function cleanCompany(name) {
  return name.replace(/[\d+\-]+/g, "").trim() || "Unknown Company";
}

function extractExperienceFallback(text) {
  const m = text.match(/(?:\b\d{1,2}\+?\s*(?:years|yrs|yr|Year|Yr)\s*(?:of)?(?:\s*(?:exp|experience))?|\b\d{1,2}\s*[-–to]+\s*\d{1,2}\+?\s*(?:years|yrs|yr|Year|Yr|YRS|Years|Exp|Experience)\b)/i);
  return m ? m[0].trim() : "";
}

function extractLocationFallback(text) {
  // Known Indian cities + common patterns
  const cities = [
    "Pune", "Bangalore", "Bengaluru", "Mumbai", "Hyderabad", "Chennai",
    "Delhi", "Noida", "Gurgaon", "Gurugram", "Kolkata", "Ahmedabad",
    "Indore", "Jaipur", "Chandigarh", "Coimbatore", "Kochi", "Thiruvananthapuram",
    "Nagpur", "Vadodara", "Visakhapatnam", "Bhopal", "Lucknow", "Remote", "Hybrid",
  ];
  const found = cities.filter(c => new RegExp("\\b" + c + "\\b", "i").test(text));
  if (found.length) return found.join(" / ");
  const m = text.match(/(?:Location|Place|Office|City)\s*[:：]\s*(.+?)[\n\r]/i);
  return m ? m[1].trim() : "";
}

// ─── Public API ─────────────────────────────────────────
// LLM-first job extraction with regex fallback for problematic PDFs.
export async function parseJobsFromFile(filePath) {
  const raw = await extractText(filePath);
  if (!raw) return [];

  // Try LLM extraction first
  let jobs = await extractJobsViaLLM(raw);
  if (!jobs) {
    // If LLM fails (returns null), try regex fallback for PDFs that are hard to parse
    console.log(`[Parser] LLM failed, trying regex fallback for ${filePath}`);
    jobs = extractJobsViaRegex(raw);
    if (!jobs || jobs.length === 0) {
      throw new Error("LLM extracted 0 jobs and regex fallback also failed. The file may not contain valid job listings or may be in an unsupported format.");
    }
    console.log(`[Parser] Regex fallback extracted ${jobs.length} jobs`);
  } else if (jobs.length === 0) {
    // LLM returned empty array (no jobs found)
    console.log(`[Parser] LLM extracted 0 jobs for ${filePath}`);
  }
  return jobs;
}

export function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}
