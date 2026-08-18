"""Temporal activities — the actual work executed by workers."""
from __future__ import annotations

from typing import Any

from temporalio import activity


@activity.defn
async def generate_tests_activity(payload: dict[str, Any]) -> dict[str, Any]:
    """Run the generation pipeline (Analyst → Planner → Designer)."""
    from app.generation.pipeline import run_generation_pipeline
    from app.db.session import SessionLocal

    workspace_id = payload["workspace_id"]
    with SessionLocal() as db:
        return run_generation_pipeline(
            db,
            workspace_id,
            requirement_ids=payload.get("requirement_ids"),
            max_cases=payload.get("max_cases", 50),
        )


@activity.defn
async def run_suite_activity(payload: dict[str, Any]) -> dict[str, Any]:
    """Execute approved suite + eval + gate for a run."""
    from app.exec.orchestrator import create_run, execute_run
    from app.db.session import SessionLocal

    workspace_id = payload["workspace_id"]
    trigger = payload.get("trigger", "manual")
    with SessionLocal() as db:
        run = create_run(db, workspace_id, trigger)
        return execute_run(db, run)
