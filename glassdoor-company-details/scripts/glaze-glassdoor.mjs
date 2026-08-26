import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./lib/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED_PATH = path.join(ROOT, "data", "seed-companies.json");
const RAW_PATH = path.join(ROOT, "data", "companies.raw.json");

const BASE_URL = process.env.GLASSDOOR_BASE_URL || "https://www.glassdoor.com";
const EMAIL = process.env.GLASSDOOR_EMAIL;
const PASSWORD = process.env.GLASSDOOR_PASSWORD;

const MAX_REVIEWS_PER_COMPANY = 30;
const NAV_TIMEOUT = 45000;

// Headed mode on when GLASSDOOR_HEADED is 1 / true / yes (case-insensitive).
const IS_HEADED = /^(1|true|yes|on)$/i.test(process.env.GLASSDOOR_HEADED || "");

/**
 * Glassdoor is aggressive with Cloudflare + CAPTCHA. We attempt a logged-in
 * session, but everything is written to durable JSON so a partial/failed run
 * still leaves usable data and can be re-run or manually topped up.
 */
async function main() {
  if (!EMAIL || !PASSWORD) {
    console.log(
      "[scrape] GLASSDOOR_EMAIL / GLASSDOOR_PASSWORD not set in .env.local. Nothing to do.\n" +
        "You can still paste review data into data/companies.raw.json manually — see README."
    );
    process.exit(0);
  }

  let chromium;
  let playwright;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("[scrape] playwright not installed. Run: npm i -D playwright && npx playwright install chromium");
    process.exit(1);
  }

  const seeds = JSON.parse(await fs.readFile(SEED_PATH, "utf8"));
  if (!Array.isArray(seeds) || seeds.length === 0) {
    console.log("[scrape] data/seed-companies.json is empty.");
    process.exit(0);
  }

  const browser = await chromium.launch({
    headless: !IS_HEADED,
    // If running headed, keep a normal (non-automation) window visible.
    args: [],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "en-US",
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  await login(page);

  const results = [];
  for (const seed of seeds) {
    print(`\n[${seed.name}] scraping…`);
    try {
      const detail = await scrapeCompany(page, seed);
      results.push(detail);
      print(`  ok: rating=${detail.rating} reviews=${detail.reviews.length}`);
    } catch (err) {
      print(`  SKIPPED: ${err.message}`);
    }
  }

  await browser.close();

  const output = {
    version: 1,
    scrapedAt: new Date().toISOString(),
    companies: results,
  };
  await fs.mkdir(path.dirname(RAW_PATH), { recursive: true });
  await fs.writeFile(RAW_PATH, JSON.stringify(output, null, 2), "utf8");
  print(`\n[scrape] Wrote ${results.length} companies to ${RAW_PATH}`);
}

async function login(page) {
  print(`[login] visiting glassdoor… (headed=${IS_HEADED})`);
  await page.goto(`${BASE_URL}/profile/login.htm`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });

  try {
    const emailInput = page.locator('input[type="email"], input[name*="email"], #InlineLogin_Email');
    await emailInput.first().waitFor({ timeout: 25000 });
    await emailInput.first().fill(EMAIL);
    await page.locator('input[type="password"], input[name*="pass"], #InlineLogin_Password').first().fill(PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign In"), input[type="submit"]').first().click();
    print("[login] credentials submitted.");

    if (IS_HEADED) {
      // Give you a chance to solve any CAPTCHA / 2FA in the visible browser.
      // Wait until the URL leaves the login path, or up to 120s.
      print("[login] HEADED MODE: if a CAPTCHA/2FA appeared, solve it now…");
      await page.waitForURL(
        (u) => !/login|sign|auth|captcha|challenge|verify/i.test(u.pathname),
        { timeout: 120000 }
      ).catch(() => print("[login] waited 120s for manual completion (continuing)."));
    } else {
      await page.waitForTimeout(6000);
    }
    print("[login] ready.");
  } catch (err) {
    print(`[login] could not complete login: ${err.message}`);
    if (IS_HEADED) {
      print("[login] continuing anyway in headed mode — you can log in manually while it runs.");
      await page.waitForTimeout(8000);
    }
  }
}

async function scrapeCompany(page, seed) {
  const url = seed.url || `${BASE_URL}/Company/${encodeURIComponent(seed.name)}.htm`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForTimeout(2500);

  const rating = await readRating(page);
  if (rating == null) {
    throw new Error("no rating found (likely blocked / CAPTCHA)");
  }

  const breakdown = await readRatingBreakdown(page);
  const totalReviews = await readReviewCount(page);
  const headcount = await readHeadcount(page);
  const reviews = await readSampleReviews(page);
  const salaries = await readSalaries(page);

  return {
    name: seed.name,
    url,
    rating,
    ratingBreakdown: breakdown,
    totalReviews,
    headcount,
    reviews,
    salaries,
  };
}

async function readRating(page) {
  const txt = await page.locator('span[data-test*="rating"], div[data-test*="rating"], .ratingNumber, .css-ratingNumber, [class*="ratingNumber"]').first().textContent().catch(() => null);
  const m = txt && txt.match(/(\d\.\d)/);
  if (m) return parseFloat(m[1]);
  // fallback: first fraction-looking number on page
  const body = await page.locator("body").innerText().catch(() => "");
  const bm = body.match(/([45]\.\d)\s*\/\s*5/);
  return bm ? parseFloat(bm[1]) : null;
}

async function readRatingBreakdown(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  const grab = (label) => {
    const re = new RegExp(label + "\\s*(\\d\\.\\d)");
    const m = body.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };
  return {
    career: grab("Career Opportunities"),
    comp: grab("Compensation and Benefits"),
    management: grab("Management"),
    culture: grab("Culture and Values"),
  };
}

async function readReviewCount(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  const m = body.match(/([\d,.kKmM]+)\s*(?:reviews?|ratings?)/i);
  if (!m) return undefined;
  const raw = m[1].toLowerCase();
  const num = parseFloat(raw.replace(/[,]/g, "").replace(/k$/, "000").replace(/m$/, "000000"));
  return Number.isFinite(num) ? Math.round(num) : undefined;
}

async function readHeadcount(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  const india = body.match(/India\s*[:=]?\s*([\d,+\s]+?)employees?/i);
  const global = body.match(/(?:company|global|worldwide)\s*[:=]?\s*([\d,+\s]+?)employees?/i);
  return {
    india: india ? india[1].trim() : "—",
    global: global ? global[1].trim() : "—",
  };
}

async function readSampleReviews(page) {
  // Navigate to the reviews tab.
  await page.goto(page.url().replace(/\.htm$/, "") + "/Reviews/" + "EI_INDEX32.htm", {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  }).catch(() => {});
  await page.waitForTimeout(2500);

  const texts = await page.locator('[data-test="review", :has-text, [class*="reviewText"], p:has-text("Pros")] , .reviewBody, [class*="review__"], [data-test="pros"]').allInnerTexts().catch(() => []);
  const cleaned = texts
    .map((t) => t.trim().replace(/\s+/g, " "))
    .filter((t) => t.length > 40)
    .slice(0, MAX_REVIEWS_PER_COMPANY);
  return cleaned;
}

async function readSalaries(page) {
  const base = page.url().replace(/\.htm$/, "");
  await page.goto(`${base}/Salaries/`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {});
  await page.waitForTimeout(2500);
  const lines = await page
    .locator('[class*="salaryRange"], [class*="salary__"], [class*="amount"], td, li')
    .allInnerTexts()
    .catch(() => []);
  return lines.map((l) => l.trim().replace(/\s+/g, " ")).filter((l) => /(lpa|lakh|lacs|l\b|cr|per year|\/yr|₹|rs)/i.test(l) && l.length < 80).slice(0, 40);
}

function print(msg) {
  console.log(msg);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[scrape] Fatal:", err);
    process.exit(1);
  });
}