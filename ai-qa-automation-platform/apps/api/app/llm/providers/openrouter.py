"""OpenRouter provider — OpenAI-compatible SDK.

Config from .env:
    LLM_API_KEY=sk-or-...       (or OPENROUTER_API_KEY env)
    LLM_MODEL=openrouter/auto   (any OpenRouter model id)
    LLM_BASE_URL=               (optional override)
"""
import os
from typing import Any

from ...config import settings
from .base import LLMProvider


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

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
        from openai import OpenAI

        api_key = settings.llm_api_key or os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("LLM_API_KEY missing for openrouter provider")

        client = OpenAI(
            api_key=api_key,
            base_url=settings.llm_base_url or "https://openrouter.ai/api/v1",
        )
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        body: dict[str, Any] = {
            "model": model or settings.llm_model or "openrouter/auto",
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            body["max_tokens"] = max_tokens
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"

        resp = client.chat.completions.create(**body)
        if tools:
            msg = resp.choices[0].message
            if msg.tool_calls:
                return msg.tool_calls[0].function.arguments
        return resp.choices[0].message.content or ""
