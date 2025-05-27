import logging
import sys
from pathlib import Path
from typing import Optional
from ..core.config import settings

def setup_logging(
    log_file: Optional[Path] = None,
    log_level: Optional[str] = None,
    log_format: Optional[str] = None
) -> logging.Logger:
    """
    Set up logging configuration for the application.
    
    Args:
        log_file: Optional path to log file. If None, logs to stdout.
        log_level: Optional log level. If None, uses settings.LOG_LEVEL.
        log_format: Optional log format string. If None, uses default format.
    
    Returns:
        logging.Logger: Configured logger instance.
    """
    # Use provided values or fall back to settings
    log_level = log_level or settings.LOG_LEVEL
    log_file = log_file or settings.LOG_FILE
    log_format = log_format or (
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Create logger
    logger = logging.getLogger("researchtools")
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Create formatter
    formatter = logging.Formatter(log_format)
    
    # Add handlers
    if log_file:
        # File handler
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger

# Create default logger instance
logger = setup_logging()

# Export logger for use in other modules
__all__ = ["logger", "setup_logging"] 