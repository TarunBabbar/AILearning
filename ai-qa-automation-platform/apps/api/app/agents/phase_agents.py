"""STLC phase agents — one specialist per phase, orchestrated by Supervisor.

Each agent extends BaseAgent, overrides build_prompt to compose workspace data
(requirements, coverage, existing tests, schema), and returns structured JSON
via the swappable LLM client (app/llm/client.py).
"""
from .base import AgentContext, BaseAgent


class RequirementsAnalystAgent(BaseAgent):
    name = "requirements_analyst"
    description = (
        "Analyze Jira user stories + acceptance criteria. Extract a graded rubric, "
        "expected tool sequence, and acceptance checklist per story."
    )
    output_schema = (
        '{"stories": [{"key": str, "rubric": {criteria: str, weight: float}, '
        '"expected_tools": [str], "acceptance_checklist": [str], "risk_tier": str}]}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        stories = ctx.data.get("requirements", [])
        return (
            f"Workspace {ctx.workspace_id} — analyze these Jira stories:\n"
            f"{stories}\n\n"
            "Extract rubric, expected tool sequence, acceptance checklist, risk tier."
        )


class TestPlannerAgent(BaseAgent):
    name = "test_planner"
    description = (
        "Produce a risk-tiered test plan from rubrics + coverage map + workspace "
        "settings. Prioritize coverage gaps (stories with no matching test)."
    )
    output_schema = (
        '{"plan": [{"priority": int, "story_key": str, "test_types": [str], '
        '"gaps": [str], "thresholds": dict}]}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — build a test plan from:\n"
            f"rubrics={ctx.data.get('rubrics')}\n"
            f"coverage={ctx.data.get('coverage_map')}\n"
            f"settings={ctx.data.get('settings')}\n"
            "Prioritize uncovered stories."
        )


class TestDesignerAgent(BaseAgent):
    name = "test_designer"
    description = (
        "Draft test cases (source: ai-generated) from the plan + repo structure + "
        "existing tests + DB schema. Follow existing test conventions."
    )
    output_schema = (
        '{"cases": [{"title": str, "test_type": str, "derived_from": str, '
        '"tags": [str], "priority": str, "code": str}]}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — design test cases for:\n"
            f"plan={ctx.data.get('plan')}\n"
            f"repo={ctx.data.get('repo_structure')}\n"
            f"existing_tests={ctx.data.get('existing_tests')}\n"
            f"db_schema={ctx.data.get('db_schema')}\n"
            "Follow existing conventions; tag source: ai-generated."
        )


class AutomationBuilderAgent(BaseAgent):
    name = "automation_builder"
    description = (
        "Compile approved test cases into runnable Playwright/pytest/DeepEval "
        "suites, workspace-isolated."
    )
    output_schema = '{"suites": [{"name": str, "type": str, "files": {path: str}}]}'

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — compile approved cases into suites:\n"
            f"approved_cases={ctx.data.get('approved_cases')}"
        )


class ExecutorAgent(BaseAgent):
    name = "executor"
    description = (
        "Execute compiled suites in the worker pool (Playwright/pytest), collect "
        "traces + results + artifacts."
    )
    output_schema = (
        '{"results": [{"case_id": str, "status": str, "duration_ms": int, '
        '"error": str|null}], "artifacts": [str]}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — execute suites:\n"
            f"suites={ctx.data.get('suites')}\n"
            f"trigger={ctx.data.get('trigger')}"
        )


class DefectReporterAgent(BaseAgent):
    name = "defect_reporter"
    description = (
        "Create Jira tickets for failures/low scores via the Jira MCP connector, "
        "with trace attached."
    )
    output_schema = (
        '{"defects": [{"summary": str, "description": str, "trace_ref": str, '
        '"jira_key": str|null}]}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — create defect tickets for:\n"
            f"failures={ctx.data.get('failures')}\n"
            f"trace_ref={ctx.data.get('trace_ref')}"
        )


class ReleaseGaterAgent(BaseAgent):
    name = "release_gater"
    description = (
        "Evaluate per-metric scores against configured thresholds. Verdict: "
        "pass or block (hard-gate failure blocks release)."
    )
    output_schema = '{"verdict": str, "blocked_metrics": [str], "summary": str}'

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — evaluate gate:\n"
            f"scores={ctx.data.get('metric_scores')}\n"
            f"thresholds={ctx.data.get('thresholds')}\n"
            "Decide pass/block."
        )
