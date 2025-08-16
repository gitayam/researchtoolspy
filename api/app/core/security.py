"""
Security utilities for authentication and authorization.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
ALGORITHM = "HS256"


class TokenData(BaseModel):
    """Token data model for JWT tokens."""
    username: str | None = None
    user_id: int | None = None
    scopes: list[str] = []


class Token(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password
        
    Returns:
        bool: True if password matches
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a password.
    
    Args:
        password: Plain text password
        
    Returns:
        str: Hashed password
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any], 
    expires_delta: timedelta | None = None
) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Data to encode in token
        expires_delta: Custom expiration time
        
    Returns:
        str: JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    to_encode.update({"exp": expire, "type": "access"})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    data: dict[str, Any], 
    expires_delta: timedelta | None = None
) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Data to encode in token
        expires_delta: Custom expiration time
        
    Returns:
        str: JWT refresh token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> TokenData | None:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token to verify
        token_type: Expected token type ("access" or "refresh")
        
    Returns:
        TokenData | None: Decoded token data or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        
        # Check token type
        if payload.get("type") != token_type:
            logger.warning(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
            return None
        
        # Extract data
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        scopes: list[str] = payload.get("scopes", [])
        
        if username is None:
            logger.warning("Token missing username")
            return None
            
        return TokenData(username=username, user_id=user_id, scopes=scopes)
        
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        return None


def create_token_pair(user_id: int, username: str, scopes: list[str] = None) -> Token:
    """
    Create both access and refresh tokens for a user.
    
    Args:
        user_id: User ID
        username: Username
        scopes: User permissions/scopes
        
    Returns:
        Token: Token pair with access and refresh tokens
    """
    if scopes is None:
        scopes = []
    
    token_data = {
        "sub": username,
        "user_id": user_id,
        "scopes": scopes,
    }
    
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


def hash_api_key(api_key: str) -> str:
    """
    Hash an API key for storage.
    
    Args:
        api_key: Plain API key
        
    Returns:
        str: Hashed API key
    """
    return get_password_hash(api_key)


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """
    Verify an API key against its hash.
    
    Args:
        plain_key: Plain API key
        hashed_key: Hashed API key
        
    Returns:
        bool: True if API key matches
    """
    return verify_password(plain_key, hashed_key)