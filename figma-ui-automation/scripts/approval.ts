import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dump } from 'js-yaml';
import type { Config } from '../shared/lib/config.ts';
import { log } from '../shared/lib/logger.ts';
import type { TestCase, TestCaseFile } from '../agents/test-case-gen/agent.ts';
import { readTestCaseFile } from '../agents/test-case-gen/agent.ts';

export interface ReviewSummary {
  screenId: string;
  total: number;
  approved: number;
  rejected: number;
  edited: number;
  pending: number;
}

const CASES_DIR = (cfg: Config) => `${cfg.specsDir}/tests`;
const CASES_FILE = (cfg: Config, screenId: string) => `${CASES_DIR(cfg)}/${screenId}.tests.yaml`;

export function listPendingCases(cfg: Config): TestCaseFile[] {
  const dir = CASES_DIR(cfg);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tests.yaml'))
    .map((f) => readTestCaseFile(`${dir}/${f}`));
}

/**
 * Approval gate — human reviews generated test cases before codegen.
 * Marks a case approved/rejected/edited by rewriting the YAML with a
 * `review` field, so the orchestrator's gate check can read it deterministically.
 */
export function approveCase(cfg: Config, screenId: string, caseId: string, decision: 'approved' | 'rejected' | 'edited', note?: string): ReviewSummary {
  const file = readTestCaseFile(CASES_FILE(cfg, screenId));
  const target = file.cases.find((c) => c.id === caseId);
  if (!target) throw new Error(`No test case "${caseId}" in ${screenId}.tests.yaml`);

  const reviewed = (target as TestCase & { review?: string; reviewNote?: string });
  reviewed.review = decision;
  reviewed.reviewNote = note ?? reviewed.reviewNote;
  writeFileSync(CASES_FILE(cfg, screenId), toYaml(file), 'utf-8');
  log.info('review', `${caseId} → ${decision}`);
  return summarize(file);
}

export function approveAll(cfg: Config, screenId: string): ReviewSummary {
  const file = readTestCaseFile(CASES_FILE(cfg, screenId));
  for (const c of file.cases) (c as TestCase & { review?: string }).review = 'approved';
  writeFileSync(CASES_FILE(cfg, screenId), toYaml(file), 'utf-8');
  log.info('review', `approved all ${file.cases.length} cases for ${screenId}`);
  return summarize(file);
}

export function isFullyApproved(file: TestCaseFile): boolean {
  return file.cases.length > 0 && file.cases.every((c) => (c as TestCase & { review?: string }).review === 'approved');
}

export function approvedCases(file: TestCaseFile): TestCase[] {
  return file.cases.filter((c) => (c as TestCase & { review?: string }).review === 'approved');
}

export function summarize(file: TestCaseFile): ReviewSummary {
  const cases = file.cases as Array<TestCase & { review?: string }>;
  return {
    screenId: file.screenId,
    total: cases.length,
    approved: cases.filter((c) => c.review === 'approved').length,
    rejected: cases.filter((c) => c.review === 'rejected').length,
    edited: cases.filter((c) => c.review === 'edited').length,
    pending: cases.filter((c) => !c.review).length,
  };
}

export function toYaml(file: TestCaseFile): string {
  return dump(file, { noRefs: true, lineWidth: -1, quotingType: "'" });
}
