from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    model_name: str = "gpt-4o-mini"
    tavily_api_key: str = ""
    mock_mode: bool = False

    # Clerk — required in production; backend uses this to verify frontend JWTs
    clerk_jwks_url: str = ""

    # Sentry — optional; leave empty to disable
    sentry_dsn: str = ""

    @property
    def effective_mock_mode(self) -> bool:
        return self.mock_mode or not self.openai_api_key.strip()

    cors_origins: str = "*"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        "protected_namespaces": ("settings_",),
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
