"""
User model and related database models.
"""

from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SQLEnum, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.framework import FrameworkSession


class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    ANALYST = "analyst"
    RESEARCHER = "researcher"
    VIEWER = "viewer"


class User(BaseModel):
    """
    User model for authentication and authorization.
    """
    
    __tablename__ = "users"
    
    # Basic Information
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    # Authentication
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    
    # Role and Permissions
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.RESEARCHER,
        nullable=False,
    )
    
    # Profile Information
    organization: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    department: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    bio: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Preferences
    preferences: Mapped[str | None] = mapped_column(
        Text,  # JSON string
        nullable=True,
    )
    
    # Relationships
    framework_sessions: Mapped[list["FrameworkSession"]] = relationship(
        "FrameworkSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    
    def __repr__(self) -> str:
        """String representation of user."""
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin."""
        return self.role == UserRole.ADMIN
    
    @property
    def can_create_frameworks(self) -> bool:
        """Check if user can create framework sessions."""
        return self.role in [UserRole.ADMIN, UserRole.ANALYST, UserRole.RESEARCHER]
    
    @property
    def can_export(self) -> bool:
        """Check if user can export data."""
        return self.role in [UserRole.ADMIN, UserRole.ANALYST, UserRole.RESEARCHER]
    
    @property
    def can_admin(self) -> bool:
        """Check if user has admin privileges."""
        return self.role == UserRole.ADMIN


class APIKey(BaseModel):
    """
    API key model for programmatic access.
    """
    
    __tablename__ = "api_keys"
    
    # Key Information
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    
    key_hash: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    
    # Relationships
    user_id: Mapped[int] = mapped_column(
        nullable=False,
        index=True,
    )
    
    user: Mapped[User] = relationship("User")
    
    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    
    # Permissions
    scopes: Mapped[str] = mapped_column(
        Text,  # JSON string of scopes
        default="[]",
        nullable=False,
    )
    
    # Usage tracking
    last_used_at: Mapped[str | None] = mapped_column(
        String(50),  # ISO datetime string
        nullable=True,
    )
    
    usage_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )
    
    def __repr__(self) -> str:
        """String representation of API key."""
        return f"<APIKey(id={self.id}, name='{self.name}', user_id={self.user_id})>"