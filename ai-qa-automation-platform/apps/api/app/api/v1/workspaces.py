"""Workspace router: list, create, settings."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace, get_current_user
from ...db.models import User, Workspace, WorkspaceMember, WorkspaceSettings
from ...db.session import get_db

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceOut(BaseModel):
    id: str
    name: str
    role: str


class CreateWorkspace(BaseModel):
    name: str


class SettingsOut(BaseModel):
    thresholds: dict
    risk_tiers: dict
    gate_policy: dict


class SettingsUpdate(BaseModel):
    thresholds: dict | None = None
    risk_tiers: dict | None = None
    gate_policy: dict | None = None


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WorkspaceOut]:
    rows = db.execute(
        select(WorkspaceMember, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .where(WorkspaceMember.user_id == user.id)
    ).all()
    return [
        WorkspaceOut(id=ws.id, name=ws.name, role=member.role)
        for member, ws in rows
    ]


@router.post("", response_model=WorkspaceOut)
def create_workspace(
    body: CreateWorkspace,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceOut:
    ws = Workspace(name=body.name)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner"))
    db.add(WorkspaceSettings(workspace_id=ws.id))
    db.commit()
    return WorkspaceOut(id=ws.id, name=ws.name, role="owner")


@router.get("/{workspace_id}/settings", response_model=SettingsOut)
def get_settings(
    workspace_id: str,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> SettingsOut:
    if ctx.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Cross-workspace access denied")
    settings_row = db.get(WorkspaceSettings, workspace_id)
    if not settings_row:
        settings_row = WorkspaceSettings(workspace_id=workspace_id)
        db.add(settings_row)
        db.commit()
    return SettingsOut(
        thresholds=settings_row.thresholds,
        risk_tiers=settings_row.risk_tiers,
        gate_policy=settings_row.gate_policy,
    )


@router.put("/{workspace_id}/settings", response_model=SettingsOut)
def update_settings(
    workspace_id: str,
    body: SettingsUpdate,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> SettingsOut:
    if ctx.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Cross-workspace access denied")
    settings_row = db.get(WorkspaceSettings, workspace_id)
    if not settings_row:
        settings_row = WorkspaceSettings(workspace_id=workspace_id)
        db.add(settings_row)
    if body.thresholds is not None:
        settings_row.thresholds = body.thresholds
    if body.risk_tiers is not None:
        settings_row.risk_tiers = body.risk_tiers
    if body.gate_policy is not None:
        settings_row.gate_policy = body.gate_policy
    db.commit()
    return SettingsOut(
        thresholds=settings_row.thresholds,
        risk_tiers=settings_row.risk_tiers,
        gate_policy=settings_row.gate_policy,
    )
