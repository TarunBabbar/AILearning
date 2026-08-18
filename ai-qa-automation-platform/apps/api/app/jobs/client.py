"""Temporal client — connects to Temporal Cloud / local dev server."""
from __future__ import annotations

from temporalio.client import Client

from ..config import settings


async def get_temporal_client() -> Client:
    """Return a Temporal client. Local dev: localhost:7233."""
    return await Client.connect(settings.temporal_address)


def workflow_id(workspace_id: str, kind: str) -> str:
    """Tenant-scoped workflow id — prevents cross-workspace interference."""
    return f"{workspace_id}:{kind}:{uuid4_hex()}"


def uuid4_hex() -> str:
    import uuid

    return uuid.uuid4().hex[:12]
