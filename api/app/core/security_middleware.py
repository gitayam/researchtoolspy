"""
Security middleware for API hardening.
Implements rate limiting, security headers, and request validation.
"""

import time
from collections import defaultdict

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware implementing rate limiting and security headers.
    """

    def __init__(self, app, max_requests_per_minute: int = 60):
        super().__init__(app)
        self.max_requests_per_minute = max_requests_per_minute
        self.request_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.last_cleanup = time.time()

    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address from request.
        Handles X-Forwarded-For header for reverse proxy scenarios.
        """
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _cleanup_old_requests(self) -> None:
        """
        Clean up old request counts to prevent memory leaks.
        """
        current_time = time.time()
        if current_time - self.last_cleanup > 300:  # Cleanup every 5 minutes
            cutoff_time = current_time - 120  # Keep last 2 minutes
            for ip in list(self.request_counts.keys()):
                for timestamp in list(self.request_counts[ip].keys()):
                    if int(timestamp) < cutoff_time:
                        del self.request_counts[ip][timestamp]
                if not self.request_counts[ip]:
                    del self.request_counts[ip]
            self.last_cleanup = current_time

    def _is_rate_limited(self, client_ip: str) -> bool:
        """
        Check if client IP is rate limited.
        """
        if not settings.ENABLE_RATE_LIMITING:
            return False

        current_time = int(time.time())
        minute_window = current_time // 60

        # Count requests in current minute
        current_requests = 0
        for timestamp_window in range(minute_window - 1, minute_window + 1):
            current_requests += self.request_counts[client_ip].get(str(timestamp_window), 0)

        if current_requests >= self.max_requests_per_minute:
            logger.warning(f"Rate limit exceeded for IP {client_ip}: {current_requests} requests")
            return True

        # Increment counter for current minute
        self.request_counts[client_ip][str(minute_window)] += 1
        return False

    def _add_security_headers(self, response: Response) -> None:
        """
        Add security headers to response.
        """
        if not settings.ENABLE_SECURITY_HEADERS:
            return

        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none';",
        }

        # Add HSTS header for production HTTPS
        if settings.REQUIRE_HTTPS and settings.ENVIRONMENT == "production":
            security_headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        for header, value in security_headers.items():
            response.headers[header] = value

    def _validate_request_size(self, request: Request) -> bool:
        """
        Validate request size to prevent resource exhaustion.
        """
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                max_size = settings.MAX_UPLOAD_SIZE
                if size > max_size:
                    logger.warning(f"Request size too large: {size} bytes (max: {max_size})")
                    return False
            except ValueError:
                logger.warning("Invalid Content-Length header")
                return False
        return True

    def _validate_content_type(self, request: Request) -> bool:
        """
        Validate content type for security.
        """
        content_type = request.headers.get("content-type", "").lower()

        # Skip validation for GET requests and other methods without body
        if request.method in ["GET", "DELETE", "HEAD", "OPTIONS"]:
            return True

        # Allow common content types
        allowed_types = [
            "application/json",
            "application/x-www-form-urlencoded",
            "multipart/form-data",
            "text/plain",
        ]

        if not any(allowed_type in content_type for allowed_type in allowed_types):
            logger.warning(f"Suspicious content type: {content_type}")
            # Don't block, just log for now

        return True

    async def dispatch(self, request: Request, call_next):
        """
        Main middleware dispatch method.
        """
        start_time = time.time()
        client_ip = self._get_client_ip(request)

        # Cleanup old request counts
        self._cleanup_old_requests()

        # Validate request size
        if not self._validate_request_size(request):
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request entity too large"}
            )

        # Validate content type
        if not self._validate_content_type(request):
            # Log but don't block for now
            pass

        # Check rate limiting
        if self._is_rate_limited(client_ip):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )

        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"Request processing error: {str(e)}")
            raise

        # Add security headers
        self._add_security_headers(response)

        # Add rate limit headers
        if settings.ENABLE_RATE_LIMITING:
            response.headers["X-RateLimit-Limit"] = str(self.max_requests_per_minute)
            current_count = sum(
                self.request_counts[client_ip].values()
            )
            response.headers["X-RateLimit-Remaining"] = str(max(0, self.max_requests_per_minute - current_count))
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + 60)

        # Log request
        process_time = time.time() - start_time
        logger.info(
            f"{request.method} {request.url.path} - "
            f"IP: {client_ip} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.3f}s"
        )

        return response


def create_security_middleware(app, max_requests_per_minute: int = None):
    """
    Factory function to create security middleware with configuration.
    """
    if max_requests_per_minute is None:
        max_requests_per_minute = settings.MAX_REQUESTS_PER_MINUTE

    return SecurityMiddleware(app, max_requests_per_minute)
