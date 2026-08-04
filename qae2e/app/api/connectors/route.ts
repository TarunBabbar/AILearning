// GET  /api/connectors?workspaceId=...   → status of every connector (configured / missing)
// POST /api/connectors/test              → test a connector's credentials (best-effort)
// POST /api/connectors/save              → persist connector credentials per-workspace (workspace_secrets)

import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { connectorStatuses } from "@/lib/connectors";
import { jiraFetchIssue, confluenceFetchPage, figmaFetchFile } from "@/lib/connectors/client";
import { getWorkspaceSecrets, saveWorkspaceSecrets } from "@/lib/db";
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

// Status per workspace: merge env defaults with the workspace's saved secrets.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const workspaceId = sp.get("workspaceId") || "";
  const secrets = workspaceId ? await getWorkspaceSecrets(workspaceId) : {};
  const base = getConfig();
  const merged = { ...base, ...secretsToPartial(secrets) };
  const statuses = connectorStatusesFor(merged);
  return Response.json({ connectors: statuses, workspaceId });
}

function secretsToPartial(secrets: Record<string, string>) {
  // Map stored env-key names to the config fields the status checker reads.
  return {
    jiraUrl: secrets.JIRA_URL,
    jiraEmail: secrets.JIRA_EMAIL,
    jiraApiToken: secrets.JIRA_API_TOKEN,
    jiraProjectKey: secrets.JIRA_PROJECT_KEY,
    confluenceUrl: secrets.CONFLUENCE_URL,
    confluenceEmail: secrets.CONFLUENCE_EMAIL,
    confluenceApiToken: secrets.CONFLUENCE_API_TOKEN,
    figmaToken: secrets.FIGMA_TOKEN,
    githubToken: secrets.GITHUB_TOKEN,
    githubOwner: secrets.GITHUB_OWNER,
    githubRepo: secrets.GITHUB_REPO,
    githubBranch: secrets.GITHUB_BRANCH,
    zephyrBaseUrl: secrets.ZEPHYR_BASE_URL,
    zephyrToken: secrets.ZEPHYR_TOKEN,
    zephyrProjectKey: secrets.ZEPHYR_PROJECT_KEY,
    testrailUrl: secrets.TESTRAIL_URL,
    testrailUser: secrets.TESTRAIL_USER,
    testrailApiKey: secrets.TESTRAIL_API_KEY,
    pineconeApiKey: secrets.PINECONE_API_KEY,
    pineconeIndex: secrets.PINECONE_INDEX,
    pineconeHost: secrets.PINECONE_HOST,
  };
}

function connectorStatusesFor(cfg: ReturnType<typeof getConfig>) {
  // connectorStatuses() reads getConfig() internally, so emulate the fields it
  // needs by checking presence directly.
  const jiraConfigured = Boolean(cfg.jiraUrl && cfg.jiraEmail && cfg.jiraApiToken);
  const confluenceConfigured = Boolean(cfg.confluenceUrl && cfg.confluenceEmail && cfg.confluenceApiToken);
  const figmaConfigured = Boolean(cfg.figmaToken);
  const githubConfigured = Boolean(cfg.githubToken && cfg.githubOwner && cfg.githubRepo);
  const zephyrConfigured = Boolean(cfg.zephyrBaseUrl && cfg.zephyrToken && cfg.zephyrProjectKey);
  const testrailConfigured = Boolean(cfg.testrailUrl && cfg.testrailUser && cfg.testrailApiKey);

  return [
    { id: "jira" as const, configured: jiraConfigured, missing: jiraConfigured ? [] : ["url", "email", "api token"] },
    { id: "confluence" as const, configured: confluenceConfigured, missing: confluenceConfigured ? [] : ["url", "email", "api token"] },
    { id: "figma" as const, configured: figmaConfigured, missing: figmaConfigured ? [] : ["token"] },
    { id: "github" as const, configured: githubConfigured, missing: githubConfigured ? [] : ["token", "owner", "repo"] },
    { id: "zephyr" as const, configured: zephyrConfigured, missing: zephyrConfigured ? [] : ["base url", "token", "project key"] },
    { id: "testrail" as const, configured: testrailConfigured, missing: testrailConfigured ? [] : ["url", "user", "api key"] },
  ];
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

// Best-effort connectivity test per connector. Overrides are per-call only.
async function handleTest(body: { connector?: string; fields?: Record<string, string>; workspaceId?: string }) {
  const connector = body.connector as ConnectorId | undefined;
  if (!connector) return Response.json({ error: "connector required" }, { status: 400 });

  // Base = workspace secrets (if any) + explicit overrides from the wizard.
  const secrets = body.workspaceId ? await getWorkspaceSecrets(body.workspaceId) : {};
  const merged: Record<string, string> = { ...secrets };
  for (const [k, v] of Object.entries(body.fields || {})) {
    if (v && ENV_KEY[k]) merged[ENV_KEY[k]] = String(v);
  }

  const overrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v) overrides[k] = String(v);
  }
  const orig = { ...process.env };
  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
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
    } else {
      result = { ok: false, detail: `Connectivity test for ${connector} not yet implemented — check configured status instead.` };
    }
  } finally {
    process.env = orig;
  }

  return Response.json({ connector, ok: result.ok, detail: result.detail });
}

// Persist credentials per-workspace (NOT to .env — scoped and safe).
async function handleSave(body: { connector?: string; fields?: Record<string, string>; workspaceId?: string }) {
  const connector = body.connector as ConnectorId | undefined;
  if (!connector) return Response.json({ error: "connector required" }, { status: 400 });
  const workspaceId = String(body.workspaceId || "");
  if (!workspaceId) return Response.json({ error: "workspaceId required" }, { status: 400 });

  const existing = await getWorkspaceSecrets(workspaceId);
  const next = { ...existing };
  for (const [k, v] of Object.entries(body.fields || {})) {
    const envKey = ENV_KEY[k];
    if (envKey && v) next[envKey] = String(v);
  }

  await saveWorkspaceSecrets(workspaceId, next);
  return Response.json({ ok: true, message: `Saved ${connector} credentials for this workspace.` });
}
