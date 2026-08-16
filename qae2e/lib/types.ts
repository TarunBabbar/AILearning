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
  | "release"
  | "evaluation";

export type ConnectorId =
  | "jira"
  | "confluence"
  | "figma"
  | "github"
  | "zephyr"
  | "testrail"
  | "pinecone"
  | "openrouter";

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
  testData: (string | Record<string, string>)[];
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

// DeepEval-style stage evaluation: how well an agent's output delivered what
// the previous stage asked for. precision = share of output items that are
// justified/traceable; accuracy = share of requested items actually delivered.
export type EvalStage = "analyze" | "coverage" | "automate" | "execute" | "release";

export interface EvalItemVerdict {
  item: string;
  verdict: "pass" | "fail" | "partial";
  reason: string;
}

/** Human-readable verdict for a stage, derived from precision+accuracy. */
export type EvalVerdict = "excellent" | "good" | "needs-work" | "poor" | "fallback";

/** Extra metrics derived from per-item verdicts (plus judge confidence). */
export interface EvalMetrics {
  /** % of output items judged fully correct (pass/total). Undefined when the
   *  judge supplied no per-item data. */
  completeness?: number;
  /** Number of output items that were hallucinated / off-topic. */
  hallucinatedCount?: number;
  /** Number of input asks that were missed / only partially covered. */
  missedCount?: number;
  /** Judge's confidence in its own scores (0-100), when reported. */
  judgeConfidence?: number;
}

export interface Evaluation {
  id: string;
  requirementId: string;
  stage: EvalStage;
  agentId: string;
  artifactKind: string; // analyses | coverages | scripts | cycles | releases
  artifactId: string;
  inputRef: string; // what the stage was asked to deliver (requirement/analysis/coverage/…)
  precision: number; // 0-100
  accuracy: number; // 0-100
  rationale: string;
  /** Plain-language "what does this mean for me" explanation. */
  overall?: string;
  /** Actionable ways to raise the scores. */
  improvements?: string[];
  verdict?: EvalVerdict;
  metrics?: EvalMetrics;
  perItem: EvalItemVerdict[];
  method: "llm-judge" | "fallback";
  createdAt: string;
}

// ---- Connectors (real integrations) ----
// Schema-driven connector definitions: each connector is declared once as data
// and the Settings → Integrations UI is rendered generically from the registry
// (lib/connectors/registry.ts). Adding a connector = one registry entry.

export type ConnectorAuthType = "api_token" | "basic_auth" | "bearer_token" | "oauth2";

export interface ConnectorField {
  key: string; // e.g. "apiToken"
  label: string; // e.g. "API Token"
  type: "text" | "password" | "url" | "select";
  required: boolean;
  helpText?: string; // what this credential is for + how to generate it
  helpUrl?: string; // deep link to the provider's "generate a token" page
}

export interface ConnectorDef {
  id: ConnectorId;
  name: string;
  authType: ConnectorAuthType;
  fields: ConnectorField[];
  testEndpoint: string; // lightweight read-only probe used by "Test connection"
  docsUrl: string;
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
      // Per-test outcomes (name + status) — captured for flaky detection/trends.
      results?: Array<{ test: string; status: string; durationMs?: number }>;
      ts?: number;
    }
  // DeepEval-style stage evaluation result (streamed after each agent stage).
  | {
      type: "evaluation";
      agentId: string;
      stage: string;
      precision: number;
      accuracy: number;
      rationale: string;
      completeness?: number;
      hallucinatedCount?: number;
      missedCount?: number;
      ts?: number;
    }
  // DeepEval judge started scoring this stage's output (drives the UI spinner).
  | { type: "eval_start"; agentId: string; stage: string; ts?: number }
  // DeepEval scored below threshold and is re-running the agent with feedback.
  | {
      type: "eval_retry";
      agentId: string;
      stage: string;
      attempt: number;
      maxAttempts: number;
      precision: number;
      accuracy: number;
      feedback: string;
      ts?: number;
    };
