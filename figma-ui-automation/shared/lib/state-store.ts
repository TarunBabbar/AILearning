import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type ScreenState =
  | 'design-only'
  | 'design-extracted'
  | 'impl-inspected'
  | 'validated'
  | 'tests-generated'
  | 'tests-approved'
  | 'automation-generated'
  | 'pending-dev'
  | 'dev-shipped'
  | 'eval-failed';

export const STATE_ORDER: ScreenState[] = [
  'design-only',
  'design-extracted',
  'impl-inspected',
  'validated',
  'tests-generated',
  'tests-approved',
  'automation-generated',
  'pending-dev',
  'dev-shipped',
];

export interface ScreenRow {
  id: string;
  name: string;
  state: ScreenState;
  designVersion: string;
  implUrl: string;
  lastRunAt: string | null;
}

export interface RunRow {
  id: string;
  screenId: string;
  agent: string;
  status: 'success' | 'failed' | 'pending' | 'skipped';
  artifactPath: string | null;
  message: string;
  createdAt: string;
}

export interface ApprovalRow {
  id: string;
  screenId: string;
  testCaseId: string;
  decision: 'approved' | 'rejected' | 'edited';
  note: string;
  createdAt: string;
}

export class StateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS screens (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'design-only',
        designVersion TEXT,
        implUrl TEXT,
        lastRunAt TEXT
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        screenId TEXT NOT NULL,
        agent TEXT NOT NULL,
        status TEXT NOT NULL,
        artifactPath TEXT,
        message TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        screenId TEXT NOT NULL,
        testCaseId TEXT NOT NULL,
        decision TEXT NOT NULL,
        note TEXT,
        createdAt TEXT NOT NULL
      );
    `);
  }

  upsertScreen(s: { id: string; name: string; state?: ScreenState; designVersion?: string; implUrl?: string }): void {
    const existing = this.getScreen(s.id);
    this.db
      .prepare(
        `INSERT INTO screens (id, name, state, designVersion, implUrl, lastRunAt)
         VALUES (@id, @name, @state, @designVersion, @implUrl, @lastRunAt)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           state = CASE WHEN @stateOverride THEN excluded.state ELSE screens.state END,
           designVersion = COALESCE(excluded.designVersion, screens.designVersion),
           implUrl = COALESCE(excluded.implUrl, screens.implUrl)`,
      )
      .run({
        id: s.id,
        name: s.name,
        state: s.state ?? 'design-only',
        stateOverride: s.state ? 1 : 0,
        designVersion: s.designVersion ?? existing?.designVersion ?? null,
        implUrl: s.implUrl ?? existing?.implUrl ?? null,
        lastRunAt: new Date().toISOString(),
      });
  }

  getScreen(id: string): ScreenRow | undefined {
    return this.db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as ScreenRow | undefined;
  }

  listScreens(): ScreenRow[] {
    return this.db.prepare('SELECT * FROM screens ORDER BY name').all() as ScreenRow[];
  }

  setState(screenId: string, state: ScreenState): void {
    this.db.prepare('UPDATE screens SET state = ?, lastRunAt = ? WHERE id = ?').run(state, new Date().toISOString(), screenId);
  }

  addRun(r: { id: string; screenId: string; agent: string; status: RunRow['status']; artifactPath?: string | null; message?: string }): void {
    this.db
      .prepare('INSERT INTO runs (id, screenId, agent, status, artifactPath, message, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(r.id, r.screenId, r.agent, r.status, r.artifactPath ?? null, r.message ?? null, new Date().toISOString());
  }

  listRuns(screenId?: string): RunRow[] {
    if (screenId) return this.db.prepare('SELECT * FROM runs WHERE screenId = ? ORDER BY createdAt DESC').all(screenId) as RunRow[];
    return this.db.prepare('SELECT * FROM runs ORDER BY createdAt DESC').all() as RunRow[];
  }

  addApproval(a: { id: string; screenId: string; testCaseId: string; decision: ApprovalRow['decision']; note?: string }): void {
    this.db
      .prepare('INSERT INTO approvals (id, screenId, testCaseId, decision, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(a.id, a.screenId, a.testCaseId, a.decision, a.note ?? null, new Date().toISOString());
  }

  listApprovals(screenId?: string): ApprovalRow[] {
    if (screenId) return this.db.prepare('SELECT * FROM approvals WHERE screenId = ? ORDER BY createdAt DESC').all(screenId) as ApprovalRow[];
    return this.db.prepare('SELECT * FROM approvals ORDER BY createdAt DESC').all() as ApprovalRow[];
  }

  close(): void {
    this.db.close();
  }
}
