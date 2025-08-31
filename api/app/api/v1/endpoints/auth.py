"""
Authentication endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import (
    Token,
    TokenData,
    create_token_pair,
    get_password_hash,
    verify_password,
    verify_token,
)
from app.models.user import User, UserRole

logger = get_logger(__name__)
router = APIRouter()

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


class UserCreate(BaseModel):
    """User creation request model."""
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.RESEARCHER
    organization: Optional[str] = None
    department: Optional[str] = None


class UserResponse(BaseModel):
    """User response model."""
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    organization: Optional[str] = None
    department: Optional[str] = None
    
    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Login response model."""
    user: UserResponse
    tokens: Token


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current user from JWT token.
    
    Args:
        token: JWT access token
        db: Database session
        
    Returns:
        User: Current user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = verify_token(token, "access")
    if token_data is None:
        raise credentials_exception
    
    # Get user from database
    from sqlalchemy import select
    
    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise credentials_exception
    
    return user


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    Register a new user.
    
    Args:
        user_data: User registration data
        db: Database session
        
    Returns:
        UserResponse: Created user data
        
    Raises:
        HTTPException: If username or email already exists
    """
    # TODO: Implement actual user creation with database
    # For now, return mock response
    logger.info(f"User registration attempt: {user_data.username}")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create mock user response
    user_response = UserResponse(
        id=1,
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=True,
        is_verified=False,
        organization=user_data.organization,
        department=user_data.department,
    )
    
    return user_response


@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> LoginResponse:
    """
    Login user and return access tokens.
    
    Args:
        form_data: Login form data
        db: Database session
        
    Returns:
        LoginResponse: User data and tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    from sqlalchemy import select
    from app.core.config import settings
    
    logger.info(f"Login attempt: {form_data.username}")
    
    # Check if mock auth is enabled (development only)
    if settings.ENABLE_MOCK_AUTH and settings.ENVIRONMENT == "development":
        # Mock authentication - accept "admin/admin" or "test/test" 
        if (form_data.username == "admin" and form_data.password == "admin") or \
           (form_data.username == "test" and form_data.password == "test"):
            user = UserResponse(
                id=1 if form_data.username == "admin" else 2,
                username=form_data.username,
                email=f"{form_data.username}@example.com",
                full_name=f"{form_data.username.title()} User",
                role=UserRole.ADMIN if form_data.username == "admin" else UserRole.RESEARCHER,
                is_active=True,
                is_verified=True,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        # Actual database authentication
        result = await db.execute(
            select(User).where(User.username == form_data.username)
        )
        db_user = result.scalar_one_or_none()
        
        if db_user is None or not verify_password(form_data.password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is deactivated"
            )
        
        user = UserResponse(
            id=db_user.id,
            username=db_user.username,
            email=db_user.email,
            full_name=db_user.full_name,
            role=db_user.role,
            is_active=db_user.is_active,
            is_verified=db_user.is_verified,
            organization=db_user.organization,
            department=db_user.department,
        )
    
    # Create tokens
    tokens = create_token_pair(
        user_id=user.id,
        username=user.username,
        scopes=["admin"] if user.role == UserRole.ADMIN else ["user"],
    )
    
    return LoginResponse(user=user, tokens=tokens)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    Refresh access token using refresh token.
    
    Args:
        refresh_token: JWT refresh token
        db: Database session
        
    Returns:
        Token: New token pair
        
    Raises:
        HTTPException: If refresh token is invalid
    """
    token_data = verify_token(refresh_token, "refresh")
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    # Create new token pair
    tokens = create_token_pair(
        user_id=token_data.user_id or 1,
        username=token_data.username or "test",
        scopes=token_data.scopes,
    )
    
    return tokens


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Get current user information.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        UserResponse: Current user data
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