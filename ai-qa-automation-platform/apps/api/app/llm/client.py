"""Public LLM client — agents import this, never providers directly.

Delegates to the active provider from .env (LLM_PROVIDER). Adding a provider
= new module in providers/ + one registry entry; this API stays stable.
"""
from typing import Any

from .providers.registry import get_provider

_llm = get_provider()


def complete(
    prompt: str,
    system: str | None = None,
    *,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    json_mode: bool = False,
    tools: list[dict] | None = None,
    model: str | None = None,
) -> str:
    return _llm.complete(
        prompt,
        system,
        temperature=temperature,
        max_tokens=max_tokens,
        json_mode=json_mode,
        tools=tools,
        model=model,
    )


def complete_json(prompt: str, system: str | None = None, **kwargs: Any) -> dict:
    return _llm.complete_json(prompt, system, **kwargs)


def active_provider() -> str:
    return _llm.name
