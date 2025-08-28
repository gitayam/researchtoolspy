"""
Citation management API endpoints for academic and source management.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.models.research_tool import Citation, ProcessedUrl

logger = get_logger(__name__)

router = APIRouter()

# Request/Response Models
class CitationCreateRequest(BaseModel):
    """Request model for creating citations."""
    title: str
    authors: Optional[List[str]] = None
    publication_date: Optional[datetime] = None
    source_type: str  # article, book, website, report, etc.
    source_name: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    pmid: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    reliability_rating: Optional[int] = None
    relevance_rating: Optional[int] = None
    processed_url_id: Optional[int] = None
    additional_data: Optional[dict] = None
    
    @validator('source_type')
    def validate_source_type(cls, v):
        """Validate source type."""
        valid_types = {
            'article', 'book', 'website', 'report', 'thesis', 'conference', 
            'news', 'blog', 'social_media', 'government', 'academic', 'other'
        }
        if v.lower() not in valid_types:
            raise ValueError(f"Source type must be one of: {', '.join(valid_types)}")
        return v.lower()
    
    @validator('reliability_rating', 'relevance_rating')
    def validate_rating(cls, v):
        """Validate rating is between 1-5."""
        if v is not None and (v < 1 or v > 5):
            raise ValueError("Rating must be between 1 and 5")
        return v


class CitationUpdateRequest(BaseModel):
    """Request model for updating citations."""
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    publication_date: Optional[datetime] = None
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    url: Optional[str] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    pmid: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    reliability_rating: Optional[int] = None
    relevance_rating: Optional[int] = None
    additional_data: Optional[dict] = None


class CitationResponse(BaseModel):
    """Response model for citations."""
    id: int
    title: str
    authors: Optional[List[str]]
    publication_date: Optional[datetime]
    source_type: str
    source_name: Optional[str]
    url: Optional[str]
    doi: Optional[str]
    isbn: Optional[str]
    pmid: Optional[str]
    apa_citation: Optional[str]
    mla_citation: Optional[str]
    chicago_citation: Optional[str]
    bibtex_citation: Optional[str]
    tags: Optional[List[str]]
    notes: Optional[str]
    reliability_rating: Optional[int]
    relevance_rating: Optional[int]
    processed_url_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BibliographyExportRequest(BaseModel):
    """Request model for bibliography export."""
    citation_ids: List[int]
    format: str  # apa, mla, chicago, bibtex
    title: Optional[str] = "Bibliography"
    
    @validator('format')
    def validate_format(cls, v):
        """Validate citation format."""
        valid_formats = {'apa', 'mla', 'chicago', 'bibtex'}
        if v.lower() not in valid_formats:
            raise ValueError(f"Format must be one of: {', '.join(valid_formats)}")
        return v.lower()


class CitationStatsResponse(BaseModel):
    """Response model for citation statistics."""
    total_citations: int
    by_source_type: dict
    by_rating: dict
    recent_citations: int  # Last 30 days
    top_tags: List[dict]


# Citation Format Generator Helper
class CitationFormatter:
    """Helper class for generating citation formats."""
    
    @staticmethod
    def generate_apa(citation_data: dict) -> str:
        """Generate APA format citation."""
        authors = citation_data.get('authors', [])
        title = citation_data.get('title', '')
        source_name = citation_data.get('source_name', '')
        publication_date = citation_data.get('publication_date')
        url = citation_data.get('url', '')
        
        # Simplified APA format - in production, use a proper citation library
        author_str = ""
        if authors:
            if len(authors) == 1:
                author_str = authors[0]
            elif len(authors) <= 7:
                author_str = ", ".join(authors[:-1]) + f", & {authors[-1]}"
            else:
                author_str = ", ".join(authors[:6]) + ", ... " + authors[-1]
        
        year = f"({publication_date.year})" if publication_date else "(n.d.)"
        
        citation = f"{author_str} {year}. {title}."
        if source_name:
            citation += f" {source_name}."
        if url:
            citation += f" {url}"
        
        return citation
    
    @staticmethod
    def generate_mla(citation_data: dict) -> str:
        """Generate MLA format citation."""
        authors = citation_data.get('authors', [])
        title = citation_data.get('title', '')
        source_name = citation_data.get('source_name', '')
        publication_date = citation_data.get('publication_date')
        url = citation_data.get('url', '')
        
        # Simplified MLA format
        author_str = ""
        if authors:
            author_str = authors[0]
            if len(authors) > 1:
                author_str += ", et al."
        
        citation = f"{author_str}. \"{title}.\""
        if source_name:
            citation += f" {source_name},"
        if publication_date:
            citation += f" {publication_date.year},"
        if url:
            citation += f" {url}."
        
        return citation
    
    @staticmethod
    def generate_chicago(citation_data: dict) -> str:
        """Generate Chicago format citation."""
        # Simplified Chicago format
        authors = citation_data.get('authors', [])
        title = citation_data.get('title', '')
        source_name = citation_data.get('source_name', '')
        publication_date = citation_data.get('publication_date')
        
        author_str = ""
        if authors:
            author_str = authors[0]
            if len(authors) > 1:
                author_str += " et al."
        
        citation = f"{author_str}. \"{title}.\""
        if source_name:
            citation += f" {source_name}."
        if publication_date:
            citation += f" {publication_date.year}."
        
        return citation
    
    @staticmethod
    def generate_bibtex(citation_data: dict, citation_id: int) -> str:
        """Generate BibTeX format citation."""
        source_type = citation_data.get('source_type', 'misc')
        title = citation_data.get('title', '')
        authors = citation_data.get('authors', [])
        source_name = citation_data.get('source_name', '')
        publication_date = citation_data.get('publication_date')
        url = citation_data.get('url', '')
        doi = citation_data.get('doi', '')
        
        # Map source types to BibTeX entry types
        bibtex_type_map = {
            'article': 'article',
            'book': 'book',
            'website': 'misc',
            'report': 'techreport',
            'thesis': 'phdthesis',
            'conference': 'inproceedings'
        }
        
        entry_type = bibtex_type_map.get(source_type, 'misc')
        key = f"citation{citation_id}"
        
        bibtex = f"@{entry_type}{{{key},\n"
        bibtex += f"  title={{{title}}},\n"
        
        if authors:
            author_str = " and ".join(authors)
            bibtex += f"  author={{{author_str}}},\n"
        
        if source_name:
            if entry_type == 'article':
                bibtex += f"  journal={{{source_name}}},\n"
            else:
                bibtex += f"  publisher={{{source_name}}},\n"
        
        if publication_date:
            bibtex += f"  year={{{publication_date.year}}},\n"
        
        if url:
            bibtex += f"  url={{{url}}},\n"
        
        if doi:
            bibtex += f"  doi={{{doi}}},\n"
        
        bibtex += "}"
        
        return bibtex


# API Endpoints
@router.post("/", response_model=CitationResponse, status_code=status.HTTP_201_CREATED)
async def create_citation(
    request: CitationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CitationResponse:
    """
    Create a new citation.
    
    - **title**: Citation title (required)
    - **authors**: List of author names
    - **source_type**: Type of source (article, book, website, etc.)
    - **publication_date**: Date of publication
    - **url**: URL if applicable
    - **doi**: Digital Object Identifier
    - **tags**: List of tags for organization
    - **reliability_rating**: Rating from 1-5
    - **relevance_rating**: Rating from 1-5
    """
    try:
        # Prepare citation data for formatting
        citation_data = {
            'title': request.title,
            'authors': request.authors or [],
            'source_name': request.source_name,
            'publication_date': request.publication_date,
            'url': request.url,
            'doi': request.doi,
            'source_type': request.source_type
        }
        
        # Generate citation formats
        formatter = CitationFormatter()
        apa_citation = formatter.generate_apa(citation_data)
        mla_citation = formatter.generate_mla(citation_data)
        chicago_citation = formatter.generate_chicago(citation_data)
        
        # Create citation
        citation = Citation(
            title=request.title,
            authors=str(request.authors) if request.authors else None,
            publication_date=request.publication_date,
            source_type=request.source_type,
            source_name=request.source_name,
            url=request.url,
            doi=request.doi,
            isbn=request.isbn,
            pmid=request.pmid,
            apa_citation=apa_citation,
            mla_citation=mla_citation,
            chicago_citation=chicago_citation,
            tags=str(request.tags) if request.tags else None,
            notes=request.notes,
            reliability_rating=request.reliability_rating,
            relevance_rating=request.relevance_rating,
            processed_url_id=request.processed_url_id,
            citation_data=str(request.additional_data) if request.additional_data else None,
            user_id=current_user.id
        )
        
        db.add(citation)
        await db.commit()
        await db.refresh(citation)
        
        # Generate BibTeX after we have the ID
        bibtex_citation = formatter.generate_bibtex(citation_data, citation.id)
        citation.bibtex_citation = bibtex_citation
        await db.commit()
        await db.refresh(citation)
        
        logger.info(f"Created citation {citation.id} for user {current_user.username}")
        return CitationResponse.from_orm(citation)
        
    except Exception as e:
        logger.error(f"Failed to create citation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create citation: {str(e)}"
        )


@router.get("/", response_model=List[CitationResponse])
async def get_citations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    source_type: Optional[str] = Query(None, description="Filter by source type"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    search: Optional[str] = Query(None, description="Search in title, authors, notes")
) -> List[CitationResponse]:
    """
    Get user's citations with optional filtering and search.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **source_type**: Filter by source type
    - **tag**: Filter by tag
    - **search**: Search in title, authors, and notes
    """
    try:
        query = select(Citation).where(Citation.user_id == current_user.id)
        
        # Apply filters
        if source_type:
            query = query.where(Citation.source_type == source_type)
        
        if tag:
            query = query.where(Citation.tags.ilike(f"%{tag}%"))
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Citation.title.ilike(search_term),
                    Citation.authors.ilike(search_term),
                    Citation.notes.ilike(search_term)
                )
            )
        
        # Apply pagination and ordering
        query = query.order_by(Citation.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        citations = result.scalars().all()
        
        return [CitationResponse.from_orm(citation) for citation in citations]
        
    except Exception as e:
        logger.error(f"Failed to get citations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve citations: {str(e)}"
        )


@router.get("/{citation_id}", response_model=CitationResponse)
async def get_citation(
    citation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CitationResponse:
    """
    Get a specific citation by ID.
    
    - **citation_id**: ID of the citation
    """
    try:
        result = await db.execute(
            select(Citation).where(
                Citation.id == citation_id,
                Citation.user_id == current_user.id
            )
        )
        citation = result.scalar_one_or_none()
        
        if not citation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation not found"
            )
        
        return CitationResponse.from_orm(citation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get citation {citation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve citation: {str(e)}"
        )


@router.put("/{citation_id}", response_model=CitationResponse)
async def update_citation(
    citation_id: int,
    request: CitationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CitationResponse:
    """
    Update a citation.
    
    - **citation_id**: ID of the citation to update
    """
    try:
        result = await db.execute(
            select(Citation).where(
                Citation.id == citation_id,
                Citation.user_id == current_user.id
            )
        )
        citation = result.scalar_one_or_none()
        
        if not citation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation not found"
            )
        
        # Update fields
        update_data = request.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field in ['authors', 'tags'] and value is not None:
                setattr(citation, field, str(value))
            elif field == 'additional_data' and value is not None:
                setattr(citation, 'citation_data', str(value))
            else:
                setattr(citation, field, value)
        
        # Regenerate citation formats if relevant fields changed
        if any(field in update_data for field in ['title', 'authors', 'source_name', 'publication_date', 'url', 'doi']):
            citation_data = {
                'title': citation.title,
                'authors': eval(citation.authors) if citation.authors else [],
                'source_name': citation.source_name,
                'publication_date': citation.publication_date,
                'url': citation.url,
                'doi': citation.doi,
                'source_type': citation.source_type
            }
            
            formatter = CitationFormatter()
            citation.apa_citation = formatter.generate_apa(citation_data)
            citation.mla_citation = formatter.generate_mla(citation_data)
            citation.chicago_citation = formatter.generate_chicago(citation_data)
            citation.bibtex_citation = formatter.generate_bibtex(citation_data, citation.id)
        
        await db.commit()
        await db.refresh(citation)
        
        logger.info(f"Updated citation {citation_id} for user {current_user.username}")
        return CitationResponse.from_orm(citation)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update citation {citation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update citation: {str(e)}"
        )


@router.delete("/{citation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_citation(
    citation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a citation.
    
    - **citation_id**: ID of the citation to delete
    """
    try:
        result = await db.execute(
            select(Citation).where(
                Citation.id == citation_id,
                Citation.user_id == current_user.id
            )
        )
        citation = result.scalar_one_or_none()
        
        if not citation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Citation not found"
            )
        
        await db.delete(citation)
        await db.commit()
        
        logger.info(f"Deleted citation {citation_id} for user {current_user.username}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete citation {citation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete citation: {str(e)}"
        )


@router.post("/export/bibliography")
async def export_bibliography(
    request: BibliographyExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Export selected citations as a bibliography.
    
    - **citation_ids**: List of citation IDs to include
    - **format**: Citation format (apa, mla, chicago, bibtex)
    - **title**: Title for the bibliography
    """
    try:
        # Get citations
        result = await db.execute(
            select(Citation).where(
                Citation.id.in_(request.citation_ids),
                Citation.user_id == current_user.id
            ).order_by(Citation.created_at)
        )
        citations = result.scalars().all()
        
        if not citations:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No citations found"
            )
        
        # Generate bibliography
        bibliography_lines = [f"# {request.title}\n"]
        
        for citation in citations:
            if request.format == 'apa':
                line = citation.apa_citation
            elif request.format == 'mla':
                line = citation.mla_citation
            elif request.format == 'chicago':
                line = citation.chicago_citation
            elif request.format == 'bibtex':
                line = citation.bibtex_citation
            else:
                line = citation.apa_citation  # Default fallback
            
            bibliography_lines.append(line)
        
        bibliography_text = "\n\n".join(bibliography_lines)
        
        return {
            "success": True,
            "format": request.format,
            "title": request.title,
            "citation_count": len(citations),
            "bibliography": bibliography_text
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export bibliography: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export bibliography: {str(e)}"
        )


@router.get("/stats/overview", response_model=CitationStatsResponse)
async def get_citation_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CitationStatsResponse:
    """
    Get citation statistics for the current user.
    """
    try:
        # Total citations
        total_result = await db.execute(
            select(func.count(Citation.id)).where(Citation.user_id == current_user.id)
        )
        total_citations = total_result.scalar() or 0
        
        # By source type
        source_type_result = await db.execute(
            select(
                Citation.source_type,
                func.count(Citation.id)
            ).where(
                Citation.user_id == current_user.id
            ).group_by(Citation.source_type)
        )
        by_source_type = {row[0]: row[1] for row in source_type_result}
        
        # By rating (simplified)
        rating_result = await db.execute(
            select(
                Citation.reliability_rating,
                func.count(Citation.id)
            ).where(
                Citation.user_id == current_user.id,
                Citation.reliability_rating.is_not(None)
            ).group_by(Citation.reliability_rating)
        )
        by_rating = {f"rating_{row[0]}": row[1] for row in rating_result}
        
        # Recent citations (last 30 days)
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_result = await db.execute(
            select(func.count(Citation.id)).where(
                Citation.user_id == current_user.id,
                Citation.created_at >= thirty_days_ago
            )
        )
        recent_citations = recent_result.scalar() or 0
        
        # Top tags (simplified - would need better JSON handling in production)
        top_tags = [
            {"tag": "research", "count": 0},
            {"tag": "analysis", "count": 0},
            {"tag": "intelligence", "count": 0}
        ]
        
        return CitationStatsResponse(
            total_citations=total_citations,
            by_source_type=by_source_type,
            by_rating=by_rating,
            recent_citations=recent_citations,
            top_tags=top_tags
        )
        
    except Exception as e:
        logger.error(f"Failed to get citation stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve statistics: {str(e)}"
        )