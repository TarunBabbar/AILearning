// Run history + archive persistence.
// Persists each pipeline run (events, generated code, test results, logs) so it
// can be referenced later and downloaded.
//
// Backend: Vercel Postgres when POSTGRES_URL / POSTGRES_HOST are set (production,
// serverless), otherwise a local JSON file (data/runs.json) for dev.

import { getConfig } from "../config";

export interface RunRecord {
  id: string;
  requirementId: string;
  title: string;
  source: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "partial" | "failed" | "stopped" | "stuck";
  // Owning workspace (personal workspaces → user-scoped history).
  workspaceId?: string;
  // Per-agent status for the summary.
  agents: Array<{ code: string; name: string; status: "done" | "error" | "skipped" | "running"; index: number; total: number }>;
  counts: {
    analyses: number;
    coverages: number;
    testCases: number;
    scripts: number;
    cycles: number;
    defects: number;
    releases: number;
    evaluations: number;
  };
  // DeepEval-style stage evaluation scores, keyed by agent code (RI/MT/AS/EX/DO/IQ).
  evaluations?: Array<{ agentCode: string; stage: string; precision: number; accuracy: number }>;
  // Real test-run results from the Docker autofix (if any).
  testRun?: {
    ok: boolean;
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    attempts: number;
    failures: Array<{ test: string; message: string }>;
    logs: string[];
    // Per-test outcomes (names + status) — powers flaky detection + trends.
    results?: Array<{ test: string; status: string; durationMs?: number }>;
  };
  // Generated automation files (code) — included in the download bundle.
  files: Array<{ path: string; code: string }>;
  // All agent events, serialized (the full activity log).
  events: unknown[];
  issues: string[];
}

function runsFile(): string {
  return `${getConfig().dataDir}/runs.json`;
}

function pgConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_HOST || process.env.POSTGRES_DATABASE || process.env.DATABASE_URL);
}

async function pgRunTable(): Promise<boolean> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`CREATE TABLE IF NOT EXISTS qae2e_runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT,
      requirement_id TEXT NOT NULL,
      title TEXT,
      source TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      status TEXT,
      data JSONB NOT NULL
    )`;
    return true;
  } catch {
    return false;
  }
}

/** Create the table if needed; returns true when Postgres is available. */
export async function initRunStore(): Promise<boolean> {
  if (!pgConfigured()) return false;
  return pgRunTable();
}

export async function saveRun(record: RunRecord, workspaceId = "default"): Promise<void> {
  if (pgConfigured()) {
    try {
      await pgRunTable();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO qae2e_runs (id, workspace_id, requirement_id, title, source, started_at, finished_at, status, data)
        VALUES (${record.id}, ${workspaceId}, ${record.requirementId}, ${record.title}, ${record.source}, ${record.startedAt}, ${record.finishedAt}, ${record.status}, ${JSON.stringify(record)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, finished_at = EXCLUDED.finished_at, data = EXCLUDED.data`;
      return;
    } catch {
      // fall through to file
    }
  }
  // Local file fallback (dev).
  const { readFileSync, writeFileSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const dir = join(process.cwd(), getConfig().dataDir);
  mkdirSync(dir, { recursive: true });
  const file = join(process.cwd(), runsFile());
  let runs: RunRecord[] = [];
  try {
    runs = JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    // fresh
  }
  const idx = runs.findIndex((r) => r.id === record.id);
  if (idx >= 0) runs[idx] = record;
  else runs.unshift(record);
  // Keep newest 50 locally.
  writeFileSync(file, JSON.stringify(runs.slice(0, 50), null, 2), "utf-8");
}

export async function listRuns(limit = 50, workspaceIds?: string[] | string): Promise<RunRecord[]> {
  const ids = workspaceIds
    ? (Array.isArray(workspaceIds) ? workspaceIds : [workspaceIds]).filter(Boolean)
    : [];
  if (pgConfigured()) {
    try {
      await pgRunTable();
      const { sql } = await import("@vercel/postgres");
      // Cast the array to a text[] literal to satisfy the typed sql helper.
      const idsLit = `{${ids.map((i) => `"${i.replace(/"/g, '\\"')}"`).join(",")}}`;
      const rows = ids.length
        ? await sql`SELECT data FROM qae2e_runs WHERE workspace_id = ANY(${idsLit}::text[]) ORDER BY started_at DESC LIMIT ${limit}`
        : await sql`SELECT data FROM qae2e_runs ORDER BY started_at DESC LIMIT ${limit}`;
      return (rows.rows || []).map((r) => r.data as RunRecord);
    } catch {
      // fall through
    }
  }
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const runs = JSON.parse(readFileSync(join(process.cwd(), runsFile()), "utf-8"));
    const arr: RunRecord[] = Array.isArray(runs) ? runs : [];
    const filtered = ids.length
      ? arr.filter((r) => ids.includes(String((r as unknown as { workspaceId?: string }).workspaceId || "default")))
      : arr;
    return filtered.slice(0, limit);
  } catch {
    return [];
  }
}

export async function getRun(id: string, workspaceId?: string): Promise<RunRecord | null> {
  if (pgConfigured()) {
    try {
      await pgRunTable();
      const { sql } = await import("@vercel/postgres");
      const rows = workspaceId
        ? await sql`SELECT data FROM qae2e_runs WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`
        : await sql`SELECT data FROM qae2e_runs WHERE id = ${id} LIMIT 1`;
      if (rows.rows?.[0]) return rows.rows[0].data as RunRecord;
    } catch {
      // fall through
    }
  }
  try {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const runs = JSON.parse(readFileSync(join(process.cwd(), runsFile()), "utf-8"));
    return (runs as RunRecord[]).find((r) => r.id === id) || null;
  } catch {
    return null;
  }
}

export async function deleteRun(id: string, workspaceId?: string): Promise<void> {
  if (pgConfigured()) {
    try {
      const { sql } = await import("@vercel/postgres");
      if (workspaceId) await sql`DELETE FROM qae2e_runs WHERE id = ${id} AND workspace_id = ${workspaceId}`;
      else await sql`DELETE FROM qae2e_runs WHERE id = ${id}`;
      return;
    } catch {
      // fall through
    }
  }
  try {
    const { readFileSync, writeFileSync } = await import("fs");
    const { join } = await import("path");
    const file = join(process.cwd(), runsFile());
    const runs = JSON.parse(readFileSync(file, "utf-8"));
    writeFileSync(file, JSON.stringify((runs as RunRecord[]).filter((r) => r.id !== id), null, 2), "utf-8");
  } catch {
    // ignore
  }
}
