"""
Hash-based authentication endpoints (Mullvad-style).
No usernames or passwords - just cryptographically secure account hashes.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import create_token_pair, Token, get_password_hash
from app.models.user import UserRole, User
from sqlalchemy import select

logger = get_logger(__name__)
router = APIRouter()


class HashAuthRequest(BaseModel):
    """Hash authentication request."""
    account_hash: str = Field(
        ..., 
        description="16-digit account hash for authentication",
        min_length=16,
        max_length=16,
        pattern=r"^\d{16}$"
    )


class HashAuthResponse(BaseModel):
    """Hash authentication response with tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    account_hash: str
    role: UserRole = UserRole.ANALYST


def generate_account_hash() -> str:
    """
    Generate a cryptographically secure 16-digit account hash.
    Similar to Mullvad's approach but using all 16 digits for maximum entropy.
    
    Returns:
        str: 16-digit account hash
    """
    # Generate a random number between 1000000000000000 and 9999999999999999
    # This gives us ~9 quadrillion possible combinations
    min_val = 1000000000000000
    max_val = 9999999999999999
    account_number = secrets.randbelow(max_val - min_val + 1) + min_val
    return str(account_number)


# In-memory storage for development (replace with database in production)
# Pre-populate with some test accounts
VALID_ACCOUNT_HASHES = {
    "1234567890123456": {
        "role": UserRole.ADMIN,
        "created_at": datetime.utcnow(),
        "last_login": None,
        "is_active": True
    },
    "9876543210987654": {
        "role": UserRole.ANALYST,
        "created_at": datetime.utcnow(),
        "last_login": None,
        "is_active": True
    },
    # Generate a few random ones for testing
    generate_account_hash(): {
        "role": UserRole.RESEARCHER,
        "created_at": datetime.utcnow(),
        "last_login": None,
        "is_active": True
    }
}

# Log the generated test hashes for development
for hash_key in VALID_ACCOUNT_HASHES:
    logger.info(f"Test account hash available: {hash_key}")


@router.post("/authenticate", response_model=HashAuthResponse)
async def authenticate_with_hash(
    request: HashAuthRequest,
    db: AsyncSession = Depends(get_db)
) -> HashAuthResponse:
    """
    Authenticate using only an account hash (Mullvad-style).
    No username or password required.
    
    Args:
        request: Hash authentication request
        db: Database session
        
    Returns:
        HashAuthResponse: Authentication tokens and account info
        
    Raises:
        HTTPException: If account hash is invalid
    """
    logger.info(f"Hash authentication attempt: {request.account_hash[:4]}...")
    
    # Check if user with this account hash exists in database
    result = await db.execute(
        select(User).where(User.account_hash == request.account_hash)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user automatically for any valid 16-digit hash
        # This allows the frontend-generated hashes to work immediately
        username = f"user_{request.account_hash[:8]}"
        email = f"{username}@researchtools.dev"
        
        # Check if username already exists (edge case)
        existing_result = await db.execute(
            select(User).where(User.username == username)
        )
        if existing_result.scalar_one_or_none():
            # Add a random suffix if username collision
            import random
            username = f"user_{request.account_hash[:8]}_{random.randint(100, 999)}"
            email = f"{username}@researchtools.dev"
        
        # Create new user record
        user = User(
            username=username,
            email=email,
            full_name=f"Research Analyst {request.account_hash[:4]}",
            hashed_password=get_password_hash(request.account_hash),
            account_hash=request.account_hash,
            role=UserRole.ANALYST,  # Default role for new users
            is_active=True,
            is_verified=True,
            organization="Research Tools Platform",
            department="Analysis"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"Auto-created new user for hash: {request.account_hash[:4]}...")
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Determine scopes based on role
    scopes = ["admin"] if user.role == UserRole.ADMIN else ["user"]
    
    # Use create_token_pair which handles both tokens correctly
    tokens = create_token_pair(
        user_id=user.id,
        username=user.username,
        scopes=scopes
    )
    
    logger.info(f"Successful hash authentication for: {request.account_hash[:4]}...")
    
    return HashAuthResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        account_hash=request.account_hash,
        role=user.role
    )


@router.post("/register", response_model=dict)
async def register_new_account(
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Register a new account by generating a unique account hash.
    No personal information required.
    
    Args:
        db: Database session (for future use)
        
    Returns:
        dict: New account hash and instructions
    """
    # Generate a new unique account hash
    max_attempts = 100
    for _ in range(max_attempts):
        new_hash = generate_account_hash()
        if new_hash not in VALID_ACCOUNT_HASHES:
            # Add to valid hashes
            VALID_ACCOUNT_HASHES[new_hash] = {
                "role": UserRole.ANALYST,  # Default role
                "created_at": datetime.utcnow(),
                "last_login": None,
                "is_active": True
            }
            
            logger.info(f"New account registered: {new_hash[:4]}...")
            
            return {
                "account_hash": new_hash,
                "message": "Account created successfully. Save this account hash - it cannot be recovered if lost.",
                "warning": "This is your only authentication credential. Store it securely."
            }
    
    # Extremely unlikely to reach here given the keyspace
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Unable to generate unique account hash. Please try again."
    )


@router.get("/validate/{account_hash}")
async def validate_account_hash(
    account_hash: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Validate if an account hash exists and is active.
    Used for client-side validation without authentication.
    
    Args:
        account_hash: Account hash to validate
        db: Database session (for future use)
        
    Returns:
        dict: Validation status (minimal information for privacy)
    """
    # Add delay to prevent timing attacks
    import asyncio
    await asyncio.sleep(0.05)
    
    if account_hash in VALID_ACCOUNT_HASHES:
        account_info = VALID_ACCOUNT_HASHES[account_hash]
        if account_info.get("is_active", True):
            return {"valid": True}
    
    return {"valid": False}