from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "QA Copilot"
    debug: bool = True

    # Database — use custom prefix to avoid collision with DATABASE_URL env var
    db_url: str = "sqlite+aiosqlite:///./qacopilot.db"

    # LLM — set LLM_PROVIDER in .env: openrouter, anthropic, or openai
    llm_provider: str = "openrouter"
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.0-flash-001"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # ChromaDB
    chroma_persist_dir: str = "./chroma_data"

    # JIRA (configured per-project)
    # Zephyr/TestRail (configured per-project)




@lru_cache
def get_settings() -> Settings:
    return Settings()
