"""
Application configuration using Pydantic settings.
Manages environment variables and application settings.
"""

import secrets
from typing import Any, Literal

from pydantic import (
    AnyHttpUrl,
    EmailStr,
    PostgresDsn,
    RedisDsn,
    computed_field,
    field_validator,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )
    
    # Project Information
    PROJECT_NAME: str = "OmniCore API"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Intelligence Analysis Platform API"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    BACKEND_CORS_ORIGINS: list[AnyHttpUrl] = []
    ALLOWED_HOSTS: list[str] = ["localhost", "127.0.0.1"]
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Database Configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "omnicore"
    POSTGRES_PASSWORD: str = "omnicore_dev"
    POSTGRES_DB: str = "omnicore"
    
    @computed_field  # type: ignore[misc]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Use SQLite for local development if PostgreSQL is not available
        if self.ENVIRONMENT == "development":
            return "sqlite+aiosqlite:///./omnicore.db"
        return str(MultiHostUrl.build(
            scheme="postgresql+asyncpg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        ))
    
    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    
    @computed_field  # type: ignore[misc]
    @property
    def REDIS_URL(self) -> RedisDsn:
        return MultiHostUrl.build(
            scheme="redis",
            username=None,
            password=self.REDIS_PASSWORD,
            host=self.REDIS_HOST,
            port=self.REDIS_PORT,
            path=str(self.REDIS_DB),
        )
    
    # AI Service Configuration (GPT-5 for Intelligence Analysis)
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5-mini"  # GPT-5 mini optimal for intel analysis
    OPENAI_MAX_TOKENS: int = 2000
    OPENAI_TEMPERATURE: float = 0.7
    
    # Local LLM Configuration (Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    USE_LOCAL_LLM: bool = False
    
    # File Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set[str] = {
        "pdf", "docx", "xlsx", "csv", "json", "txt", "md"
    }
    
    # External APIs
    WAYBACK_MACHINE_API_URL: str = "https://web.archive.org"
    
    # Social Media APIs (Optional)
    REDDIT_CLIENT_ID: str | None = None
    REDDIT_CLIENT_SECRET: str | None = None
    REDDIT_USER_AGENT: str = "OmniCore:1.0.0 (by /u/omnicore)"
    
    TWITTER_BEARER_TOKEN: str | None = None
    
    # Performance Settings
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Logging
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Email Configuration (for notifications)
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAILS_FROM_EMAIL: EmailStr | None = None
    EMAILS_FROM_NAME: str | None = None
    
    # Monitoring
    ENABLE_METRICS: bool = False
    METRICS_PORT: int = 9090
    
    # Testing
    TEST_DATABASE_URL: str | None = None


# Create global settings instance
settings = Settings()


def get_settings() -> Settings:
    """
    Dependency for FastAPI to get settings.
    
    Returns:
        Settings: Application settings instance
    """
    return settings