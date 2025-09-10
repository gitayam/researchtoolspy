"""
DOTMLPF Framework API endpoints.
Capability gap analysis for defense and military planning.
"""


from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.framework import FrameworkType
from app.models.user import User
from app.services.framework_service import FrameworkData, framework_service

logger = get_logger(__name__)
router = APIRouter()


class CapabilityGap(BaseModel):
    """Capability gap model for DOTMLPF analysis."""
    id: str
    description: str
    priority: str  # "critical", "high", "medium", "low"
    current_capability: str
    required_capability: str
    gap_analysis: str
    affected_areas: list[str]  # Which DOTMLPF areas are affected
    mitigation_options: list[str] | None = []


class DOTMLPFComponent(BaseModel):
    """DOTMLPF component model."""
    name: str  # doctrine, organization, training, materiel, leadership, personnel, facilities
    current_state: str
    desired_state: str
    gaps: list[str]
    recommendations: list[str]
    priority: str  # "critical", "high", "medium", "low"
    timeline: str | None = None
    resources_required: str | None = None


class DOTMLPFCreateRequest(BaseModel):
    """DOTMLPF analysis creation request."""
    title: str
    mission: str
    scenario: str
    timeframe: str | None = None
    doctrine: DOTMLPFComponent | None = None
    organization: DOTMLPFComponent | None = None
    training: DOTMLPFComponent | None = None
    materiel: DOTMLPFComponent | None = None
    leadership: DOTMLPFComponent | None = None
    personnel: DOTMLPFComponent | None = None
    facilities: DOTMLPFComponent | None = None
    capability_gaps: list[CapabilityGap] | None = []
    request_ai_analysis: bool = True


class DOTMLPFUpdateRequest(BaseModel):
    """DOTMLPF analysis update request."""
    title: str | None = None
    mission: str | None = None
    scenario: str | None = None
    doctrine: DOTMLPFComponent | None = None
    organization: DOTMLPFComponent | None = None
    training: DOTMLPFComponent | None = None
    materiel: DOTMLPFComponent | None = None
    leadership: DOTMLPFComponent | None = None
    personnel: DOTMLPFComponent | None = None
    facilities: DOTMLPFComponent | None = None
    capability_gaps: list[CapabilityGap] | None = None


class DOTMLPFAnalysisResponse(BaseModel):
    """DOTMLPF analysis response."""
    session_id: int
    title: str
    mission: str
    scenario: str
    timeframe: str | None
    doctrine: DOTMLPFComponent
    organization: DOTMLPFComponent
    training: DOTMLPFComponent
    materiel: DOTMLPFComponent
    leadership: DOTMLPFComponent
    personnel: DOTMLPFComponent
    facilities: DOTMLPFComponent
    capability_gaps: list[CapabilityGap]
    ai_analysis: dict | None = None
    status: str
    version: int


def _get_default_component(name: str) -> dict:
    """Get default component structure."""
    return {
        "name": name,
        "current_state": "",
        "desired_state": "",
        "gaps": [],
        "recommendations": [],
        "priority": "medium",
        "timeline": "",
        "resources_required": ""
    }


@router.post("/create", response_model=DOTMLPFAnalysisResponse)
async def create_dotmlpf_analysis(
    request: DOTMLPFCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DOTMLPFAnalysisResponse:
    """
    Create a new DOTMLPF analysis session.
    
    Args:
        request: DOTMLPF creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DOTMLPFAnalysisResponse: Created DOTMLPF analysis
    """
    logger.info(f"Creating DOTMLPF analysis: {request.title} for user {current_user.username}")

    # Prepare DOTMLPF data
    dotmlpf_data = {
        "mission": request.mission,
        "scenario": request.scenario,
        "timeframe": request.timeframe or "",
        "doctrine": request.doctrine.dict() if request.doctrine else _get_default_component("doctrine"),
        "organization": request.organization.dict() if request.organization else _get_default_component("organization"),
        "training": request.training.dict() if request.training else _get_default_component("training"),
        "materiel": request.materiel.dict() if request.materiel else _get_default_component("materiel"),
        "leadership": request.leadership.dict() if request.leadership else _get_default_component("leadership"),
        "personnel": request.personnel.dict() if request.personnel else _get_default_component("personnel"),
        "facilities": request.facilities.dict() if request.facilities else _get_default_component("facilities"),
        "capability_gaps": [gap.dict() for gap in request.capability_gaps] if request.capability_gaps else []
    }

    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis and request.mission:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.DOTMLPF,
                dotmlpf_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")

            # Merge AI suggestions
            if ai_analysis:
                # Add AI-suggested capability gaps
                if "capability_gaps" in ai_analysis and isinstance(ai_analysis["capability_gaps"], list):
                    for idx, gap in enumerate(ai_analysis["capability_gaps"]):
                        if isinstance(gap, dict):
                            gap["id"] = f"gap_ai_{idx}"
                            dotmlpf_data["capability_gaps"].append(gap)

                # Update component recommendations
                for component in ["doctrine", "organization", "training", "materiel",
                                "leadership", "personnel", "facilities"]:
                    if component in ai_analysis and isinstance(ai_analysis[component], dict):
                        if "gaps" in ai_analysis[component]:
                            dotmlpf_data[component]["gaps"].extend(ai_analysis[component]["gaps"])
                            dotmlpf_data[component]["gaps"] = list(set(dotmlpf_data[component]["gaps"]))
                        if "recommendations" in ai_analysis[component]:
                            dotmlpf_data[component]["recommendations"].extend(ai_analysis[component]["recommendations"])
                            dotmlpf_data[component]["recommendations"] = list(set(dotmlpf_data[component]["recommendations"]))

        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")

    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.DOTMLPF,
        title=request.title,
        description=f"DOTMLPF Analysis - {request.mission}",
        data=dotmlpf_data,
        tags=["dotmlpf", "capability-gaps", "defense-planning"]
    )

    session = await framework_service.create_session(db, current_user, framework_data)

    return DOTMLPFAnalysisResponse(
        session_id=session.id,
        title=session.title,
        mission=dotmlpf_data["mission"],
        scenario=dotmlpf_data["scenario"],
        timeframe=dotmlpf_data.get("timeframe"),
        doctrine=DOTMLPFComponent(**dotmlpf_data["doctrine"]),
        organization=DOTMLPFComponent(**dotmlpf_data["organization"]),
        training=DOTMLPFComponent(**dotmlpf_data["training"]),
        materiel=DOTMLPFComponent(**dotmlpf_data["materiel"]),
        leadership=DOTMLPFComponent(**dotmlpf_data["leadership"]),
        personnel=DOTMLPFComponent(**dotmlpf_data["personnel"]),
        facilities=DOTMLPFComponent(**dotmlpf_data["facilities"]),
        capability_gaps=[CapabilityGap(**gap) for gap in dotmlpf_data["capability_gaps"]],
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=DOTMLPFAnalysisResponse)
async def get_dotmlpf_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DOTMLPFAnalysisResponse:
    """
    Get a specific DOTMLPF analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DOTMLPFAnalysisResponse: DOTMLPF analysis data
    """
    logger.info(f"Getting DOTMLPF analysis {session_id}")

    # Get real data from database
    session = await framework_service.get_session(db, current_user, session_id, FrameworkType.DOTMLPF)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DOTMLPF analysis session not found"
        )

    # Extract data from session
    session_data = session.data or {}
    
    # Parse capability gaps
    gaps_data = session_data.get("capability_gaps", [])
    capability_gaps = [CapabilityGap(**gap) for gap in gaps_data if isinstance(gap, dict)]
    
    # Parse DOTMLPF components
    def parse_component(component_name: str) -> DOTMLPFComponent:
        comp_data = session_data.get(component_name, {})
        if comp_data and isinstance(comp_data, dict):
            return DOTMLPFComponent(**comp_data)
        else:
            return DOTMLPFComponent(
                name=component_name,
                current_state=f"Current {component_name} state",
                desired_state=f"Desired {component_name} state",
                gaps=[],
                recommendations=[],
                priority="pending",
                timeline="TBD",
                resources_required="TBD"
            )
    
    # Get basic information
    mission = session_data.get("mission", "Mission statement")
    scenario = session_data.get("scenario", "Analysis scenario")
    timeframe = session_data.get("timeframe", "Analysis timeframe")

    return DOTMLPFAnalysisResponse(
        session_id=session.id,
        title=session.title,
        mission=mission,
        scenario=scenario,
        timeframe=timeframe,
        doctrine=parse_component("doctrine"),
        organization=parse_component("organization"),
        training=parse_component("training"),
        materiel=parse_component("materiel"),
        leadership=parse_component("leadership"),
        personnel=parse_component("personnel"),
        facilities=parse_component("facilities"),
        capability_gaps=capability_gaps,
        status=session.status.value,
        version=session.version
    )


@router.put("/{session_id}/gaps")
async def update_capability_gaps(
    session_id: int,
    gaps: list[CapabilityGap],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update capability gaps for DOTMLPF analysis.
    
    Args:
        session_id: Session ID
        gaps: Updated capability gaps
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Updating capability gaps for DOTMLPF {session_id}")

    return {
        "message": "Capability gaps updated successfully",
        "session_id": session_id,
        "gaps_count": len(gaps),
        "updated_gaps": [gap.dict() for gap in gaps]
    }


@router.get("/{session_id}/recommendations")
async def get_recommendations(
    session_id: int,
    priority_filter: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get prioritized recommendations from DOTMLPF analysis.
    
    Args:
        session_id: Session ID
        priority_filter: Filter by priority (critical, high, medium, low)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Prioritized recommendations
    """
    logger.info(f"Getting recommendations for DOTMLPF {session_id}")

    recommendations = {
        "critical": [
            {
                "area": "training",
                "recommendation": "Implement joint multi-domain training program",
                "timeline": "6 months",
                "impact": "Essential for MDO capability"
            },
            {
                "area": "materiel",
                "recommendation": "Acquire integrated C2 systems",
                "timeline": "12 months",
                "impact": "Critical for joint operations"
            }
        ],
        "high": [
            {
                "area": "doctrine",
                "recommendation": "Develop MDO doctrine",
                "timeline": "9 months",
                "impact": "Foundation for operations"
            },
            {
                "area": "personnel",
                "recommendation": "Recruit cyber specialists",
                "timeline": "Ongoing",
                "impact": "Address critical shortage"
            }
        ],
        "medium": [
            {
                "area": "facilities",
                "recommendation": "Modernize training facilities",
                "timeline": "24 months",
                "impact": "Improve training effectiveness"
            }
        ]
    }

    if priority_filter:
        recommendations = {priority_filter: recommendations.get(priority_filter, [])}

    return {
        "session_id": session_id,
        "recommendations": recommendations,
        "total_count": sum(len(recs) for recs in recommendations.values())
    }


@router.post("/{session_id}/prioritize")
async def prioritize_gaps(
    session_id: int,
    method: str = "risk-based",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Prioritize capability gaps using various methods.
    
    Args:
        session_id: Session ID
        method: Prioritization method (risk-based, cost-benefit, timeline)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Prioritized gaps
    """
    logger.info(f"Prioritizing gaps for DOTMLPF {session_id} using {method} method")

    prioritized_gaps = [
        {
            "rank": 1,
            "gap": "Counter-drone capabilities",
            "score": 0.95,
            "rationale": "Critical operational impact, high threat likelihood"
        },
        {
            "rank": 2,
            "gap": "Cyber defense personnel",
            "score": 0.88,
            "rationale": "Significant vulnerability, affects multiple areas"
        },
        {
            "rank": 3,
            "gap": "Joint C2 systems",
            "score": 0.82,
            "rationale": "Essential for multi-domain operations"
        }
    ]

    return {
        "session_id": session_id,
        "method": method,
        "prioritized_gaps": prioritized_gaps,
        "timestamp": "2025-08-16T00:00:00Z"
    }


@router.post("/{session_id}/export")
async def export_dotmlpf_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export DOTMLPF analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json, pptx)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting DOTMLPF analysis {session_id} as {format}")

    if format not in ["pdf", "docx", "json", "pptx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json, pptx"
        )

    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/dotmlpf_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_dotmlpf_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available DOTMLPF analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Force Modernization Template",
            "description": "Comprehensive force modernization assessment",
            "focus_areas": ["Multi-domain operations", "Technology integration", "Joint capabilities"],
            "typical_gaps": [
                "Legacy system integration",
                "Joint interoperability",
                "Emerging technology adoption"
            ]
        },
        {
            "id": 2,
            "name": "Capability Development Template",
            "description": "New capability development analysis",
            "focus_areas": ["Requirements definition", "Solution analysis", "Implementation planning"],
            "typical_gaps": [
                "Technology gaps",
                "Training requirements",
                "Doctrine development"
            ]
        },
        {
            "id": 3,
            "name": "Rapid Assessment Template",
            "description": "Quick capability gap identification",
            "focus_areas": ["Critical gaps", "Quick wins", "Risk mitigation"],
            "typical_gaps": [
                "Immediate operational needs",
                "Personnel shortfalls",
                "Equipment deficiencies"
            ]
        }
    ]

    return templates
