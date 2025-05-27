from typing import Optional
from pydantic import BaseSettings, Field
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
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # Database settings
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    DATABASE_POOL_SIZE: int = Field(default=5, env="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, env="DATABASE_MAX_OVERFLOW")
    
    # API settings
    API_KEY: Optional[str] = Field(None, env="API_KEY")
    API_RATE_LIMIT: int = Field(default=100, env="API_RATE_LIMIT")
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FILE: Optional[Path] = Field(None, env="LOG_FILE")
    
    # Security settings
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALLOWED_HOSTS: list[str] = Field(default=["*"], env="ALLOWED_HOSTS")
    
    # File storage settings
    UPLOAD_DIR: Path = Field(default=Path("uploads"), env="UPLOAD_DIR")
    MAX_UPLOAD_SIZE: int = Field(default=10 * 1024 * 1024, env="MAX_UPLOAD_SIZE")  # 10MB
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._validate_settings()
    
    def _validate_settings(self):
        """Validate settings after initialization."""
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

# Create global settings instance
settings = Settings()

# Export settings for use in other modules
__all__ = ["settings"] 