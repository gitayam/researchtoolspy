"""
Authentication logging model for tracking login attempts and sessions.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class AuthLog(BaseModel):
    """
    Authentication log model for tracking login attempts.
    """
    
    __tablename__ = "auth_logs"
    
    # User reference
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )
    
    # Authentication details
    account_hash: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        index=True,
    )
    
    # Login attempt details
    success: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    
    ip_address: Mapped[str | None] = mapped_column(
        String(45),  # IPv6 max length
        nullable=True,
    )
    
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Session info
    session_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    # Error details (for failed attempts)
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Timestamps
    login_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    
    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="auth_logs",
    )
    
    def __repr__(self) -> str:
        """String representation of auth log."""
        status = "SUCCESS" if self.success else "FAILED"
        return f"<AuthLog(hash={self.account_hash[:4]}..., status={status}, at={self.login_at})>"