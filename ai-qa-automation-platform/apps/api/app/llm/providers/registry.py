"""LLM provider registry — scalable by design.

Adding a provider (deepseek, anthropic, ollama, together, ...) = one new
module in this package + one line here. The active provider is chosen from
.env: LLM_PROVIDER=<name>. No other code changes.
"""
from typing import Type

from ...config import settings
from .base import LLMProvider
from .command_code import CommandCodeProvider
from .openrouter import OpenRouterProvider

PROVIDER_REGISTRY: dict[str, Type[LLMProvider]] = {
    "openrouter": OpenRouterProvider,
    "command-code": CommandCodeProvider,
}


def get_provider() -> LLMProvider:
    """Instantiate the active provider (defaults to command-code if unset)."""
    name = settings.llm_provider or "command-code"
    cls = PROVIDER_REGISTRY.get(name)
    if not cls:
        raise RuntimeError(
            f"Unknown LLM_PROVIDER: {name!r}. Registered: {sorted(PROVIDER_REGISTRY)}"
        )
    return cls()


def list_providers() -> list[str]:
    return sorted(PROVIDER_REGISTRY)
