from typing import Any, Dict, Optional

class ResearchToolsError(Exception):
    """Base exception class for all application errors."""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)

class ConfigurationError(ResearchToolsError):
    """Raised when there is a configuration error."""
    pass

class DatabaseError(ResearchToolsError):
    """Raised when there is a database error."""
    pass

class ValidationError(ResearchToolsError):
    """Raised when there is a validation error."""
    pass

class AuthenticationError(ResearchToolsError):
    """Raised when there is an authentication error."""
    pass

class AuthorizationError(ResearchToolsError):
    """Raised when there is an authorization error."""
    pass

class ResourceNotFoundError(ResearchToolsError):
    """Raised when a requested resource is not found."""
    pass

class ExternalServiceError(ResearchToolsError):
    """Raised when there is an error with an external service."""
    pass

class RateLimitError(ResearchToolsError):
    """Raised when rate limit is exceeded."""
    pass

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
    "RateLimitError"
] 