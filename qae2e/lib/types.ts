// Shared types for the agentic QA platform.

export type AgentId =
  | "requirement-intelligence"
  | "manual-test-case"
  | "automation-script"
  | "execution-defect"
  | "devops-execution"
  | "quality-intelligence";

export type PipelineStep = "connect" | "analyze" | "coverage" | "automate" | "execute" | "release";

export type ArtifactType =
  | "requirement"
  | "analysis"
  | "coverage"
  | "script"
  | "cycle"
  | "defect"
  | "release";

export type ConnectorId =
  | "jira"
  | "confluence"
  | "figma"
  | "github"
  | "zephyr"
  | "testrail";

export type SourceType = "manual" | "jira" | "confluence" | "figma" | "image" | "other";

// ---- Artifacts (traceability chain, all linked by requirementId) ----

export interface Requirement {
  id: string;
  title: string;
  source: SourceType; // manual | jira | confluence | figma | image | other
  sourceKey?: string; // e.g. Jira ticket key, Confluence page id, Figma file id
  content: string;
  createdAt: string;
}

export interface Analysis {
  id: string;
  requirementId: string;
  summary: string;
  businessRules: string[];
  acceptanceCriteria: string[];
  risks: { risk: string; severity: "high" | "medium" | "low" }[];
  edgeCases: string[];
  scenarios: string[];
  testData: string[];
  missingInfo: string[];
  createdAt: string;
}

export interface TestStep {
  action: string;
  expected: string;
}

export interface TestCase {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  testType: string; // functional | negative | boundary | api | ui | regression ...
  scenarioType?: "positive" | "negative" | "boundary";
  steps: TestStep[];
}

export interface Coverage {
  id: string;
  requirementId: string;
  product?: string;
  module?: string;
  testCases: TestCase[];
  createdAt: string;
}

export interface Script {
  id: string;
  requirementId: string;
  coverageId: string;
  framework: string; // "playwright" (TypeScript + Playwright is the only supported stack)
  language: string;
  files: { path: string; code: string }[];
  createdAt: string;
}

export type ExecutionStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "skipped";

export interface Execution {
  id: string;
  caseId: string;
  caseTitle: string;
  status: ExecutionStatus;
  evidence?: string; // screenshot / notes
  executedBy?: string;
  executedAt?: string;
}

export interface Cycle {
  id: string;
  requirementId: string;
  name: string;
  status: "planned" | "running" | "completed";
  executions: Execution[];
  createdAt: string;
}

export interface Defect {
  id: string;
  requirementId: string;
  cycleId: string;
  caseId: string;
  caseTitle: string;
  summary: string;
  description: string;
  severity: "critical" | "major" | "minor" | "trivial";
  status: "open" | "in-progress" | "resolved" | "closed";
  evidence?: string;
  createdAt: string;
}

export interface ReleaseReport {
  id: string;
  requirementId: string;
  confidence: number; // 0-100
  risk: "low" | "medium" | "high";
  summary: string;
  coveragePercent: number;
  passRate: number;
  openDefects: number;
  findings: string[];
  recommendations: string[];
  createdAt: string;
}

// ---- Connectors (real integrations) ----

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "email";
  placeholder?: string;
  required: boolean;
  description: string;
}

export interface ConnectorDef {
  id: ConnectorId;
  name: string;
  description: string;
  icon: string; // emoji-ish marker
  fields: ConnectorField[];
}

export interface ConnectorStatus {
  id: ConnectorId;
  configured: boolean;
  missing: string[]; // field labels the user still needs to provide
  hint: string; // where to get the credential
}

// A test case as it exists in an external tool (Zephyr / TestRail).
export interface ExternalTestCase {
  id: string;
  source: string; // "zephyr" | "testrail" | ...
  title: string;
  description?: string;
  steps?: string[]; // flattened "action → expected"
  priority?: string;
  testType?: string;
}

// A vector record in the Pinecone index (RAG dedupe).
export interface VectorRecord {
  id: string;
  values: number[];
  metadata: { title: string; source: string; text: string };
}

export type ExportFormat = "csv" | "xlsx";

// ---- Agents / tools ----

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: ToolInput) => Promise<ToolResult>;
}

export interface Agent {
  id: AgentId;
  code: string; // 2-letter icon code, e.g. "RI"
  name: string;
  tagline: string;
  description: string;
  step: PipelineStep;
  systemPrompt: string;
  tools: string[]; // tool names this agent may call
  model?: string;
}

// ---- Event stream (NDJSON over the wire) ----
// `ts` is epoch ms, added by the runner for duration/ordering display.

export type AgentEvent =
  | { type: "status"; agentId: string; message: string; ts?: number }
  | { type: "tool_call"; agentId: string; tool: string; args: ToolInput; ts?: number }
  | { type: "tool_result"; agentId: string; tool: string; summary: string; text?: string; ts?: number }
  | { type: "artifact"; agentId: string; artifact: ArtifactType; id: string; ts?: number }
  | { type: "chunk"; agentId: string; text: string; ts?: number }
  | { type: "done"; agentId: string; artifact: ArtifactType; id: string; ts?: number }
  | { type: "error"; agentId: string; message: string; ts?: number }
  // Orchestrator-level: which agent is starting/finishing (drives the
  // "Agent N/6 running" banner).
  | { type: "agent_start"; agentId: string; code: string; name: string; index: number; total: number; ts?: number }
  | { type: "agent_done"; agentId: string; code: string; name: string; index: number; total: number; ts?: number }
  // Real Docker autofix results (surfaced in the workspace run report).
  | {
      type: "test_run";
      agentId: string;
      ok: boolean;
      passed: number;
      failed: number;
      skipped: number;
      total: number;
      attempts: number;
      failures?: Array<{ test: string; message: string }>;
      logs?: string[];
      message?: string;
      ts?: number;
    };
