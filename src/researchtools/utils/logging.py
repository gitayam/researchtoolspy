import logging
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import structlog
from ..core.config import settings
from ..core.exceptions import ResearchToolsError, ErrorSeverity

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Create logger
logger = structlog.get_logger()

class StructuredLogger:
    """Enhanced logger with structured logging capabilities."""
    
    def __init__(self, name: str):
        self.logger = structlog.get_logger(name)
        self._setup_file_handler()
    
    def _setup_file_handler(self):
        """Setup file handler for logging."""
        if settings.LOG_FILE:
            log_path = Path(settings.LOG_FILE)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_handler = logging.FileHandler(log_path)
            file_handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            ))
            
            root_logger = logging.getLogger()
            root_logger.addHandler(file_handler)
    
    def _log_with_context(
        self,
        level: str,
        message: str,
        error: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        """Log message with context and error information."""
        log_data = {
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            **(context or {}),
            **kwargs
        }
        
        if error:
            if isinstance(error, ResearchToolsError):
                log_data.update(error.to_dict())
            else:
                log_data.update({
                    "error_type": error.__class__.__name__,
                    "error_message": str(error),
                    "traceback": getattr(error, "traceback", None)
                })
        
        getattr(self.logger, level.lower())(**log_data)
    
    def debug(self, message: str, **kwargs):
        """Log debug message."""
        self._log_with_context("debug", message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message."""
        self._log_with_context("info", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self._log_with_context("warning", message, **kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error message."""
        self._log_with_context("error", message, error=error, **kwargs)
    
    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log critical message."""
        self._log_with_context("critical", message, error=error, **kwargs)
    
    def log_operation(
        self,
        operation: str,
        status: str,
        details: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ):
        """Log operation with status and details."""
        self._log_with_context(
            "info" if status == "success" else "error",
            f"Operation {operation} {status}",
            error=error,
            operation=operation,
            status=status,
            **(details or {})
        )

# Create default logger instance
default_logger = StructuredLogger("researchtools")

# Export for use in other modules
__all__ = ["logger", "StructuredLogger", "default_logger"] 