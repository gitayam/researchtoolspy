"""
Main API router for v1 endpoints.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, cog, frameworks, health, swot, users

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(frameworks.router, prefix="/frameworks", tags=["frameworks"])

# Analysis Framework Endpoints
api_router.include_router(swot.router, prefix="/frameworks/swot", tags=["swot-analysis"])
api_router.include_router(cog.router, prefix="/frameworks/cog", tags=["cog-analysis"])