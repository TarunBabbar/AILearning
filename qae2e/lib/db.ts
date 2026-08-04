// Database layer: Vercel Postgres via @vercel/postgres, with a local JSON file
// fallback for dev when no POSTGRES_* env is configured.
//
// Pattern mirrors lib/runs/store.ts: CREATE TABLE IF NOT EXISTS before ops,
// whole-record JSONB for the artifact bodies, lazy dynamic import so the app
// boots without the package configured.

import { getConfig } from "./config";

export interface DbRow {
  id: string;
  [key: string]: unknown;
}

function pgConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.POSTGRES_HOST || process.env.POSTGRES_DATABASE);
}

/** Best-effort table bootstrap. Returns true when Postgres is usable. */
async function ensureTables(): Promise<boolean> {
  try {
    const { sql } = await import("@vercel/postgres");
    await sql`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      requirement_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_artifacts_ws ON artifacts (workspace_id, kind)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_artifacts_req ON artifacts (workspace_id, requirement_id)`;
    await sql`CREATE TABLE IF NOT EXISTS workspace_secrets (
      workspace_id TEXT PRIMARY KEY,
      secrets JSONB NOT NULL
    )`;
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
    await sql`CREATE INDEX IF NOT EXISTS idx_runs_ws ON qae2e_runs (workspace_id)`;
    return true;
  } catch {
    return false;
  }
}

// ---- Users ----

export async function createUser(user: { id: string; email: string; passwordHash: string; name?: string }): Promise<"ok" | "duplicate" | "error"> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO users (id, email, password_hash, name) VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.name || null})`;
      return "ok";
    } catch (e) {
      // unique violation → duplicate
      return (e as { code?: string }).code === "23505" ? "duplicate" : "error";
    }
  }
  // JSON file fallback (dev without DB)
  const all = await readFileStore<Record<string, unknown>>("users");
  const existing = all.find((u) => u.email === user.email);
  if (existing) return "duplicate";
  await writeFileStore("users", [...all, user]);
  return "ok";
}

export async function getUserByEmail(email: string): Promise<Record<string, unknown> | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT id, email, password_hash, name, created_at FROM users WHERE email = ${email} LIMIT 1`;
      return rows.rows?.[0] as Record<string, unknown> | undefined;
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("users");
  return all.find((u) => u.email === email);
}

export async function getUserById(id: string): Promise<Record<string, unknown> | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT id, email, name, created_at FROM users WHERE id = ${id} LIMIT 1`;
      return rows.rows?.[0] as Record<string, unknown> | undefined;
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("users");
  return all.find((u) => u.id === id);
}

// ---- Sessions ----

export async function createSession(session: { id: string; userId: string; expiresAt: string }): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${session.id}, ${session.userId}, ${session.expiresAt})`;
      return;
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("sessions");
  await writeFileStore("sessions", [...all, session]);
}

export async function getSession(id: string): Promise<{ id: string; userId: string; expiresAt: string } | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT id, user_id, expires_at FROM sessions WHERE id = ${id} LIMIT 1`;
      if (!rows.rows?.[0]) return undefined;
      const r = rows.rows[0] as { id: string; user_id: string; expires_at: string };
      return { id: r.id, userId: r.user_id, expiresAt: r.expires_at };
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<{ id: string; userId: string; expiresAt: string }>("sessions");
  return all.find((s) => s.id === id);
}

export async function deleteSession(id: string): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`DELETE FROM sessions WHERE id = ${id}`;
      return;
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<{ id: string }>("sessions");
  await writeFileStore("sessions", all.filter((s) => s.id !== id));
}

// ---- Workspaces ----

export async function createWorkspace(w: { id: string; ownerId: string; name: string; description?: string }): Promise<"ok" | "duplicate" | "error"> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO workspaces (id, owner_id, name, description) VALUES (${w.id}, ${w.ownerId}, ${w.name}, ${w.description || null})`;
      return "ok";
    } catch (e) {
      return (e as { code?: string }).code === "23505" ? "duplicate" : "error";
    }
  }
  const all = await readFileStore<Record<string, unknown>>("workspaces");
  const dup = all.find((x) => x.ownerId === w.ownerId && x.name === w.name);
  if (dup) return "duplicate";
  await writeFileStore("workspaces", [...all, w]);
  return "ok";
}

export async function listWorkspaces(ownerId: string): Promise<Array<{ id: string; name: string; description?: string; createdAt: string }>> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT id, name, description, created_at FROM workspaces WHERE owner_id = ${ownerId} ORDER BY created_at ASC`;
      return (rows.rows || []).map((r) => {
        const x = r as { id: string; name: string; description: string | null; created_at: string };
        return { id: x.id, name: x.name, description: x.description || undefined, createdAt: x.created_at };
      });
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("workspaces");
  return (all.filter((x) => x.ownerId === ownerId) as Array<{ id: string; name: string; description?: string; createdAt: string }>).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    createdAt: w.createdAt,
  }));
}

export async function getWorkspace(workspaceId: string): Promise<{ id: string; ownerId: string; name: string } | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT id, owner_id, name FROM workspaces WHERE id = ${workspaceId} LIMIT 1`;
      if (!rows.rows?.[0]) return undefined;
      const r = rows.rows[0] as { id: string; owner_id: string; name: string };
      return { id: r.id, ownerId: r.owner_id, name: r.name };
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<{ id: string; ownerId: string; name: string }>("workspaces");
  return all.find((w) => w.id === workspaceId);
}

// ---- Secrets ----

export async function saveWorkspaceSecrets(workspaceId: string, secrets: Record<string, string>): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO workspace_secrets (workspace_id, secrets) VALUES (${workspaceId}, ${JSON.stringify(secrets)}::jsonb)
        ON CONFLICT (workspace_id) DO UPDATE SET secrets = EXCLUDED.secrets`;
      return;
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("workspace_secrets");
  const rest = all.filter((x) => x.workspaceId !== workspaceId);
  await writeFileStore("workspace_secrets", [...rest, { workspaceId, secrets }]);
}

export async function getWorkspaceSecrets(workspaceId: string): Promise<Record<string, string>> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT secrets FROM workspace_secrets WHERE workspace_id = ${workspaceId} LIMIT 1`;
      return (rows.rows?.[0]?.secrets as Record<string, string>) || {};
    } catch {
      // fall through
    }
  }
  const all = await readFileStore<Record<string, unknown>>("workspace_secrets");
  return (all.find((x) => x.workspaceId === workspaceId)?.secrets as Record<string, string>) || {};
}

// ---- Artifacts ----

export async function insertArtifact<T extends { id: string; requirementId?: string }>(
  kind: string,
  workspaceId: string,
  item: T
): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`INSERT INTO artifacts (id, workspace_id, requirement_id, kind, data)
        VALUES (${item.id}, ${workspaceId}, ${item.requirementId || ""}, ${kind}, ${JSON.stringify(item)}::jsonb)`;
      return;
    } catch {
      // fall through
    }
  }
  await fileArtifactInsert(kind, workspaceId, item);
}

export async function updateArtifact<T extends { id: string }>(kind: string, workspaceId: string, item: T): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`UPDATE artifacts SET data = ${JSON.stringify(item)}::jsonb
        WHERE id = ${item.id} AND workspace_id = ${workspaceId} AND kind = ${kind}`;
      return;
    } catch {
      // fall through
    }
  }
  await fileArtifactUpdate(kind, workspaceId, item);
}

export async function getArtifact<T>(kind: string, workspaceId: string, id: string): Promise<T | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT data FROM artifacts WHERE id = ${id} AND workspace_id = ${workspaceId} AND kind = ${kind} LIMIT 1`;
      return rows.rows?.[0]?.data as T | undefined;
    } catch {
      // fall through
    }
  }
  return fileArtifactGet<T>(kind, workspaceId, id);
}

export async function listArtifacts<T>(kind: string, workspaceId: string): Promise<T[]> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT data FROM artifacts WHERE workspace_id = ${workspaceId} AND kind = ${kind} ORDER BY created_at ASC`;
      return (rows.rows || []).map((r) => r.data as T);
    } catch {
      // fall through
    }
  }
  return fileArtifactList<T>(kind, workspaceId);
}

// ---- Runs (workspace-scoped) ----

export async function listRuns(workspaceId: string, limit = 50): Promise<unknown[]> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT data FROM qae2e_runs WHERE workspace_id = ${workspaceId} ORDER BY started_at DESC LIMIT ${limit}`;
      return (rows.rows || []).map((r) => r.data);
    } catch {
      // fall through
    }
  }
  return fileArtifactList<unknown>("runs", workspaceId);
}

export async function getRun(workspaceId: string, id: string): Promise<unknown | undefined> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const rows = await sql`SELECT data FROM qae2e_runs WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`;
      return rows.rows?.[0]?.data;
    } catch {
      // fall through
    }
  }
  return fileArtifactGet<unknown>("runs", workspaceId, id);
}

export async function saveRun(workspaceId: string, record: unknown): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      const r = record as { id: string; requirementId: string; title?: string; source?: string; startedAt: string; finishedAt?: string; status?: string };
      await sql`INSERT INTO qae2e_runs (id, workspace_id, requirement_id, title, source, started_at, finished_at, status, data)
        VALUES (${r.id}, ${workspaceId}, ${r.requirementId}, ${r.title || null}, ${r.source || null}, ${r.startedAt}, ${r.finishedAt || null}, ${r.status || null}, ${JSON.stringify(record)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, finished_at = EXCLUDED.finished_at, data = EXCLUDED.data`;
      return;
    } catch {
      // fall through
    }
  }
  await fileArtifactInsert("runs", workspaceId, record as { id: string });
}

export async function deleteRun(workspaceId: string, id: string): Promise<void> {
  if (pgConfigured()) {
    try {
      await ensureTables();
      const { sql } = await import("@vercel/postgres");
      await sql`DELETE FROM qae2e_runs WHERE id = ${id} AND workspace_id = ${workspaceId}`;
      return;
    } catch {
      // fall through
    }
  }
  await fileArtifactDelete("runs", workspaceId, id);
}

// ---- JSON-file fallback (dev without DB) ----
// File layout: data/db.json → { "<kind>": { "<workspaceId>": [ items... ] } }

interface FileStoreShape {
  [kind: string]: Record<string, unknown[]>;
}

async function filePath(): Promise<string> {
  const { join } = await import("path");
  return join(process.cwd(), getConfig().dataDir, "db.json");
}

async function readFileStore<T>(kind: string, workspaceId?: string): Promise<T[]> {
  try {
    const { readFileSync } = await import("fs");
    const all = JSON.parse(readFileSync(await filePath(), "utf-8")) as FileStoreShape;
    if (workspaceId) return ((all[kind] || {})[workspaceId] || []) as T[];
    // For user/session/workspace tables, the fallback stores them flat under kind.
    return ((all[kind] || {})["__all"] || []) as T[];
  } catch {
    return [];
  }
}

async function writeFileStore(kind: string, items: unknown[], workspaceId?: string): Promise<void> {
  try {
    const { mkdirSync, readFileSync, writeFileSync } = await import("fs");
    const { join } = await import("path");
    const dir = join(process.cwd(), getConfig().dataDir);
    mkdirSync(dir, { recursive: true });
    const path = await filePath();
    let all: FileStoreShape = {};
    try {
      all = JSON.parse(readFileSync(path, "utf-8")) as FileStoreShape;
    } catch {
      // fresh
    }
    const key = workspaceId || "__all";
    all[kind] = { ...(all[kind] || {}), [key]: items };
    writeFileSync(path, JSON.stringify(all, null, 2), "utf-8");
  } catch {
    // memory-only mode — drop
  }
}

async function fileArtifactInsert<T extends { id: string }>(kind: string, workspaceId: string, item: T): Promise<void> {
  const items = await readFileStore<T>(kind, workspaceId);
  items.push(item);
  await writeFileStore(kind, items, workspaceId);
}

async function fileArtifactUpdate<T extends { id: string }>(kind: string, workspaceId: string, item: T): Promise<void> {
  const items = await readFileStore<T>(kind, workspaceId);
  await writeFileStore(kind, items.map((i) => (i.id === item.id ? item : i)), workspaceId);
}

async function fileArtifactGet<T>(kind: string, workspaceId: string, id: string): Promise<T | undefined> {
  const items = await readFileStore<T>(kind, workspaceId);
  return items.find((i) => (i as { id: string }).id === id);
}

async function fileArtifactList<T>(kind: string, workspaceId: string): Promise<T[]> {
  return readFileStore<T>(kind, workspaceId);
}

async function fileArtifactDelete<T extends { id: string }>(kind: string, workspaceId: string, id: string): Promise<void> {
  const items = await readFileStore<T>(kind, workspaceId);
  await writeFileStore(kind, items.filter((i) => i.id !== id), workspaceId);
}

export { pgConfigured, ensureTables };
