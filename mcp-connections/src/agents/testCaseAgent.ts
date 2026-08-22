import { OpenRouterClient } from '../llm/openrouter.js';
import { DesignAnalysis, TestCase } from './schema.js';

/**
 * Agent 2 — Test Case Generator.
 * Turns the design analysis into a prioritized, exportable list of test cases
 * with concrete steps and Playwright-friendly selectors.
 */
export class TestCaseAgent {
  constructor(private readonly llm: OpenRouterClient, private readonly modelName: string) {}

  async generate(analysis: DesignAnalysis): Promise<TestCase[]> {
    const userPrompt = [
      'From the analysis below, produce a complete functional test-case suite for this UI.',
      '',
      '## Design analysis',
      JSON.stringify(analysis, null, 2),
      '',
      '## Rules',
      '- Cover happy paths, validations, empty states, and at least the most important error states.',
      '- Assign priority: P0 = critical core flows, P1 = important, P2 = secondary, P3 = nice-to-have.',
      '- Each step MUST have an "action" and a "type" of "action" | "assertion" | "wait".',
      '- Prefer stable selectors: accessible roles, test ids, placeholders, then text. Never use CSS that obeys layout only (e.g. nth-child).',
      '- Center each test on ONE page (its "page" field), named from the analysis pages.',
      '- selectors is a map of semantic names -> selector strings, reuse them across steps and the eventual page objects.',
      '',
      'Return ONLY a JSON array (no fences, no keys wrapper) with shape:',
      JSON.stringify(
        [
          {
            id: 'TC-001',
            title: 'should log in with valid credentials',
            priority: 'P0',
            page: 'Login',
            description: 'sentence',
            preconditions: ['list of things that must be true'],
            steps: [
              { type: 'action', action: 'fill the email field', selector: 'input[name="email"]', value: 'user@example.com' },
              { type: 'assertion', action: 'dashboard heading is visible', selector: 'role=heading[name=Welcome]' },
            ],
            selectors: { email: 'input[name="email"]', submitBtn: 'role=button[name="Sign in"]' },
          },
        ],
        null,
        2,
      ),
      '',
      'Return an array with a minimum of 8 test cases.',
    ].join('\n');

    const system = [
      'You are a senior QA engineer writing precise, automation-ready functional test cases from a UI design analysis.',
      'Be exhaustive yet realistic — every case must be implementable in Playwright.',
      'Use deterministic, resilient selectors. Prefer: role selectors, getByLabel/getByPlaceholder text, data-testid, stable IDs.',
      'Emit strictly valid JSON.',
    ].join('\n');

    const result = await this.llm.chat(system, userPrompt, { temperature: 0.2 });
    return this.parse(result.content);
  }

  private parse(raw: string): TestCase[] {
    const stripped = raw.replace(/```(?:json)?/g, '');
    const start = stripped.indexOf('[');
    const end = stripped.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Test-case agent did not return a JSON array.');
    }
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('Test-case output is not an array.');

    return parsed.map((item, i) => {
      const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const steps = Array.isArray(o.steps)
        ? (o.steps as Record<string, unknown>[]).map((s) => ({
            type: s.type as 'action' | 'assertion' | 'wait',
            action: String(s.action ?? ''),
            selector: s.selector !== undefined ? String(s.selector) : undefined,
            value: s.value !== undefined ? String(s.value) : undefined,
          }))
        : [];
      return {
        id: String(o.id ?? `TC-${String(i + 1).padStart(3, '0')}`),
        title: String(o.title ?? 'untitled test'),
        priority: ['P0', 'P1', 'P2', 'P3'].includes(o.priority as string)
          ? (o.priority as TestCase['priority'])
          : 'P2',
        page: String(o.page ?? 'General'),
        description: String(o.description ?? ''),
        preconditions: Array.isArray(o.preconditions) ? o.preconditions.map(String) : [],
        steps,
        selectors: Object.fromEntries(
          Object.entries(isRecord(o.selectors ?? {})).map(([k, v]) => [k, String(v)]),
        ),
      };
    });
  }
}

function isRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}