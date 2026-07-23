"""Multi-provider LLM client — OpenRouter, Anthropic, or OpenAI.
Controlled by LLM_PROVIDER in .env."""
import httpx
from app.config import get_settings

settings = get_settings()

PROVIDER_HANDLERS = {
    "openrouter": ("openrouter_api_key", "openrouter_model", "_openrouter_complete"),
    "anthropic": ("anthropic_api_key", "anthropic_model", "_anthropic_complete"),
    "openai": ("openai_api_key", "openai_model", "_openai_complete"),
}


def is_llm_available() -> bool:
    handler = PROVIDER_HANDLERS.get(settings.llm_provider)
    if not handler:
        return False
    key_attr = handler[0]
    return bool(getattr(settings, key_attr, ""))


def get_active_provider() -> str:
    if is_llm_available():
        return settings.llm_provider
    # Fall back to any available
    for provider, (key_attr, _, _) in PROVIDER_HANDLERS.items():
        if getattr(settings, key_attr, ""):
            return provider
    return ""


async def llm_complete(system_prompt: str, user_message: str, max_tokens: int = 2000) -> str:
    provider = get_active_provider()
    if not provider:
        raise RuntimeError(
            "No LLM provider configured. Set LLM_PROVIDER + API key for openrouter, anthropic, or openai."
        )

    _, _, handler_name = PROVIDER_HANDLERS[provider]
    handler = globals()[handler_name]
    return await handler(system_prompt, user_message, max_tokens)


async def _openrouter_complete(system: str, user: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "QA Copilot",
            },
            json={
                "model": settings.openrouter_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _anthropic_complete(system: str, user: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.anthropic_model,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


async def _openai_complete(system: str, user: str, max_tokens: int) -> str:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
