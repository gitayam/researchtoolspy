"""
AI endpoints for GPT-5-mini integration.
"""

from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import get_logger
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.services.ai_service import ai_service

logger = get_logger(__name__)
router = APIRouter()


class FiveWAnalysisRequest(BaseModel):
    """Request for 5W analysis."""
    content: str
    
class FiveWAnalysisResponse(BaseModel):
    """5W analysis result."""
    who: str
    what: str
    where: str
    when: str
    why: str


class StarburstingQuestionsRequest(BaseModel):
    """Request for Starbursting questions."""
    central_idea: str
    context: Optional[str] = None
    
class StarburstingQuestionsResponse(BaseModel):
    """Starbursting questions result."""
    questions: List[str]


class SummarizeRequest(BaseModel):
    """Request for content summarization."""
    content: str
    max_length: Optional[int] = 200
    
class SummarizeResponse(BaseModel):
    """Summarization result."""
    summary: str


class DIMEAnalysisRequest(BaseModel):
    """Request for DIME analysis."""
    scenario: str
    objective: str
    
class DIMEAnalysisResponse(BaseModel):
    """DIME analysis result."""
    diplomatic: List[str]
    information: List[str]
    military: List[str]
    economic: List[str]


@router.post("/5w-analysis", response_model=FiveWAnalysisResponse)
async def analyze_5w(
    request: FiveWAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> FiveWAnalysisResponse:
    """
    Extract 5W information from content using AI.
    """
    logger.info(f"5W analysis requested by user {current_user.username}")
    
    try:
        analysis = await ai_service.generate_5w_analysis(request.content)
        return FiveWAnalysisResponse(**analysis)
    except Exception as e:
        logger.error(f"5W analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI analysis failed: {str(e)}"
        )


@router.post("/starbursting/questions", response_model=StarburstingQuestionsResponse)
async def generate_starbursting_questions(
    request: StarburstingQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StarburstingQuestionsResponse:
    """
    Generate expansion questions for Starbursting framework.
    """
    logger.info(f"Starbursting questions requested by user {current_user.username}")
    
    try:
        questions = await ai_service.generate_starbursting_questions(
            request.central_idea,
            request.context or ""
        )
        return StarburstingQuestionsResponse(questions=questions)
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Question generation failed: {str(e)}"
        )


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_content(
    request: SummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SummarizeResponse:
    """
    Summarize content using AI.
    """
    logger.info(f"Summarization requested by user {current_user.username}")
    
    try:
        summary = await ai_service.summarize_content(
            request.content,
            request.max_length or 200
        )
        return SummarizeResponse(summary=summary)
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summarization failed: {str(e)}"
        )


@router.post("/dime/suggestions", response_model=DIMEAnalysisResponse)
async def generate_dime_suggestions(
    request: DIMEAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DIMEAnalysisResponse:
    """
    Generate DIME framework suggestions using AI.
    """
    logger.info(f"DIME suggestions requested by user {current_user.username}")
    
    try:
        suggestions = await ai_service.generate_dime_suggestions(
            request.scenario,
            request.objective
        )
        return DIMEAnalysisResponse(**suggestions)
    except Exception as e:
        logger.error(f"DIME analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DIME analysis failed: {str(e)}"
        )


@router.get("/status")
async def get_ai_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Check AI service status and availability.
    """
    is_available = ai_service.async_client is not None
    
    return {
        "available": "true" if is_available else "false",
        "model": ai_service.model if is_available else "not configured",
        "message": "AI service ready" if is_available else "OpenAI API key not configured"
    }