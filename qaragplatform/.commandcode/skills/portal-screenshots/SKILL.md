# Portal Screenshots Skill

Captures full-page screenshots of web application pages using Playwright.

## When to use
When the user asks to take screenshots of their web app for README/docs/state capture.

## Steps

1. **Check dev server** at the specified URL (default `http://localhost:3000`). Start it if down.

2. **Ensure playwright** is installed in the project:
   ```bash
   npm install --no-optional playwright
   ```
   (Check first — skip if already installed)

3. **Ask or confirm** which pages to capture. If the user said "all screens", suggest the common pages from the current project's routes.

4. **Create and run** a capture script at project root as `capture-screenshots.mjs`:

   ```js
   import { chromium } from 'playwright';
   import { mkdirSync } from 'fs';

   const baseUrl = process.argv[2] || 'http://localhost:3000';
   const dir = 'screenshots';
   mkdirSync(dir, { recursive: true });

   const pages = [
     // User-specified pages here
     { url: `${baseUrl}/`, name: 'dashboard.png' },
   ];

   const browser = await chromium.launch({ headless: true });

   for (const { url, name } of pages) {
     const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
     try {
       await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
       await p.waitForTimeout(1000);
       await p.screenshot({ path: `${dir}/${name}`, fullPage: true });
       console.log(`OK: ${name}`);
     } catch (e) {
       console.log(`FAIL: ${name} - ${e.message}`);
     }
     await p.close();
   }
   await browser.close();
   ```

5. **Run**: `node capture-screenshots.mjs`

6. **Clean up**: delete `capture-screenshots.mjs` after capture.

7. **Report** screenshot paths to the user.
