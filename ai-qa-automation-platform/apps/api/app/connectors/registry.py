"""MCP connector registry — adding a connector = config addition, not code.

Each entry describes how to reach the connector's MCP server (streamable
HTTP) and what workspace secrets it needs. The gateway spawns/connects to
servers per workspace with scoped credentials injected.

Server URLs are env-overridable so local dev can point at locally-run MCP
servers (e.g. `uvx mcp-server-github`) while Docker uses service names.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ConnectorSpec:
    type: str  # github|jira|database|slack|linear|...
    server_url: str  # MCP server endpoint (streamable HTTP)
    env_prefix: str  # env var prefix for injected secrets
    description: str
    requires_secret: bool = True
    defaults: dict[str, Any] = field(default_factory=dict)


def _env_or(name: str, default: str) -> str:
    return os.environ.get(name, default)


# Registry: new connectors (Slack, Linear, Confluence) = one entry + container.
# Server URLs read env vars so local dev can override:
#   MCP_GITHUB_URL=http://localhost:8765/mcp   (uvx mcp-server-github)
#   MCP_JIRA_URL=...
#   MCP_DB_URL=http://localhost:8766/mcp       (mcp-servers/db-server)
CONNECTOR_REGISTRY: dict[str, ConnectorSpec] = {
    "github": ConnectorSpec(
        type="github",
        server_url=_env_or("MCP_GITHUB_URL", "http://mcp-github:8000/mcp"),
        env_prefix="GITHUB_",
        description="Repo structure, source code, existing tests, PR diffs",
    ),
    "jira": ConnectorSpec(
        type="jira",
        server_url=_env_or("MCP_JIRA_URL", "http://mcp-jira:8000/mcp"),
        env_prefix="JIRA_",
        description="User stories, acceptance criteria, linked tickets",
    ),
    "database": ConnectorSpec(
        type="database",
        server_url=_env_or("MCP_DB_URL", "http://mcp-db:8000/mcp"),
        env_prefix="DB_",
        description="Schema + read-only query execution for assertions",
    ),
}


def get_connector_spec(conn_type: str) -> ConnectorSpec:
    try:
        return CONNECTOR_REGISTRY[conn_type]
    except KeyError as exc:
        raise KeyError(f"Unknown connector type: {conn_type}") from exc


def list_connectors() -> list[ConnectorSpec]:
    return list(CONNECTOR_REGISTRY.values())
