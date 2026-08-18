"""Connections router: connect/disconnect GitHub, Jira, Database.

Secrets are encrypted (KMS envelope) before storage — never returned by the
API, never logged. Status surfaces connect/expired states.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...auth.deps import AuthContext, get_current_workspace
from ...connectors.gateway import ConnectorError, session_manager
from ...db.models import Connection
from ...db.session import get_db
from ...secrets.crypto import encrypt_secret

router = APIRouter(prefix="/connections", tags=["connections"])


class ConnectRequest(BaseModel):
    type: str  # github|jira|database
    secret: str  # token / connection string — encrypted before storage
    scope_config: dict = {}


class ConnectionOut(BaseModel):
    id: str
    type: str
    status: str
    scope_config: dict
    expires_at: str | None = None


@router.get("", response_model=list[ConnectionOut])
def list_connections(
    ctx: AuthContext = Depends(get_current_workspace), db: Session = Depends(get_db)
) -> list[ConnectionOut]:
    rows = db.execute(
        select(Connection).where(Connection.workspace_id == ctx.workspace_id)
    ).scalars().all()
    return [
        ConnectionOut(
            id=c.id,
            type=c.type,
            status=c.status,
            scope_config=c.scope_config,
            expires_at=c.expires_at.isoformat() if c.expires_at else None,
        )
        for c in rows
    ]


@router.post("", response_model=ConnectionOut)
def create_connection(
    body: ConnectRequest,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> ConnectionOut:
    if body.type not in {"github", "jira", "database"}:
        raise HTTPException(status_code=400, detail="Unsupported connector type")
    ciphertext = encrypt_secret(body.secret)
    conn = Connection(
        workspace_id=ctx.workspace_id,
        type=body.type,
        status="connected",
        secret_ciphertext=ciphertext,
        scope_config=body.scope_config,
    )
    db.add(conn)
    db.commit()
    return ConnectionOut(
        id=conn.id, type=conn.type, status=conn.status, scope_config=conn.scope_config
    )


@router.delete("/{connection_id}")
def delete_connection(
    connection_id: str,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    conn = db.get(Connection, connection_id)
    if not conn or conn.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    session_manager.close(ctx.workspace_id, conn.type)
    return {"ok": True}


@router.post("/{connection_id}/test")
def test_connection(
    connection_id: str,
    ctx: AuthContext = Depends(get_current_workspace),
    db: Session = Depends(get_db),
) -> dict:
    """Exercise the MCP connection with the stored token.

    Establishes a session against the connector's MCP server and reports
    reachability. This surfaces expired tokens / unreachable servers instead
    of silently failing later.
    """
    conn = db.get(Connection, connection_id)
    if not conn or conn.workspace_id != ctx.workspace_id:
        raise HTTPException(status_code=404, detail="Connection not found")
    try:
        session_manager.get_session(ctx.workspace_id, conn.type, db)
    except ConnectorError as exc:
        return {"ok": False, "status": "expired", "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": "error", "error": str(exc)}
    return {"ok": True, "status": "connected"}
