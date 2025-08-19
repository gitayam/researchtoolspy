"""
Framework analysis models.
"""

from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class FrameworkType(str, Enum):
    """Available framework types."""
    SWOT = "swot"
    COG = "cog"
    PMESII_PT = "pmesii_pt"
    DOTMLPF = "dotmlpf"
    ACH = "ach"
    DECEPTION_DETECTION = "deception_detection"
    BEHAVIORAL_ANALYSIS = "behavioral_analysis"
    STARBURSTING = "starbursting"
    CAUSEWAY = "causeway"
    DIME = "dime"
    PEST = "pest"
    VRIO = "vrio"
    STAKEHOLDER = "stakeholder"
    TREND = "trend"
    SURVEILLANCE = "surveillance"
    FUNDAMENTAL_FLOW = "fundamental_flow"


class FrameworkStatus(str, Enum):
    """Framework session status."""
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class FrameworkSession(BaseModel):
    """
    Framework analysis session model.
    Stores the state and data for a framework analysis.
    """
    
    __tablename__ = "framework_sessions"
    
    # Basic Information
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    framework_type: Mapped[FrameworkType] = mapped_column(
        nullable=False,
        index=True,
    )
    
    status: Mapped[FrameworkStatus] = mapped_column(
        default=FrameworkStatus.DRAFT,
        nullable=False,
        index=True,
    )
    
    # Relationships
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    user: Mapped["User"] = relationship(
        "User",
        back_populates="framework_sessions",
    )
    
    # Analysis Data
    data: Mapped[str] = mapped_column(
        Text,  # JSON string containing framework analysis data
        default="{}",
        nullable=False,
    )
    
    # Configuration
    config: Mapped[str | None] = mapped_column(
        Text,  # JSON string containing framework configuration
        nullable=True,
    )
    
    # Metadata
    tags: Mapped[str | None] = mapped_column(
        Text,  # JSON array of tags
        nullable=True,
    )
    
    version: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )
    
    # AI Integration
    ai_suggestions: Mapped[str | None] = mapped_column(
        Text,  # JSON string containing AI suggestions
        nullable=True,
    )
    
    ai_analysis_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )
    
    def __repr__(self) -> str:
        """String representation of framework session."""
        return (
            f"<FrameworkSession("
            f"id={self.id}, "
            f"title='{self.title}', "
            f"type='{self.framework_type}', "
            f"status='{self.status}'"
            f")>"
        )


class FrameworkTemplate(BaseModel):
    """
    Framework template model for reusable framework configurations.
    """
    
    __tablename__ = "framework_templates"
    
    # Basic Information
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    framework_type: Mapped[FrameworkType] = mapped_column(
        nullable=False,
        index=True,
    )
    
    # Template Data
    template_data: Mapped[str] = mapped_column(
        Text,  # JSON string containing template structure
        nullable=False,
    )
    
    # Metadata
    is_public: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    
    is_system: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )
    
    # Relationships
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    created_by: Mapped["User"] = relationship("User")
    
    # Usage
    usage_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )
    
    def __repr__(self) -> str:
        """String representation of framework template."""
        return (
            f"<FrameworkTemplate("
            f"id={self.id}, "
            f"name='{self.name}', "
            f"type='{self.framework_type}'"
            f")>"
        )


class FrameworkExport(BaseModel):
    """
    Framework export model for tracking export history.
    """
    
    __tablename__ = "framework_exports"
    
    # Export Information
    session_id: Mapped[int] = mapped_column(
        ForeignKey("framework_sessions.id"),
        nullable=False,
        index=True,
    )
    
    session: Mapped[FrameworkSession] = relationship("FrameworkSession")
    
    export_type: Mapped[str] = mapped_column(
        String(50),  # pdf, docx, json, etc.
        nullable=False,
    )
    
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    
    file_size: Mapped[int] = mapped_column(
        nullable=False,
    )
    
    # Relationships
    exported_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    exported_by: Mapped["User"] = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of framework export."""
        return (
            f"<FrameworkExport("
            f"id={self.id}, "
            f"session_id={self.session_id}, "
            f"type='{self.export_type}'"
            f")>"
        )