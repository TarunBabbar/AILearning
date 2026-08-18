"""Auth router: JWT issue + exchange.

The web app (Auth.js) authenticates the user and mints a JWT signed with the
shared JWT_SECRET (see app/config.py). The api trusts that signature.
"""
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import get_current_user
from ...config import settings
from ...db.models import User, Workspace, WorkspaceMember
from ...db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    name: str | None = None
    picture: str | None = None
    provider: str = "credentials"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    workspace_id: str
    role: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Create-or-fetch user + default workspace, return a JWT."""
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user:
        user = User(
            email=body.email, name=body.name, picture=body.picture, provider=body.provider
        )
        db.add(user)
        db.flush()
        ws = Workspace(name=f"{user.name or user.email}'s workspace")
        db.add(ws)
        db.flush()
        db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner"))
        db.commit()

    membership = (
        db.execute(select(WorkspaceMember).where(WorkspaceMember.user_id == user.id))
        .scalars()
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="No workspace for user")

    token = jwt.encode(
        {
            "sub": user.id,
            "email": user.email,
            "ws": membership.workspace_id,
            "role": membership.role,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_alg,
    )
    return TokenResponse(
        access_token=token,
        workspace_id=membership.workspace_id,
        role=membership.role,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name}
