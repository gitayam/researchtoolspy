"""
Framework analysis endpoints.
"""

import json
from datetime import datetime
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.framework import FrameworkSession, FrameworkStatus, FrameworkType
from app.models.user import User

logger = get_logger(__name__)
router = APIRouter()


class FrameworkSessionCreate(BaseModel):
    """Framework session creation request."""
    title: str
    description: str | None = None
    framework_type: FrameworkType
    data: dict | None = None


class FrameworkSessionResponse(BaseModel):
    """Framework session response."""
    id: int
    title: str
    description: str | None
    framework_type: FrameworkType
    status: FrameworkStatus
    data: dict
    version: int
    created_at: str
    updated_at: str
    user_id: int
    
    class Config:
        from_attributes = True


class FrameworkSessionUpdate(BaseModel):
    """Framework session update request."""
    title: str | None = None
    description: str | None = None
    status: FrameworkStatus | None = None
    data: dict | None = None


@router.get("/", response_model=list[FrameworkSessionResponse])
async def list_framework_sessions(
    framework_type: FrameworkType | None = None,
    status: FrameworkStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[FrameworkSessionResponse]:
    """
    List framework sessions for the current user.
    
    Args:
        framework_type: Filter by framework type
        status: Filter by status
        limit: Maximum number of sessions to return
        offset: Number of sessions to skip
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list[FrameworkSessionResponse]: List of framework sessions
    """
    logger.info(f"Listing framework sessions for user {current_user.username}")
    
    # Build query
    query = select(FrameworkSession).where(FrameworkSession.user_id == current_user.id)
    
    # Apply filters
    if framework_type:
        query = query.where(FrameworkSession.framework_type == framework_type)
    if status:
        query = query.where(FrameworkSession.status == status)
    
    # Order by updated_at (newest first)
    query = query.order_by(FrameworkSession.updated_at.desc())
    
    # Apply pagination
    query = query.offset(offset).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    # Convert to response format
    responses = []
    for session in sessions:
        # Parse JSON data safely
        try:
            data = json.loads(session.data) if session.data else {}
        except (json.JSONDecodeError, TypeError):
            data = {}
            
        responses.append(FrameworkSessionResponse(
            id=session.id,
            title=session.title,
            description=session.description,
            framework_type=session.framework_type,
            status=session.status,
            data=data,
            version=session.version,
            created_at=session.created_at.isoformat() + "Z",
            updated_at=session.updated_at.isoformat() + "Z",
            user_id=session.user_id,
        ))
    
    logger.info(f"Found {len(responses)} framework sessions for user {current_user.username}")
    return responses


@router.post("/", response_model=FrameworkSessionResponse)
async def create_framework_session(
    session_data: FrameworkSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FrameworkSessionResponse:
    """
    Create a new framework session.
    
    Args:
        session_data: Framework session data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        FrameworkSessionResponse: Created framework session
    """
    logger.info(f"Creating framework session: {session_data.title} ({session_data.framework_type})")
    
    # Check user permissions
    if not hasattr(current_user, 'can_create_frameworks') or not current_user.can_create_frameworks:
        # For now, allow all authenticated users to create frameworks
        pass
    
    # Create database session
    db_session = FrameworkSession(
        title=session_data.title,
        description=session_data.description,
        framework_type=session_data.framework_type,
        status=FrameworkStatus.DRAFT,
        user_id=current_user.id,
        data=json.dumps(session_data.data or {}),
        version=1,
    )
    
    # Save to database
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    
    logger.info(f"Created framework session {db_session.id} in database")
    
    # Convert to response format
    return FrameworkSessionResponse(
        id=db_session.id,
        title=db_session.title,
        description=db_session.description,
        framework_type=db_session.framework_type,
        status=db_session.status,
        data=json.loads(db_session.data) if db_session.data else {},
        version=db_session.version,
        created_at=db_session.created_at.isoformat() + "Z",
        updated_at=db_session.updated_at.isoformat() + "Z",
        user_id=db_session.user_id,
    )


@router.get("/{session_id}", response_model=FrameworkSessionResponse)
async def get_framework_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FrameworkSessionResponse:
    """
    Get a specific framework session.
    
    Args:
        session_id: Framework session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        FrameworkSessionResponse: Framework session data
        
    Raises:
        HTTPException: If session not found
    """
    logger.info(f"Getting framework session {session_id}")
    
    # Query database for session
    result = await db.execute(
        select(FrameworkSession).where(
            FrameworkSession.id == session_id,
            FrameworkSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        logger.warning(f"Framework session {session_id} not found for user {current_user.username}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Framework session not found"
        )
    
    logger.info(f"Found framework session {session_id}")
    
    # Convert to response format
    try:
        data = json.loads(session.data) if session.data else {}
    except (json.JSONDecodeError, TypeError):
        data = {}
        
    return FrameworkSessionResponse(
        id=session.id,
        title=session.title,
        description=session.description,
        framework_type=session.framework_type,
        status=session.status,
        data=data,
        version=session.version,
        created_at=session.created_at.isoformat() + "Z",
        updated_at=session.updated_at.isoformat() + "Z",
        user_id=session.user_id,
    )


@router.put("/{session_id}", response_model=FrameworkSessionResponse)
async def update_framework_session(
    session_id: int,
    update_data: FrameworkSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FrameworkSessionResponse:
    """
    Update a framework session.
    
    Args:
        session_id: Framework session ID
        update_data: Update data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        FrameworkSessionResponse: Updated framework session
        
    Raises:
        HTTPException: If session not found
    """
    logger.info(f"Updating framework session {session_id}")
    
    # Query database for session
    result = await db.execute(
        select(FrameworkSession).where(
            FrameworkSession.id == session_id,
            FrameworkSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        logger.warning(f"Framework session {session_id} not found for user {current_user.username}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Framework session not found"
        )
    
    # Update fields if provided
    if update_data.title is not None:
        session.title = update_data.title
    if update_data.description is not None:
        session.description = update_data.description
    if update_data.status is not None:
        session.status = update_data.status
    if update_data.data is not None:
        session.data = json.dumps(update_data.data)
    
    # Increment version and update timestamp
    session.version += 1
    session.updated_at = datetime.utcnow()
    
    # Save to database
    await db.commit()
    await db.refresh(session)
    
    logger.info(f"Updated framework session {session_id} in database")
    
    # Convert to response format
    try:
        data = json.loads(session.data) if session.data else {}
    except (json.JSONDecodeError, TypeError):
        data = {}
        
    return FrameworkSessionResponse(
        id=session.id,
        title=session.title,
        description=session.description,
        framework_type=session.framework_type,
        status=session.status,
        data=data,
        version=session.version,
        created_at=session.created_at.isoformat() + "Z",
        updated_at=session.updated_at.isoformat() + "Z",
        user_id=session.user_id,
    )


@router.delete("/{session_id}")
async def delete_framework_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """
    Delete a framework session.
    
    Args:
        session_id: Framework session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If session not found
    """
    logger.info(f"Deleting framework session {session_id}")
    
    # Query database for session
    result = await db.execute(
        select(FrameworkSession).where(
            FrameworkSession.id == session_id,
            FrameworkSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        logger.warning(f"Framework session {session_id} not found for user {current_user.username}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Framework session not found"
        )
    
    # Delete from database
    await db.delete(session)
    await db.commit()
    
    logger.info(f"Deleted framework session {session_id} from database")
    
    return {"message": "Framework session deleted successfully"}