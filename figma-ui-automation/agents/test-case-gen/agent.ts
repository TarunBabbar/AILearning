import { writeText, readText } from '../../shared/lib/fs.ts';
import { load as loadYaml, dump } from 'js-yaml';
import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';
import { OpenRouterClient } from '../../shared/lib/openrouter.ts';
import { getRouting } from '../../shared/lib/models.ts';
import type { Spec } from '../../shared/types/index.ts';
import type { ModelRouting } from '../../shared/lib/models.ts';

export interface TestCase {
  id: string;
  title: string;
  feature: string;
  scenario: string;
  steps: Array<{ action: string; target?: string; value?: string }>;
  expected: string;
  priority: 'P0' | 'P1' | 'P2';
  source: string;
}

export interface TestCaseFile {
  schemaVersion: 1;
  screenId: string;
  designVersion: string;
  generatedAt: string;
  provider: string;
  cases: TestCase[];
}

const GOLDEN = `- Login screen
  - Scenario: Sign in with valid credentials
    Given the user is on the login screen
    When the user enters a valid email in "login-email"
    And the user enters a valid password in "login-password"
    And the user clicks "login-submit"
    Then the user is redirected to the dashboard
  - Scenario: Sign in with invalid credentials
    Given the user is on the login screen
    When the user enters an invalid email in "login-email"
    And the user clicks "login-submit"
    Then an inline error is shown and no navigation occurs`;

/**
 * Agent 4 — Test Case Generation (shift-left).
 * Design spec (+ PRD context) → Gherkin/YAML test cases. This is the highest-risk
 * agent: its output must be human-approved before codegen runs.
 */
export class TestCaseGenAgent {
  private cfg: Config;
  private llm: OpenRouterClient;
  private routing: ModelRouting;

  constructor(cfg: Config) {
    this.cfg = cfg;
    this.llm = new OpenRouterClient(this.cfg);
    this.routing = getRouting(this.cfg);
  }

  async run(spec: Spec, context?: string): Promise<TestCaseFile> {
    const screenId = spec.screen.id;
    const prompt = this.buildPrompt(spec, context);

    let cases: TestCase[];
    let provider: string;

    if (this.llm.configured) {
      try {
        const res = await this.llm.chatJSON<{ cases: Array<Omit<TestCase, 'id' | 'source'>> }>({
          model: this.routing.testCaseGen,
          messages: [
            { role: 'system', content: 'You are a senior QA test designer. Generate Gherkin-style test cases from a UI design spec. Use element IDs from the spec as targets. Never invent elements that are not in the spec. Respond with STRICT JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          maxTokens: 4096,
          responseFormat: { type: 'json_object' },
        });
        cases = (res.cases ?? []).map((c, i) => ({ ...c, id: `${screenId}-tc-${i + 1}`, source: 'llm' }));
        provider = this.routing.testCaseGen;
        log.info('test-case-gen', `LLM produced ${cases.length} test cases`);
      } catch (err) {
        log.warn('test-case-gen', `LLM failed (${(err as Error).message}); using golden/fallback generator`);
        cases = this.fallbackCases(spec);
        provider = 'fallback-rules';
      }
    } else {
      log.info('test-case-gen', 'no OPENROUTER_API_KEY; using fallback generator');
      cases = this.fallbackCases(spec);
      provider = 'fallback-rules';
    }

    if (cases.length === 0) {
      cases = this.fallbackCases(spec);
      provider = 'fallback-rules';
    }

    const file: TestCaseFile = {
      schemaVersion: 1,
      screenId,
      designVersion: spec.screen.designVersion ?? 'unknown',
      generatedAt: new Date().toISOString(),
      provider,
      cases,
    };

    const p = `${this.cfg.specsDir}/tests/${screenId}.tests.yaml`;
    writeText(p, this.toYaml(file));
    log.info('test-case-gen', `wrote ${p} (${cases.length} cases via ${provider})`);
    return file;
  }

  private buildPrompt(spec: Spec, context?: string): string {
    const elements = spec.elements
      .map((e) => `- [${e.id}] "${e.name}" role=${e.role}${e.text ? ` text="${e.text}"` : ''} bounds=${JSON.stringify(e.bounds)}`)
      .join('\n');
    const interactions = spec.interactions
      .map((i) => `- ${i.trigger} ${i.target}: ${i.expected}${i.context ? ` (context: ${i.context})` : ''}`)
      .join('\n') || '(none)';

    return `Generate a focused set of Gherkin test cases for the screen "${spec.screen.name}" (id ${spec.screen.id}).
Design version: ${spec.screen.designVersion ?? 'unknown'}.

ELEMENTS (use these ids as targets):
${elements}

DOCUMENTED INTERACTIONS:
${interactions}

${context ? `PRD / CONTEXT:\n${context}\n` : ''}

Follow the style of these golden examples:
${GOLDEN}

Cover: happy path, validation/error states, a11y (labels), and any documented interactions.
Return JSON: {"cases":[{"title","feature","scenario","steps":[{"action","target","value"}],"expected","priority"}]}`;
  }

  /** Deterministic fallback: one case per documented interaction + core elements. */
  private fallbackCases(spec: Spec): TestCase[] {
    const cases: TestCase[] = [];
    for (const [i, interaction] of spec.interactions.entries()) {
      cases.push({
        id: `${spec.screen.id}-tc-${i + 1}`,
        title: `${interaction.trigger} on ${interaction.target}`,
        feature: spec.screen.name,
        scenario: `${interaction.trigger} "${interaction.target}"`,
        steps: [{ action: interaction.trigger, target: interaction.target }],
        expected: interaction.expected,
        priority: i === 0 ? 'P0' : 'P1',
        source: 'fallback',
      });
    }
    if (cases.length === 0) {
      // no interactions documented — generate from elements
      for (const [i, el] of spec.elements.filter((e) => e.role === 'button' || e.role === 'input' || e.role === 'link').slice(0, 5).entries()) {
        cases.push({
          id: `${spec.screen.id}-tc-${i + 1}`,
          title: `Verify ${el.role} "${el.name}" is present and accessible`,
          feature: spec.screen.name,
          scenario: `The ${el.role} "${el.name}" is visible and labeled`,
          steps: [{ action: 'assertVisible', target: el.id }],
          expected: `"${el.name}" is visible with a valid accessible label`,
          priority: 'P1',
          source: 'fallback',
        });
      }
    }
    return cases;
  }

  toYaml(file: TestCaseFile): string {
    return dump(file, { noRefs: true, lineWidth: -1, quotingType: "'" });
  }
}

export function readTestCaseFile(p: string): TestCaseFile {
  const yaml = loadYaml(readText(p));
  return yaml as TestCaseFile;
}
