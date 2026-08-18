"""Gate webhook — external CI (GitHub Actions, GitLab, Jenkins) blocks on this.

POST /api/v1/webhooks/gate   (workspace auth via bearer token)
GET  /api/v1/webhooks/gate/{run_id} → current gate status
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace
from ...db.models import Run
from ...db.session import get_db

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class GateResponse(BaseModel):
    run_id: str
    status: str
    gate_verdict: str | None


@router.get("/gate/{run_id}", response_model=GateResponse)
def gate_status(
    run_id: str,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> GateResponse:
    run = db.get(Run, run_id)
    if not run or run.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return GateResponse(run_id=run.id, status=run.status, gate_verdict=run.gate_verdict)


@router.post("/gate/notify")
async def gate_notify(
    request: Request,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """External CI posts run completion; responds with the gate verdict."""
    body = await request.json()
    run_id = body.get("run_id")
    run = db.get(Run, run_id)
    if not run or run.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "run_id": run.id,
        "gate_verdict": run.gate_verdict,
        "blocked": run.gate_verdict == "block",
    }
