"""
User management endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import UserResponse, get_current_user
from app.core.database import get_db
from app.models.user import User

router = APIRouter()


@router.get("/profile", response_model=UserResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    Get current user's profile.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        UserResponse: User profile data
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=True,
        is_verified=True,
    )