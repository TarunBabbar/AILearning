"""Langfuse observability client — traces for agent steps + run executions."""
from __future__ import annotations

from typing import Any

from ..config import settings

try:
    from langfuse import Langfuse

    _LANGFUSE_AVAILABLE = True
except ImportError:  # pragma: no cover
    _LANGFUSE_AVAILABLE = False


class Tracer:
    """Thin Langfuse wrapper. No-op when not configured (local dev)."""

    def __init__(self) -> None:
        self._lf = None
        if (
            _LANGFUSE_AVAILABLE
            and settings.langfuse_public_key
            and settings.langfuse_secret_key
        ):
            self._lf = Langfuse(
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
                host=settings.langfuse_host,
            )

    @property
    def enabled(self) -> bool:
        return self._lf is not None

    def start_run_trace(self, workspace_id: str, run_id: str) -> Any:
        """Start a trace for a run. Returns a trace object (or None stub)."""
        if not self._lf:
            return None
        return self._lf.trace(
            name=f"run:{run_id}",
            user_id=workspace_id,
            session_id=run_id,
        )

    def log_agent_step(
        self,
        trace: Any,
        agent: str,
        prompt: str,
        output: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Log one agent step as a span under the run trace."""
        if not self._lf or trace is None:
            return
        trace.span(
            name=f"agent:{agent}",
            input=prompt[:4000],
            output=output,
            metadata=metadata or {},
        )

    def flush(self) -> None:
        if self._lf:
            self._lf.flush()


tracer = Tracer()
