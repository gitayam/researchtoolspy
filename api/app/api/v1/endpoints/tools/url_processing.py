"""
URL processing API endpoints for web content analysis and archival.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, HttpUrl, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.models.research_tool import ProcessedUrl
from app.services.url_service import url_service

logger = get_logger(__name__)

router = APIRouter()

# Request/Response Models
class UrlProcessRequest(BaseModel):
    """Request model for URL processing."""
    url: str
    force_refresh: bool = False
    archive_with_wayback: bool = False
    
    @validator('url')
    def validate_url(cls, v):
        """Validate URL format."""
        if not v.startswith(('http://', 'https://')):
            v = f"https://{v}"
        # Basic validation - let the service handle detailed validation
        return v


class BatchUrlProcessRequest(BaseModel):
    """Request model for batch URL processing."""
    urls: List[str]
    force_refresh: bool = False
    archive_with_wayback: bool = False
    
    @validator('urls')
    def validate_urls(cls, v):
        """Validate URLs list."""
        if len(v) > 100:
            raise ValueError("Maximum 100 URLs allowed per batch")
        if not v:
            raise ValueError("At least one URL is required")
        return v


class ProcessedUrlResponse(BaseModel):
    """Response model for processed URL."""
    id: int
    url: str
    url_hash: str
    title: Optional[str]
    description: Optional[str]
    author: Optional[str]
    domain: str
    content_type: Optional[str]
    language: Optional[str]
    word_count: Optional[int]
    status_code: Optional[int]
    response_time: Optional[float]
    archived_url: Optional[str]
    wayback_url: Optional[str]
    reliability_score: Optional[float]
    domain_reputation: Optional[str]
    processing_status: str
    error_message: Optional[str]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class UrlStatsResponse(BaseModel):
    """Response model for URL processing statistics."""
    total_processed: int
    successful: int
    failed: int
    domains_count: int
    average_reliability: Optional[float]
    most_reliable_domain: Optional[str]
    least_reliable_domain: Optional[str]


# API Endpoints
@router.post("/process", response_model=ProcessedUrlResponse, status_code=status.HTTP_201_CREATED)
async def process_url(
    request: UrlProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ProcessedUrlResponse:
    """
    Process a single URL and extract metadata.
    
    - **url**: URL to process and analyze
    - **force_refresh**: Force re-processing even if URL was previously processed
    - **archive_with_wayback**: Archive URL with Wayback Machine
    """
    logger.info(f"Processing URL: {request.url} for user {current_user.username}")
    
    try:
        # Process the URL
        processed_url = await url_service.process_url(
            url=request.url,
            db=db,
            user=current_user,
            force_refresh=request.force_refresh
        )
        
        # Archive with Wayback Machine if requested
        if request.archive_with_wayback and processed_url.processing_status == "completed":
            wayback_url = await url_service.archive_with_wayback(request.url)
            if wayback_url:
                processed_url.wayback_url = wayback_url
                await db.commit()
                await db.refresh(processed_url)
        
        return ProcessedUrlResponse.from_orm(processed_url)
        
    except Exception as e:
        logger.error(f"Failed to process URL {request.url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process URL: {str(e)}"
        )


@router.post("/process/batch", response_model=List[ProcessedUrlResponse])
async def process_urls_batch(
    request: BatchUrlProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[ProcessedUrlResponse]:
    """
    Process multiple URLs in batch.
    
    - **urls**: List of URLs to process (max 100)
    - **force_refresh**: Force re-processing for all URLs
    - **archive_with_wayback**: Archive all URLs with Wayback Machine
    """
    logger.info(f"Batch processing {len(request.urls)} URLs for user {current_user.username}")
    
    try:
        # Process URLs in batch
        processed_urls = await url_service.batch_process_urls(
            urls=request.urls,
            db=db,
            user=current_user,
            force_refresh=request.force_refresh
        )
        
        # Archive with Wayback Machine if requested
        if request.archive_with_wayback:
            for processed_url in processed_urls:
                if processed_url.processing_status == "completed":
                    wayback_url = await url_service.archive_with_wayback(processed_url.url)
                    if wayback_url:
                        processed_url.wayback_url = wayback_url
            
            await db.commit()
            for processed_url in processed_urls:
                await db.refresh(processed_url)
        
        return [ProcessedUrlResponse.from_orm(url) for url in processed_urls]
        
    except Exception as e:
        logger.error(f"Failed to batch process URLs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process URLs: {str(e)}"
        )


@router.get("/processed", response_model=List[ProcessedUrlResponse])
async def get_processed_urls(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    domain: Optional[str] = Query(None, description="Filter by domain"),
    status: Optional[str] = Query(None, description="Filter by processing status")
) -> List[ProcessedUrlResponse]:
    """
    Get user's processed URLs with optional filtering.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **domain**: Filter results by domain
    - **status**: Filter by processing status (completed, failed, processing)
    """
    try:
        query = select(ProcessedUrl).where(ProcessedUrl.user_id == current_user.id)
        
        # Apply filters
        if domain:
            query = query.where(ProcessedUrl.domain.ilike(f"%{domain}%"))
        if status:
            query = query.where(ProcessedUrl.processing_status == status)
        
        # Apply pagination and ordering
        query = query.order_by(ProcessedUrl.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        processed_urls = result.scalars().all()
        
        return [ProcessedUrlResponse.from_orm(url) for url in processed_urls]
        
    except Exception as e:
        logger.error(f"Failed to get processed URLs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve processed URLs: {str(e)}"
        )


@router.get("/processed/{url_id}", response_model=ProcessedUrlResponse)
async def get_processed_url(
    url_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ProcessedUrlResponse:
    """
    Get a specific processed URL by ID.
    
    - **url_id**: ID of the processed URL
    """
    try:
        result = await db.execute(
            select(ProcessedUrl).where(
                ProcessedUrl.id == url_id,
                ProcessedUrl.user_id == current_user.id
            )
        )
        processed_url = result.scalar_one_or_none()
        
        if not processed_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processed URL not found"
            )
        
        return ProcessedUrlResponse.from_orm(processed_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get processed URL {url_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve processed URL: {str(e)}"
        )


@router.delete("/processed/{url_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_processed_url(
    url_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a processed URL record.
    
    - **url_id**: ID of the processed URL to delete
    """
    try:
        result = await db.execute(
            select(ProcessedUrl).where(
                ProcessedUrl.id == url_id,
                ProcessedUrl.user_id == current_user.id
            )
        )
        processed_url = result.scalar_one_or_none()
        
        if not processed_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processed URL not found"
            )
        
        await db.delete(processed_url)
        await db.commit()
        
        logger.info(f"Deleted processed URL {url_id} for user {current_user.username}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete processed URL {url_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete processed URL: {str(e)}"
        )


@router.post("/archive/{url_id}")
async def archive_url_wayback(
    url_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Archive a processed URL with Wayback Machine.
    
    - **url_id**: ID of the processed URL to archive
    """
    try:
        result = await db.execute(
            select(ProcessedUrl).where(
                ProcessedUrl.id == url_id,
                ProcessedUrl.user_id == current_user.id
            )
        )
        processed_url = result.scalar_one_or_none()
        
        if not processed_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processed URL not found"
            )
        
        wayback_url = await url_service.archive_with_wayback(processed_url.url)
        
        if wayback_url:
            processed_url.wayback_url = wayback_url
            await db.commit()
            await db.refresh(processed_url)
            
            return {
                "success": True,
                "wayback_url": wayback_url,
                "message": "URL successfully archived with Wayback Machine"
            }
        else:
            return {
                "success": False,
                "wayback_url": None,
                "message": "Failed to archive URL with Wayback Machine"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to archive URL {url_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to archive URL: {str(e)}"
        )


@router.get("/stats", response_model=UrlStatsResponse)
async def get_url_processing_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> UrlStatsResponse:
    """
    Get URL processing statistics for the current user.
    """
    try:
        # Get total counts
        total_result = await db.execute(
            select(func.count(ProcessedUrl.id)).where(ProcessedUrl.user_id == current_user.id)
        )
        total_processed = total_result.scalar() or 0
        
        # Get successful count
        success_result = await db.execute(
            select(func.count(ProcessedUrl.id)).where(
                ProcessedUrl.user_id == current_user.id,
                ProcessedUrl.processing_status == "completed"
            )
        )
        successful = success_result.scalar() or 0
        
        # Get failed count  
        failed_result = await db.execute(
            select(func.count(ProcessedUrl.id)).where(
                ProcessedUrl.user_id == current_user.id,
                ProcessedUrl.processing_status == "failed"
            )
        )
        failed = failed_result.scalar() or 0
        
        # Get unique domains count
        domains_result = await db.execute(
            select(func.count(func.distinct(ProcessedUrl.domain))).where(
                ProcessedUrl.user_id == current_user.id
            )
        )
        domains_count = domains_result.scalar() or 0
        
        # Get average reliability
        avg_reliability_result = await db.execute(
            select(func.avg(ProcessedUrl.reliability_score)).where(
                ProcessedUrl.user_id == current_user.id,
                ProcessedUrl.reliability_score.is_not(None)
            )
        )
        average_reliability = avg_reliability_result.scalar()
        
        # Get most/least reliable domains (simplified)
        most_reliable_domain = None
        least_reliable_domain = None
        
        if total_processed > 0:
            # This is a simplified approach - in production you'd want more sophisticated domain reliability analysis
            domain_reliability = await db.execute(
                select(
                    ProcessedUrl.domain,
                    func.avg(ProcessedUrl.reliability_score).label('avg_score')
                ).where(
                    ProcessedUrl.user_id == current_user.id,
                    ProcessedUrl.reliability_score.is_not(None)
                ).group_by(ProcessedUrl.domain).order_by(func.avg(ProcessedUrl.reliability_score).desc())
            )
            
            domain_results = domain_reliability.all()
            if domain_results:
                most_reliable_domain = domain_results[0][0]
                least_reliable_domain = domain_results[-1][0]
        
        return UrlStatsResponse(
            total_processed=total_processed,
            successful=successful,
            failed=failed,
            domains_count=domains_count,
            average_reliability=round(average_reliability, 3) if average_reliability else None,
            most_reliable_domain=most_reliable_domain,
            least_reliable_domain=least_reliable_domain
        )
        
    except Exception as e:
        logger.error(f"Failed to get URL processing stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve statistics: {str(e)}"
        )


@router.get("/domains", response_model=List[dict])
async def get_processed_domains(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100, description="Number of domains to return")
) -> List[dict]:
    """
    Get list of processed domains with statistics.
    
    - **limit**: Maximum number of domains to return
    """
    try:
        result = await db.execute(
            select(
                ProcessedUrl.domain,
                func.count(ProcessedUrl.id).label('url_count'),
                func.avg(ProcessedUrl.reliability_score).label('avg_reliability'),
                func.max(ProcessedUrl.created_at).label('last_processed')
            ).where(
                ProcessedUrl.user_id == current_user.id
            ).group_by(
                ProcessedUrl.domain
            ).order_by(
                func.count(ProcessedUrl.id).desc()
            ).limit(limit)
        )
        
        domains = []
        for row in result:
            domains.append({
                "domain": row[0],
                "url_count": row[1],
                "average_reliability": round(row[2], 3) if row[2] else None,
                "last_processed": row[3].isoformat() if row[3] else None
            })
        
        return domains
        
    except Exception as e:
        logger.error(f"Failed to get processed domains: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve domains: {str(e)}"
        )