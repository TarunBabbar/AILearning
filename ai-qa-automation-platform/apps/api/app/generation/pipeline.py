"""Test generation engine — Jira story + repo + schema → draft test cases.

Runs the Analyst → Planner → Designer agent chain per workspace, persists
drafts (source: ai-generated) into the review queue, and records coverage.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ..agents.base import AgentContext
from ..agents.phase_agents import (
    RequirementsAnalystAgent,
    TestDesignerAgent,
    TestPlannerAgent,
)
from ..db.models import CoverageMap, Requirement, TestCase
from ..observability.langfuse import tracer


def run_generation_pipeline(
    db: Session,
    workspace_id: str,
    requirement_ids: list[str] | None = None,
    max_cases: int = 50,
) -> dict[str, Any]:
    """Execute the generation chain and persist draft cases + coverage.

    Returns a summary dict (cases drafted, requirements covered).
    """
    # 1. Gather requirements (Jira stories pulled by the connector)
    query = db.query(Requirement).filter(Requirement.workspace_id == workspace_id)
    if requirement_ids:
        query = query.filter(Requirement.id.in_(requirement_ids))
    requirements = query.limit(200).all()
    if not requirements:
        return {"cases_drafted": 0, "requirements_covered": 0, "error": "no requirements"}

    story_data = [
        {
            "key": r.source_key,
            "title": r.title,
            "description": r.description,
            "acceptance_criteria": r.acceptance_criteria,
            "risk_tier": r.risk_tier,
        }
        for r in requirements
    ]

    # 2. Agent chain: Analyst → Planner → Designer
    trace = tracer.start_run_trace(workspace_id, run_id=f"gen:{workspace_id}")
    ctx = AgentContext(workspace_id=workspace_id, data={"requirements": story_data})

    analyst = RequirementsAnalystAgent()
    analyst_result = analyst.run(ctx)
    if analyst_result.status != "success":
        return {"cases_drafted": 0, "error": analyst_result.error}
    tracer.log_agent_step(trace, analyst.name, "", analyst_result.output)

    # Persist rubric per requirement
    for story in analyst_result.output.get("stories", []):
        req = next((r for r in requirements if r.source_key == story.get("key")), None)
        if req:
            req.rubric = story.get("rubric", {})

    planner_ctx = AgentContext(
        workspace_id=workspace_id,
        data={
            "rubrics": analyst_result.output,
            "coverage_map": _coverage_map(db, workspace_id),
            "settings": _workspace_settings(db, workspace_id),
        },
    )
    planner = TestPlannerAgent()
    planner_result = planner.run(planner_ctx)
    if planner_result.status != "success":
        return {"cases_drafted": 0, "error": planner_result.error}
    tracer.log_agent_step(trace, planner.name, "", planner_result.output)

    designer_ctx = AgentContext(
        workspace_id=workspace_id,
        data={
            "plan": planner_result.output,
            "repo_structure": _get_repo_structure(db, workspace_id),
            "existing_tests": _get_existing_tests(db, workspace_id),
            "db_schema": _get_db_schema(db, workspace_id),
        },
    )
    designer = TestDesignerAgent()
    designer_result = designer.run(designer_ctx)
    if designer_result.status != "success":
        return {"cases_drafted": 0, "error": designer_result.error}
    tracer.log_agent_step(trace, designer.name, "", designer_result.output)

    # 3. Persist drafts (source: ai-generated) + coverage links
    drafted = 0
    for case in designer_result.output.get("cases", [])[:max_cases]:
        req_key = case.get("derived_from", "")
        req = next((r for r in requirements if r.source_key == req_key), None)
        tc = TestCase(
            workspace_id=workspace_id,
            requirement_id=req.id if req else None,
            title=case.get("title", "Untitled"),
            test_type=case.get("test_type", "api"),
            status="draft",
            source="ai-generated",
            derived_from=req_key or "unknown",
            code=case.get("code"),
            tags=case.get("tags", []),
            priority=case.get("priority", "P2"),
        )
        db.add(tc)
        db.flush()
        if req:
            db.add(
                CoverageMap(
                    workspace_id=workspace_id,
                    requirement_id=req.id,
                    test_case_id=tc.id,
                )
            )
        drafted += 1

    db.commit()
    tracer.flush()
    return {
        "cases_drafted": drafted,
        "requirements_covered": len(requirements),
    }


def _coverage_map(db: Session, workspace_id: str) -> dict[str, Any]:
    rows = (
        db.query(CoverageMap)
        .filter(CoverageMap.workspace_id == workspace_id)
        .all()
    )
    return {"total_links": len(rows)}


def _workspace_settings(db: Session, workspace_id: str) -> dict[str, Any]:
    from ..db.models import WorkspaceSettings

    s = db.get(WorkspaceSettings, workspace_id)
    return {
        "thresholds": s.thresholds if s else {},
        "risk_tiers": s.risk_tiers if s else {},
        "gate_policy": s.gate_policy if s else {},
    }


def _get_repo_structure(db: Session, workspace_id: str) -> list[str]:
    from ..db.models import Connection

    conn = (
        db.query(Connection)
        .filter(Connection.workspace_id == workspace_id, Connection.type == "github")
        .first()
    )
    return conn.scope_config.get("repos", []) if conn else []


def _get_existing_tests(db: Session, workspace_id: str) -> list[dict[str, Any]]:
    rows = (
        db.query(TestCase)
        .filter(
            TestCase.workspace_id == workspace_id,
            TestCase.source == "user-provided",
        )
        .limit(100)
        .all()
    )
    return [
        {"title": t.title, "test_type": t.test_type, "tags": t.tags}
        for t in rows
    ]


def _get_db_schema(db: Session, workspace_id: str) -> dict[str, Any]:
    from ..db.models import Connection

    conn = (
        db.query(Connection)
        .filter(Connection.workspace_id == workspace_id, Connection.type == "database")
        .first()
    )
    return conn.scope_config if conn else {}
