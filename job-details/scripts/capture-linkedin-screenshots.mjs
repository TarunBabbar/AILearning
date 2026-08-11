import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "linkedin-screenshots");
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL || "https://qajobs.vercel.app";

const shots = [
  { name: "01-all-jobs", path: "/" },
  { name: "02-browse-jobs", path: "/browse" },
  { name: "03-recruiter-contacts", path: "/contacts" },
  { name: "04-match-by-resume", path: "/score" },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

for (const shot of shots) {
  const url = `${BASE}${shot.path}`;
  console.log(`Capturing ${shot.name} → ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // Let SWR/data settle
  await page.waitForTimeout(3500);
  const file = path.join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Saved ${file}`);
}

await browser.close();
console.log("Done.");
