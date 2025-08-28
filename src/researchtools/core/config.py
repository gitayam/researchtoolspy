from typing import Optional, Dict, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    """Application settings with validation."""
    
    # Application settings
    APP_NAME: str = "Research Tools"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=False, json_schema_extra={"env": "DEBUG"})
    ENVIRONMENT: str = Field(default="development", json_schema_extra={"env": "ENVIRONMENT"})
    
    # Database settings
    DATABASE_URL: str = Field(default="sqlite:///./test.db", json_schema_extra={"env": "DATABASE_URL"})
    DATABASE_POOL_SIZE: int = Field(default=5, json_schema_extra={"env": "DATABASE_POOL_SIZE"})
    DATABASE_MAX_OVERFLOW: int = Field(default=10, json_schema_extra={"env": "DATABASE_MAX_OVERFLOW"})
    DATABASE_POOL_TIMEOUT: int = Field(default=30, json_schema_extra={"env": "DATABASE_POOL_TIMEOUT"})
    DATABASE_POOL_RECYCLE: int = Field(default=3600, json_schema_extra={"env": "DATABASE_POOL_RECYCLE"})
    
    # API settings
    API_KEY: Optional[str] = Field(None, json_schema_extra={"env": "API_KEY"})
    API_RATE_LIMIT: int = Field(default=100, json_schema_extra={"env": "API_RATE_LIMIT"})
    API_RATE_LIMIT_WINDOW: int = Field(default=60, json_schema_extra={"env": "API_RATE_LIMIT_WINDOW"})
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO", json_schema_extra={"env": "LOG_LEVEL"})
    LOG_FILE: Optional[Path] = Field(None, json_schema_extra={"env": "LOG_FILE"})
    LOG_FORMAT: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        json_schema_extra={"env": "LOG_FORMAT"}
    )
    LOG_ROTATION: bool = Field(default=True, json_schema_extra={"env": "LOG_ROTATION"})
    LOG_MAX_SIZE: int = Field(default=10 * 1024 * 1024, json_schema_extra={"env": "LOG_MAX_SIZE"})  # 10MB
    LOG_BACKUP_COUNT: int = Field(default=5, json_schema_extra={"env": "LOG_BACKUP_COUNT"})
    
    # Security settings
    SECRET_KEY: str = Field(default="test_secret", json_schema_extra={"env": "SECRET_KEY"})
    ALLOWED_HOSTS: list[str] = Field(default=["*"], json_schema_extra={"env": "ALLOWED_HOSTS"})
    CORS_ORIGINS: list[str] = Field(default=["*"], json_schema_extra={"env": "CORS_ORIGINS"})
    SSL_VERIFY: bool = Field(default=True, json_schema_extra={"env": "SSL_VERIFY"})
    
    # File storage settings
    UPLOAD_DIR: Path = Field(default=Path("uploads"), json_schema_extra={"env": "UPLOAD_DIR"})
    MAX_UPLOAD_SIZE: int = Field(default=10 * 1024 * 1024, json_schema_extra={"env": "MAX_UPLOAD_SIZE"})  # 10MB
    ALLOWED_EXTENSIONS: list[str] = Field(
        default=["txt", "pdf", "png", "jpg", "jpeg", "gif"],
        json_schema_extra={"env": "ALLOWED_EXTENSIONS"}
    )
    
    # Cache settings
    CACHE_ENABLED: bool = Field(default=True, json_schema_extra={"env": "CACHE_ENABLED"})
    CACHE_TYPE: str = Field(default="memory", json_schema_extra={"env": "CACHE_TYPE"})
    CACHE_TIMEOUT: int = Field(default=300, json_schema_extra={"env": "CACHE_TIMEOUT"})  # 5 minutes
    REDIS_URL: Optional[str] = Field(None, json_schema_extra={"env": "REDIS_URL"})
    
    # Monitoring settings
    ENABLE_METRICS: bool = Field(default=False, json_schema_extra={"env": "ENABLE_METRICS"})
    METRICS_PORT: int = Field(default=9090, json_schema_extra={"env": "METRICS_PORT"})
    ENABLE_TRACING: bool = Field(default=False, json_schema_extra={"env": "ENABLE_TRACING"})
    TRACING_SERVICE: Optional[str] = Field(None, json_schema_extra={"env": "TRACING_SERVICE"})
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="allow")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_settings()
    
    def _validate_settings(self):
        """Validate settings after initialization."""
        # Set log level based on debug mode
        if self.DEBUG:
            self.LOG_LEVEL = "DEBUG"
        
        # Ensure upload directory exists
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # Validate database URL
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL must be set")
        
        # Validate secret key
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set")
        
        # Validate environment-specific settings
        if self.ENVIRONMENT == "production":
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            if not self.SECRET_KEY or self.SECRET_KEY == "test_secret":
                raise ValueError("SECRET_KEY must be set in production")
            if self.ALLOWED_HOSTS == ["*"]:
                raise ValueError("ALLOWED_HOSTS must be explicitly set in production")
    
    @validator("LOG_LEVEL")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(f"LOG_LEVEL must be one of {valid_levels}")
        return v.upper()
    
    @validator("ENVIRONMENT")
    def validate_environment(cls, v):
        """Validate environment."""
        valid_environments = {"development", "testing", "staging", "production"}
        if v.lower() not in valid_environments:
            raise ValueError(f"ENVIRONMENT must be one of {valid_environments}")
        return v.lower()
    
    @validator("CACHE_TYPE")
    def validate_cache_type(cls, v):
        """Validate cache type."""
        valid_types = {"memory", "redis", "file"}
        if v.lower() not in valid_types:
            raise ValueError(f"CACHE_TYPE must be one of {valid_types}")
        return v.lower()
    
    def get_cache_config(self) -> Dict[str, Any]:
        """Get cache configuration based on settings."""
        config = {
            "enabled": self.CACHE_ENABLED,
            "type": self.CACHE_TYPE,
            "timeout": self.CACHE_TIMEOUT
        }
        
        if self.CACHE_TYPE == "redis" and self.REDIS_URL:
            config["redis_url"] = self.REDIS_URL
        
        return config
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration based on settings."""
        return {
            "level": self.LOG_LEVEL,
            "format": self.LOG_FORMAT,
            "file": str(self.LOG_FILE) if self.LOG_FILE else None,
            "rotation": self.LOG_ROTATION,
            "max_size": self.LOG_MAX_SIZE,
            "backup_count": self.LOG_BACKUP_COUNT
        }

# Create global settings instance
settings = Settings()

# Export settings for use in other modules
__all__ = ["settings"] 