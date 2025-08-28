"""
SWOT Analysis API endpoints.
Comprehensive SWOT analysis capabilities for intelligence analysts.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.framework import FrameworkType
from app.models.user import User
from app.services.framework_service import (
    FrameworkData,
    SWOTAnalysisData,
    framework_service,
)

logger = get_logger(__name__)
router = APIRouter()


class SWOTCreateRequest(BaseModel):
    """SWOT analysis creation request."""
    title: str
    objective: str
    context: Optional[str] = None
    initial_strengths: Optional[list[str]] = []
    initial_weaknesses: Optional[list[str]] = []
    initial_opportunities: Optional[list[str]] = []
    initial_threats: Optional[list[str]] = []
    request_ai_suggestions: bool = True


class SWOTUpdateRequest(BaseModel):
    """SWOT analysis update request."""
    title: Optional[str] = None
    objective: Optional[str] = None
    context: Optional[str] = None
    strengths: Optional[list[str]] = None
    weaknesses: Optional[list[str]] = None
    opportunities: Optional[list[str]] = None
    threats: Optional[list[str]] = None


class SWOTAnalysisResponse(BaseModel):
    """SWOT analysis response."""
    session_id: int
    title: str
    objective: str
    context: Optional[str]
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]
    ai_suggestions: Optional[dict] = None
    status: str
    version: int


class SWOTAISuggestionRequest(BaseModel):
    """Request for AI suggestions on SWOT analysis."""
    session_id: int
    focus_area: Optional[str] = None  # strengths, weaknesses, opportunities, threats, or all
    additional_context: Optional[str] = None


@router.post("/", response_model=SWOTAnalysisResponse)
async def create_swot_analysis_simple(
    request: SWOTCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SWOTAnalysisResponse:
    """Create SWOT analysis (standard endpoint)."""
    return await create_swot_analysis(request, current_user, db)


@router.post("/create", response_model=SWOTAnalysisResponse)
async def create_swot_analysis(
    request: SWOTCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SWOTAnalysisResponse:
    """
    Create a new SWOT analysis session.
    
    Args:
        request: SWOT creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        SWOTAnalysisResponse: Created SWOT analysis
    """
    logger.info(f"Creating SWOT analysis: {request.title} for user {current_user.username}")
    
    # Prepare SWOT data
    swot_data = {
        "objective": request.objective,
        "context": request.context or "",
        "strengths": request.initial_strengths or [],
        "weaknesses": request.initial_weaknesses or [],
        "opportunities": request.initial_opportunities or [],
        "threats": request.initial_threats or [],
    }
    
    # Get AI suggestions if requested
    ai_suggestions = None
    if request.request_ai_suggestions:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.SWOT,
                swot_data,
                "suggest"
            )
            ai_suggestions = ai_result.get("suggestions")
            
            # Merge AI suggestions with initial data
            if ai_suggestions:
                for category in ["strengths", "weaknesses", "opportunities", "threats"]:
                    if category in ai_suggestions and isinstance(ai_suggestions[category], list):
                        swot_data[category].extend(ai_suggestions[category])
                        # Remove duplicates while preserving order
                        swot_data[category] = list(dict.fromkeys(swot_data[category]))
                        
        except Exception as e:
            logger.warning(f"Failed to get AI suggestions: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.SWOT,
        title=request.title,
        description=f"SWOT Analysis - Objective: {request.objective}",
        data=swot_data,
        tags=["swot", "strategic-analysis"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    return SWOTAnalysisResponse(
        session_id=session.id,
        title=session.title,
        objective=swot_data["objective"],
        context=swot_data.get("context"),
        strengths=swot_data["strengths"],
        weaknesses=swot_data["weaknesses"],
        opportunities=swot_data["opportunities"],
        threats=swot_data["threats"],
        ai_suggestions=ai_suggestions,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=SWOTAnalysisResponse)
async def get_swot_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SWOTAnalysisResponse:
    """
    Get a specific SWOT analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        SWOTAnalysisResponse: SWOT analysis data
    """
    # TODO: Implement database retrieval
    # For now, return mock data
    logger.info(f"Getting SWOT analysis {session_id}")
    
    return SWOTAnalysisResponse(
        session_id=session_id,
        title="Strategic Market Analysis",
        objective="Analyze competitive position in emerging markets",
        context="Q4 2025 strategic planning",
        strengths=[
            "Strong brand recognition",
            "Advanced technology platform",
            "Experienced leadership team",
            "Robust financial position"
        ],
        weaknesses=[
            "Limited international presence",
            "High operational costs",
            "Dependency on key suppliers"
        ],
        opportunities=[
            "Growing demand in Asian markets",
            "Digital transformation trends",
            "Strategic partnership possibilities",
            "Regulatory changes favoring innovation"
        ],
        threats=[
            "Increased competition from startups",
            "Economic uncertainty",
            "Supply chain disruptions",
            "Cybersecurity risks"
        ],
        status="in_progress",
        version=1
    )


@router.put("/{session_id}", response_model=SWOTAnalysisResponse)
async def update_swot_analysis(
    session_id: int,
    request: SWOTUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SWOTAnalysisResponse:
    """
    Update a SWOT analysis session.
    
    Args:
        session_id: Session ID
        request: Update request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        SWOTAnalysisResponse: Updated SWOT analysis
    """
    logger.info(f"Updating SWOT analysis {session_id}")
    
    # Build update data
    updates = {}
    swot_data = {}
    
    if request.title:
        updates["title"] = request.title
    
    if request.objective is not None:
        swot_data["objective"] = request.objective
    
    if request.context is not None:
        swot_data["context"] = request.context
    
    for field in ["strengths", "weaknesses", "opportunities", "threats"]:
        value = getattr(request, field)
        if value is not None:
            swot_data[field] = value
    
    if swot_data:
        updates["data"] = swot_data
    
    # Update session
    session = await framework_service.update_session(
        db, session_id, current_user, updates
    )
    
    # Parse data
    import json
    data = json.loads(session.data)
    
    return SWOTAnalysisResponse(
        session_id=session.id,
        title=session.title,
        objective=data.get("objective", ""),
        context=data.get("context"),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        opportunities=data.get("opportunities", []),
        threats=data.get("threats", []),
        status=session.status.value,
        version=session.version
    )


@router.post("/{session_id}/ai-suggestions")
async def get_ai_suggestions(
    session_id: int,
    request: SWOTAISuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get AI-powered suggestions for SWOT analysis.
    
    Args:
        session_id: Session ID
        request: AI suggestion request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: AI suggestions
    """
    logger.info(f"Getting AI suggestions for SWOT analysis {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    swot_data = {
        "objective": "Analyze competitive position",
        "context": request.additional_context or "",
        "strengths": ["Strong brand", "Good technology"],
        "weaknesses": ["High costs"],
        "opportunities": ["New markets"],
        "threats": ["Competition"]
    }
    
    # Get AI suggestions
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.SWOT,
        swot_data,
        "suggest"
    )
    
    # Filter by focus area if specified
    if request.focus_area and request.focus_area != "all":
        suggestions = ai_result.get("suggestions", {})
        if request.focus_area in suggestions:
            ai_result["suggestions"] = {
                request.focus_area: suggestions[request.focus_area]
            }
    
    return ai_result


@router.post("/{session_id}/validate")
async def validate_swot_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Validate SWOT analysis using AI.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Validation results
    """
    logger.info(f"Validating SWOT analysis {session_id}")
    
    # TODO: Get actual session data from database
    swot_data = {
        "objective": "Analyze competitive position",
        "strengths": ["Strong brand", "Good technology"],
        "weaknesses": ["High costs"],
        "opportunities": ["New markets"],
        "threats": ["Competition"]
    }
    
    # Validate with AI
    validation_result = await framework_service.analyze_with_ai(
        FrameworkType.SWOT,
        swot_data,
        "validate"
    )
    
    return validation_result


@router.post("/{session_id}/export")
async def export_swot_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export SWOT analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting SWOT analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json"
        )
    
    # TODO: Implement actual export functionality
    # For now, return mock response
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/swot_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_swot_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available SWOT analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    # Return common SWOT templates
    templates = [
        {
            "id": 1,
            "name": "Business Strategy SWOT",
            "description": "Template for business strategic planning",
            "categories": {
                "strengths": ["Market position", "Resources", "Capabilities"],
                "weaknesses": ["Limitations", "Gaps", "Vulnerabilities"],
                "opportunities": ["Market trends", "Partnerships", "Innovation"],
                "threats": ["Competition", "Regulations", "Market risks"]
            }
        },
        {
            "id": 2,
            "name": "Competitive Intelligence SWOT",
            "description": "Template for competitive analysis",
            "categories": {
                "strengths": ["Competitive advantages", "Market share", "Brand strength"],
                "weaknesses": ["Competitive disadvantages", "Market gaps", "Resource constraints"],
                "opportunities": ["Market expansion", "Competitor weaknesses", "Emerging technologies"],
                "threats": ["New entrants", "Substitute products", "Market disruption"]
            }
        },
        {
            "id": 3,
            "name": "Security Assessment SWOT",
            "description": "Template for security and risk assessment",
            "categories": {
                "strengths": ["Security capabilities", "Response readiness", "Intelligence assets"],
                "weaknesses": ["Security gaps", "Resource limitations", "Training needs"],
                "opportunities": ["Technology improvements", "Partnerships", "Funding"],
                "threats": ["Threat actors", "Vulnerabilities", "Emerging risks"]
            }
        }
    ]
    
    return templates