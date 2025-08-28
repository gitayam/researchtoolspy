from typing import Any, Dict, Optional
from enum import Enum
import traceback
from datetime import datetime

class ErrorSeverity(Enum):
    """Error severity levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class ResearchToolsError(Exception):
    """Base exception class for all application errors."""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.severity = severity
        self.timestamp = datetime.utcnow()
        self.context = context or {}
        self.traceback = traceback.format_exc()
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging."""
        return {
            "message": self.message,
            "error_code": self.error_code,
            "details": self.details,
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat(),
            "context": self.context,
            "traceback": self.traceback
        }

class ConfigurationError(ResearchToolsError):
    """Raised when there is a configuration error."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "CONFIG_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class DatabaseError(ResearchToolsError):
    """Raised when there is a database error."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "DB_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class ValidationError(ResearchToolsError):
    """Raised when there is a validation error."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "VALIDATION_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class AuthenticationError(ResearchToolsError):
    """Raised when there is an authentication error."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "AUTH_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class AuthorizationError(ResearchToolsError):
    """Raised when there is an authorization error."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "AUTHZ_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class ResourceNotFoundError(ResearchToolsError):
    """Raised when a requested resource is not found."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "RESOURCE_NOT_FOUND",
            details=details,
            severity=severity,
            context=context
        )

class ExternalServiceError(ResearchToolsError):
    """Raised when there is an error with an external service."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "EXTERNAL_SERVICE_ERROR",
            details=details,
            severity=severity,
            context=context
        )

class RateLimitError(ResearchToolsError):
    """Raised when rate limits are exceeded."""
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: ErrorSeverity = ErrorSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code or "RATE_LIMIT_ERROR",
            details=details,
            severity=severity,
            context=context
        )

# Export for use in other modules
__all__ = [
    "ResearchToolsError",
    "ConfigurationError",
    "DatabaseError",
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "ResourceNotFoundError",
    "ExternalServiceError",
    "RateLimitError",
    "ErrorSeverity"
] 