const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const dir = 'C:\\Tarun\\ai-learning\\AILearning\\qadashboard\\screenshots';

  // Intercept auth/me so it returns immediately, not hang
  await context.route('**/api/auth/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'test-user', username: 'TarunBabbar' } })
    });
  });

  async function capture(name, url) {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait until the .animate-spin is gone AND real content appears
    await page.waitForTimeout(3000);
    try {
      // Wait for spinner to disappear
      await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
    } catch (e) {
      // no spinner at all
    }
    // Wait a bit more for re-render
    await page.waitForTimeout(2000);
    // Verify the page has actual content (not just a spinner)
    const bodyText = await page.evaluate(() => document.body.innerText.length);
    console.log(`${name}: body text length = ${bodyText}`);
    // Check for sidebar or actual UI
    const hasContent = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.length > 50;
    });
    if (!hasContent) {
      console.log(`  WARNING: ${name} seems empty, waiting more...`);
      await page.waitForTimeout(5000);
    }
    await page.screenshot({ path: `${dir}\\${name}.png`, fullPage: false });
    console.log(`✓ ${name}.png`);

    const stats = fs.statSync(`${dir}\\${name}.png`);
    console.log(`  size: ${(stats.size / 1024).toFixed(1)} KB`);
    await page.close();
  }

  // Login page
  const loginPage = await context.newPage();
  await loginPage.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await loginPage.waitForTimeout(3000);
  try {
    await loginPage.waitForSelector('.animate-spin', { state: 'detached', timeout: 15000 });
  } catch(e) {}
  await loginPage.waitForTimeout(2000);
  // Check what's rendered
  const html = await loginPage.evaluate(() => document.body.innerHTML.substring(0, 500));
  console.log('Login HTML:', html);
  
  try {
    await loginPage.fill('input[type="text"]', 'TarunBabbar');
    console.log('Filled username');
    await loginPage.fill('input[type="password"]', 'TarunBabbar');
    console.log('Filled password');
    await loginPage.waitForTimeout(500);
  } catch(e) {
    console.log('Could not fill form:', e.message.substring(0, 200));
  }
  await loginPage.screenshot({ path: `${dir}\\login.png`, fullPage: false });
  console.log('✓ login.png');
  const loginStats = fs.statSync(`${dir}\\login.png`);
  console.log(`  size: ${(loginStats.size / 1024).toFixed(1)} KB`);
  await loginPage.close();

  // Dashboard
  await capture('dashboard', 'http://localhost:3000/');
  await capture('qa-chat', 'http://localhost:3000/qa');
  await capture('qa-topics', 'http://localhost:3000/qa/topics');
  await capture('resume-upload', 'http://localhost:3000/resume');
  await capture('job-matches', 'http://localhost:3000/resume/matches');
  await capture('email-agent', 'http://localhost:3000/resume/email');
  await capture('companies', 'http://localhost:3000/resume/companies');
  await capture('documents', 'http://localhost:3000/documents');
  await capture('test-architect', 'http://localhost:3000/test-architect');
  await capture('projects', 'http://localhost:3000/test-architect/projects');
  await capture('learn', 'http://localhost:3000/learn');
  await capture('settings', 'http://localhost:3000/settings');

  await browser.close();
  console.log('All done!');
})().catch(err => { console.error(err); process.exit(1); });
