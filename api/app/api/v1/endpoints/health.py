"""
Health check endpoints for monitoring.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, db_manager
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/")
async def health_check() -> dict[str, str]:
    """
    Basic health check endpoint.
    
    Returns:
        dict: Health status
    """
    return {"status": "healthy", "service": "omnicore-api"}


@router.get("/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_db)
) -> dict[str, str | bool]:
    """
    Detailed health check including database connectivity.
    
    Args:
        db: Database session
        
    Returns:
        dict: Detailed health status
    """
    try:
        # Check database connectivity
        db_healthy = await db_manager.health_check()
        
        return {
            "status": "healthy" if db_healthy else "unhealthy",
            "database": db_healthy,
            "service": "omnicore-api",
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": False,
            "service": "omnicore-api",
            "error": str(e),
        }