"""Requirements router — ingest Jira stories (via connector) + trigger generation."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace
from ...db.models import Requirement
from ...db.session import get_db
from ...generation.pipeline import run_generation_pipeline

router = APIRouter(prefix="/requirements", tags=["requirements"])


class RequirementIn(BaseModel):
    source_key: str
    title: str
    description: str | None = None
    acceptance_criteria: list[str] = []
    source_link: str | None = None
    risk_tier: str = "medium"


class RequirementOut(BaseModel):
    id: str
    source_key: str
    title: str
    risk_tier: str
    source_link: str | None


@router.get("", response_model=list[RequirementOut])
def list_requirements(
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[RequirementOut]:
    rows = db.execute(
        select(Requirement).where(Requirement.workspace_id == ctx.workspace_id)
    ).scalars().all()
    return [
        RequirementOut(
            id=r.id, source_key=r.source_key, title=r.title,
            risk_tier=r.risk_tier, source_link=r.source_link,
        )
        for r in rows
    ]


@router.post("", response_model=RequirementOut)
def create_requirement(
    body: RequirementIn,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> RequirementOut:
    req = Requirement(
        workspace_id=ctx.workspace_id,
        source_key=body.source_key,
        title=body.title,
        description=body.description,
        acceptance_criteria=body.acceptance_criteria,
        source_link=body.source_link,
        risk_tier=body.risk_tier,
    )
    db.add(req)
    db.commit()
    return RequirementOut(
        id=req.id, source_key=req.source_key, title=req.title,
        risk_tier=req.risk_tier, source_link=req.source_link,
    )


class GenerateRequest(BaseModel):
    requirement_ids: list[str] | None = None
    max_cases: int = 50


@router.post("/generate")
def generate_tests(
    body: GenerateRequest,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """Run the Analyst → Planner → Designer chain, persist drafts."""
    summary = run_generation_pipeline(
        db,
        ctx.workspace_id,
        requirement_ids=body.requirement_ids,
        max_cases=body.max_cases,
    )
    if summary.get("error"):
        raise HTTPException(status_code=502, detail=summary["error"])
    return summary
