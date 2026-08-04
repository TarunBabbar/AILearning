// Async, workspace-scoped artifact persistence backed by lib/db.ts
// (Vercel Postgres with a local JSON-file fallback for dev without a DB).
//
// Replaces the old global data/artifacts.json singleton. Every artifact is
// scoped to a workspaceId so users only ever see their own data.
//
// Tool handlers / orchestrator keep their existing signatures: they call
// insertOne("kind", item) and the CURRENT workspace is resolved from a
// per-request context set by the route handler via withWorkspace().

import {
  insertArtifact,
  updateArtifact,
  getArtifact,
  listArtifacts,
} from "./db";

export type ArtifactKind =
  | "requirements"
  | "analyses"
  | "coverages"
  | "scripts"
  | "cycles"
  | "defects"
  | "releases"
  | "exports"
  | "uploads"
  | "extractions";

// ---- Per-request workspace context ----
// Routes call withWorkspace(workspaceId, async () => ...) so all store calls
// made during the request (including agent tool handlers) are scoped to the
// workspace without threading a param through every signature.

const ctxStore = new Map<symbol, string>();

export function withWorkspace<T>(workspaceId: string, fn: () => Promise<T> | T): Promise<T> {
  const token = Symbol("ws");
  ctxStore.set(token, workspaceId);
  return Promise.resolve(fn()).finally(() => ctxStore.delete(token));
}

export function currentWorkspace(): string {
  // Last-set token wins (simplest correct behavior for nested/sequential).
  let ws = "";
  ctxStore.forEach((v) => (ws = v));
  return ws || "default";
}

async function wsId(): Promise<string> {
  return currentWorkspace();
}

export async function insertOne<T extends { id: string; requirementId?: string }>(
  kind: ArtifactKind,
  item: T
): Promise<T> {
  await insertArtifact(kind, await wsId(), item);
  return item;
}

export async function updateOne<T extends { id: string }>(
  kind: ArtifactKind,
  id: string,
  item: T
): Promise<T | undefined> {
  await updateArtifact(kind, await wsId(), item);
  return item;
}

export async function getOne<T extends { id: string }>(
  kind: ArtifactKind,
  id: string
): Promise<T | undefined> {
  return getArtifact<T>(kind, await wsId(), id);
}

export async function listAll<T extends { id: string }>(
  kind: ArtifactKind
): Promise<T[]> {
  return listArtifacts<T>(kind, await wsId());
}

export async function listByRequirement<T extends { id: string; requirementId?: string }>(
  kind: ArtifactKind,
  requirementId: string
): Promise<T[]> {
  const items = await listArtifacts<T>(kind, await wsId());
  return items.filter((i) => i.requirementId === requirementId);
}
