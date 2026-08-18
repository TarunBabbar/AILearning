"""Temporal workflows — durable STLC orchestration.

Workflow IDs are prefixed by workspace_id so runs stay tenant-isolated.
Human-in-the-loop review is modeled with signals (native Temporal pattern).

Generation:  Analyst → Planner → Designer → signal (human review) → Builder
Run:         Executor → Eval → Gater → (on failure) DefectReporter + review items
"""
from dataclasses import dataclass, field
from typing import Any

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from .activities import generate_tests_activity, run_suite_activity


@dataclass
class ReviewDecision:
    case_id: str
    decision: str  # approve|reject|edit
    edited_code: str | None = None


@dataclass
class GenerationInput:
    workspace_id: str
    requirement_ids: list[str] = field(default_factory=list)
    max_cases: int = 50


@dataclass
class RunInput:
    workspace_id: str
    run_id: str
    trigger: str = "manual"


@workflow.defn
class GenerateTestsWorkflow:
    def __init__(self) -> None:
        self._review_decision: ReviewDecision | None = None

    @workflow.signal
    async def review_decision(self, decision: ReviewDecision) -> None:
        self._review_decision = decision

    @workflow.run
    async def run(self, inp: GenerationInput) -> dict[str, Any]:
        payload = {
            "workspace_id": inp.workspace_id,
            "requirement_ids": inp.requirement_ids,
            "max_cases": inp.max_cases,
        }
        result = await workflow.execute_activity(
            generate_tests_activity,
            payload,
            start_to_close_timeout=workflow.Duration.from_seconds(1800),
        )

        # Human review happens via the review queue UI. The workflow waits for
        # a review decision per drafted case.
        drafted = result.get("cases_drafted", 0)
        approved: list[str] = []
        for _ in range(drafted):
            decision = await workflow.wait_for_signal(self.review_decision)
            if decision.decision == "approve":
                approved.append(decision.case_id)

        return {"workspace_id": inp.workspace_id, **result, "approved": approved}


@workflow.defn
class RunSuiteWorkflow:
    @workflow.run
    async def run(self, inp: RunInput) -> dict[str, Any]:
        payload = {
            "workspace_id": inp.workspace_id,
            "run_id": inp.run_id,
            "trigger": inp.trigger,
        }
        result = await workflow.execute_activity(
            run_suite_activity,
            payload,
            start_to_close_timeout=workflow.Duration.from_seconds(3600),
        )
        return result
