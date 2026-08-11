import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "linkedin-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL || "https://qajobs.vercel.app";
const EMAIL = process.env.SCREENSHOT_EMAIL || "tarun1@tarun.com";
const PASSWORD = process.env.SCREENSHOT_PASSWORD || "12345678";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(`${BASE}/score`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2000);

const email = page.locator('input[type="email"]').first();
const password = page.locator('input[type="password"]').first();
if (await email.count()) {
  await email.fill(EMAIL);
  await password.fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(4500);
}

await page.screenshot({
  path: path.join(outDir, "04-match-by-resume.png"),
  fullPage: false,
});
console.log("Saved 04-match-by-resume.png");

await page.goto(`${BASE}/browse`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);
const locBtn = page.getByRole("button", { name: /^location$/i });
if (await locBtn.count()) {
  await locBtn.first().click();
  await page.waitForTimeout(2500);
}
await page.screenshot({
  path: path.join(outDir, "05-browse-by-location.png"),
  fullPage: false,
});
console.log("Saved 05-browse-by-location.png");

await browser.close();
console.log("Done.");
