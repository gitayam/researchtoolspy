"""
Main API router for v1 endpoints.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    ach,
    auth,
    cog,
    deception,
    dotmlpf,
    frameworks,
    health,
    pmesii_pt,
    swot,
    users,
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(frameworks.router, prefix="/frameworks", tags=["frameworks"])

# Analysis Framework Endpoints
api_router.include_router(swot.router, prefix="/frameworks/swot", tags=["swot-analysis"])
api_router.include_router(cog.router, prefix="/frameworks/cog", tags=["cog-analysis"])
api_router.include_router(pmesii_pt.router, prefix="/frameworks/pmesii-pt", tags=["pmesii-pt-analysis"])
api_router.include_router(ach.router, prefix="/frameworks/ach", tags=["ach-analysis"])
api_router.include_router(dotmlpf.router, prefix="/frameworks/dotmlpf", tags=["dotmlpf-analysis"])
api_router.include_router(deception.router, prefix="/frameworks/deception", tags=["deception-detection"])