"""
PMESII-PT Framework API endpoints.
Comprehensive operational environment analysis for intelligence professionals.
"""

from typing import Dict, Optional

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
    PMESIIPTData,
    framework_service,
)

logger = get_logger(__name__)
router = APIRouter()


class PMESIIPTComponent(BaseModel):
    """Base model for PMESII-PT components."""
    description: str
    factors: list[str]
    assessment: Optional[str] = None
    indicators: Optional[list[str]] = []
    trends: Optional[str] = None
    implications: Optional[str] = None


class PMESIIPTCreateRequest(BaseModel):
    """PMESII-PT analysis creation request."""
    title: str
    scenario: str
    region: Optional[str] = None
    timeframe: Optional[str] = None
    political: Optional[PMESIIPTComponent] = None
    military: Optional[PMESIIPTComponent] = None
    economic: Optional[PMESIIPTComponent] = None
    social: Optional[PMESIIPTComponent] = None
    infrastructure: Optional[PMESIIPTComponent] = None
    information: Optional[PMESIIPTComponent] = None
    physical_environment: Optional[PMESIIPTComponent] = None
    time: Optional[PMESIIPTComponent] = None
    request_ai_analysis: bool = True


class PMESIIPTUpdateRequest(BaseModel):
    """PMESII-PT analysis update request."""
    title: Optional[str] = None
    scenario: Optional[str] = None
    political: Optional[PMESIIPTComponent] = None
    military: Optional[PMESIIPTComponent] = None
    economic: Optional[PMESIIPTComponent] = None
    social: Optional[PMESIIPTComponent] = None
    infrastructure: Optional[PMESIIPTComponent] = None
    information: Optional[PMESIIPTComponent] = None
    physical_environment: Optional[PMESIIPTComponent] = None
    time: Optional[PMESIIPTComponent] = None


class PMESIIPTAnalysisResponse(BaseModel):
    """PMESII-PT analysis response."""
    session_id: int
    title: str
    scenario: str
    region: Optional[str]
    timeframe: Optional[str]
    political: PMESIIPTComponent
    military: PMESIIPTComponent
    economic: PMESIIPTComponent
    social: PMESIIPTComponent
    infrastructure: PMESIIPTComponent
    information: PMESIIPTComponent
    physical_environment: PMESIIPTComponent
    time: PMESIIPTComponent
    ai_analysis: Optional[dict] = None
    status: str
    version: int


def _get_default_component() -> dict:
    """Get default empty component structure."""
    return {
        "description": "",
        "factors": [],
        "assessment": "",
        "indicators": [],
        "trends": "",
        "implications": ""
    }


@router.post("/create", response_model=PMESIIPTAnalysisResponse)
async def create_pmesii_pt_analysis(
    request: PMESIIPTCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> PMESIIPTAnalysisResponse:
    """
    Create a new PMESII-PT analysis session.
    
    Args:
        request: PMESII-PT creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        PMESIIPTAnalysisResponse: Created PMESII-PT analysis
    """
    logger.info(f"Creating PMESII-PT analysis: {request.title} for user {current_user.username}")
    
    # Prepare PMESII-PT data
    pmesii_data = {
        "scenario": request.scenario,
        "region": request.region or "",
        "timeframe": request.timeframe or "",
        "political": request.political.dict() if request.political else _get_default_component(),
        "military": request.military.dict() if request.military else _get_default_component(),
        "economic": request.economic.dict() if request.economic else _get_default_component(),
        "social": request.social.dict() if request.social else _get_default_component(),
        "infrastructure": request.infrastructure.dict() if request.infrastructure else _get_default_component(),
        "information": request.information.dict() if request.information else _get_default_component(),
        "physical_environment": request.physical_environment.dict() if request.physical_environment else _get_default_component(),
        "time": request.time.dict() if request.time else _get_default_component(),
    }
    
    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.PMESII_PT,
                pmesii_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")
            
            # Merge AI suggestions with initial data
            if ai_analysis:
                for component in ["political", "military", "economic", "social", 
                                "infrastructure", "information", "physical_environment", "time"]:
                    if component in ai_analysis and isinstance(ai_analysis[component], dict):
                        # Merge AI suggestions into component
                        for key, value in ai_analysis[component].items():
                            if key == "factors" and isinstance(value, list):
                                pmesii_data[component]["factors"].extend(value)
                                # Remove duplicates
                                pmesii_data[component]["factors"] = list(set(pmesii_data[component]["factors"]))
                            elif value:
                                pmesii_data[component][key] = value
                        
        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.PMESII_PT,
        title=request.title,
        description=f"PMESII-PT Analysis - {request.scenario}",
        data=pmesii_data,
        tags=["pmesii-pt", "operational-environment", "intelligence-preparation"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    return PMESIIPTAnalysisResponse(
        session_id=session.id,
        title=session.title,
        scenario=pmesii_data["scenario"],
        region=pmesii_data.get("region"),
        timeframe=pmesii_data.get("timeframe"),
        political=PMESIIPTComponent(**pmesii_data["political"]),
        military=PMESIIPTComponent(**pmesii_data["military"]),
        economic=PMESIIPTComponent(**pmesii_data["economic"]),
        social=PMESIIPTComponent(**pmesii_data["social"]),
        infrastructure=PMESIIPTComponent(**pmesii_data["infrastructure"]),
        information=PMESIIPTComponent(**pmesii_data["information"]),
        physical_environment=PMESIIPTComponent(**pmesii_data["physical_environment"]),
        time=PMESIIPTComponent(**pmesii_data["time"]),
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=PMESIIPTAnalysisResponse)
async def get_pmesii_pt_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> PMESIIPTAnalysisResponse:
    """
    Get a specific PMESII-PT analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        PMESIIPTAnalysisResponse: PMESII-PT analysis data
    """
    # TODO: Implement database retrieval
    # For now, return comprehensive mock data
    logger.info(f"Getting PMESII-PT analysis {session_id}")
    
    return PMESIIPTAnalysisResponse(
        session_id=session_id,
        title="Regional Stability Assessment",
        scenario="Assessment of operational environment for strategic planning",
        region="Eastern Europe",
        timeframe="2025-2027",
        political=PMESIIPTComponent(
            description="Political landscape and governance structures",
            factors=["Democratic institutions", "Political parties", "International relations"],
            assessment="Moderate stability with increasing polarization",
            indicators=["Election turnout", "Protest frequency", "Legislative efficiency"],
            trends="Increasing political fragmentation",
            implications="Potential for governance challenges"
        ),
        military=PMESIIPTComponent(
            description="Military capabilities and security environment",
            factors=["Armed forces", "Security alliances", "Threat assessment"],
            assessment="Strong defensive capabilities with modernization needs",
            indicators=["Defense spending", "Force readiness", "Equipment modernization"],
            trends="Increasing focus on hybrid threats",
            implications="Need for adaptive security strategies"
        ),
        economic=PMESIIPTComponent(
            description="Economic conditions and development",
            factors=["GDP growth", "Trade relations", "Energy security"],
            assessment="Moderate growth with structural challenges",
            indicators=["Inflation rate", "Unemployment", "FDI levels"],
            trends="Gradual economic recovery",
            implications="Economic resilience but vulnerability to external shocks"
        ),
        social=PMESIIPTComponent(
            description="Social dynamics and demographic factors",
            factors=["Demographics", "Education", "Social cohesion"],
            assessment="Aging population with urban-rural divide",
            indicators=["Migration patterns", "Education levels", "Social trust"],
            trends="Increasing urbanization",
            implications="Need for social policy reforms"
        ),
        infrastructure=PMESIIPTComponent(
            description="Critical infrastructure and services",
            factors=["Transportation", "Energy grid", "Communications"],
            assessment="Adequate but aging infrastructure",
            indicators=["Infrastructure investment", "Service reliability", "Connectivity"],
            trends="Gradual modernization",
            implications="Infrastructure resilience concerns"
        ),
        information=PMESIIPTComponent(
            description="Information environment and media landscape",
            factors=["Media freedom", "Information warfare", "Digital literacy"],
            assessment="Complex information environment with disinformation challenges",
            indicators=["Press freedom index", "Internet penetration", "Media trust"],
            trends="Increasing digital transformation",
            implications="Vulnerability to information operations"
        ),
        physical_environment=PMESIIPTComponent(
            description="Geographic and environmental factors",
            factors=["Geography", "Climate", "Natural resources"],
            assessment="Strategic location with environmental pressures",
            indicators=["Climate events", "Resource availability", "Environmental quality"],
            trends="Climate change impacts increasing",
            implications="Environmental security considerations"
        ),
        time=PMESIIPTComponent(
            description="Temporal factors and timing considerations",
            factors=["Historical context", "Electoral cycles", "Seasonal patterns"],
            assessment="Critical period approaching with multiple convergent events",
            indicators=["Key dates", "Decision windows", "Historical patterns"],
            trends="Accelerating pace of change",
            implications="Limited windows for strategic action"
        ),
        status="in_progress",
        version=1
    )


@router.put("/{session_id}/component/{component_name}")
async def update_pmesii_component(
    session_id: int,
    component_name: str,
    component_data: PMESIIPTComponent,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update a specific PMESII-PT component.
    
    Args:
        session_id: Session ID
        component_name: Component to update (political, military, etc.)
        component_data: Updated component data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    valid_components = ["political", "military", "economic", "social", 
                       "infrastructure", "information", "physical_environment", "time"]
    
    if component_name not in valid_components:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid component. Must be one of: {', '.join(valid_components)}"
        )
    
    logger.info(f"Updating {component_name} component for PMESII-PT {session_id}")
    
    # TODO: Implement actual database update
    # For now, return success response
    
    return {
        "message": f"Successfully updated {component_name} component",
        "session_id": session_id,
        "component": component_name,
        "updated_data": component_data.dict()
    }


@router.post("/{session_id}/ai-analysis")
async def get_pmesii_ai_analysis(
    session_id: int,
    components: Optional[list[str]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get AI-powered analysis for PMESII-PT components.
    
    Args:
        session_id: Session ID
        components: Specific components to analyze (None = all)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: AI analysis results
    """
    logger.info(f"Getting AI analysis for PMESII-PT {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    pmesii_data = {
        "scenario": "Regional stability assessment",
        "political": {"description": "Political landscape", "factors": ["Governance", "Elections"]},
        "military": {"description": "Security environment", "factors": ["Defense", "Threats"]},
        "economic": {"description": "Economic conditions", "factors": ["GDP", "Trade"]},
        "social": {"description": "Social dynamics", "factors": ["Demographics", "Education"]},
        "infrastructure": {"description": "Critical infrastructure", "factors": ["Transport", "Energy"]},
        "information": {"description": "Information environment", "factors": ["Media", "Cyber"]},
        "physical_environment": {"description": "Geographic factors", "factors": ["Climate", "Resources"]},
        "time": {"description": "Temporal factors", "factors": ["History", "Timing"]}
    }
    
    # Filter components if specified
    if components:
        pmesii_data = {k: v for k, v in pmesii_data.items() 
                      if k in components or k == "scenario"}
    
    # Get AI analysis
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.PMESII_PT,
        pmesii_data,
        "suggest"
    )
    
    return {
        "session_id": session_id,
        "analyzed_components": components or "all",
        "analysis": ai_result.get("suggestions", {}),
        "timestamp": ai_result.get("timestamp")
    }


@router.post("/{session_id}/export")
async def export_pmesii_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export PMESII-PT analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json, pptx)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting PMESII-PT analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json", "pptx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json, pptx"
        )
    
    # TODO: Implement actual export functionality
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/pmesii_pt_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_pmesii_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available PMESII-PT analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Country Assessment Template",
            "description": "Comprehensive country-level PMESII-PT analysis",
            "components": {
                "political": ["Government structure", "Political parties", "Foreign relations"],
                "military": ["Armed forces", "Defense capabilities", "Security threats"],
                "economic": ["GDP", "Trade", "Industry", "Agriculture"],
                "social": ["Demographics", "Education", "Healthcare", "Culture"],
                "infrastructure": ["Transportation", "Energy", "Communications", "Water"],
                "information": ["Media landscape", "Internet", "Information operations"],
                "physical_environment": ["Geography", "Climate", "Natural resources"],
                "time": ["Historical events", "Key dates", "Seasonal factors"]
            }
        },
        {
            "id": 2,
            "name": "Urban Area Assessment",
            "description": "PMESII-PT analysis for urban operational environments",
            "components": {
                "political": ["Local governance", "Political groups", "Civil society"],
                "military": ["Security forces", "Non-state actors", "Crime"],
                "economic": ["Local economy", "Employment", "Markets"],
                "social": ["Population density", "Ethnic groups", "Social services"],
                "infrastructure": ["Utilities", "Transportation hubs", "Critical facilities"],
                "information": ["Local media", "Social media", "Communication networks"],
                "physical_environment": ["Urban terrain", "Key terrain", "Environmental hazards"],
                "time": ["Daily patterns", "Weekly cycles", "Event schedules"]
            }
        },
        {
            "id": 3,
            "name": "Crisis Assessment Template",
            "description": "Rapid PMESII-PT assessment for crisis situations",
            "components": {
                "political": ["Leadership", "Decision-making", "International response"],
                "military": ["Immediate threats", "Security posture", "Force deployment"],
                "economic": ["Economic impacts", "Supply chains", "Financial stability"],
                "social": ["Humanitarian needs", "Population displacement", "Social tensions"],
                "infrastructure": ["Damage assessment", "Critical services", "Restoration priorities"],
                "information": ["Crisis communications", "Information flow", "Misinformation"],
                "physical_environment": ["Affected areas", "Access routes", "Environmental impacts"],
                "time": ["Crisis timeline", "Response phases", "Recovery timeline"]
            }
        }
    ]
    
    return templates