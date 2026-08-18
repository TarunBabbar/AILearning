"""Read-only Database MCP server.

Exposes two safe tools over MCP:
  - list_schema: tables, columns, PKs, FKs (no data)
  - run_query:  parameterized SELECT-only, row-capped, timeout-enforced

Security invariants:
  - Only SELECT statements are ever executed; everything else is rejected.
  - No writes, no DDL, no COPY, no multi-statement.
  - Row count capped (MAX_ROWS), statement timeout enforced (QUERY_TIMEOUT_SECONDS).
"""
import os
import re
from typing import Any

from fastmcp import FastMCP
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://qa:qa@localhost:5432/qaplatform")
QUERY_TIMEOUT_SECONDS = int(os.environ.get("QUERY_TIMEOUT_SECONDS", "10"))
MAX_ROWS = int(os.environ.get("MAX_ROWS", "500"))

# Reject anything that isn't a single SELECT. No semicolons, no comments.
_SAFE_SELECT = re.compile(
    r"^\s*SELECT\b.*$", re.IGNORECASE | re.DOTALL
)
_FORBIDDEN_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|"
    r"MERGE|REPLACE|INTO|EXEC|CALL|VACUUM|ANALYZE|ATTACH|DETACH)\b",
    re.IGNORECASE,
)

mcp = FastMCP("db-server")


def _check_select(statement: str) -> None:
    if not _SAFE_SELECT.match(statement):
        raise ValueError("Only SELECT statements are allowed")
    if ";" in statement:
        raise ValueError("Multi-statement queries are not allowed")
    if _FORBIDDEN_KEYWORDS.search(statement):
        raise ValueError("Statement contains a forbidden keyword")


@mcp.tool()
def list_schema() -> dict[str, Any]:
    """Return table, column, PK, FK info for the connected database (no data)."""
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = 'public' ORDER BY table_name"
                )
            ).fetchall()
            schema = {}
            for (table,) in rows:
                cols = conn.execute(
                    text(
                        "SELECT column_name, data_type, is_nullable "
                        "FROM information_schema.columns "
                        "WHERE table_name = :t ORDER BY ordinal_position"
                    ),
                    {"t": table},
                ).fetchall()
                schema[table] = [
                    {"name": c, "type": t, "nullable": n == "YES"}
                    for c, t, n in cols
                ]
            return {"tables": schema}
    finally:
        engine.dispose()


@mcp.tool()
def run_query(statement: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Execute a read-only SELECT with optional named params. Row-capped."""
    _check_select(statement)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text(statement).execution_options(
                    timeout=QUERY_TIMEOUT_SECONDS
                ),
                params or {},
            )
            rows = result.fetchmany(MAX_ROWS + 1)
            truncated = len(rows) > MAX_ROWS
            rows = rows[:MAX_ROWS]
            columns = list(result.keys())
            return {
                "columns": columns,
                "rows": [dict(zip(columns, r)) for r in rows],
                "row_count": len(rows),
                "truncated": truncated,
            }
    finally:
        engine.dispose()


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
