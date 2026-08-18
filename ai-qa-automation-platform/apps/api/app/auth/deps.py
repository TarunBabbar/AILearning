"""Auth deps: JWT verification + workspace scoping.

Every workspace-scoped endpoint depends on get_current_user and
get_current_workspace. The workspace id comes from a signed claim in the JWT
(issued by Auth.js in the web app) and is re-validated against
workspace_members on every request — no cross-tenant access.
"""
from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db.models import User, Workspace, WorkspaceMember
from ..db.session import get_db


class AuthContext:
    def __init__(self, user: User, workspace: Workspace, role: str):
        self.user = user
        self.workspace = workspace
        self.role = role

    @property
    def user_id(self) -> str:
        return self.user.id

    @property
    def workspace_id(self) -> str:
        return self.workspace.id


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc


def get_current_user(
    token: str, db: Session = Depends(get_db)
) -> User:
    payload = _decode(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing subject")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_workspace(
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthContext:
    """Resolve workspace from a signed `ws` claim in the JWT.

    The claim is re-validated against workspace_members on every request.
    """
    payload = _decode(token)
    ws_id = payload.get("ws")
    if not ws_id:
        raise HTTPException(status_code=401, detail="No workspace claim")

    membership = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == ws_id,
            WorkspaceMember.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )

    workspace = db.get(Workspace, ws_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return AuthContext(user=user, workspace=workspace, role=membership.role)
