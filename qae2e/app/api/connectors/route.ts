// GET  /api/connectors        → status of every connector (configured / missing)
// POST /api/connectors/test   → test a connector's credentials (best-effort)
// POST /api/connectors/save   → persist connector credentials to .env (dev convenience)

import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { connectorStatuses } from "@/lib/connectors";
import { jiraFetchIssue, confluenceFetchPage, figmaFetchFile } from "@/lib/connectors/client";
import type { ConnectorId } from "@/lib/types";

export const runtime = "nodejs";

const ENV_KEY: Record<string, string> = {
  url: "JIRA_URL",
  email: "JIRA_EMAIL",
  apiToken: "JIRA_API_TOKEN",
  confluenceUrl: "CONFLUENCE_URL",
  confluenceEmail: "CONFLUENCE_EMAIL",
  confluenceApiToken: "CONFLUENCE_API_TOKEN",
  figmaToken: "FIGMA_TOKEN",
  githubToken: "GITHUB_TOKEN",
  githubOwner: "GITHUB_OWNER",
  githubRepo: "GITHUB_REPO",
  githubBranch: "GITHUB_BRANCH",
  zephyrBaseUrl: "ZEPHYR_BASE_URL",
  zephyrToken: "ZEPHYR_TOKEN",
  zephyrProjectKey: "ZEPHYR_PROJECT_KEY",
  testrailUrl: "TESTRAIL_URL",
  testrailUser: "TESTRAIL_USER",
  testrailApiKey: "TESTRAIL_API_KEY",
  pineconeApiKey: "PINECONE_API_KEY",
  pineconeIndex: "PINECONE_INDEX",
  pineconeHost: "PINECONE_HOST",
};

export async function GET() {
  return Response.json({ connectors: connectorStatuses() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (!body || !action) return Response.json({ error: "action required" }, { status: 400 });

  if (action === "test") {
    return handleTest(body);
  }

  if (action === "save") {
    return handleSave(body);
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
}

// Best-effort connectivity test per connector.
async function handleTest(body: { connector?: string; fields?: Record<string, string> }) {
  const connector = body.connector as ConnectorId | undefined;
  if (!connector) return Response.json({ error: "connector required" }, { status: 400 });

  // In-memory override from the wizard (not persisted) for the test call.
  const overrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.fields || {})) {
    if (v) overrides[k] = String(v);
  }
  const orig = { ...process.env };
  for (const [k, v] of Object.entries(overrides)) {
    if (ENV_KEY[k]) process.env[ENV_KEY[k]] = v;
  }

  let result: { ok: boolean; detail: string };
  try {
    if (connector === "jira") {
      const r = await jiraFetchIssue(overrides.issueKey || "TEST");
      result = r.ok ? { ok: true, detail: "Jira credentials work." } : { ok: false, detail: (r.data as { error?: string })?.error || `Jira returned ${r.status}` };
    } else if (connector === "confluence") {
      const r = await confluenceFetchPage(overrides.pageId || "1");
      result = r.ok ? { ok: true, detail: "Confluence credentials work." } : { ok: false, detail: (r.data as { error?: string })?.error || `Confluence returned ${r.status}` };
    } else if (connector === "figma") {
      const r = await figmaFetchFile(overrides.fileKey || "test");
      result = r.ok ? { ok: true, detail: "Figma credentials work." } : { ok: false, detail: (r.data as { error?: string })?.error || `Figma returned ${r.status}` };
    } else if (connector === "github") {
      const r = await jiraFetchIssue(""); // placeholder — real check would list repos
      result = { ok: false, detail: "GitHub connectivity check: provide a repo path and read a file to verify (see connector_status)." };
      void r;
    } else {
      result = { ok: false, detail: `Connectivity test for ${connector} not yet implemented — check configured status instead.` };
    }
  } finally {
    process.env = orig;
  }

  return Response.json({ connector, ok: result.ok, detail: result.detail });
}

// Persist credentials to .env (dev convenience; secrets stay out of git via .gitignore).
async function handleSave(body: { connector?: string; fields?: Record<string, string> }) {
  const connector = body.connector as ConnectorId | undefined;
  if (!connector) return Response.json({ error: "connector required" }, { status: 400 });
  const fields = body.fields || {};
  const lines: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    const envKey = ENV_KEY[k];
    if (envKey && v) lines.push(`${envKey}=${String(v)}`);
  }
  if (!lines.length) return Response.json({ error: "no fields to save" }, { status: 400 });

  try {
    const { readFileSync, writeFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const envPath = join(process.cwd(), ".env");
    const existing = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
    const set: Record<string, string> = {};
    for (const l of existing.split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) set[m[1]] = m[2];
    }
    for (const l of lines) {
      const [k, ...rest] = l.split("=");
      set[k] = rest.join("=");
    }
    const out = Object.entries(set).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
    writeFileSync(envPath, out, "utf-8");
    return Response.json({ ok: true, message: `Saved ${connector} credentials to .env (applies on next restart).` });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
