"""MCP gateway — per-workspace MCP session manager.

Routes tool calls through MCP clients to the right connector server with the
workspace's scoped credentials injected. Sessions are cached per
(workspace, connector); expired tokens surface reconnect prompts, never
silent failures. No raw REST calls to GitHub/Jira in business logic.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Connection
from ..secrets.crypto import decrypt_secret
from .registry import ConnectorSpec, get_connector_spec

try:
    from mcp import ClientSession
    from mcp.client.http import http_client

    _MCP_AVAILABLE = True
except ImportError:  # pragma: no cover — local dev without mcp sdk
    _MCP_AVAILABLE = False
    ClientSession = Any  # type: ignore[assignment,misc]
    http_client = Any  # type: ignore[assignment,misc]


@dataclass
class WorkspaceConnection:
    """Decrypted, workspace-scoped connection ready for MCP injection."""

    connection_id: str
    conn_type: str
    secret: str
    scope_config: dict[str, Any]


class ConnectorError(RuntimeError):
    pass


class MCPSessionManager:
    """Holds live MCP sessions per (workspace_id, connector_type)."""

    def __init__(self) -> None:
        self._sessions: dict[tuple[str, str], Any] = {}
        self._status: dict[tuple[str, str], str] = {}

    def get_session(
        self, workspace_id: str, conn_type: str, db: Session | None = None
    ) -> Any:
        """Return a live session, spawning one if needed.

        Credentials are loaded from the workspace's stored Connection and
        injected into the MCP request (query token + Authorization header).
        """
        key = (workspace_id, conn_type)
        if key in self._sessions:
            return self._sessions[key]

        if not _MCP_AVAILABLE:
            raise ConnectorError("MCP SDK not installed")

        spec = get_connector_spec(conn_type)
        return self._connect(spec, workspace_id, db)

    def _load_connection(
        self, workspace_id: str, conn_type: str, db: Session | None
    ) -> WorkspaceConnection:
        if db is None:
            raise ConnectorError("DB session required to load connector credentials")
        conn = db.execute(
            select(Connection).where(
                Connection.workspace_id == workspace_id,
                Connection.type == conn_type,
            )
        ).scalars().first()
        if not conn:
            raise ConnectorError(
                f"No {conn_type} connection for workspace — connect it first"
            )
        return WorkspaceConnection(
            connection_id=conn.id,
            conn_type=conn.type,
            secret=decrypt_secret(conn.secret_ciphertext),
            scope_config=conn.scope_config,
        )

    def _connect(
        self, spec: ConnectorSpec, workspace_id: str, db: Session | None
    ) -> Any:
        key = (workspace_id, spec.type)
        try:
            wc = self._load_connection(workspace_id, spec.type, db)

            # Inject scoped credentials: GitHub MCP accepts a `token` query
            # param and/or an Authorization header. Build the request URL with
            # the token as a query param.
            from urllib.parse import urlencode, urlsplit, urlunsplit

            parts = urlsplit(spec.server_url)
            query = urlencode({"token": wc.secret})
            url = urlunsplit((parts.scheme, parts.netloc, parts.path, query, ""))

            ctx, session = http_client(url)  # type: ignore[attr-defined]
            self._sessions[key] = session
            self._status[key] = "connected"
            return session
        except ConnectorError:
            raise
        except Exception as exc:  # noqa: BLE001
            self._status[key] = "expired"
            raise ConnectorError(
                f"Connector {spec.type} unreachable — reconnect required"
            ) from exc

    def status(self, workspace_id: str, conn_type: str) -> str:
        return self._status.get((workspace_id, conn_type), "unknown")

    def close(self, workspace_id: str, conn_type: str) -> None:
        key = (workspace_id, conn_type)
        self._sessions.pop(key, None)
        self._status.pop(key, None)


# Module-level singleton — one manager per API process.
session_manager = MCPSessionManager()
