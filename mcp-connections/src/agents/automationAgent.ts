import { OpenRouterClient } from '../llm/openrouter.js';
import { AutomationFile, TestCase } from './schema.js';
import { extractJson } from './analysisAgent.js';

/**
 * Agent 3 — Automation Generator.
 * Produces a runnable Playwright + TypeScript project: page objects and
 * .spec.ts test files derived from the test-case list.
 */
export class AutomationAgent {
  constructor(private readonly llm: OpenRouterClient, private readonly modelName: string) {}

  async generate(testCases: TestCase[], baseUrl: string): Promise<AutomationFile[]> {
    const userPrompt = [
      'Write a runnable Playwright + TypeScript end-to-end test project for the following test cases.',
      '',
      `Base URL of the app under test: ${baseUrl}`,
      '',
      '## Test cases',
      JSON.stringify(testCases, null, 2),
      '',
      '## Requirements',
      '- Use @playwright/test (TypeScript).',
      '- Emit code files as an array with "path" (relative, e.g. pages/LoginPage.ts, tests/login.spec.ts).',
      '- Put shared selectors in Page Object classes (or a selectors module).',
      '- Use deterministic locators (getByRole, getByLabel, getByPlaceholder, test ids).',
      '- Name spec files after their page and give each a `test.describe` block.',
      '- Tests should read baseURL from use.baseURL in the Playwright config.',
      '- Include imports so each file is self-contained and type-safe.',
      '',
      'Return ONLY a JSON object (no fences) with this shape:',
      JSON.stringify(
        {
          source: 'Playwright',
          files: [
            { path: 'pages/LoginPage.ts', content: '// TypeScript import + class ...' },
            { path: 'tests/login.spec.ts', content: "import { test, expect } from '@playwright/test'; ..." },
          ],
        },
        null,
        2,
      ),
    ].join('\n');

    const system = [
      'You are a senior Playwright automation engineer generating production-quality TypeScript E2E tests.',
      'Code must compile against @playwright/test 1.4x. Default to getByRole/getByLabel/getByPlaceholder; fall back to well-scoped CSS with data-testid.',
      'Write resilient tests: robust timeouts via Playwright auto-waiting, avoid arbitrary sleeps.',
      'Group related assertions in one test where sensible; keep one logical scenario per test.',
      'Emit strictly valid JSON.',
    ].join('\n');

    const result = await this.llm.chat(system, userPrompt, { temperature: 0.1 });
    return this.parse(result.content);
  }

  private parse(raw: string): AutomationFile[] {
    const obj = extractJson(raw);
    const files = (typeof obj === 'object' && obj !== null && 'files' in obj ? obj.files : obj) as unknown;
    if (!Array.isArray(files)) throw new Error('Automation output is not a { files: [...] } array.');
    return files.map((f) => {
      const o = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>;
      const path = String(o.path ?? '').replace(/\\/g, '/');
      if (!path) throw new Error('Automation file missing path.');
      return { path, content: String(o.content ?? '') };
    });
  }
}