"""
Social media download API endpoints for content collection and analysis.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from datetime import datetime
from enum import Enum

from app.core.database import get_async_db
from app.core.auth import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.models.research_tool import ResearchJob, ResearchJobStatus, ResearchJobType

logger = get_logger(__name__)

router = APIRouter()

# Enums and Models
class SocialPlatform(str, Enum):
    """Supported social media platforms."""
    TWITTER = "twitter"
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    TIKTOK = "tiktok"
    REDDIT = "reddit"


class ContentType(str, Enum):
    """Types of content to download."""
    POST = "post"
    PROFILE = "profile"
    COMMENTS = "comments"
    MEDIA = "media"
    METADATA = "metadata"


class SocialMediaDownloadRequest(BaseModel):
    """Request model for social media content download."""
    platform: SocialPlatform
    url: str
    content_types: List[ContentType] = [ContentType.POST, ContentType.METADATA]
    include_comments: bool = False
    include_media: bool = False
    max_comments: int = 100
    download_images: bool = False
    download_videos: bool = False
    
    @validator('max_comments')
    def validate_max_comments(cls, v):
        """Validate max comments."""
        if v < 0 or v > 1000:
            raise ValueError("Max comments must be between 0 and 1000")
        return v


class BatchSocialMediaRequest(BaseModel):
    """Request model for batch social media downloads."""
    downloads: List[SocialMediaDownloadRequest]
    
    @validator('downloads')
    def validate_downloads(cls, v):
        """Validate downloads list."""
        if len(v) > 20:
            raise ValueError("Maximum 20 downloads allowed per batch")
        if not v:
            raise ValueError("At least one download is required")
        return v


class SocialMediaJobResponse(BaseModel):
    """Response model for social media download jobs."""
    job_id: int
    platform: str
    status: str
    progress_percentage: int
    current_step: Optional[str]
    started_at: Optional[datetime]
    estimated_completion: Optional[datetime]
    message: str
    
    class Config:
        from_attributes = True


class PlatformInfoResponse(BaseModel):
    """Response model for platform information."""
    platform: str
    supported: bool
    requires_auth: bool
    content_types: List[str]
    rate_limits: Dict[str, Any]
    notes: Optional[str]


# Social Media Service
class SocialMediaService:
    """Service for social media content download."""
    
    # Platform configurations
    PLATFORM_CONFIG = {
        SocialPlatform.TWITTER: {
            "supported": True,
            "requires_auth": True,
            "content_types": ["post", "profile", "comments", "media"],
            "rate_limits": {"requests_per_hour": 100},
            "notes": "Requires Twitter API access"
        },
        SocialPlatform.YOUTUBE: {
            "supported": True,
            "requires_auth": False,
            "content_types": ["post", "profile", "comments", "media"],
            "rate_limits": {"requests_per_hour": 200},
            "notes": "Uses yt-dlp for video downloads"
        },
        SocialPlatform.INSTAGRAM: {
            "supported": True,
            "requires_auth": False,
            "content_types": ["post", "profile", "media"],
            "rate_limits": {"requests_per_hour": 50},
            "notes": "Limited to public content only"
        },
        SocialPlatform.REDDIT: {
            "supported": True,
            "requires_auth": False,
            "content_types": ["post", "comments", "profile"],
            "rate_limits": {"requests_per_hour": 150},
            "notes": "Public subreddits and posts"
        },
        SocialPlatform.TIKTOK: {
            "supported": False,
            "requires_auth": False,
            "content_types": [],
            "rate_limits": {},
            "notes": "Not currently supported due to API restrictions"
        },
        SocialPlatform.FACEBOOK: {
            "supported": False,
            "requires_auth": True,
            "content_types": [],
            "rate_limits": {},
            "notes": "Not supported due to API restrictions"
        },
        SocialPlatform.LINKEDIN: {
            "supported": False,
            "requires_auth": True,
            "content_types": [],
            "rate_limits": {},
            "notes": "Not currently supported"
        }
    }
    
    async def download_twitter_content(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Download Twitter content."""
        # Placeholder for Twitter API integration
        # In production, this would use the Twitter API v2
        
        try:
            # Simulate Twitter content extraction
            await asyncio.sleep(2)  # Simulate API call
            
            return {
                "platform": "twitter",
                "url": url,
                "content_type": "tweet",
                "text": "Sample tweet content (API integration required)",
                "author": "sample_user",
                "created_at": datetime.utcnow().isoformat(),
                "engagement": {
                    "likes": 0,
                    "retweets": 0,
                    "replies": 0
                },
                "media": [],
                "hashtags": [],
                "mentions": [],
                "status": "simulated"
            }
            
        except Exception as e:
            logger.error(f"Failed to download Twitter content: {e}")
            return {"error": str(e), "status": "failed"}
    
    async def download_youtube_content(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Download YouTube content."""
        # Placeholder for YouTube content extraction
        # In production, this would use yt-dlp or YouTube Data API
        
        try:
            # Simulate YouTube content extraction
            await asyncio.sleep(3)  # Simulate processing
            
            return {
                "platform": "youtube",
                "url": url,
                "content_type": "video",
                "title": "Sample YouTube Video (API integration required)",
                "description": "Sample video description",
                "channel": "sample_channel",
                "duration": "5:30",
                "views": 1000,
                "likes": 50,
                "published_at": datetime.utcnow().isoformat(),
                "thumbnails": [],
                "tags": [],
                "status": "simulated"
            }
            
        except Exception as e:
            logger.error(f"Failed to download YouTube content: {e}")
            return {"error": str(e), "status": "failed"}
    
    async def download_instagram_content(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Download Instagram content."""
        # Placeholder for Instagram content extraction
        
        try:
            # Simulate Instagram content extraction
            await asyncio.sleep(2)  # Simulate processing
            
            return {
                "platform": "instagram",
                "url": url,
                "content_type": "post",
                "caption": "Sample Instagram post (API integration required)",
                "username": "sample_user",
                "posted_at": datetime.utcnow().isoformat(),
                "likes": 100,
                "comments_count": 10,
                "media_type": "photo",
                "media_urls": [],
                "hashtags": [],
                "status": "simulated"
            }
            
        except Exception as e:
            logger.error(f"Failed to download Instagram content: {e}")
            return {"error": str(e), "status": "failed"}
    
    async def download_reddit_content(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Download Reddit content."""
        # Placeholder for Reddit content extraction
        # In production, this would use PRAW (Python Reddit API Wrapper)
        
        try:
            # Simulate Reddit content extraction
            await asyncio.sleep(1)  # Simulate API call
            
            return {
                "platform": "reddit",
                "url": url,
                "content_type": "post",
                "title": "Sample Reddit Post (API integration required)",
                "text": "Sample post content",
                "subreddit": "sample_subreddit",
                "author": "sample_user",
                "created_at": datetime.utcnow().isoformat(),
                "score": 100,
                "comments_count": 25,
                "awards": [],
                "flair": None,
                "status": "simulated"
            }
            
        except Exception as e:
            logger.error(f"Failed to download Reddit content: {e}")
            return {"error": str(e), "status": "failed"}
    
    async def download_content(self, platform: SocialPlatform, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Download content from specified platform."""
        
        # Check if platform is supported
        if not self.PLATFORM_CONFIG[platform]["supported"]:
            return {
                "error": f"Platform {platform} is not currently supported",
                "status": "unsupported"
            }
        
        # Route to appropriate platform handler
        if platform == SocialPlatform.TWITTER:
            return await self.download_twitter_content(url, options)
        elif platform == SocialPlatform.YOUTUBE:
            return await self.download_youtube_content(url, options)
        elif platform == SocialPlatform.INSTAGRAM:
            return await self.download_instagram_content(url, options)
        elif platform == SocialPlatform.REDDIT:
            return await self.download_reddit_content(url, options)
        else:
            return {
                "error": f"No handler implemented for platform {platform}",
                "status": "not_implemented"
            }
    
    async def process_download_job(
        self,
        job_id: int,
        downloads: List[Dict[str, Any]],
        db: AsyncSession
    ):
        """Process a social media download job in the background."""
        import asyncio
        
        try:
            # Get job
            result = await db.execute(
                select(ResearchJob).where(ResearchJob.id == job_id)
            )
            job = result.scalar_one_or_none()
            
            if not job:
                logger.error(f"Download job {job_id} not found")
                return
            
            # Update job status
            job.status = ResearchJobStatus.IN_PROGRESS
            job.started_at = datetime.utcnow()
            job.current_step = "Starting downloads"
            await db.commit()
            
            results = []
            total_downloads = len(downloads)
            
            for i, download_config in enumerate(downloads):
                try:
                    # Update progress
                    job.progress_percentage = int((i / total_downloads) * 100)
                    job.current_step = f"Downloading from {download_config['platform']}"
                    await db.commit()
                    
                    # Download content
                    result = await self.download_content(
                        platform=SocialPlatform(download_config['platform']),
                        url=download_config['url'],
                        options=download_config
                    )
                    
                    results.append(result)
                    
                    # Add delay between downloads to respect rate limits
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    logger.error(f"Failed to download from {download_config.get('platform', 'unknown')}: {e}")
                    results.append({
                        "platform": download_config.get('platform', 'unknown'),
                        "url": download_config.get('url', ''),
                        "error": str(e),
                        "status": "failed"
                    })
            
            # Update job completion
            job.status = ResearchJobStatus.COMPLETED
            job.progress_percentage = 100
            job.completed_at = datetime.utcnow()
            job.current_step = "Downloads completed"
            job.result_data = json.dumps(results)
            
            await db.commit()
            
            logger.info(f"Completed download job {job_id} with {len(results)} results")
            
        except Exception as e:
            logger.error(f"Failed to process download job {job_id}: {e}")
            
            # Update job with error
            try:
                job.status = ResearchJobStatus.FAILED
                job.error_message = str(e)
                job.current_step = "Job failed"
                await db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update job status: {commit_error}")


# Service instance
social_media_service = SocialMediaService()

# API Endpoints
@router.get("/platforms", response_model=List[PlatformInfoResponse])
async def get_supported_platforms() -> List[PlatformInfoResponse]:
    """
    Get list of supported social media platforms and their capabilities.
    """
    platforms = []
    
    for platform, config in social_media_service.PLATFORM_CONFIG.items():
        platforms.append(PlatformInfoResponse(
            platform=platform.value,
            supported=config["supported"],
            requires_auth=config["requires_auth"],
            content_types=config["content_types"],
            rate_limits=config["rate_limits"],
            notes=config.get("notes")
        ))
    
    return platforms


@router.post("/download", response_model=SocialMediaJobResponse)
async def download_social_media_content(
    request: SocialMediaDownloadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> SocialMediaJobResponse:
    """
    Start a social media content download job.
    
    - **platform**: Social media platform (twitter, youtube, instagram, reddit)
    - **url**: URL of the content to download
    - **content_types**: Types of content to extract
    - **include_comments**: Include comments in download
    - **include_media**: Include media files
    - **download_images**: Download image files
    - **download_videos**: Download video files
    """
    try:
        # Check if platform is supported
        if not social_media_service.PLATFORM_CONFIG[request.platform]["supported"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Platform {request.platform} is not currently supported"
            )
        
        # Create download job
        job_data = request.dict()
        
        job = ResearchJob(
            job_type=ResearchJobType.SOCIAL_MEDIA_ANALYSIS,
            job_name=f"Download: {request.platform} - {request.url}",
            status=ResearchJobStatus.PENDING,
            input_data=json.dumps(job_data),
            user_id=current_user.id
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            social_media_service.process_download_job,
            job.id,
            [job_data],
            db
        )
        
        logger.info(f"Started social media download job {job.id} for {request.platform}: {request.url}")
        
        return SocialMediaJobResponse(
            job_id=job.id,
            platform=request.platform,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            started_at=job.started_at,
            estimated_completion=None,
            message="Download job started successfully"
        )
        
    except Exception as e:
        logger.error(f"Failed to start download job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start download job: {str(e)}"
        )


@router.post("/download/batch", response_model=SocialMediaJobResponse)
async def download_batch_social_media(
    request: BatchSocialMediaRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> SocialMediaJobResponse:
    """
    Start a batch social media download job for multiple platforms/URLs.
    
    - **downloads**: List of download configurations (max 20)
    """
    try:
        # Validate all platforms are supported
        for download in request.downloads:
            if not social_media_service.PLATFORM_CONFIG[download.platform]["supported"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Platform {download.platform} is not currently supported"
                )
        
        # Create batch download job
        job_data = [download.dict() for download in request.downloads]
        
        platforms = list(set(d.platform for d in request.downloads))
        platform_str = ", ".join(platforms)
        
        job = ResearchJob(
            job_type=ResearchJobType.SOCIAL_MEDIA_ANALYSIS,
            job_name=f"Batch Download: {len(request.downloads)} items from {platform_str}",
            status=ResearchJobStatus.PENDING,
            input_data=json.dumps(job_data),
            user_id=current_user.id
        )
        
        db.add(job)
        await db.commit()
        await db.refresh(job)
        
        # Start background processing
        background_tasks.add_task(
            social_media_service.process_download_job,
            job.id,
            job_data,
            db
        )
        
        logger.info(f"Started batch download job {job.id} for {len(request.downloads)} items")
        
        return SocialMediaJobResponse(
            job_id=job.id,
            platform=platform_str,
            status=job.status,
            progress_percentage=job.progress_percentage,
            current_step=job.current_step,
            started_at=job.started_at,
            estimated_completion=None,
            message=f"Batch download job started for {len(request.downloads)} items"
        )
        
    except Exception as e:
        logger.error(f"Failed to start batch download job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start batch download job: {str(e)}"
        )


@router.get("/jobs/{job_id}/status", response_model=SocialMediaJobResponse)
async def get_download_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> SocialMediaJobResponse:
    """
    Get the status of a social media download job.
    
    - **job_id**: ID of the download job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.SOCIAL_MEDIA_ANALYSIS
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Download job not found"
            )
        
        # Extract platform from job name or input data
        platform = "unknown"
        if job.input_data:
            try:
                input_data = json.loads(job.input_data)
                if isinstance(input_data, list) and input_data:
                    platform = input_data[0].get('platform', 'unknown')
                elif isinstance(input_data, dict):
                    platform = input_data.get('platform', 'unknown')
            except json.JSONDecodeError:
                pass
        
        return SocialMediaJobResponse(
            job_id=job.id,
            platform=platform,
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
        logger.error(f"Failed to get download job status {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job status: {str(e)}"
        )


@router.get("/jobs/{job_id}/results")
async def get_download_job_results(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get the results of a completed social media download job.
    
    - **job_id**: ID of the download job
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.SOCIAL_MEDIA_ANALYSIS
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Download job not found"
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
            "total_downloads": len(results),
            "successful_downloads": len([r for r in results if r.get("status") != "failed"]),
            "failed_downloads": len([r for r in results if r.get("status") == "failed"]),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get download job results {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job results: {str(e)}"
        )


@router.get("/jobs")
async def get_download_jobs(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    platform: Optional[str] = Query(None, description="Filter by platform"),
    status_filter: Optional[str] = Query(None, description="Filter by job status")
) -> List[dict]:
    """
    Get user's social media download jobs with optional filtering.
    
    - **skip**: Number of records to skip for pagination
    - **limit**: Maximum number of records to return
    - **platform**: Filter by platform
    - **status_filter**: Filter by job status
    """
    try:
        query = select(ResearchJob).where(
            ResearchJob.user_id == current_user.id,
            ResearchJob.job_type == ResearchJobType.SOCIAL_MEDIA_ANALYSIS
        )
        
        if status_filter:
            query = query.where(ResearchJob.status == status_filter)
        
        query = query.order_by(ResearchJob.created_at.desc()).offset(skip).limit(limit)
        
        result = await db.execute(query)
        jobs = result.scalars().all()
        
        # Format jobs with platform information
        formatted_jobs = []
        for job in jobs:
            # Extract platform from input data
            platform_name = "unknown"
            if job.input_data:
                try:
                    input_data = json.loads(job.input_data)
                    if isinstance(input_data, list) and input_data:
                        platform_name = input_data[0].get('platform', 'unknown')
                    elif isinstance(input_data, dict):
                        platform_name = input_data.get('platform', 'unknown')
                except json.JSONDecodeError:
                    pass
            
            # Apply platform filter
            if platform and platform_name != platform:
                continue
            
            formatted_jobs.append({
                "job_id": job.id,
                "platform": platform_name,
                "job_name": job.job_name,
                "status": job.status,
                "progress_percentage": job.progress_percentage,
                "current_step": job.current_step,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "created_at": job.created_at.isoformat()
            })
        
        return formatted_jobs
        
    except Exception as e:
        logger.error(f"Failed to get download jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve download jobs: {str(e)}"
        )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_download_job(
    job_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel or delete a social media download job.
    
    - **job_id**: ID of the download job to cancel
    """
    try:
        result = await db.execute(
            select(ResearchJob).where(
                ResearchJob.id == job_id,
                ResearchJob.user_id == current_user.id,
                ResearchJob.job_type == ResearchJobType.SOCIAL_MEDIA_ANALYSIS
            )
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Download job not found"
            )
        
        # If job is running, mark as cancelled. If completed/failed, delete it.
        if job.status in [ResearchJobStatus.PENDING, ResearchJobStatus.IN_PROGRESS]:
            job.status = ResearchJobStatus.CANCELLED
            job.current_step = "Job cancelled by user"
            await db.commit()
        else:
            await db.delete(job)
            await db.commit()
        
        logger.info(f"Cancelled/deleted download job {job_id} for user {current_user.username}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel download job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel job: {str(e)}"
        )