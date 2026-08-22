/**
 * Shared JSON-schema types passed between the three agents. Everything the
 * agents emit is validated against `FC` before it is written to disk.
 */

/** Language-agnostic validation: ensure a string is valid JSON. */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Agent 1 output — a human-readable + structured analysis of the design.
// ---------------------------------------------------------------------------
export interface DesignAnalysis {
  productName: string;
  purpose: string;
  pages: { name: string; description: string }[];
  keyElements: { name: string; type: string; notes: string }[];
  interactions: string[];
}

// ---------------------------------------------------------------------------
// Agent 2 output — the test-case list.
// ---------------------------------------------------------------------------
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type StepType = 'action' | 'assertion' | 'wait';

export interface TestStep {
  type: StepType;
  action: string;
  /** Playwright selector for action/assertion steps, if derivable. */
  selector?: string;
  value?: string;
}

export interface TestCase {
  id: string;
  title: string;
  priority: Priority;
  page: string;
  description: string;
  preconditions: string[];
  steps: TestStep[];
  /** Selectors the automation agent will reuse as page-object locators. */
  selectors: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Agent 3 output — the automation source files.
// ---------------------------------------------------------------------------
export interface AutomationFile {
  /** Relative path inside the generated Playwright project, e.g. tests/home.spec.ts */
  path: string;
  content: string;
}

/**
 * Scaffold-owned filenames inside the generated Playwright project that the
 * automation agent must never overwrite. We supply these ourselves.
 */
export const AUTOMATION_PACKAGE_GUARD: ReadonlySet<string> = new Set([
  'package.json',
  'tsconfig.json',
  'playwright.config.ts',
  'README.md',
]);