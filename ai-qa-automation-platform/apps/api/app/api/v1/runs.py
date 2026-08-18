"""Runs router — trigger runs, list history, view metric scores + gate status."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace
from ...db.models import MetricScore, Run, RunResult
from ...db.session import get_db
from ...exec.orchestrator import create_run, execute_run

router = APIRouter(prefix="/runs", tags=["runs"])


class RunTrigger(BaseModel):
    trigger: str = "manual"


class RunOut(BaseModel):
    id: str
    trigger: str
    status: str
    gate_verdict: str | None
    created_at: str
    passed: int = 0
    failed: int = 0
    total: int = 0


class MetricOut(BaseModel):
    metric: str
    score: float
    threshold: float
    hard_gate: bool
    passed: bool


@router.post("", response_model=RunOut)
def trigger_run(
    body: RunTrigger,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> RunOut:
    run = create_run(db, ctx.workspace_id, body.trigger)
    # NOTE(M5): async via Temporal worker; sync here for local dev.
    summary = execute_run(db, run)
    return RunOut(
        id=run.id,
        trigger=run.trigger,
        status=run.status,
        gate_verdict=run.gate_verdict,
        created_at=run.created_at.isoformat(),
        passed=summary.get("passed", 0),
        failed=summary.get("failed", 0),
        total=summary.get("total", 0),
    )


@router.get("", response_model=list[RunOut])
def list_runs(
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[RunOut]:
    rows = db.execute(
        select(Run).where(Run.workspace_id == ctx.workspace_id).order_by(Run.created_at.desc())
    ).scalars().all()
    out = []
    for r in rows:
        results = db.execute(
            select(RunResult).where(RunResult.run_id == r.id)
        ).scalars().all()
        out.append(
            RunOut(
                id=r.id, trigger=r.trigger, status=r.status,
                gate_verdict=r.gate_verdict, created_at=r.created_at.isoformat(),
                passed=sum(1 for x in results if x.status == "passed"),
                failed=sum(1 for x in results if x.status != "passed"),
                total=len(results),
            )
        )
    return out


@router.get("/{run_id}/metrics", response_model=list[MetricOut])
def run_metrics(
    run_id: str,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> list[MetricOut]:
    run = db.get(Run, run_id)
    if not run or run.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Run not found")
    rows = db.execute(
        select(MetricScore)
        .join(RunResult, RunResult.id == MetricScore.run_result_id)
        .where(RunResult.run_id == run_id)
    ).scalars().all()
    return [
        MetricOut(
            metric=m.metric, score=m.score, threshold=m.threshold,
            hard_gate=m.hard_gate, passed=m.passed,
        )
        for m in rows
    ]
