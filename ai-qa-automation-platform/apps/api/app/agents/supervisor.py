"""Supervisor agent — orchestrates STLC phase agents.

Routes work, aggregates results, decides retry vs escalate, and makes the
final release-gate call. Workspace-scoped; never crosses tenants.
"""
from typing import Any

from ..llm.client import complete_json
from .base import AgentContext, AgentResult, BaseAgent
from .phase_agents import (
    AutomationBuilderAgent,
    DefectReporterAgent,
    ExecutorAgent,
    ReleaseGaterAgent,
    RequirementsAnalystAgent,
    TestDesignerAgent,
    TestPlannerAgent,
)

# Agent instantiation factory: name -> constructor.
AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    RequirementsAnalystAgent.name: RequirementsAnalystAgent,
    TestPlannerAgent.name: TestPlannerAgent,
    TestDesignerAgent.name: TestDesignerAgent,
    AutomationBuilderAgent.name: AutomationBuilderAgent,
    ExecutorAgent.name: ExecutorAgent,
    DefectReporterAgent.name: DefectReporterAgent,
    ReleaseGaterAgent.name: ReleaseGaterAgent,
}

# Canonical STLC order for generation workflows.
STLC_ORDER = [
    RequirementsAnalystAgent.name,
    TestPlannerAgent.name,
    TestDesignerAgent.name,
    AutomationBuilderAgent.name,
    ExecutorAgent.name,
    DefectReporterAgent.name,
    ReleaseGaterAgent.name,
]


class SupervisorAgent(BaseAgent):
    name = "supervisor"
    description = (
        "Route work between STLC phase agents, decide retry vs escalate, and "
        "issue the final release gate call."
    )
    output_schema = (
        '{"next_agent": str, "reason": str, "payload": dict, '
        '"escalate": bool, "final_verdict": str|null}'
    )

    def build_prompt(self, ctx: AgentContext) -> str:
        return (
            f"Workspace {ctx.workspace_id} — supervise STLC pipeline.\n"
            f"Pipeline state:\n{ctx.data.get('pipeline_state')}\n"
            f"Last agent result:\n{ctx.data.get('last_result')}\n"
            "Decide next agent, payload, escalate flag, or final verdict."
        )

    def run(self, ctx: AgentContext) -> AgentResult:
        """Route to the next phase agent based on pipeline state."""
        state = ctx.data.get("pipeline_state", {})
        step = state.get("step", 0)
        # Generation workflow order (DefectReporter/ReleaseGater used in run flow).
        generation_order = STLC_ORDER[:4]

        if step >= len(generation_order):
            return AgentResult(
                agent=self.name,
                output={"escalate": False, "final_verdict": "generation_complete"},
            )

        agent_name = generation_order[step]
        agent_cls = AGENT_REGISTRY.get(agent_name)
        if not agent_cls:
            return AgentResult(agent=self.name, status="escalate", error=f"Unknown agent {agent_name}")

        agent = agent_cls(model=self.model)
        result = agent.run(ctx)
        result.agent = self.name
        return AgentResult(
            agent=self.name,
            status=result.status,
            output={
                "next_agent": agent_name,
                "reason": "stepping through generation pipeline",
                "payload": result.output,
                "escalate": result.status == "escalate",
            },
        )
