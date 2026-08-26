import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { load as loadYaml } from 'js-yaml';
import { paths } from './paths';

export interface ScreenRow {
  id: string;
  name: string;
  state: string;
  designVersion: string | null;
  implUrl: string | null;
  lastRunAt: string | null;
}

export interface RunRow {
  id: string;
  screenId: string;
  agent: string;
  status: string;
  artifactPath: string | null;
  message: string | null;
  createdAt: string;
}

export interface ApprovalRow {
  id: string;
  screenId: string;
  testCaseId: string;
  decision: string;
  note: string | null;
  createdAt: string;
}

export interface TestCaseItem {
  id: string;
  title: string;
  feature: string;
  scenario: string;
  priority: string;
  source: string;
  review?: string;
  reviewNote?: string;
  steps: Array<{ action: string; target?: string; value?: string }>;
  expected: string;
}

export interface TestCaseFile {
  schemaVersion: number;
  screenId: string;
  designVersion: string;
  generatedAt: string;
  provider: string;
  cases: TestCaseItem[];
}

function openDb(): Database.Database | null {
  try {
    return new Database(paths.dbFile, { readonly: true });
  } catch {
    return null;
  }
}

export function listScreens(): ScreenRow[] {
  const db = openDb();
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM screens ORDER BY name').all() as ScreenRow[];
  } finally {
    db.close();
  }
}

export function getScreen(id: string): ScreenRow | undefined {
  const db = openDb();
  if (!db) return undefined;
  try {
    return db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as ScreenRow | undefined;
  } finally {
    db.close();
  }
}

export function listRuns(screenId?: string): RunRow[] {
  const db = openDb();
  if (!db) return [];
  try {
    if (screenId) return db.prepare('SELECT * FROM runs WHERE screenId = ? ORDER BY createdAt DESC').all(screenId) as RunRow[];
    return db.prepare('SELECT * FROM runs ORDER BY createdAt DESC LIMIT 200').all() as RunRow[];
  } finally {
    db.close();
  }
}

export function listApprovals(screenId?: string): ApprovalRow[] {
  const db = openDb();
  if (!db) return [];
  try {
    if (screenId) return db.prepare('SELECT * FROM approvals WHERE screenId = ? ORDER BY createdAt DESC').all(screenId) as ApprovalRow[];
    return db.prepare('SELECT * FROM approvals ORDER BY createdAt DESC LIMIT 200').all() as ApprovalRow[];
  } finally {
    db.close();
  }
}

export function listDriftReports(): Array<{ name: string; path: string; mtime: string }> {
  try {
    if (!fs.existsSync(paths.driftReports)) return [];
    return fs
      .readdirSync(paths.driftReports)
      .filter((f) => f.endsWith('.html'))
      .map((f) => {
        const p = path.join(paths.driftReports, f);
        const st = fs.statSync(p);
        return { name: f, path: p, mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export function listGeneratedSpecs(): Array<{ name: string; path: string; mtime: string; content: string }> {
  try {
    if (!fs.existsSync(paths.generatedSpecs)) return [];
    return fs
      .readdirSync(paths.generatedSpecs)
      .filter((f) => f.endsWith('.spec.ts'))
      .map((f) => {
        const p = path.join(paths.generatedSpecs, f);
        const st = fs.statSync(p);
        return { name: f, path: p, mtime: st.mtime.toISOString(), content: fs.readFileSync(p, 'utf-8') };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export function listTestCaseFiles(): TestCaseFile[] {
  try {
    if (!fs.existsSync(paths.testCases)) return [];
    return fs
      .readdirSync(paths.testCases)
      .filter((f) => f.endsWith('.tests.yaml'))
      .map((f) => readTestCaseFile(path.join(paths.testCases, f)));
  } catch {
    return [];
  }
}

export function readTestCaseFile(p: string): TestCaseFile {
  const text = fs.readFileSync(p, 'utf-8');
  return loadYaml(text) as TestCaseFile;
}
