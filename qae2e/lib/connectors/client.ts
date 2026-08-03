// Real REST clients for the source/target connectors.
// Each method validates credentials, makes the actual API call, and returns a
// normalized result. If credentials are missing, it returns a structured error
// (never throws) so the UI can show exactly what's required.

import { getConfig } from "../config";
import type { ExternalTestCase } from "../types";

async function call(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        Accept: "application/json",
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text().catch(() => "");
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON response
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

function basicAuth(user: string, pass: string): string {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

function missing(connector: string, fields: string[]) {
  return {
    ok: false,
    status: 0,
    // Marked as a WARNING (not an error): missing credentials are a config
    // gap, not a runtime failure. UI/runner surface these in amber.
    warning: true,
    data: { error: `Missing ${connector} credentials: ${fields.join(", ")}` },
  };
}

// ---------------------------------------------------------------------------
// Jira — fetch issue by key
// ---------------------------------------------------------------------------
export async function jiraFetchIssue(
  issueKey: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.jiraUrl || !cfg.jiraEmail || !cfg.jiraApiToken) {
    return missing("Jira", ["JIRA_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]);
  }
  const url = `${cfg.jiraUrl.replace(/\/$/, "")}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;
  const res = await call(url, {
    headers: {
      Authorization: basicAuth(cfg.jiraEmail, cfg.jiraApiToken),
    },
  });
  if (!res.ok) return res;
  const issue = res.data as {
    key?: string;
    fields?: { summary?: string; description?: unknown; issuetype?: { name?: string } };
  };
  const text = issue?.fields?.description;
  return {
    ok: true,
    status: res.status,
    data: {
      key: issue?.key,
      title: issue?.fields?.summary,
      issueType: issue?.fields?.issuetype?.name,
      content: typeof text === "string" ? text : JSON.stringify(text ?? ""),
    },
  };
}

// ---------------------------------------------------------------------------
// Confluence — fetch page by ID
// ---------------------------------------------------------------------------
export async function confluenceFetchPage(
  pageId: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.confluenceUrl || !cfg.confluenceEmail || !cfg.confluenceApiToken) {
    return missing("Confluence", ["CONFLUENCE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"]);
  }
  const url = `${cfg.confluenceUrl.replace(/\/$/, "")}/rest/api/content/${encodeURIComponent(pageId)}?expand=body.view`;
  const res = await call(url, {
    headers: {
      Authorization: basicAuth(cfg.confluenceEmail, cfg.confluenceApiToken),
    },
  });
  if (!res.ok) return res;
  const page = res.data as { id?: string; title?: string; body?: { view?: { value?: string } } };
  const html = page?.body?.view?.value || "";
  // strip HTML tags to plain text
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    ok: true,
    status: res.status,
    data: { id: page?.id, title: page?.title, content: text },
  };
}

// ---------------------------------------------------------------------------
// Figma — fetch file metadata + a specific frame's description
// ---------------------------------------------------------------------------
export async function figmaFetchFile(
  fileKey: string,
  frameName?: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.figmaToken) return missing("Figma", ["FIGMA_TOKEN"]);
  const url = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}`;
  const res = await call(url, {
    headers: { Authorization: `Bearer ${cfg.figmaToken}` },
  });
  if (!res.ok) return res;
  const file = res.data as {
    name?: string;
    document?: { children?: Array<{ type?: string; name?: string; children?: unknown[] }> };
  };
  // Collect frame/page names + description-ish text from child names (simplified).
  const frames = (file.document?.children || []).map((c) => c.name || "");
  const content = frameName
    ? `Frame "${frameName}" selected from file "${file.name}". Extract requirement text from the visual/design of this frame.`
    : `Figma file "${file.name}" has frames: ${frames.join(", ")}.`;
  return { ok: true, status: res.status, data: { name: file.name, frames, content } };
}

// ---------------------------------------------------------------------------
// GitHub — read repo tree / file, create branch, push
// ---------------------------------------------------------------------------
export async function githubReadRepo(
  owner: string,
  repo: string,
  path = ""
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const res = await call(url, {
    headers: {
      Authorization: `Bearer ${cfg.githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) return res;
  const data = res.data as Array<{ name?: string; type?: string; path?: string; download_url?: string | null }>;
  const listing = Array.isArray(data)
    ? data.map((d) => ({ name: d.name, type: d.type, path: d.path, url: d.download_url }))
    : { name: (data as { name?: string }).name, content: (data as { content?: string }).content };
  return { ok: true, status: res.status, data: listing };
}

export async function githubCreateBranch(
  owner: string,
  repo: string,
  branch: string,
  base = "main"
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const headers = { Authorization: `Bearer ${cfg.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" };
  const baseRes = await call(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${base}`, { headers });
  const baseSha = (baseRes.data as { object?: { sha?: string } })?.object?.sha;
  if (!baseSha) return { ok: false, status: baseRes.status, data: { error: "Could not resolve base branch" } };
  return call(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers,
    body: { ref: `refs/heads/${branch}`, sha: baseSha },
  });
}

export async function githubCommitFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const headers = { Authorization: `Bearer ${cfg.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" };
  // Get current SHA of the path if it exists (to update) else null (to create)
  const existing = await call(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers });
  const sha = (existing.data as { sha?: string })?.sha || null;
  return call(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers,
    body: { message, content: Buffer.from(content).toString("base64"), branch, sha },
  });
}

// Full git tree (recursive) of a repo branch — used to understand an existing
// automation framework before generating new tests in its style.
export async function githubGetTree(
  owner: string,
  repo: string,
  branch = "main"
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const headers = { Authorization: `Bearer ${cfg.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" };
  const ref = await call(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  const sha = (ref.data as { object?: { sha?: string } })?.object?.sha;
  if (!sha) return { ok: false, status: ref.status, data: { error: "Could not resolve branch" } };
  return call(`https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, { headers });
}

// Create a commit from multiple file changes (create/update) on a branch,
// using the git data API (blobs → tree → commit → ref). One atomic push.
export async function githubCommitMultipleFiles(
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const headers = { Authorization: `Bearer ${cfg.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" };

  // 1. latest commit sha on branch
  const refRes = await call(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  const baseSha = (refRes.data as { object?: { sha?: string } })?.object?.sha;
  if (!baseSha) return { ok: false, status: refRes.status, data: { error: "Could not resolve branch head" } };

  // 2. get current tree sha
  const baseCommit = await call(`https://api.github.com/repos/${owner}/${repo}/git/commits/${baseSha}`, { headers });
  const baseTree = (baseCommit.data as { tree?: { sha?: string } })?.tree?.sha;
  if (!baseTree) return { ok: false, status: baseCommit.status, data: { error: "Could not resolve base tree" } };

  // 3. create blobs
  const treeItems: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
  for (const f of files) {
    const blob = await call(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers,
      body: { content: Buffer.from(f.content).toString("base64"), encoding: "base64" },
    });
    const sha = (blob.data as { sha?: string })?.sha;
    if (!sha) return { ok: false, status: blob.status, data: { error: `Blob create failed for ${f.path}` } };
    treeItems.push({ path: f.path, mode: "100644", type: "blob", sha });
  }

  // 4. create tree
  const tree = await call(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers,
    body: { base_tree: baseTree, tree: treeItems },
  });
  const treeSha = (tree.data as { sha?: string })?.sha;
  if (!treeSha) return { ok: false, status: tree.status, data: { error: "Tree create failed" } };

  // 5. create commit
  const commit = await call(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers,
    body: { message, tree: treeSha, parents: [baseSha] },
  });
  const commitSha = (commit.data as { sha?: string })?.sha;
  if (!commitSha) return { ok: false, status: commit.status, data: { error: "Commit create failed" } };

  // 6. update ref
  const upd = await call(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: { sha: commitSha, force: false },
  });
  return upd.ok ? { ok: true, status: upd.status, data: { commitSha } } : upd;
}

// Trigger a GitHub Actions workflow_dispatch (devops leg).
export async function githubDispatchWorkflow(
  owner: string,
  repo: string,
  workflowFile: string,
  branch: string,
  inputs: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.githubToken) return missing("GitHub", ["GITHUB_TOKEN"]);
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
  const res = await call(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.githubToken}`, "X-GitHub-Api-Version": "2022-11-28" },
    body: { ref: branch, inputs },
  });
  return { ok: res.ok, status: res.status, data: res.ok ? { dispatched: true } : res.data };
}

// ---------------------------------------------------------------------------
// Zephyr Scale — list test cases + create test case
// ---------------------------------------------------------------------------
export async function zephyrListTestCases(
  projectKey: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.zephyrBaseUrl || !cfg.zephyrToken || !cfg.zephyrProjectKey) {
    return missing("Zephyr", ["ZEPHYR_BASE_URL", "ZEPHYR_TOKEN", "ZEPHYR_PROJECT_KEY"]);
  }
  const url = `${cfg.zephyrBaseUrl.replace(/\/$/, "")}/testcases?projectKey=${encodeURIComponent(projectKey)}&maxResults=100`;
  const res = await call(url, {
    headers: { Authorization: `Bearer ${cfg.zephyrToken}` },
  });
  if (!res.ok) return res;
  const data = res.data as { values?: Array<{ key?: string; name?: string; priorityName?: string; folder?: { name?: string } }> };
  const cases: ExternalTestCase[] = (data.values || []).map((v) => ({
    id: v.key || v.name || "",
    source: "zephyr",
    title: v.name || "",
    priority: v.priorityName,
    testType: v.folder?.name,
  }));
  return { ok: true, status: res.status, data: cases };
}

export async function zephyrCreateTestCase(
  projectKey: string,
  title: string,
  description: string,
  steps: Array<{ action: string; expected: string }>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.zephyrBaseUrl || !cfg.zephyrToken) return missing("Zephyr", ["ZEPHYR_BASE_URL", "ZEPHYR_TOKEN"]);
  const url = `${cfg.zephyrBaseUrl.replace(/\/$/, "")}/testcases`;
  return call(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.zephyrToken}` },
    body: {
      projectKey,
      name: title,
      objective: description,
      precondition: "",
      testScript: { type: "step", steps: steps.map((s) => ({ inline: { description: s.action, expectedResult: s.expected } })) },
    },
  });
}

// ---------------------------------------------------------------------------
// TestRail — list cases + add case
// ---------------------------------------------------------------------------
export async function testrailListTestCases(
  projectId: string,
  suiteId?: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.testrailUrl || !cfg.testrailUser || !cfg.testrailApiKey) {
    return missing("TestRail", ["TESTRAIL_URL", "TESTRAIL_USER", "TESTRAIL_API_KEY"]);
  }
  const url = `${cfg.testrailUrl.replace(/\/$/, "")}/index.php?/api/v2/get_cases/${encodeURIComponent(projectId)}${suiteId ? `&suite_id=${encodeURIComponent(suiteId)}` : ""}`;
  const res = await call(url, {
    headers: { Authorization: basicAuth(cfg.testrailUser, cfg.testrailApiKey) },
  });
  if (!res.ok) return res;
  const data = res.data as { cases?: Array<{ id?: number; title?: string; priority_id?: number; type_id?: number }> };
  const cases: ExternalTestCase[] = (data.cases || []).map((c) => ({
    id: String(c.id),
    source: "testrail",
    title: c.title || "",
    priority: c.priority_id ? `priority_${c.priority_id}` : undefined,
    testType: c.type_id ? `type_${c.type_id}` : undefined,
  }));
  return { ok: true, status: res.status, data: cases };
}

export async function testrailAddTestCase(
  projectId: string,
  sectionId: number,
  title: string,
  steps: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.testrailUrl || !cfg.testrailUser || !cfg.testrailApiKey) {
    return missing("TestRail", ["TESTRAIL_URL", "TESTRAIL_USER", "TESTRAIL_API_KEY"]);
  }
  const url = `${cfg.testrailUrl.replace(/\/$/, "")}/index.php?/api/v2/add_case/${sectionId}`;
  return call(url, {
    method: "POST",
    headers: { Authorization: basicAuth(cfg.testrailUser, cfg.testrailApiKey) },
    body: { title, custom_steps_separated: steps },
  });
}

// TestRail — add a test result to a run (post-run sync)
export async function testrailAddResult(
  runId: number,
  caseId: number,
  status: "passed" | "failed",
  comment: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.testrailUrl || !cfg.testrailUser || !cfg.testrailApiKey) {
    return missing("TestRail", ["TESTRAIL_URL", "TESTRAIL_USER", "TESTRAIL_API_KEY"]);
  }
  const url = `${cfg.testrailUrl.replace(/\/$/, "")}/index.php?/api/v2/add_result/${caseId}`;
  return call(url, {
    method: "POST",
    headers: { Authorization: basicAuth(cfg.testrailUser, cfg.testrailApiKey) },
    body: { run_id: runId, status_id: status === "passed" ? 1 : 5, comment },
  });
}

// Jira — create a defect (post-run sync)
export async function jiraCreateDefect(
  projectKey: string,
  summary: string,
  description: string
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = getConfig();
  if (!cfg.jiraUrl || !cfg.jiraEmail || !cfg.jiraApiToken) {
    return missing("Jira", ["JIRA_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"]);
  }
  const url = `${cfg.jiraUrl.replace(/\/$/, "")}/rest/api/3/issue`;
  return call(url, {
    method: "POST",
    headers: {
      Authorization: basicAuth(cfg.jiraEmail, cfg.jiraApiToken),
      "Content-Type": "application/json",
    },
    body: {
      fields: {
        project: { key: projectKey },
        summary,
        description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: description }] }] },
        issuetype: { name: "Bug" },
      },
    },
  });
}
