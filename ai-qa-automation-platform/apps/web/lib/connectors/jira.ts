import { prisma } from "../db";
import { decryptSecret } from "../secrets";

/**
 * Jira connector — direct REST (Vercel-friendly, replaces MCP).
 * Reads user stories + acceptance criteria; optionally creates defect tickets.
 */
export interface JiraConnectionConfig {
  baseUrl: string; // e.g. https://yourorg.atlassian.net
  email: string;
  apiToken: string;
  projectKey: string;
  boardId?: string;
}

export async function getJiraConfig(workspaceId: string): Promise<JiraConnectionConfig> {
  const conn = await prisma.connection.findFirst({
    where: { workspaceId, type: "jira" },
  });
  if (!conn) throw new Error("Jira not connected for this workspace");
  const secret = decryptSecret(conn.secretCiphertext);
  // Scope config holds baseUrl/email/projectKey; the token is the secret.
  const cfg = conn.scopeConfig as Partial<JiraConnectionConfig>;
  if (!cfg.baseUrl || !cfg.email || !cfg.projectKey) {
    throw new Error("Jira scope config incomplete (baseUrl, email, projectKey required)");
  }
  return { ...cfg, apiToken: secret } as JiraConnectionConfig;
}

function authHeader(cfg: JiraConnectionConfig): string {
  return "Basic " + Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
}

export async function fetchStories(
  cfg: JiraConnectionConfig,
  jql = "",
): Promise<Array<{ key: string; summary: string; description: string; acceptanceCriteria: string[] }>> {
  const jqlQuery = jql || `project=${cfg.projectKey} AND issuetype in (Story, Task) ORDER BY created DESC`;
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/search`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: jqlQuery,
      maxResults: 50,
      fields: ["summary", "description", "customfield_10020"], // acceptance criteria field varies
    }),
  });
  if (!res.ok) throw new Error(`Jira search failed: ${res.status} ${await res.text()}`);

  const data = (await res.json()) as {
    issues?: Array<{ key: string; fields: Record<string, unknown> }>;
  };
  return (data.issues ?? []).map((issue) => ({
    key: issue.key,
    summary: (issue.fields.summary as string) ?? "",
    description: (issue.fields.description as string) ?? "",
    acceptanceCriteria: Array.isArray(issue.fields.customfield_10020)
      ? (issue.fields.customfield_10020 as unknown as string[]).map((v) =>
          typeof v === "string" ? v : JSON.stringify(v)
        )
      : [],
  }));
}

export async function createDefect(
  cfg: JiraConnectionConfig,
  summary: string,
  description: string,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(cfg),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: cfg.projectKey },
        summary,
        description: { type: "doc", version: 1, content: [] },
        issuetype: { name: "Bug" },
      },
    }),
  });
  if (!res.ok) throw new Error(`Jira create failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { key: string };
  return data.key;
}
