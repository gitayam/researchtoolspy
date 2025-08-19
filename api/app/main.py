"""
OmniCore API - Intelligence Analysis Platform
FastAPI application entry point
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.logging import setup_logging


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
    # CORS configuration for development
    if settings.ENVIRONMENT == "development":
        # TEMPORARY: Using regex to allow all trycloudflare.com domains for demo
        # TODO: Re-enable specific origins after demo
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"https://.*\.trycloudflare\.com",  # Allow all cloudflare tunnels
            allow_credentials=True,  # Allow credentials
            allow_methods=["*"],
            allow_headers=["*"],
        )
        print("WARNING: CORS configured to allow ALL trycloudflare.com origins (demo mode)")
    elif settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Trusted host middleware (temporarily disabled for tunnel testing)
    # if settings.ALLOWED_HOSTS:
    #     app.add_middleware(
    #         TrustedHostMiddleware,
    #         allowed_hosts=settings.ALLOWED_HOSTS,
    #     )

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