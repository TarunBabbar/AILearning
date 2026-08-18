import { BaseAgent, AgentContext } from "./base";

/** Requirements Analysis — Jira stories → rubric + expected tools + checklist. */
export class RequirementsAnalystAgent extends BaseAgent {
  name = "requirements_analyst";
  description =
    "Analyze Jira user stories + acceptance criteria. Extract a graded rubric, expected tool sequence, and acceptance checklist per story.";
  outputSchema =
    '{"stories": [{"key": str, "rubric": {criteria: str, weight: number}, "expected_tools": [str], "acceptance_checklist": [str], "risk_tier": str}]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — analyze these Jira stories:`,
      JSON.stringify(ctx.data.requirements ?? []),
      "Extract rubric, expected tool sequence, acceptance checklist, risk tier.",
    ].join("\n");
  }
}

/** Test Planning — risk-tiered plan from rubrics + coverage + settings. */
export class TestPlannerAgent extends BaseAgent {
  name = "test_planner";
  description =
    "Produce a risk-tiered test plan from rubrics + coverage map + workspace settings. Prioritize coverage gaps.";
  outputSchema =
    '{"plan": [{"priority": number, "story_key": str, "test_types": [str], "gaps": [str], "thresholds": {}}]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — build a test plan from:`,
      `rubrics=${JSON.stringify(ctx.data.rubrics ?? {})}`,
      `coverage=${JSON.stringify(ctx.data.coverageMap ?? {})}`,
      `settings=${JSON.stringify(ctx.data.settings ?? {})}`,
      "Prioritize uncovered stories.",
    ].join("\n");
  }
}

/** Test Design — draft test cases following existing conventions. */
export class TestDesignerAgent extends BaseAgent {
  name = "test_designer";
  description =
    "Draft test cases (source: ai-generated) from the plan + repo structure + existing tests + DB schema. Follow existing conventions.";
  outputSchema =
    '{"cases": [{"title": str, "test_type": str, "derived_from": str, "tags": [str], "priority": str, "code": str}]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — design test cases for:`,
      `plan=${JSON.stringify(ctx.data.plan ?? {})}`,
      `repo=${JSON.stringify(ctx.data.repoStructure ?? {})}`,
      `existing_tests=${JSON.stringify(ctx.data.existingTests ?? [])}`,
      `db_schema=${JSON.stringify(ctx.data.dbSchema ?? {})}`,
      "Follow existing conventions; tag source: ai-generated.",
    ].join("\n");
  }
}

/** Automation Build — approved cases → compiled suites. */
export class AutomationBuilderAgent extends BaseAgent {
  name = "automation_builder";
  description = "Compile approved test cases into runnable Playwright/pytest/DeepEval suites.";
  outputSchema = '{"suites": [{"name": str, "type": str, "files": {path: str}}]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — compile approved cases into suites:`,
      `approved_cases=${JSON.stringify(ctx.data.approvedCases ?? [])}`,
    ].join("\n");
  }
}

/** Execution — run suites, collect results + artifacts. */
export class ExecutorAgent extends BaseAgent {
  name = "executor";
  description = "Execute compiled suites in the worker pool (Playwright/pytest), collect traces + results + artifacts.";
  outputSchema =
    '{"results": [{"case_id": str, "status": str, "duration_ms": number, "error": str|null}], "artifacts": [str]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — execute suites:`,
      `suites=${JSON.stringify(ctx.data.suites ?? {})}`,
      `trigger=${JSON.stringify(ctx.data.trigger ?? "manual")}`,
    ].join("\n");
  }
}

/** Defect Reporting — failures/low scores → Jira tickets. */
export class DefectReporterAgent extends BaseAgent {
  name = "defect_reporter";
  description = "Create Jira tickets for failures/low scores via the Jira connector, with trace attached.";
  outputSchema =
    '{"defects": [{"summary": str, "description": str, "trace_ref": str, "jira_key": str|null}]}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — create defect tickets for:`,
      `failures=${JSON.stringify(ctx.data.failures ?? [])}`,
      `trace_ref=${JSON.stringify(ctx.data.traceRef ?? "")}`,
    ].join("\n");
  }
}

/** Release Gate — per-metric scores vs thresholds → pass/block. */
export class ReleaseGaterAgent extends BaseAgent {
  name = "release_gater";
  description = "Evaluate per-metric scores against configured thresholds. Verdict: pass or block (hard-gate failure blocks).";
  outputSchema = '{"verdict": str, "blocked_metrics": [str], "summary": str}';

  buildPrompt(ctx: AgentContext): string {
    return [
      `Workspace ${ctx.workspaceId} — evaluate gate:`,
      `scores=${JSON.stringify(ctx.data.metricScores ?? [])}`,
      `thresholds=${JSON.stringify(ctx.data.thresholds ?? {})}`,
      "Decide pass/block.",
    ].join("\n");
  }
}
