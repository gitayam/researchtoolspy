"""
Main API router for v1 endpoints.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    ach,
    ai,
    auth,
    behavioral,
    causeway,
    cog,
    deception,
    dime,
    dotmlpf,
    frameworks,
    hash_auth,
    health,
    pmesii_pt,
    security,
    starbursting,
    swot,
    users,
)
from app.api.v1.endpoints.tools import (
    citations,
    document_processing,
    social_media,
    url_processing,
    web_scraping,
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(hash_auth.router, prefix="/hash-auth", tags=["hash-authentication"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(frameworks.router, prefix="/frameworks", tags=["frameworks"])
api_router.include_router(security.router, prefix="/security", tags=["security-assessment"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai-analysis"])

# Analysis Framework Endpoints
api_router.include_router(swot.router, prefix="/frameworks/swot", tags=["swot-analysis"])
api_router.include_router(cog.router, prefix="/frameworks/cog", tags=["cog-analysis"])
api_router.include_router(pmesii_pt.router, prefix="/frameworks/pmesii-pt", tags=["pmesii-pt-analysis"])
api_router.include_router(ach.router, prefix="/frameworks/ach", tags=["ach-analysis"])
api_router.include_router(dotmlpf.router, prefix="/frameworks/dotmlpf", tags=["dotmlpf-analysis"])
api_router.include_router(deception.router, prefix="/frameworks/deception", tags=["deception-detection"])
api_router.include_router(behavioral.router, prefix="/frameworks/behavioral", tags=["behavioral-analysis"])
api_router.include_router(starbursting.router, prefix="/frameworks/starbursting", tags=["starbursting-analysis"])
api_router.include_router(causeway.router, prefix="/frameworks/causeway", tags=["causeway-analysis"])
api_router.include_router(dime.router, prefix="/frameworks/dime", tags=["dime-analysis"])

# Research Tools Endpoints
api_router.include_router(url_processing.router, prefix="/tools/url", tags=["url-processing"])
api_router.include_router(citations.router, prefix="/tools/citations", tags=["citation-management"])
api_router.include_router(web_scraping.router, prefix="/tools/scraping", tags=["web-scraping"])
api_router.include_router(social_media.router, prefix="/tools/social-media", tags=["social-media"])
api_router.include_router(document_processing.router, prefix="/tools/documents", tags=["document-processing"])
