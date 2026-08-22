import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Config } from '../config.js';
import { AutomationFile, AUTOMATION_PACKAGE_GUARD } from '../agents/schema.js';

/**
 * Takes the AutomationAgent output and scaffolds a self-contained Playwright +
 * TypeScript project (own package.json, tsconfig, playwright.config.ts, specs,
 * page objects, and a starter test-double README).
 */
export async function scaffoldPlaywrightProject(
  config: Config,
  files: AutomationFile[],
): Promise<void> {
  const out = config.playwrightOutputDir;
  await mkdir(join(out, 'tests'), { recursive: true });
  await mkdir(join(out, 'pages'), { recursive: true });

  // Children files emitted by the agent (page objects, specs, etc.).
  for (const f of files) {
    // Never let the agent overwrite our scaffold-owned files.
    if (AUTOMATION_PACKAGE_GUARD.has(f.path)) continue;
    const dest = join(out, f.path);
    await mkdir(join(dest, '..'), { recursive: true });
    await writeFile(dest, f.content, 'utf8');
  }

  // Scaffold-owned files we write (protected from the agent).
  await writeFile(join(out, 'playwright.config.ts'), PLAYWRIGHT_CONFIG(config.appBaseUrl), 'utf8');
  await writeFile(join(out, 'package.json'), PLAYWRIGHT_PACKAGE(), 'utf8');
  await writeFile(join(out, 'tsconfig.json'), PLAYWRIGHT_TSCONFIG(), 'utf8');
  await writeFile(join(out, 'README.md'), GENERATED_README, 'utf8');
}

// ---------------------------------------------------------------------------
// Scaffold templates (written once, owned by us, not the agent).
// ---------------------------------------------------------------------------

export const PLAYWRIGHT_CONFIG = (baseUrl: string): string => `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: ${JSON.stringify(baseUrl)},
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
`;

export const PLAYWRIGHT_PACKAGE = (): string => `{
  "name": "generated-playwright-tests",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "install:deps": "playwright install",
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^22.0.0"
  }
}
`;

export const PLAYWRIGHT_TSCONFIG = (): string => `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
`;

export const GENERATED_README = `# Generated Playwright Tests

E2E suite generated from a Figma design by the figma-to-playwright-agents pipeline.

## Run

\`\`\`bash
npm install
npm run install:deps   # installs browser binaries (Chromium)
npm run test
\`\`\`

## Where things live
- \`tests/*.spec.ts\` — the generated test specifications.
- \`pages/*.ts\` — page-objects/selectors modules used by the specs.
- \`playwright.config.ts\` — report, base URL, retries, tracing.

Point \`baseURL\` at your running app (default from the orchestrator's
\`APP_BASE_URL\`). These tests assume the app matches the design the suite was
generated from; adjust selectors if the implementation drift.
`;