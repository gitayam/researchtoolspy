"""
Web scraping API endpoints for content extraction and analysis.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import asyncio
import json
from datetime import datetime, timedelta

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.models.research_tool import ResearchJob, ResearchJobStatus, ResearchJobType

logger = get_logger(__name__)

router = APIRouter()

# Request/Response Models
class ScrapingRequest(BaseModel):
    """Request model for web scraping."""
    url: str
    options: Optional[Dict[str, Any]] = {}
    extract_images: bool = False
    extract_links: bool = False
    follow_redirects: bool = True
    max_depth: int = 1
    delay_seconds: float = 1.0
    user_agent: Optional[str] = None
    
    @validator('max_depth')
    def validate_max_depth(cls, v):
        """Validate max depth."""
        if v < 1 or v > 5:
            raise ValueError("Max depth must be between 1 and 5")
        return v
    
    @validator('delay_seconds')
    def validate_delay(cls, v):
        """Validate delay."""
        if v < 0.5 or v > 10.0:
            raise ValueError("Delay must be between 0.5 and 10.0 seconds")
        return v


class BatchScrapingRequest(BaseModel):
    """Request model for batch web scraping."""
    urls: List[str]
    options: Optional[Dict[str, Any]] = {}
    extract_images: bool = False
    extract_links: bool = False
    follow_redirects: bool = True
    delay_seconds: float = 1.0
    
    @validator('urls')
    def validate_urls(cls, v):
        """Validate URLs list."""
        if len(v) > 50:
            raise ValueError("Maximum 50 URLs allowed per batch")
        if not v:
            raise ValueError("At least one URL is required")
        return v


class ScrapingJobResponse(BaseModel):
    """Response model for scraping jobs."""
    job_id: int
    status: str
    progress_percentage: int
    current_step: Optional[str]
    started_at: Optional[datetime]
    estimated_completion: Optional[datetime]
    message: str
    
    class Config:
        from_attributes = True


class ScrapingResultResponse(BaseModel):
    """Response model for scraping results."""
    job_id: int
    status: str
    url: str
    title: Optional[str]
    content: Optional[str]
    images: Optional[List[str]]
    links: Optional[List[str]]
    metadata: Optional[Dict[str, Any]]
    error_message: Optional[str]
    scraped_at: datetime
    
    class Config:
        from_attributes = True


# Web Scraping Service
class WebScrapingService:
    """Service for web scraping operations."""
    
    async def scrape_url(
        self, 
        url: str, 
        options: Dict[str, Any],
        extract_images: bool = False,
        extract_links: bool = False,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scrape a single URL.
        """
        import httpx
        from bs4 import BeautifulSoup
        import urllib.parse
        
        try:
            headers = {
                "User-Agent": user_agent or "OmniCore Intelligence Analysis Platform/1.0"
            }
            
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                # Parse content
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Extract basic content
                title = soup.find('title')
                title_text = title.get_text().strip() if title else None
                
                # Extract main text content
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                
                text_content = soup.get_text()
                # Clean up whitespace
                lines = (line.strip() for line in text_content.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                content = '\n'.join(chunk for chunk in chunks if chunk)
                
                result = {
                    "url": url,
                    "status_code": response.status_code,
                    "title": title_text,
                    "content": content[:10000],  # Limit content size
                    "content_length": len(content),
                    "headers": dict(response.headers),
                }
                
                # Extract images if requested
                if extract_images:
                    images = []
                    for img in soup.find_all('img'):
                        src = img.get('src')
                        if src:
                            # Convert relative URLs to absolute
                            absolute_url = urllib.parse.urljoin(url, src)
                            images.append(absolute_url)
                    result["images"] = images[:100]  # Limit to 100 images
                
                # Extract links if requested
                if extract_links:
                    links = []
                    for link in soup.find_all('a'):
                        href = link.get('href')
                        if href:
                            # Convert relative URLs to absolute
                            absolute_url = urllib.parse.urljoin(url, href)
                            links.append({
                                "url": absolute_url,
                                "text": link.get_text().strip()
                            })
                    result["links"] = links[:200]  # Limit to 200 links
                
                # Extract metadata
                metadata = {}
                
                # Meta tags
                for meta in soup.find_all('meta'):
                    name = meta.get('name') or meta.get('property')
                    content = meta.get('content')
                    if name and content:
                        metadata[name] = content
                
                result["metadata"] = metadata
                
                return result
                
        except Exception as e:
            logger.error(f"Failed to scrape URL {url}: {e}")
            return {
                "url": url,
                "error": str(e),
                "status": "failed"
            }
    
    async def process_scraping_job(
        self,
        job_id: int,
        urls: List[str],
        options: Dict[str, Any],
        db: AsyncSession
    ):
        """
        Process a scraping job in the background.
        """
        try:
            # Get job
            result = await db.execute(
                select(ResearchJob).where(ResearchJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                logger.error(f"Scraping job {job_id} not found")
                return
            
            # Update job status
            job.status = ResearchJobStatus.IN_PROGRESS
            job.started_at = datetime.utcnow()
            job.current_step = "Starting scraping process"
            await db.commit()
            
            results = []
            total_urls = len(urls)
            
            for i, url in enumerate(urls):
                try:
                    # Update progress
                    job.progress_percentage = int((i / total_urls) * 100)
                    job.current_step = f"Scraping {url}"
                    await db.commit()
                    
                    # Scrape URL
                    result = await self.scrape_url(
                        url=url,
                        options=options,
                        extract_images=options.get('extract_images', False),
                        extract_links=options.get('extract_links', False),
                        user_agent=options.get('user_agent')
                    )
                    
                    results.append(result)
                    
                    # Add delay between requests
                    delay = options.get('delay_seconds', 1.0)
                    await asyncio.sleep(delay)
                    
                except Exception as e:
                    logger.error(f"Failed to scrape URL {url}: {e}")
                    results.append({
                        "url": url,
                        "error": str(e),
                        "status": "failed"
                    })
            
            # Update job completion
            job.status = ResearchJobStatus.COMPLETED
            job.progress_percentage = 100
            job.completed_at = datetime.utcnow()
            job.current_step = "Scraping completed"
            job.result_data = json.dumps(results)
            
            await db.commit()
            
            logger.info(f"Completed scraping job {job_id} with {len(results)} results")
            
        except Exception as e:
            logger.error(f"Failed to process scraping job {job_id}: {e}")
            
            # Update job with error
            try:
                job.status = ResearchJobStatus.FAILED
                job.error_message = str(e)
                job.current_step = "Job failed"
                await db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update job status: {commit_error}")


# Service instance
scraping_service = WebScrapingService()

# API Endpoints
@router.post("/scrape", response_model=ScrapingJobResponse)
async def scrape_url(
    request: ScrapingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ScrapingJobResponse:
    """
    Start a web scraping job for a single URL.
    
    - **url**: URL to scrape
    - **extract_images**: Extract image URLs from the page
    - **extract_links**: Extract all links from the page
    - **follow_redirects**: Follow HTTP redirects
    - **max_depth**: Maximum depth for recursive scraping (1-5)
    - **delay_seconds**: Delay between requests (0.5-10.0 seconds)
    """
    try:
        # Create scraping job
        job_data = {
            "url": request.url,
            "options": request.options,
            "extract_images": request.extract_images,
            "extract_links": request.extract_links,
            "delay_seconds": request.delay_seconds,
            "user_agent": request.user_agent
        }
        
        job = ResearchJob(
            job_type=ResearchJobType.WEB_SCRAPING,
            job_name=f"Scrape: {request.url}",
            status=ResearchJobStatus.PENDING,
            input_data=json.dumps(job_data),
            user_id=current_user.id
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            scraping_service.process_scraping_job,
            job.id,
            [request.url],
            job_data,
            db
        )
        
        logger.info(f"Started scraping job {job.id} for URL: {request.url}")
        
        return ScrapingJobResponse(
            job_id=job.id,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            started_at=job.started_at,
            estimated_completion=None,
            message="Scraping job started successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to start scraping job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start scraping job: {str(e)}"
        )


@router.post("/scrape/batch", response_model=ScrapingJobResponse)
async def scrape_urls_batch(
    request: BatchScrapingRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ScrapingJobResponse:
    """
    Start a batch web scraping job for multiple URLs.
    
    - **urls**: List of URLs to scrape (max 50)
    - **extract_images**: Extract image URLs from pages
    - **extract_links**: Extract all links from pages
    - **delay_seconds**: Delay between requests (0.5-10.0 seconds)
    """
    try:
        # Create batch scraping job
        job_data = {
            "urls": request.urls,
            "options": request.options,
            "extract_images": request.extract_images,
            "extract_links": request.extract_links,
            "delay_seconds": request.delay_seconds
        }
        
        job = ResearchJob(
            job_type=ResearchJobType.WEB_SCRAPING,
            job_name=f"Batch Scrape: {len(request.urls)} URLs",
            status=ResearchJobStatus.PENDING,
            input_data=json.dumps(job_data),
            user_id=current_user.id
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            scraping_service.process_scraping_job,
            job.id,
            request.urls,
            job_data,
            db
        )
        
        estimated_completion = datetime.utcnow() + timedelta(
            seconds=len(request.urls) * request.delay_seconds + 60
        )
        
        logger.info(f"Started batch scraping job {job.id} for {len(request.urls)} URLs")
        
        return ScrapingJobResponse(
            job_id=job.id,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            started_at=job.started_at,
            estimated_completion=estimated_completion,
            message=f"Batch scraping job started for {len(request.urls)} URLs"
        )
        
    except Exception as e:
        logger.error(f"Failed to start batch scraping job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start batch scraping job: {str(e)}"
        )


@router.get("/jobs/{job_id}/status", response_model=ScrapingJobResponse)
async def get_scraping_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ScrapingJobResponse:
    """
    Get the status of a scraping job.
    
    - **job_id**: ID of the scraping job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.WEB_SCRAPING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scraping job not found"
            )
        
        return ScrapingJobResponse(
            job_id=job.id,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            started_at=job.started_at,
            estimated_completion=job.estimated_completion,
            message=f"Job status: {job.status}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scraping job status {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/jobs/{job_id}/results")
async def get_scraping_job_results(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get the results of a completed scraping job.
    
    - **job_id**: ID of the scraping job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.WEB_SCRAPING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scraping job not found"
            )
        
        if job.status != ResearchJobStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Job is not completed. Current status: {job.status}"
            )
        
        # Parse results
        results = []
        if job.result_data:
            try:
                results = json.loads(job.result_data)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse results for job {job_id}")
        
        return {
            "job_id": job.id,
            "status": job.status,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "total_urls": len(results),
            "successful_scrapes": len([r for r in results if r.get("status") != "failed"]),
            "failed_scrapes": len([r for r in results if r.get("status") == "failed"]),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get scraping job results {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job results: {str(e)}"
        )


@router.get("/jobs", response_model=List[ScrapingJobResponse])
async def get_scraping_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    status_filter: Optional[str] = Query(None, description="Filter by job status")
) -> List[ScrapingJobResponse]:
    """
    Get user's scraping jobs with optional filtering.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **status_filter**: Filter by job status
    """
    try:
        query = select(ResearchJob).where(
            ResearchJob.user_id == current_user.id,
            ResearchJob.job_type == ResearchJobType.WEB_SCRAPING
        )
        
        if status_filter:
            query = query.where(ResearchJob.status == status_filter)
        
        query = query.order_by(ResearchJob.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        jobs = result.scalars().all()
        
        return [
            ScrapingJobResponse(
                job_id=job.id,
                status=job.status,
                progress_percentage=job.progress_percentage,
                current_step=job.current_step,
                started_at=job.started_at,
                estimated_completion=job.estimated_completion,
                message=job.job_name or "Scraping job"
            )
            for job in jobs
        ]
        
    except Exception as e:
        logger.error(f"Failed to get scraping jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve scraping jobs: {str(e)}"
        )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_scraping_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel or delete a scraping job.
    
    - **job_id**: ID of the scraping job to cancel
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.WEB_SCRAPING
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scraping job not found"
            )
        
        # If job is running, mark as cancelled. If completed/failed, delete it.
        if job.status in [ResearchJobStatus.PENDING, ResearchJobStatus.IN_PROGRESS]:
            job.status = ResearchJobStatus.CANCELLED
            job.current_step = "Job cancelled by user"
            await db.commit()
        else:
            await db.delete(job)
            await db.commit()
        
        logger.info(f"Cancelled/deleted scraping job {job_id} for user {current_user.username}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel scraping job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job: {str(e)}"
        )