// Screenshot capture script — logs in via the UI and captures each key page
// into qae2e/docs/screenshots/. Run: node scripts/capture-screenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = "tarun1@tarun.com";
const PASSWORD = "12345678";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, name), fullPage: false });
  console.log("captured", name);
};

try {
  // 1. Landing
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot("landing.png");

  // 2. Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot("login.png");

  // Log in via the form
  const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="mail" i]';
  await page.fill(emailSel, EMAIL).catch(() => {});
  await page.fill('input[type="password"]', PASSWORD).catch(() => {});
  await page.getByRole("button", { name: /sign in|login/i }).click().catch(() => {});
  await page.waitForTimeout(3000);
  console.log("after login url:", page.url());

  // 3. Workspaces dashboard
  await page.goto(`${BASE}/workspaces`, { waitUntil: "networkidle" });
  await shot("workspaces.png");

  // 4. New workspace modal
  await page.getByRole("button", { name: /new workspace/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);
  await shot("new-workspace-modal.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // 5. Workspace page — first workspace card
  const wsHref = await page
    .locator('a[href*="workspace?workspaceId="]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  console.log("workspace href:", wsHref);
  if (wsHref) {
    await page.goto(`${BASE}${wsHref}`, { waitUntil: "networkidle" });
    await shot("workspace.png");
  }

  // 6. History
  await page.goto(`${BASE}/history`, { waitUntil: "networkidle" });
  await shot("history.png");

  // 7. Run detail — first run link
  const runHref = await page.locator('a[href*="/history/"]').first().getAttribute("href").catch(() => null);
  console.log("run href:", runHref);
  if (runHref) {
    await page.goto(`${BASE}${runHref}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await shot("run-detail.png");
  }

  // 8. Settings
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await shot("settings.png");
} catch (e) {
  console.error("ERROR:", e.message);
} finally {
  await browser.close();
}
