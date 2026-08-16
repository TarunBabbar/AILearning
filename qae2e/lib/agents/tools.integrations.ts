// Integration tools.
//
// Connector-backed tools (Jira/Confluence/Figma/GitHub/Zephyr/TestRail/Pinecone)
// are MCP PLACEHOLDERS: the current workflow supports copy-pasted requirements
// only, so every external-connection handler returns a deterministic NOTE
// string without any network call. Tools keep the MCP shape
// ({name, description, inputSchema, handler}) so the web UI and the external
// MCP server both expose the same stable surface — wiring a real connector
// later only means replacing the handler body.
//
// Still real (no external credentials): cases_export, api_test_generate,
// image_extract, test_run_local (local Docker run).

import type { MCPTool, Coverage, Script } from "../types";
import { insertOne, updateOne, listAll } from "../store";
import { coverageToCsv, coverageToXlsx } from "../export";
import { extractTextFromImage } from "../vision";
import { runTests } from "../exec";

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Placeholder body for any tool that needs an external MCP connection. */
function placeholder(connector: string): MCPTool["handler"] {
  return async () =>
    ok(
      `NOTE: MCP connector "${connector}" is not connected yet. ` +
        `The current workflow supports copy-pasted requirements only. ` +
        `Skipping the external ${connector} call.`
    );
}

// ---------------------------------------------------------------------------
// connector_status — MCP connections are all placeholders for now
// ---------------------------------------------------------------------------
const connectorStatus: MCPTool = {
  name: "connector_status",
  description:
    "List external MCP connection status. All connectors are placeholders in the current copy-paste-only workflow.",
  inputSchema: { type: "object", properties: {} },
  handler: async () =>
    ok(
      "MCP connector status: all connectors are placeholders (Jira, Confluence, Figma, GitHub, Zephyr, TestRail, Pinecone). " +
        "The current workflow supports copy-pasted requirements only — external connections are coming soon."
    ),
};

// ---------------------------------------------------------------------------
// jira_fetch_issue / confluence_fetch_page / figma_fetch_file — placeholders
// ---------------------------------------------------------------------------
const jiraFetch: MCPTool = {
  name: "jira_fetch_issue",
  description: "Fetch a Jira issue (requirement) by its key (e.g. QA-123). Placeholder — MCP not connected.",
  inputSchema: { type: "object", properties: { issueKey: { type: "string", description: "Jira issue key, e.g. QA-123" } }, required: ["issueKey"] },
  handler: placeholder("Jira"),
};

const confluenceFetch: MCPTool = {
  name: "confluence_fetch_page",
  description: "Fetch a Confluence page (document) by its page ID. Placeholder — MCP not connected.",
  inputSchema: { type: "object", properties: { pageId: { type: "string", description: "Confluence page ID" } }, required: ["pageId"] },
  handler: placeholder("Confluence"),
};

const figmaFetch: MCPTool = {
  name: "figma_fetch_file",
  description: "Fetch a Figma file's frames (optionally a specific frame). Placeholder — MCP not connected.",
  inputSchema: {
    type: "object",
    properties: {
      fileKey: { type: "string", description: "Figma file key (from the file URL)" },
      frameName: { type: "string", description: "Optional specific frame/page name" },
    },
    required: ["fileKey"],
  },
  handler: placeholder("Figma"),
};

// ---------------------------------------------------------------------------
// cases_export — CSV or XLSX download from coverage (no external connection)
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
// zephyr_publish / testrail_publish — placeholders
// ---------------------------------------------------------------------------
const zephyrPublish: MCPTool = {
  name: "zephyr_publish",
  description: "Publish a coverage document's test cases to Zephyr Scale. Placeholder — MCP not connected.",
  inputSchema: {
    type: "object",
    properties: {
      coverageId: { type: "string" },
      projectKey: { type: "string", description: "Zephyr project key" },
    },
    required: ["coverageId"],
  },
  handler: placeholder("Zephyr"),
};

const testrailPublish: MCPTool = {
  name: "testrail_publish",
  description: "Publish a coverage document's test cases to TestRail. Placeholder — MCP not connected.",
  inputSchema: {
    type: "object",
    properties: {
      coverageId: { type: "string" },
      projectId: { type: "string", description: "TestRail project ID" },
      sectionId: { type: "number", description: "TestRail section ID" },
    },
    required: ["coverageId", "projectId", "sectionId"],
  },
  handler: placeholder("TestRail"),
};

// ---------------------------------------------------------------------------
// cases_index / cases_search — RAG placeholders
// ---------------------------------------------------------------------------
const casesIndex: MCPTool = {
  name: "cases_index",
  description: "Index existing test cases from Zephyr or TestRail into a vector store (RAG). Placeholder — MCP not connected.",
  inputSchema: {
    type: "object",
    properties: {
      source: { type: "string", enum: ["zephyr", "testrail"] },
      projectKey: { type: "string" },
      suiteId: { type: "string", description: "TestRail suite ID (optional)" },
    },
    required: ["source", "projectKey"],
  },
  handler: placeholder("RAG (Zephyr/TestRail index)"),
};

const casesSearch: MCPTool = {
  name: "cases_search",
  description: "Search indexed existing test cases (RAG) for similar cases. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Requirement text or case description to match against" },
      topK: { type: "number", description: "Max matches (default 5)" },
    },
    required: ["text"],
  },
  handler: async (args) =>
    ok(
      `NOTE: RAG / MCP connector not configured — skipping similar-case lookup for "${String(args.text).slice(0, 120)}". ` +
        `Proceeding to create test cases as per the requirements.`
    ),
};

// ---------------------------------------------------------------------------
// GitHub tools — placeholders
// ---------------------------------------------------------------------------
const githubRead: MCPTool = {
  name: "github_read_repo",
  description: "Read a file or directory listing from a GitHub repo. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      path: { type: "string", description: "Path to read; empty = repo root" },
    },
    required: ["owner", "repo"],
  },
  handler: placeholder("GitHub"),
};

const githubBranch: MCPTool = {
  name: "github_branch_create",
  description: "Create a new branch in a GitHub repo. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      branch: { type: "string", description: "New branch name" },
      base: { type: "string", description: "Base branch" },
    },
    required: ["owner", "repo", "branch"],
  },
  handler: placeholder("GitHub"),
};

const githubCommit: MCPTool = {
  name: "github_commit_file",
  description: "Commit a single file to a branch in a GitHub repo. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      branch: { type: "string" },
      path: { type: "string" },
      content: { type: "string" },
      message: { type: "string" },
    },
    required: ["owner", "repo", "branch", "path", "content", "message"],
  },
  handler: placeholder("GitHub"),
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
// test_run_local — local Docker test run (self-hosted only; no external creds)
// ---------------------------------------------------------------------------
const testRunLocal: MCPTool = {
  name: "test_run_local",
  description:
    "Run the generated automation locally in Docker (user must have Docker running). Clones the repo if repoUrl provided, checks the image + node/npm + Playwright Chromium preflight first, parses Playwright JSON results and records results on the cycle.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      cycleId: { type: "string" },
      repoDir: { type: "string", description: "Local dir to mount into the container (default: cwd)" },
      repoUrl: { type: "string", description: "Git URL to clone into a temp dir first (optional)" },
      command: { type: "string", description: "Command inside the container (default: TEST_COMMAND env)" },
      branch: { type: "string", description: "Branch to clone when repoUrl is set (default: main)" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const res = await runTests({
      requirementId: String(args.requirementId),
      cycleId: args.cycleId ? String(args.cycleId) : undefined,
      repoDir: args.repoDir ? String(args.repoDir) : undefined,
      repoUrl: args.repoUrl ? String(args.repoUrl) : undefined,
      branch: args.branch ? String(args.branch) : "main",
      command: args.command ? String(args.command) : undefined,
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
// jira_sync_defect / testrail_sync_result — placeholders
// ---------------------------------------------------------------------------
const jiraSyncDefect: MCPTool = {
  name: "jira_sync_defect",
  description: "Create a Jira defect (Bug) for a failed test run. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      description: { type: "string" },
      projectKey: { type: "string" },
    },
    required: ["summary", "description"],
  },
  handler: placeholder("Jira"),
};

const testrailSyncResult: MCPTool = {
  name: "testrail_sync_result",
  description: "Post a test result to a TestRail run. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      caseId: { type: "number" },
      status: { type: "string", enum: ["passed", "failed"] },
      comment: { type: "string" },
      runId: { type: "number" },
    },
    required: ["caseId", "status"],
  },
  handler: placeholder("TestRail"),
};

// ---------------------------------------------------------------------------
// github_dispatch_workflow / pr_changed_files — placeholders
// ---------------------------------------------------------------------------
const githubDispatch: MCPTool = {
  name: "github_dispatch_workflow",
  description: "Trigger a GitHub Actions workflow (workflow_dispatch). Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      workflowFile: { type: "string" },
      branch: { type: "string" },
      inputs: { type: "object" },
    },
    required: ["owner", "repo", "workflowFile", "branch"],
  },
  handler: placeholder("GitHub"),
};

const prChangedFiles: MCPTool = {
  name: "pr_changed_files",
  description: "List files changed between two refs in a GitHub repo. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      base: { type: "string" },
      head: { type: "string" },
      owner: { type: "string" },
      repo: { type: "string" },
    },
    required: ["base", "head"],
  },
  handler: placeholder("GitHub"),
};

// ---------------------------------------------------------------------------
// api_test_generate — generate API/contract tests from an OpenAPI spec
// ---------------------------------------------------------------------------
const apiTestGenerate: MCPTool = {
  name: "api_test_generate",
  description:
    "Generate Playwright API contract tests (tests/api) from an OpenAPI 3.x spec (JSON or YAML string or URL) and merge them into the current requirement's automation script.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      spec: { type: "string", description: "OpenAPI spec: JSON/YAML text or a URL ending in .json/.yaml/.yml" },
      baseUrl: { type: "string", description: "Override the API base URL (defaults to the spec's servers[0])" },
    },
    required: ["requirementId", "spec"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId || "");
    const spec = String(args.spec || "");
    if (!requirementId || !spec) return ok("ERROR: requirementId and spec are required.");
    try {
      const { parseOpenApi, buildApiSpecFiles, mergeApiSpecs, addApiTestScript } = await import("../exec/api-scripts");
      const { parse } = await import("yaml");
      const trimmed = spec.trim();
      let doc: Record<string, unknown> | null = null;
      if (/^https?:\/\//i.test(trimmed)) {
        const res = await fetch(trimmed);
        if (!res.ok) return ok(`ERROR: could not fetch spec (HTTP ${res.status}).`);
        const text = await res.text();
        doc = trimmed.includes("yaml") || trimmed.includes(".yml") || !text.trim().startsWith("{") ? (parse(text) as Record<string, unknown>) : (JSON.parse(text) as Record<string, unknown>);
      } else if (trimmed.startsWith("{")) {
        doc = JSON.parse(trimmed) as Record<string, unknown>;
      } else {
        doc = parse(trimmed) as Record<string, unknown>;
      }
      if (!doc) return ok("ERROR: could not parse the OpenAPI spec.");
      const index = parseOpenApi(doc, String(args.baseUrl || ""));
      const apiFiles = buildApiSpecFiles(index);
      const script = (await listAll<Script>("scripts")).filter((s) => s.requirementId === requirementId).pop();
      if (!script) return ok(`ERROR: no automation script found for requirement ${requirementId} — generate the framework first.`);
      const merged = mergeApiSpecs(script, apiFiles);
      const pkgIdx = merged.findIndex((f) => f.path === "package.json");
      if (pkgIdx >= 0) merged[pkgIdx] = { ...merged[pkgIdx], code: addApiTestScript(merged[pkgIdx].code) };
      await updateOne("scripts", script.id, { ...script, files: merged });
      return ok(
        `Generated ${apiFiles.length} API contract spec(s) covering ${index.operations.length} operations from "${index.title || "OpenAPI"}" ` +
        `(base ${index.baseUrl}) and merged into script ${script.id}. Run: npx playwright test tests/api --project=chromium`
      );
    } catch (err) {
      return ok(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

// ---------------------------------------------------------------------------
// github_create_pull_request / github_create_comment — placeholders
// ---------------------------------------------------------------------------
const githubCreatePr: MCPTool = {
  name: "github_create_pull_request",
  description: "Open a pull request in the configured GitHub repo. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      head: { type: "string" },
      base: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      owner: { type: "string" },
      repo: { type: "string" },
    },
    required: ["head", "base", "title"],
  },
  handler: placeholder("GitHub"),
};

const githubComment: MCPTool = {
  name: "github_create_comment",
  description: "Post a comment on a GitHub PR. Placeholder — MCP not connected; skipped.",
  inputSchema: {
    type: "object",
    properties: {
      issueNumber: { type: "number" },
      body: { type: "string" },
      owner: { type: "string" },
      repo: { type: "string" },
    },
    required: ["issueNumber", "body"],
  },
  handler: placeholder("GitHub"),
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
  prChangedFiles,
  githubCreatePr,
  githubComment,
  apiTestGenerate,
  imageExtract,
  testRunLocal,
  jiraSyncDefect,
  testrailSyncResult,
];
