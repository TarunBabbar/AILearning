"""Execution orchestration — run a workspace's approved test suite.

Flow: compile suites → execute (worker pool) → eval (DeepEval) → gate
verdict → on failure: defect report + closed-loop review items.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from ..agents.phase_agents import ReleaseGaterAgent
from ..db.models import (
    MetricScore,
    ReviewItem,
    Run,
    RunResult,
    TestCase,
    WorkspaceSettings,
)
from ..eval.metrics import EvalInput, evaluate_case
from ..observability.langfuse import tracer

TEST_TYPE_TO_METRICS: dict[str, list[str]] = {
    "ui": ["answer_relevancy", "groundedness", "tool_sequence_accuracy"],
    "api": ["answer_relevancy", "completeness", "correctness"],
    "db": ["groundedness", "completeness"],
    "integration": ["tool_sequence_accuracy", "correctness"],
}


def create_run(db: Session, workspace_id: str, trigger: str = "manual") -> Run:
    """Create a Run record with a threshold snapshot from settings."""
    s = db.get(WorkspaceSettings, workspace_id)
    thresholds = s.thresholds if s else {}
    run = Run(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        trigger=trigger,
        status="queued",
        threshold_snapshot=thresholds,
    )
    db.add(run)
    db.commit()
    return run


def execute_run(db: Session, run: Run) -> dict[str, Any]:
    """Execute all approved test cases for the run's workspace."""
    run.status = "running"
    db.commit()
    trace = tracer.start_run_trace(run.workspace_id, run.id)

    cases = (
        db.query(TestCase)
        .filter(
            TestCase.workspace_id == run.workspace_id,
            TestCase.status == "approved",
        )
        .all()
    )

    results_summary: dict[str, Any] = {"passed": 0, "failed": 0, "total": len(cases)}
    metric_rows: list[MetricScore] = []

    for case in cases:
        outcome = _run_case(case)
        result = RunResult(
            id=str(uuid.uuid4()),
            run_id=run.id,
            test_case_id=case.id,
            workspace_id=run.workspace_id,
            status=outcome["status"],
            duration_ms=outcome["duration_ms"],
            error=outcome["error"],
        )
        db.add(result)
        db.flush()
        if outcome["status"] == "passed":
            results_summary["passed"] += 1
        else:
            results_summary["failed"] += 1

        # Eval per test type (only when execution passed — else it's a defect)
        if outcome["status"] == "passed":
            eval_input = EvalInput(
                input=case.title,
                actual_output=outcome.get("output", case.code or ""),
                retrieval_context=[case.derived_from or ""],
                tools_called=outcome.get("tools_called", []),
                expected_tools=outcome.get("expected_tools", []),
                high_risk=case.priority == "P0",
            )
            for mr in evaluate_case(eval_input, run.threshold_snapshot):
                if mr.metric not in TEST_TYPE_TO_METRICS.get(case.test_type, []):
                    continue
                metric_rows.append(
                    MetricScore(
                        id=str(uuid.uuid4()),
                        run_result_id=result.id,
                        workspace_id=run.workspace_id,
                        metric=mr.metric,
                        score=mr.score,
                        threshold=mr.threshold,
                        hard_gate=mr.hard_gate,
                        passed=mr.passed,
                    )
                )

    db.add_all(metric_rows)
    db.commit()

    # Gate verdict
    gate = _gate(db, run)
    run.status = "passed" if gate["verdict"] == "pass" else "blocked"
    run.gate_verdict = gate["verdict"]
    db.commit()
    tracer.flush()

    # Closed loop: failures → review items
    for result in db.query(RunResult).filter(RunResult.run_id == run.id, RunResult.status != "passed"):
        db.add(
            ReviewItem(
                id=str(uuid.uuid4()),
                workspace_id=run.workspace_id,
                kind="defect",
                test_case_id=result.test_case_id,
                run_result_id=result.id,
                reason=result.error or "failed in run",
            )
        )
    db.commit()

    return {"run_id": run.id, "gate": gate, **results_summary}


def _run_case(case: TestCase) -> dict[str, Any]:
    """Execute one case in-process (worker pool integration lands in M5).

    Local stub: a case whose code contains 'def test_' is treated as passing;
    otherwise it reports a failure. Real Playwright/pytest workers replace this.
    """
    code = case.code or ""
    if "def test_" in code:
        return {"status": "passed", "duration_ms": 120, "output": "ok"}
    return {"status": "failed", "duration_ms": 40, "error": "no runnable code"}


def _gate(db: Session, run: Run) -> dict[str, Any]:
    """Release Gater agent decides pass/block from metric scores.

    Fail-closed: if the LLM verdict is unavailable (no provider/key, retry
    status), fall back to a deterministic hard-gate check so a broken LLM
    never lets a release through.
    """
    scores = (
        db.query(MetricScore)
        .join(RunResult, RunResult.id == MetricScore.run_result_id)
        .filter(RunResult.run_id == run.id)
        .all()
    )
    score_data = [
        {"metric": s.metric, "score": s.score, "threshold": s.threshold, "hard_gate": s.hard_gate}
        for s in scores
    ]
    from ..agents.base import AgentContext

    ctx = AgentContext(
        workspace_id=run.workspace_id,
        data={"metric_scores": score_data, "thresholds": run.threshold_snapshot},
    )
    result = ReleaseGaterAgent().run(ctx)

    verdict = result.output.get("verdict")
    if verdict not in {"pass", "block"}:
        # Deterministic fallback: any failed hard-gate metric blocks.
        blocked = [s["metric"] for s in score_data if s["hard_gate"] and s["score"] < s["threshold"]]
        verdict = "block" if blocked else "pass"
        return {"verdict": verdict, "blocked_metrics": blocked}

    blocked_metrics = result.output.get("blocked_metrics", [])
    if verdict == "block" and not blocked_metrics:
        blocked_metrics = [
            s["metric"] for s in score_data if s["hard_gate"] and s["score"] < s["threshold"]
        ]
    return {"verdict": verdict, "blocked_metrics": blocked_metrics}
