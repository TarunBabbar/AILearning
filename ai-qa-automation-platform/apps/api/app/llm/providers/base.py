"""LLMProvider interface — every provider implements this contract."""
from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """A swappable LLM backend. Providers read their own config from .env."""

    name: str = "base"

    @abstractmethod
    def complete(
        self,
        prompt: str,
        system: str | None = None,
        *,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        json_mode: bool = False,
        tools: list[dict] | None = None,
        model: str | None = None,
    ) -> str:
        """Single completion. Returns text (JSON string when json_mode)."""

    def complete_json(self, prompt: str, system: str | None = None, **kwargs: Any) -> dict:
        """Structured completion — guarantees a parsed JSON object."""
        from ..util import parse_json

        raw = self.complete(prompt, system, json_mode=True, **kwargs)
        return parse_json(raw)
