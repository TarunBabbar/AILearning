from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "QA Copilot"
    debug: bool = True

    # Database — use custom prefix to avoid collision with DATABASE_URL env var
    db_url: str = "sqlite+aiosqlite:///./qacopilot.db"

    # AI
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    llm_provider: str = "anthropic"
    llm_model: str = "claude-sonnet-4-20250514"

    # ChromaDB
    chroma_persist_dir: str = "./chroma_data"

    # JIRA (configured per-project)
    # Zephyr/TestRail (configured per-project)




@lru_cache
def get_settings() -> Settings:
    return Settings()
