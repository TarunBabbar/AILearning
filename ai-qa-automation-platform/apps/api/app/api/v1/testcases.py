"""Test cases router — review queue (approve/reject/edit) + ingestion source."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace
from ...db.models import CoverageMap, TestCase
from ...db.session import get_db

router = APIRouter(prefix="/testcases", tags=["testcases"])


class TestCaseOut(BaseModel):
    id: str
    title: str
    test_type: str
    status: str
    source: str
    derived_from: str | None
    priority: str
    tags: list[str]
    code: str | None = None


class ReviewAction(BaseModel):
    action: str  # approve|reject|edit
    code: str | None = None
    title: str | None = None


@router.get("", response_model=list[TestCaseOut])
def list_test_cases(
    status: str | None = None,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[TestCaseOut]:
    q = select(TestCase).where(TestCase.workspace_id == ctx.workspace_id)
    if status:
        q = q.where(TestCase.status == status)
    rows = db.execute(q.order_by(TestCase.created_at.desc())).scalars().all()
    return [
        TestCaseOut(
            id=t.id, title=t.title, test_type=t.test_type, status=t.status,
            source=t.source, derived_from=t.derived_from, priority=t.priority,
            tags=t.tags, code=t.code,
        )
        for t in rows
    ]


@router.post("/{case_id}/review")
def review_case(
    case_id: str,
    body: ReviewAction,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    case = db.get(TestCase, case_id)
    if not case or case.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Test case not found")

    if body.action == "approve":
        case.status = "approved"
    elif body.action == "reject":
        case.status = "rejected"
    elif body.action == "edit":
        if body.code is not None:
            case.code = body.code
        if body.title is not None:
            case.title = body.title
        case.status = "approved"
    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    db.commit()
    return {"ok": True, "status": case.status}


@router.post("")
def create_test_case(
    body: TestCaseOut,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """Manual/uploaded test ingestion (source: user-provided)."""
    tc = TestCase(
        workspace_id=ctx.workspace_id,
        title=body.title,
        test_type=body.test_type,
        status="approved",
        source="user-provided",
        derived_from=body.derived_from,
        code=body.code,
        tags=body.tags,
        priority=body.priority,
    )
    db.add(tc)
    db.commit()
    return {"ok": True, "id": tc.id}
