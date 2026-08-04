// Integration tools — real connectors, export, RAG, GitHub, local run.
// These share the same MCP shape ({name, description, inputSchema, handler})
// so the web UI and the external MCP server both expose them.

import type { MCPTool, Coverage, ExternalTestCase } from "../types";
import { getConfig } from "../config";
import {
  jiraFetchIssue,
  confluenceFetchPage,
  figmaFetchFile,
  githubReadRepo,
  githubCreateBranch,
  githubCommitFile,
  githubDispatchWorkflow,
  zephyrListTestCases,
  zephyrCreateTestCase,
  testrailListTestCases,
  testrailAddTestCase,
} from "../connectors/client";
import { connectorStatuses } from "../connectors";
import { indexExternalCases, findSimilarCases } from "../rag";
import { coverageToCsv, coverageToXlsx } from "../export";
import { insertOne, listAll } from "../store";
import { extractTextFromImage } from "../vision";
import { runTests } from "../exec";
import { jiraCreateDefect, testrailAddResult } from "../connectors/client";

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// Missing credentials are a configuration gap, not a runtime failure — surface
// them as a NOTE (amber in the UI) and let the agent decide to skip, instead of
// stopping the pipeline as if the connector call itself failed.
function isMissingCreds(res: { data?: unknown }): boolean {
  const error = (res.data as { error?: string } | undefined)?.error || "";
  return /^Missing .+ credentials:/.test(error);
}

// ---------------------------------------------------------------------------
// connector_status — what's configured / what's missing
// ---------------------------------------------------------------------------
const connectorStatus: MCPTool = {
  name: "connector_status",
  description:
    "List connector configuration status: which external tools (Jira, Confluence, Figma, GitHub, Zephyr, TestRail) are configured and which credentials are missing.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    const statuses = connectorStatuses();
    const text = statuses
      .map((s) => `- ${s.id}: ${s.configured ? "configured" : `missing ${s.missing.join(", ") || "credentials"}`}`)
      .join("\n");
    return ok(`Connector status:\n${text}`);
  },
};

// ---------------------------------------------------------------------------
// jira_fetch_issue
// ---------------------------------------------------------------------------
const jiraFetch: MCPTool = {
  name: "jira_fetch_issue",
  description: "Fetch a Jira issue (requirement) by its key (e.g. QA-123). Returns summary + description.",
  inputSchema: { type: "object", properties: { issueKey: { type: "string", description: "Jira issue key, e.g. QA-123" } }, required: ["issueKey"] },
  handler: async (args) => {
    const res = await jiraFetchIssue(String(args.issueKey));
    if (!res.ok) {
      const err = (res.data as { error?: string })?.error || `Jira returned ${res.status}`;
      // Missing credentials → warning (amber), not a pipeline-stopping error.
      return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping Jira fetch — proceed with manual or other source.` : `ERROR: ${err}`);
    }
    const d = res.data as { key?: string; title?: string; issueType?: string; content?: string };
    return ok(`Jira issue ${d.key} (${d.issueType}):\nTitle: ${d.title}\n\n${(d.content || "").slice(0, 4000)}`);
  },
};

// ---------------------------------------------------------------------------
// confluence_fetch_page
// ---------------------------------------------------------------------------
const confluenceFetch: MCPTool = {
  name: "confluence_fetch_page",
  description: "Fetch a Confluence page (document) by its page ID. Returns title + text content.",
  inputSchema: { type: "object", properties: { pageId: { type: "string", description: "Confluence page ID" } }, required: ["pageId"] },
  handler: async (args) => {
    const res = await confluenceFetchPage(String(args.pageId));
    if (!res.ok) {
      const err = (res.data as { error?: string })?.error || `Confluence returned ${res.status}`;
      return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping Confluence fetch — proceed with manual or other source.` : `ERROR: ${err}`);
    }
    const d = res.data as { id?: string; title?: string; content?: string };
    return ok(`Confluence page ${d.id}:\nTitle: ${d.title}\n\n${(d.content || "").slice(0, 4000)}`);
  },
};

// ---------------------------------------------------------------------------
// figma_fetch_file
// ---------------------------------------------------------------------------
const figmaFetch: MCPTool = {
  name: "figma_fetch_file",
  description: "Fetch a Figma file's frames (optionally a specific frame). Used to source requirement context from design.",
  inputSchema: {
    type: "object",
    properties: {
      fileKey: { type: "string", description: "Figma file key (from the file URL)" },
      frameName: { type: "string", description: "Optional specific frame/page name" },
    },
    required: ["fileKey"],
  },
  handler: async (args) => {
    const res = await figmaFetchFile(String(args.fileKey), args.frameName ? String(args.frameName) : undefined);
    if (!res.ok) {
      const err = (res.data as { error?: string })?.error || `Figma returned ${res.status}`;
      return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping Figma fetch — proceed with manual or other source.` : `ERROR: ${err}`);
    }
    const d = res.data as { name?: string; frames?: string[]; content?: string };
    return ok(d.content || `Figma file: ${d.name}`);
  },
};

// ---------------------------------------------------------------------------
// cases_export — CSV or XLSX download from coverage
// ---------------------------------------------------------------------------
const casesExport: MCPTool = {
  name: "cases_export",
  description: "Export a coverage document's test cases to CSV or XLSX. Returns the file name to download.",
  inputSchema: {
    type: "object",
    properties: {
      coverageId: { type: "string" },
      format: { type: "string", enum: ["csv", "xlsx"] },
    },
    required: ["coverageId", "format"],
  },
  handler: async (args) => {
    const covs = await listAll<Coverage>("coverages");
    const cov = covs.find((c) => c.id === args.coverageId);
    if (!cov) return ok(`ERROR: coverage ${args.coverageId} not found`);
    const format = String(args.format || "csv") as "csv" | "xlsx";
    const data = format === "csv" ? coverageToCsv(cov) : (coverageToXlsx(cov) as unknown as string);
    const name = (cov.module || cov.product || "coverage").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    await insertOne("exports", {
      id: crypto.randomUUID(),
      requirementId: cov.requirementId,
      format,
      fileName: `${name}-test-cases.${format}`,
      data,
      createdAt: new Date().toISOString(),
    });
    return ok(`Exported ${cov.testCases.length} cases to ${format.toUpperCase()} → ${name}-test-cases.${format} (saved, downloadable)`);
  },
};

// ---------------------------------------------------------------------------
// zephyr_publish / testrail_publish
// ---------------------------------------------------------------------------
const zephyrPublish: MCPTool = {
  name: "zephyr_publish",
  description: "Publish a coverage document's test cases to Zephyr Scale.",
  inputSchema: {
    type: "object",
    properties: {
      coverageId: { type: "string" },
      projectKey: { type: "string", description: "Zephyr project key (defaults to env)" },
    },
    required: ["coverageId"],
  },
  handler: async (args) => {
    const covs = await listAll<Coverage>("coverages");
    const cov = covs.find((c) => c.id === args.coverageId);
    if (!cov) return ok(`ERROR: coverage ${args.coverageId} not found`);
    const projectKey = String(args.projectKey || getConfig().zephyrProjectKey || "");
    if (!projectKey) return ok("NOTE: no Zephyr project key provided and none in env (ZEPHYR_PROJECT_KEY) — skipping publish.");
    const created: string[] = [];
    for (const tc of cov.testCases) {
      const res = await zephyrCreateTestCase(projectKey, tc.title, tc.description || "", tc.steps);
      created.push(res.ok ? `created ${tc.title}` : `failed ${tc.title}: ${JSON.stringify(res.data).slice(0, 120)}`);
    }
    return ok(`Zephyr publish (${projectKey}):\n${created.join("\n")}`);
  },
};

const testrailPublish: MCPTool = {
  name: "testrail_publish",
  description: "Publish a coverage document's test cases to TestRail.",
  inputSchema: {
    type: "object",
    properties: {
      coverageId: { type: "string" },
      projectId: { type: "string", description: "TestRail project ID" },
      sectionId: { type: "number", description: "TestRail section ID to add cases to" },
    },
    required: ["coverageId", "projectId", "sectionId"],
  },
  handler: async (args) => {
    const covs = await listAll<Coverage>("coverages");
    const cov = covs.find((c) => c.id === args.coverageId);
    if (!cov) return ok(`ERROR: coverage ${args.coverageId} not found`);
    const created: string[] = [];
    for (const tc of cov.testCases) {
      const steps = tc.steps.map((s) => `${s.action}\nExpected: ${s.expected}`).join("\n\n");
      const res = await testrailAddTestCase(String(args.projectId), Number(args.sectionId), tc.title, steps);
      created.push(res.ok ? `created ${tc.title}` : `failed ${tc.title}: ${JSON.stringify(res.data).slice(0, 120)}`);
    }
    return ok(`TestRail publish (project ${args.projectId}):\n${created.join("\n")}`);
  },
};

// ---------------------------------------------------------------------------
// cases_index — pull existing cases from Zephyr/TestRail → embed → Pinecone
// ---------------------------------------------------------------------------
const casesIndex: MCPTool = {
  name: "cases_index",
  description:
    "Pull existing test cases from Zephyr or TestRail and index them into the Pinecone vector store (RAG) for grounded test generation.",
  inputSchema: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["zephyr", "testrail"] },
      projectKey: { type: "string", description: "Zephyr project key or TestRail project ID" },
      suiteId: { type: "string", description: "TestRail suite ID (optional)" },
    },
    required: ["source", "projectKey"],
  },
  handler: async (args) => {
    const source = String(args.source) as "zephyr" | "testrail";
    let cases: ExternalTestCase[] = [];
    if (source === "zephyr") {
      const res = await zephyrListTestCases(String(args.projectKey));
      if (!res.ok) {
        const err = (res.data as { error?: string })?.error || "Zephyr list failed";
        return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping existing-case index.` : `ERROR: ${err}`);
      }
      cases = res.data as ExternalTestCase[];
    } else {
      const res = await testrailListTestCases(String(args.projectKey), args.suiteId ? String(args.suiteId) : undefined);
      if (!res.ok) {
        const err = (res.data as { error?: string })?.error || "TestRail list failed";
        return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping existing-case index.` : `ERROR: ${err}`);
      }
      cases = res.data as ExternalTestCase[];
    }
    if (!cases.length) return ok(`No existing cases found in ${source} — nothing to index.`);
    const idx = await indexExternalCases(cases, source);
    return ok(idx.ok ? `Indexed ${idx.count} existing ${source} cases into Pinecone.` : `ERROR: ${idx.message}`);
  },
};

// ---------------------------------------------------------------------------
// cases_search — find similar existing cases (RAG)
// ---------------------------------------------------------------------------
const casesSearch: MCPTool = {
  name: "cases_search",
  description:
    "Search the indexed existing test cases (Pinecone RAG) for cases similar to a given requirement/description. Use before generating new cases to avoid duplicates.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Requirement text or case description to match against" },
      topK: { type: "number", description: "Max matches (default 5)" },
    },
    required: ["text"],
  },
  handler: async (args) => {
    const res = await findSimilarCases(String(args.text), Number(args.topK || 5));
    if (!res.ok) {
      // Pinecone unavailable (no key/index or connection issue) — not an error,
      // just a skip. Test generation proceeds as per requirements.
      return ok(
        `NOTE: ${res.message || "existing-case comparison unavailable"}\n` +
          `Proceeding to create test cases as per the requirements without comparing against existing cases.`
      );
    }
    if (!res.matches.length) return ok("No similar existing cases found. Creating test cases as per the requirements.");
    const lines = res.matches.map((m) => `- [${m.score.toFixed(3)}] ${m.title}\n  ${m.text.slice(0, 200)}`);
    return ok(`Similar existing cases (top ${res.matches.length}):\n${lines.join("\n")}`);
  },
};

// ---------------------------------------------------------------------------
// github_read_repo / github_branch_create / github_commit_file
// ---------------------------------------------------------------------------
const githubRead: MCPTool = {
  name: "github_read_repo",
  description: "Read a file or directory listing from a GitHub repo (the existing automation framework).",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      path: { type: "string", description: "Path to read; empty = repo root" },
    },
    required: ["owner", "repo"],
  },
  handler: async (args) => {
    const owner = String(args.owner || getConfig().githubOwner);
    const repo = String(args.repo || getConfig().githubRepo);
    if (!owner || !repo) {
      // No repo configured — not an error, just skip framework matching.
      return ok(
        `NOTE: No GitHub repo configured (set GITHUB_OWNER/GITHUB_REPO or provide owner/repo).\n` +
          `Skipping existing automation framework check — proceeding to generate standalone Playwright (TypeScript) scripts as per the requirements.`
      );
    }
    const res = await githubReadRepo(owner, repo, args.path ? String(args.path) : "");
    if (!res.ok) {
      // Repo missing / access denied — skip framework matching, still generate.
      return ok(
        `NOTE: Could not read the existing automation repo (${owner}/${repo}): ${(res.data as { error?: string })?.error || `GitHub returned ${res.status}`}.\n` +
          `Skipping existing automation framework check — proceeding to generate standalone Playwright (TypeScript) scripts as per the requirements.`
      );
    }
    const d = res.data as Array<{ name?: string; type?: string; path?: string }> | { name?: string; content?: string };
    if (Array.isArray(d)) return ok(d.map((x) => `${x.type === "dir" ? "📁" : "📄"} ${x.path || x.name}`).join("\n"));
    const decoded = d.content ? Buffer.from(d.content, "base64").toString("utf-8") : "";
    return ok(`File ${d.name}:\n\n${decoded.slice(0, 4000)}`);
  },
};

const githubBranch: MCPTool = {
  name: "github_branch_create",
  description: "Create a new branch in a GitHub repo from a base branch.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      branch: { type: "string", description: "New branch name, e.g. qae2e/tc-123" },
      base: { type: "string", description: "Base branch (default main)" },
    },
    required: ["owner", "repo", "branch"],
  },
  handler: async (args) => {
    const owner = String(args.owner || getConfig().githubOwner);
    const repo = String(args.repo || getConfig().githubRepo);
    const res = await githubCreateBranch(owner, repo, String(args.branch), String(args.base || getConfig().githubBranch));
    if (res.ok) return ok(`Branch ${args.branch} created in ${owner}/${repo}.`);
    const err = (res.data as { error?: string })?.error || `GitHub returned ${res.status}`;
    return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping branch creation.` : `ERROR: ${err}`);
  },
};

const githubCommit: MCPTool = {
  name: "github_commit_file",
  description: "Commit a single file to a branch in a GitHub repo (create or update).",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      branch: { type: "string" },
      path: { type: "string", description: "Repo-relative path, e.g. tests/login.spec.ts" },
      content: { type: "string" },
      message: { type: "string" },
    },
    required: ["owner", "repo", "branch", "path", "content", "message"],
  },
  handler: async (args) => {
    const owner = String(args.owner || getConfig().githubOwner);
    const repo = String(args.repo || getConfig().githubRepo);
    const res = await githubCommitFile(owner, repo, String(args.branch), String(args.path), String(args.content), String(args.message));
    if (res.ok) return ok(`Committed ${args.path} to ${owner}/${repo}@${args.branch}.`);
    const err = (res.data as { error?: string })?.error || `GitHub returned ${res.status}`;
    return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping commit.` : `ERROR: ${err}`);
  },
};

// ---------------------------------------------------------------------------
// image_extract — extract requirement text from an uploaded image (vision/OCR)
// ---------------------------------------------------------------------------
const imageExtract: MCPTool = {
  name: "image_extract",
  description:
    "Extract requirement text from an uploaded image (screenshot of a PRD or a Figma frame). Uses a free OpenRouter vision model.",
  inputSchema: {
    type: "object",
    properties: {
      uploadId: { type: "string", description: "Uploaded image id (from /api/upload)" },
    },
    required: ["uploadId"],
  },
  handler: async (args) => {
    const uploads = await listAll<{ id: string; base64: string; mime: string }>("uploads");
    const upload = uploads.find((u) => u.id === args.uploadId);
    if (!upload) return ok(`ERROR: upload ${args.uploadId} not found — upload the image in the workspace first.`);
    try {
      const text = await extractTextFromImage(upload.base64, upload.mime);
      return ok(text ? `Extracted text:\n${text}` : "No text found in the image.");
    } catch (err) {
      return ok(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

// ---------------------------------------------------------------------------
// test_run_local — real local Docker test run
// ---------------------------------------------------------------------------
const testRunLocal: MCPTool = {
  name: "test_run_local",
  description:
    "Run the generated automation locally in Docker (user must have Docker running). Clones the repo if repoUrl provided, checks the image + node/npm + Playwright Chromium preflight first, parses Playwright JSON results, records results on the cycle, and syncs to Jira/TestRail if configured.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      cycleId: { type: "string" },
      repoDir: { type: "string", description: "Local dir to mount into the container (default: cwd)" },
      repoUrl: { type: "string", description: "Git URL to clone into a temp dir first (optional)" },
      command: { type: "string", description: "Command inside the container (default: TEST_COMMAND env)" },
      jiraProjectKey: { type: "string", description: "Create a Jira defect if failures (defaults to JIRA_PROJECT_KEY env)" },
      testrailRunId: { type: "number", description: "Post results to this TestRail run (defaults to TESTRAIL_RUN_ID env)" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const cfg = getConfig();
    const res = await runTests({
      requirementId: String(args.requirementId),
      cycleId: args.cycleId ? String(args.cycleId) : undefined,
      repoDir: args.repoDir ? String(args.repoDir) : undefined,
      repoUrl: args.repoUrl ? String(args.repoUrl) : undefined,
      command: args.command ? String(args.command) : undefined,
      jiraProjectKey: args.jiraProjectKey ? String(args.jiraProjectKey) : cfg.jiraProjectKey,
      testrailRunId: args.testrailRunId ? Number(args.testrailRunId) : cfg.testrailRunId ? Number(cfg.testrailRunId) : undefined,
      testrailProjectId: cfg.testrailUrl ? "0" : undefined,
    });
    const s = res.summary;
    return ok(
      res.ok
        ? `Local Docker run completed.\nPassed: ${s.passed}, Failed: ${s.failed}, Skipped: ${s.skipped}, Total: ${s.total}`
        : `Run failed (exit ${res.exitCode}).\n${res.stderr.slice(0, 1000)}`
    );
  },
};

// ---------------------------------------------------------------------------
// jira_sync_defect — raise a Jira defect manually (post-run)
// ---------------------------------------------------------------------------
const jiraSyncDefect: MCPTool = {
  name: "jira_sync_defect",
  description: "Create a Jira defect (Bug) for a failed test run. Uses JIRA_PROJECT_KEY env or projectKey arg.",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      description: { type: "string" },
      projectKey: { type: "string", description: "Jira project key (defaults to JIRA_PROJECT_KEY)" },
    },
    required: ["summary", "description"],
  },
  handler: async (args) => {
    const cfg = getConfig();
    const projectKey = String(args.projectKey || cfg.jiraProjectKey || "");
    if (!projectKey) return ok("NOTE: no Jira project key configured (set JIRA_PROJECT_KEY or pass projectKey) — skipping defect sync.");
    const res = await jiraCreateDefect(projectKey, String(args.summary), String(args.description));
    return res.ok
      ? ok(`Defect created in Jira project ${projectKey}.`)
      : ok(`ERROR: ${(res.data as { error?: string })?.error || JSON.stringify(res.data).slice(0, 200)}`);
  },
};

// ---------------------------------------------------------------------------
// testrail_sync_result — post a result to a TestRail run
// ---------------------------------------------------------------------------
const testrailSyncResult: MCPTool = {
  name: "testrail_sync_result",
  description: "Post a test result to a TestRail run. Uses TESTRAIL_RUN_ID env or runId arg.",
  inputSchema: {
    type: "object",
    properties: {
      caseId: { type: "number" },
      status: { type: "string", enum: ["passed", "failed"] },
      comment: { type: "string" },
      runId: { type: "number", description: "TestRail run id (defaults to TESTRAIL_RUN_ID)" },
    },
    required: ["caseId", "status"],
  },
  handler: async (args) => {
    const cfg = getConfig();
    const runId = args.runId ? Number(args.runId) : cfg.testrailRunId ? Number(cfg.testrailRunId) : 0;
    if (!runId) return ok("NOTE: no TestRail run id configured (set TESTRAIL_RUN_ID or pass runId) — skipping result sync.");
    const res = await testrailAddResult(runId, Number(args.caseId), String(args.status) as "passed" | "failed", String(args.comment || "QAE2E result"));
    return res.ok ? ok(`Result posted to TestRail run ${runId}.`) : ok(`ERROR: ${JSON.stringify(res.data).slice(0, 200)}`);
  },
};

// ---------------------------------------------------------------------------
// github_dispatch_workflow — trigger CI via workflow_dispatch
// ---------------------------------------------------------------------------
const githubDispatch: MCPTool = {
  name: "github_dispatch_workflow",
  description: "Trigger a GitHub Actions workflow (workflow_dispatch) on a branch — the DevOps execution leg.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      workflowFile: { type: "string", description: "Workflow file path, e.g. .github/workflows/e2e.yml" },
      branch: { type: "string" },
      inputs: { type: "object", description: "workflow_dispatch inputs" },
    },
    required: ["owner", "repo", "workflowFile", "branch"],
  },
  handler: async (args) => {
    const owner = String(args.owner || getConfig().githubOwner);
    const repo = String(args.repo || getConfig().githubRepo);
    const res = await githubDispatchWorkflow(owner, repo, String(args.workflowFile), String(args.branch), (args.inputs as Record<string, string>) || {});
    if (res.ok) return ok(`Workflow ${args.workflowFile} dispatched on ${owner}/${repo}@${args.branch}.`);
    const err = (res.data as { error?: string })?.error || `GitHub returned ${res.status}`;
    return ok(isMissingCreds(res) ? `NOTE: ${err}\nSkipping workflow dispatch.` : `ERROR: ${err}`);
  },
};

export const integrationTools: MCPTool[] = [
  connectorStatus,
  jiraFetch,
  confluenceFetch,
  figmaFetch,
  casesExport,
  zephyrPublish,
  testrailPublish,
  casesIndex,
  casesSearch,
  githubRead,
  githubBranch,
  githubCommit,
  githubDispatch,
  imageExtract,
  testRunLocal,
  jiraSyncDefect,
  testrailSyncResult,
];
