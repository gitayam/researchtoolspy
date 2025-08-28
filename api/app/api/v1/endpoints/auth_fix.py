"""
Fixed authentication endpoint for hash-based auth compatibility.
"""

from typing import Any
from pydantic import BaseModel

from app.models.user import UserRole

class MockUser:
    """Mock user for hash-based authentication"""
    
    def __init__(self, user_id: int, username: str, role: UserRole = UserRole.RESEARCHER):
        self.id = user_id
        self.username = username
        self.email = f"{username}@researchtools.dev"
        self.full_name = username.replace('_', ' ').title()
        self.hashed_password = ""
        self.role = role
        self.is_active = True
        self.is_verified = True
        self.organization = "Research Tools"
        self.department = "Analysis"
        self.bio = None
        self.preferences = None
        self.framework_sessions = []
    
    @property
    def can_create_frameworks(self) -> bool:
        """Check if user can create framework sessions."""
        return self.role in [UserRole.ADMIN, UserRole.ANALYST, UserRole.RESEARCHER]
    
    @property
    def can_export(self) -> bool:
        """Check if user can export data."""
        return self.role in [UserRole.ADMIN, UserRole.ANALYST, UserRole.RESEARCHER]
    
    @property
    def can_use_ai(self) -> bool:
        """Check if user can use AI features."""
        return self.role in [UserRole.ADMIN, UserRole.ANALYST]
    
    @property
    def is_admin(self) -> bool:
        """Check if user is admin."""
        return self.role == UserRole.ADMIN
    
    def __repr__(self) -> str:
        """String representation of user."""
        return f"<MockUser(id={self.id}, username='{self.username}', role='{self.role}')>"