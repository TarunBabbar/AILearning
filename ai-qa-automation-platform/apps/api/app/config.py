"""Application settings — env-driven via pydantic-settings.

Reads from apps/api/.env (path resolved from this file, cwd-independent).
Environment variables take precedence over the .env file.
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(API_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = "local"
    database_url: str = "postgresql+psycopg2://qa:qa@localhost:5432/qaplatform"
    redis_url: str = "redis://localhost:6379/0"

    # JWT auth — set JWT_SECRET in apps/api/.env (never commit real values)
    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    jwt_expires_minutes: int = 480

    auth0_domain: str = ""
    auth0_audience: str = ""

    # LLM provider — switch providers by editing these, no code change.
    # command-code|openrouter
    llm_provider: str = "openrouter"
    llm_model: str = ""  # openrouter: model id like "openrouter/auto"; command-code: cmdc model id
    llm_api_key: str = ""  # openrouter key (not needed for command-code)
    llm_base_url: str = ""  # optional override, defaults to OpenRouter
    # command-code binary override (default: "cmdc" from PATH)
    cmdcode_bin: str = ""

    temporal_address: str = "localhost:7233"

    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    aws_region: str = "us-east-1"
    kms_key_id: str = ""
    s3_bucket: str = ""

    @property
    def jwt_algorithm(self) -> str:
        return self.jwt_alg


settings = Settings()
