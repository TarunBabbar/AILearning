// Tool handlers shared by the web agent runner and the real MCP server.
// Each tool is MCP-shaped: { name, description, inputSchema, handler }.

import { insertOne, updateOne, getOne, listAll } from "../store";
import { integrationTools } from "./tools.integrations";
import { normalizeScriptFiles, isRunnableAutomation } from "../exec/script-quality";
import type {
  MCPTool,
  Requirement,
  Analysis,
  Coverage,
  Script,
  Cycle,
  Defect,
  ReleaseReport,
  ExecutionStatus,
} from "../types";

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ---------------------------------------------------------------------------
// requirement_save — capture a requirement from any source
// ---------------------------------------------------------------------------
const requirementSave: MCPTool = {
  name: "requirement_save",
  description:
    "Capture a requirement from Jira, Confluence, or manual input. Returns the stored requirement id (traceability root).",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      source: { type: "string", enum: ["manual", "jira", "confluence", "other"] },
      sourceKey: { type: "string", description: "e.g. Jira ticket key QA-123" },
      content: { type: "string", description: "Full requirement text" },
    },
    required: ["title", "content"],
  },
  handler: async (args) => {
    const req: Requirement = {
      id: crypto.randomUUID(),
      title: String(args.title || "Untitled requirement"),
      source: String(args.source || "manual") as Requirement["source"],
      sourceKey: args.sourceKey ? String(args.sourceKey) : undefined,
      content: String(args.content),
      createdAt: new Date().toISOString(),
    };
    insertOne("requirements", req);
    return ok(`Requirement saved. id=${req.id} title="${req.title}" source=${req.source}${req.sourceKey ? ` key=${req.sourceKey}` : ""}`);
  },
};

// ---------------------------------------------------------------------------
// requirement_analyze — Requirement Intelligence Agent's core tool
// ---------------------------------------------------------------------------
const requirementAnalyze: MCPTool = {
  name: "requirement_analyze",
  description:
    "Analyze a stored requirement and produce requirement intelligence: executive summary, business rules, acceptance criteria, risks, edge cases, scenarios, and test data. Called by the Requirement Intelligence Agent.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const req = getOne<Requirement>("requirements", String(args.requirementId));
    if (!req) return ok(`ERROR: requirement ${args.requirementId} not found`);
    return ok(
      `Analysis requested for requirement ${req.id} ("${req.title}"). ` +
        `Content: ${req.content.slice(0, 4000)}`
    );
  },
};

// ---------------------------------------------------------------------------
// coverage_save — persist generated/edited test cases
// ---------------------------------------------------------------------------
const coverageSave: MCPTool = {
  name: "coverage_save",
  description:
    "Save a coverage document (list of manual test cases with steps, priority, type, scenario type) for a requirement. Persists editable coverage.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      product: { type: "string" },
      module: { type: "string" },
      testCases: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            testType: { type: "string" },
            scenarioType: { type: "string", enum: ["positive", "negative", "boundary"] },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  expected: { type: "string" },
                },
                required: ["action", "expected"],
              },
            },
          },
          required: ["title", "priority", "testType", "steps"],
        },
      },
    },
    required: ["requirementId", "testCases"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId);
    const cov: Coverage = {
      id: crypto.randomUUID(),
      requirementId,
      product: args.product ? String(args.product) : undefined,
      module: args.module ? String(args.module) : undefined,
      testCases: args.testCases as Coverage["testCases"],
      createdAt: new Date().toISOString(),
    };
    insertOne("coverages", cov);
    return ok(`Coverage saved. id=${cov.id} with ${cov.testCases.length} test cases.`);
  },
};

// ---------------------------------------------------------------------------
// coverage_get — load saved coverage (test cases) for a requirement
// ---------------------------------------------------------------------------
const coverageGet: MCPTool = {
  name: "coverage_get",
  description:
    "Load the latest saved coverage (manual test cases) for a requirementId. Returns coverageId and the full testCases list so the Automation Script Agent can generate scripts from real cases.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId);
    const cov = listAll<Coverage>("coverages")
      .filter((c) => c.requirementId === requirementId)
      .pop();
    if (!cov) {
      return ok(
        `ERROR: no coverage found for requirement ${requirementId}. The Manual Test Case Agent must call coverage_save first.`
      );
    }
    return ok(
      JSON.stringify({
        coverageId: cov.id,
        requirementId: cov.requirementId,
        product: cov.product,
        module: cov.module,
        testCaseCount: cov.testCases.length,
        testCases: cov.testCases,
      })
    );
  },
};

// ---------------------------------------------------------------------------
// automation_framework_generate — server-side POM builder (avoids LLM truncation)
// ---------------------------------------------------------------------------
const automationFrameworkGenerate: MCPTool = {
  name: "automation_framework_generate",
  description:
    "PREFERRED way to create Playwright+TypeScript POM automation. Builds a complete runnable framework SERVER-SIDE from saved coverage (pages, fixtures, data, specs, config). Use this instead of script_save with huge file payloads — free models truncate script_save args.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      coverageId: { type: "string", description: "Optional; defaults to latest coverage for requirementId" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId);
    let coverage = args.coverageId
      ? getOne<Coverage>("coverages", String(args.coverageId))
      : undefined;
    if (!coverage) {
      coverage = listAll<Coverage>("coverages")
        .filter((c) => c.requirementId === requirementId)
        .pop();
    }
    if (!coverage?.testCases?.length) {
      return ok(
        `ERROR: no coverage with test cases for requirement ${requirementId}. Call coverage_get first / ensure MT saved coverage.`
      );
    }
    const { saveFallbackScripts } = await import("../exec/fallback-scripts");
    const script = saveFallbackScripts(requirementId, coverage);
    return ok(
      `Script saved. id=${script.id} framework=${script.framework} with ${script.files.length} file(s): ${script.files
        .map((f) => f.path)
        .join(", ")}. Generated server-side (POM). Run: npx playwright test --project=chromium`
    );
  },
};

// ---------------------------------------------------------------------------
// script_save — persist generated automation scripts
// ---------------------------------------------------------------------------
const scriptSave: MCPTool = {
  name: "script_save",
  description:
    "OPTIONAL low-level save of Playwright files. Prefer automation_framework_generate. If you use script_save, every file must include FULL source (no truncated '{' bodies) and include tests/**/*.spec.ts.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      coverageId: { type: "string", description: "Optional; defaults to latest coverage for requirementId" },
      framework: { type: "string", enum: ["playwright"] },
      language: { type: "string", enum: ["typescript"] },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            code: { type: "string" },
          },
          required: ["path", "code"],
        },
      },
    },
    required: ["requirementId", "framework", "files"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId);
    const files = normalizeScriptFiles(args.files);
    if (!files.length) {
      return ok("ERROR: files[] is empty. Prefer automation_framework_generate, or send full POM under tests/.");
    }
    const quality = isRunnableAutomation(files);
    if (!quality.ok) {
      return ok(
        `ERROR: script_save rejected — ${quality.reason}. ` +
          `You sent ${files.length} file(s): ${files.map((f) => f.path).join(", ") || "(none)"}. ` +
          `REQUIRED: package.json, tsconfig.json, playwright.config.ts, tests/pages/base.page.ts, feature *.page.ts, tests/fixtures/test.fixture.ts, tests/utils/test-data.ts, and tests/e2e/**/*.spec.ts. Prefer automation_framework_generate instead.`
      );
    }
    let coverageId = args.coverageId ? String(args.coverageId) : "";
    if (!coverageId) {
      const cov = listAll<Coverage>("coverages")
        .filter((c) => c.requirementId === requirementId)
        .pop();
      coverageId = cov?.id || "";
    }
    if (!coverageId) {
      return ok(
        `ERROR: no coverageId and no saved coverage for requirement ${requirementId}. Call coverage_get / coverage_save first.`
      );
    }
    const script: Script = {
      id: crypto.randomUUID(),
      requirementId,
      coverageId,
      framework: String(args.framework || "playwright") as Script["framework"],
      language: String(args.language || "typescript"),
      files,
      createdAt: new Date().toISOString(),
    };
    insertOne("scripts", script);
    const note = !quality.hasPage
      ? " NOTE: no src/pages/*Page.ts detected — prefer POM pages next time."
      : "";
    return ok(
      `Script saved. id=${script.id} framework=${script.framework} with ${script.files.length} file(s): ${files.map((f) => f.path).join(", ")}.${note}`
    );
  },
};

// ---------------------------------------------------------------------------
// cycle_create / execution_record — Execution & Defect Agent tools
// ---------------------------------------------------------------------------
const cycleCreate: MCPTool = {
  name: "cycle_create",
  description:
    "Create a test cycle for a requirement. Optionally attach pre-recorded executions. Returns cycle id for evidence and defect linkage.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      name: { type: "string" },
      executions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            caseId: { type: "string" },
            caseTitle: { type: "string" },
            status: { type: "string", enum: ["passed", "failed", "blocked", "skipped"] },
            evidence: { type: "string" },
            executedBy: { type: "string" },
          },
          required: ["caseTitle", "status"],
        },
      },
    },
    required: ["requirementId", "name"],
  },
  handler: async (args) => {
    const cycle: Cycle = {
      id: crypto.randomUUID(),
      requirementId: String(args.requirementId),
      name: String(args.name || "Release cycle"),
      status: "running",
      executions: (args.executions as Cycle["executions"]) || [],
      createdAt: new Date().toISOString(),
    };
    insertOne("cycles", cycle);
    return ok(`Test cycle created. id=${cycle.id} with ${cycle.executions.length} recorded execution(s).`);
  },
};

const executionRecord: MCPTool = {
  name: "execution_record",
  description:
    "Append or update an execution result (pass/fail/blocked with evidence) on a test cycle. Called by the Execution & Defect Agent as evidence is captured.",
  inputSchema: {
    type: "object",
    properties: {
      cycleId: { type: "string" },
      caseId: { type: "string" },
      caseTitle: { type: "string" },
      status: { type: "string", enum: ["passed", "failed", "blocked", "skipped"] },
      evidence: { type: "string" },
      executedBy: { type: "string" },
    },
    required: ["cycleId", "caseTitle", "status"],
  },
  handler: async (args) => {
    const cycle = getOne<Cycle>("cycles", String(args.cycleId));
    if (!cycle) return ok(`ERROR: cycle ${args.cycleId} not found`);
    const status = String(args.status) as ExecutionStatus;
    const existing = cycle.executions.findIndex((e) => e.caseId === args.caseId);
    const record = {
      id: crypto.randomUUID(),
      caseId: args.caseId ? String(args.caseId) : crypto.randomUUID(),
      caseTitle: String(args.caseTitle),
      status,
      evidence: args.evidence ? String(args.evidence) : undefined,
      executedBy: args.executedBy ? String(args.executedBy) : "automation",
      executedAt: new Date().toISOString(),
    };
    if (existing >= 0) cycle.executions[existing] = record;
    else cycle.executions.push(record);
    updateOne("cycles", cycle);
    return ok(`Execution recorded on cycle ${cycle.id}: "${record.caseTitle}" → ${status}.`);
  },
};

// ---------------------------------------------------------------------------
// defect_create — raise a Jira-style bug from a failed case
// ---------------------------------------------------------------------------
const defectCreate: MCPTool = {
  name: "defect_create",
  description:
    "Create a defect (Jira-style bug) from a failed test case, with rich context: summary, description, severity, and evidence.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
      cycleId: { type: "string" },
      caseId: { type: "string" },
      caseTitle: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      severity: { type: "string", enum: ["critical", "major", "minor", "trivial"] },
      evidence: { type: "string" },
    },
    required: ["requirementId", "caseTitle", "summary", "description"],
  },
  handler: async (args) => {
    const defect: Defect = {
      id: crypto.randomUUID(),
      requirementId: String(args.requirementId),
      cycleId: args.cycleId ? String(args.cycleId) : "manual",
      caseId: args.caseId ? String(args.caseId) : crypto.randomUUID(),
      caseTitle: String(args.caseTitle),
      summary: String(args.summary),
      description: String(args.description),
      severity: String(args.severity || "major") as Defect["severity"],
      status: "open",
      evidence: args.evidence ? String(args.evidence) : undefined,
      createdAt: new Date().toISOString(),
    };
    insertOne("defects", defect);
    return ok(`Defect created. id=${defect.id} severity=${defect.severity} "${defect.summary}"`);
  },
};

// ---------------------------------------------------------------------------
// release_confidence — Quality Intelligence Agent's core tool
// ---------------------------------------------------------------------------
const releaseConfidence: MCPTool = {
  name: "release_confidence",
  description:
    "Compute release confidence for a requirement from correlated manual + automated outcomes, defects, and coverage. Called by the Quality Intelligence Agent.",
  inputSchema: {
    type: "object",
    properties: {
      requirementId: { type: "string" },
    },
    required: ["requirementId"],
  },
  handler: async (args) => {
    const requirementId = String(args.requirementId);
    const coverage = listAll<Coverage>("coverages").find((c) => c.requirementId === requirementId);
    const cycle = listAll<Cycle>("cycles").filter((c) => c.requirementId === requirementId).pop();
    const defects = listAll<Defect>("defects").filter((d) => d.requirementId === requirementId);

    const totalCases = coverage?.testCases.length || 0;
    const executions = cycle?.executions || [];
    const executed = executions.filter((e) => e.status === "passed" || e.status === "failed" || e.status === "blocked").length;
    const passed = executions.filter((e) => e.status === "passed").length;
    const openDefects = defects.filter((d) => d.status !== "closed").length;

    const coveragePercent = totalCases ? Math.round((executed / totalCases) * 100) : 0;
    const passRate = executed ? Math.round((passed / executed) * 100) : 0;
    const confidence = Math.max(0, Math.round(coveragePercent * 0.4 + passRate * 0.4 + (openDefects === 0 ? 20 : 10)));
    const risk = confidence >= 80 ? "low" : confidence >= 55 ? "medium" : "high";

    return ok(
      JSON.stringify({
        requirementId,
        confidence,
        risk,
        coveragePercent,
        passRate,
        executed,
        totalCases,
        openDefects,
        passed,
        failed: executed - passed,
      })
    );
  },
};

export const tools: MCPTool[] = [
  requirementSave,
  requirementAnalyze,
  coverageSave,
  coverageGet,
  automationFrameworkGenerate,
  scriptSave,
  cycleCreate,
  executionRecord,
  defectCreate,
  releaseConfidence,
  ...integrationTools,
];

export function getTool(name: string): MCPTool | undefined {
  return tools.find((t) => t.name === name);
}
