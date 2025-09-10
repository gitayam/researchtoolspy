"""
OmniCore API - Intelligence Analysis Platform
FastAPI application entry point
"""

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.logging import setup_logging
from app.core.security_middleware import SecurityMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.
    Manages startup and shutdown events.
    """
    # Startup
    setup_logging()
    await init_db()

    yield

    # Shutdown
    # Add cleanup tasks here if needed
    pass


def create_application() -> FastAPI:
    """
    Create and configure FastAPI application.
    
    Returns:
        FastAPI: Configured application instance
    """
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="Modern REST API for OmniCore intelligence analysis platform",
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENVIRONMENT != "production" else None,
        docs_url=f"{settings.API_V1_STR}/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url=f"{settings.API_V1_STR}/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Security middleware
    # CORS configuration - secure by default
    allowed_origins = []

    if settings.ENVIRONMENT == "development":
        # Development origins - localhost only
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3003",
            "http://localhost:3380",
            "http://localhost:6780",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3003",
            "http://127.0.0.1:3380",
            "http://127.0.0.1:6780",
        ]

        # Add cloudflare tunnel only if explicitly enabled via environment
        cloudflare_origin = os.getenv("CLOUDFLARE_TUNNEL_URL")
        if cloudflare_origin and cloudflare_origin.startswith("https://"):
            allowed_origins.append(cloudflare_origin)
            print(f"WARNING: Adding cloudflare tunnel to CORS: {cloudflare_origin}")

    # Add configured CORS origins
    if settings.BACKEND_CORS_ORIGINS:
        allowed_origins.extend([str(origin) for origin in settings.BACKEND_CORS_ORIGINS])

    if allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Specific methods only
            allow_headers=["Authorization", "Content-Type", "Accept"],  # Specific headers only
        )
        print(f"CORS configured for origins: {allowed_origins}")

    # Trusted host middleware - re-enabled for security
    allowed_hosts = settings.ALLOWED_HOSTS.split(",") if settings.ALLOWED_HOSTS else ["*"]

    # Add cloudflare tunnel host if configured
    cloudflare_host = os.getenv("CLOUDFLARE_TUNNEL_HOST")
    if cloudflare_host and settings.ENVIRONMENT == "development":
        allowed_hosts.append(cloudflare_host)
        print(f"WARNING: Adding cloudflare tunnel host: {cloudflare_host}")

    # In production, never allow wildcard hosts
    if settings.ENVIRONMENT == "production" and "*" in allowed_hosts:
        allowed_hosts = ["localhost", "127.0.0.1"]  # Safe defaults
        print("WARNING: Wildcard hosts not allowed in production, using safe defaults")

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts,
    )

    # Add security middleware for rate limiting and security headers
    app.add_middleware(
        SecurityMiddleware,
        max_requests_per_minute=settings.MAX_REQUESTS_PER_MINUTE
    )

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


# Create application instance
app = create_application()


@app.get("/")
async def root() -> dict[str, str]:
    """
    Root endpoint - health check.
    
    Returns:
        dict: Application status and version
    """
    return {
        "message": "OmniCore API is running",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """
    Health check endpoint for monitoring.
    
    Returns:
        dict: Health status
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_config=None,  # Use our custom logging config
    )
