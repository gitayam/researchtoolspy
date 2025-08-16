"""
Research tool models for OmniCore intelligence analysis platform.
"""

import json
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING, Dict, List, Optional

from sqlalchemy import ForeignKey, String, Text, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class ResearchJobStatus(str, Enum):
    """Research job status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ResearchJobType(str, Enum):
    """Research job type enumeration."""
    URL_PROCESSING = "url_processing"
    WEB_SCRAPING = "web_scraping"
    DOCUMENT_PROCESSING = "document_processing"
    SOCIAL_MEDIA_ANALYSIS = "social_media_analysis"
    OSINT_COLLECTION = "osint_collection"
    DATA_CONVERSION = "data_conversion"


class ProcessedUrl(BaseModel):
    """
    Processed URL model for storing URL analysis results.
    """
    
    __tablename__ = "processed_urls"
    
    # URL Information
    url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        index=True,
    )
    
    url_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )
    
    # Extracted Metadata
    title: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    author: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    domain: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    
    # Content Analysis
    content_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    
    language: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    
    word_count: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    
    # Technical Metadata
    status_code: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    
    response_time: Mapped[float | None] = mapped_column(
        nullable=True,
    )
    
    # Archive Information
    archived_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    wayback_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Additional Metadata (JSON)
    metadata: Mapped[str | None] = mapped_column(
        Text,  # JSON string
        nullable=True,
    )
    
    # Reliability Assessment
    reliability_score: Mapped[float | None] = mapped_column(
        nullable=True,
    )
    
    domain_reputation: Mapped[str | None] = mapped_column(
        String(20),  # trusted, neutral, suspicious, malicious
        nullable=True,
    )
    
    # Processing Information
    processing_status: Mapped[str] = mapped_column(
        String(20),
        default="completed",
        nullable=False,
    )
    
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Relationships
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    user: Mapped["User"] = relationship("User")
    
    def __repr__(self) -> str:
        """String representation of processed URL."""
        return (
            f"<ProcessedUrl("
            f"id={self.id}, "
            f"domain='{self.domain}', "
            f"title='{self.title[:50] if self.title else None}...'"
            f")>"
        )


class Citation(BaseModel):
    """
    Citation model for academic and source management.
    """
    
    __tablename__ = "citations"
    
    # Basic Citation Information
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    
    authors: Mapped[str | None] = mapped_column(
        Text,  # JSON array of author names
        nullable=True,
    )
    
    publication_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Source Information
    source_type: Mapped[str] = mapped_column(
        String(50),  # article, book, website, report, etc.
        nullable=False,
        index=True,
    )
    
    source_name: Mapped[str | None] = mapped_column(
        String(255),  # Journal, publisher, website name
        nullable=True,
    )
    
    # Identifiers
    url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    doi: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    
    isbn: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    
    pmid: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    
    # Citation Formats (Pre-generated)
    apa_citation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    mla_citation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    chicago_citation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    bibtex_citation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Additional Data
    citation_data: Mapped[str | None] = mapped_column(
        Text,  # JSON string with additional fields
        nullable=True,
    )
    
    # Organization
    tags: Mapped[str | None] = mapped_column(
        Text,  # JSON array of tags
        nullable=True,
    )
    
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    # Quality Assessment
    reliability_rating: Mapped[int | None] = mapped_column(
        nullable=True,  # 1-5 scale
    )
    
    relevance_rating: Mapped[int | None] = mapped_column(
        nullable=True,  # 1-5 scale
    )
    
    # Relationships
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    user: Mapped["User"] = relationship("User")
    
    # Link to processed URL if applicable
    processed_url_id: Mapped[int | None] = mapped_column(
        ForeignKey("processed_urls.id"),
        nullable=True,
        index=True,
    )
    
    processed_url: Mapped[ProcessedUrl | None] = relationship("ProcessedUrl")
    
    def __repr__(self) -> str:
        """String representation of citation."""
        return (
            f"<Citation("
            f"id={self.id}, "
            f"title='{self.title[:50] if self.title else None}...', "
            f"source_type='{self.source_type}'"
            f")>"
        )


class ResearchJob(BaseModel):
    """
    Research job model for tracking async research operations.
    """
    
    __tablename__ = "research_jobs"
    
    # Job Information
    job_type: Mapped[ResearchJobType] = mapped_column(
        nullable=False,
        index=True,
    )
    
    job_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    status: Mapped[ResearchJobStatus] = mapped_column(
        default=ResearchJobStatus.PENDING,
        nullable=False,
        index=True,
    )
    
    # Job Data
    input_data: Mapped[str | None] = mapped_column(
        Text,  # JSON string
        nullable=True,
    )
    
    result_data: Mapped[str | None] = mapped_column(
        Text,  # JSON string
        nullable=True,
    )
    
    # Error Handling
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    retry_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )
    
    max_retries: Mapped[int] = mapped_column(
        default=3,
        nullable=False,
    )
    
    # Progress Tracking
    progress_percentage: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
    )
    
    current_step: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    
    # Timing
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    estimated_completion: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    
    # Relationships
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    
    user: Mapped["User"] = relationship("User")
    
    # Related Objects
    related_urls: Mapped[str | None] = mapped_column(
        Text,  # JSON array of URL IDs
        nullable=True,
    )
    
    related_citations: Mapped[str | None] = mapped_column(
        Text,  # JSON array of citation IDs
        nullable=True,
    )
    
    def __repr__(self) -> str:
        """String representation of research job."""
        return (
            f"<ResearchJob("
            f"id={self.id}, "
            f"type='{self.job_type}', "
            f"status='{self.status}', "
            f"progress={self.progress_percentage}%"
            f")>"
        )


# Database Indexes for Performance
Index("idx_processed_urls_domain_created", ProcessedUrl.domain, ProcessedUrl.created_at)
Index("idx_citations_source_type_date", Citation.source_type, Citation.publication_date)
Index("idx_research_jobs_status_type", ResearchJob.status, ResearchJob.job_type)
Index("idx_research_jobs_user_status", ResearchJob.user_id, ResearchJob.status)