"""
Logging configuration for the application.
"""

import logging
import sys
from pathlib import Path
from typing import Any

from app.core.config import settings


class ColoredFormatter(logging.Formatter):
    """
    Colored log formatter for console output.
    """
    
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record with colors.
        
        Args:
            record: Log record to format
            
        Returns:
            str: Formatted log message
        """
        if record.levelname in self.COLORS:
            record.levelname = (
                f"{self.COLORS[record.levelname]}"
                f"{record.levelname}"
                f"{self.RESET}"
            )
        return super().format(record)


def setup_logging() -> None:
    """
    Set up application logging configuration.
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL))
    console_formatter = ColoredFormatter(
        "%(asctime)s | %(name)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler for persistent logging
    if settings.ENVIRONMENT != "testing":
        file_handler = logging.FileHandler(
            logs_dir / "omnicore-api.log",
            mode="a",
            encoding="utf-8"
        )
        file_handler.setLevel(logging.INFO)
        file_formatter = logging.Formatter(
            "%(asctime)s | %(name)s | %(levelname)s | %(funcName)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
    
    # Configure specific loggers
    loggers_config = {
        "uvicorn": logging.INFO,
        "uvicorn.access": logging.WARNING,
        "sqlalchemy.engine": logging.WARNING if settings.ENVIRONMENT == "production" else logging.INFO,
        "httpx": logging.WARNING,
        "asyncio": logging.WARNING,
    }
    
    for logger_name, level in loggers_config.items():
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)
    
    # Log startup message
    logger = get_logger(__name__)
    logger.info(f"Logging configured - Level: {settings.LOG_LEVEL}, Environment: {settings.ENVIRONMENT}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for the given name.
    
    Args:
        name: Logger name (usually __name__)
        
    Returns:
        logging.Logger: Logger instance
    """
    return logging.getLogger(name)


class StructuredLogger:
    """
    Structured logger for consistent log formatting.
    """
    
    def __init__(self, name: str) -> None:
        self.logger = get_logger(name)
    
    def _log(self, level: str, message: str, **kwargs: Any) -> None:
        """
        Log message with structured data.
        
        Args:
            level: Log level
            message: Log message
            **kwargs: Additional structured data
        """
        extra_data = " | ".join([f"{k}={v}" for k, v in kwargs.items()])
        full_message = f"{message} | {extra_data}" if extra_data else message
        
        log_method = getattr(self.logger, level.lower())
        log_method(full_message)
    
    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message."""
        self._log("DEBUG", message, **kwargs)
    
    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message."""
        self._log("INFO", message, **kwargs)
    
    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message."""
        self._log("WARNING", message, **kwargs)
    
    def error(self, message: str, **kwargs: Any) -> None:
        """Log error message."""
        self._log("ERROR", message, **kwargs)
    
    def critical(self, message: str, **kwargs: Any) -> None:
        """Log critical message."""
        self._log("CRITICAL", message, **kwargs)