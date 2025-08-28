"""
DIME Framework API endpoints.
Diplomatic, Information, Military, Economic analysis for strategic assessment.
"""

from typing import Dict, List, Optional

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


class DIMEFactor(BaseModel):
    """Individual factor within a DIME component."""
    id: str
    name: str
    description: str
    current_state: Optional[str] = None
    strength: Optional[float] = 0.5  # 0-1 scale
    trend: Optional[str] = "stable"  # improving, stable, declining
    importance: Optional[float] = 0.5  # 0-1 scale
    indicators: Optional[List[str]] = []
    risks: Optional[List[str]] = []
    opportunities: Optional[List[str]] = []


class DIMEComponent(BaseModel):
    """Base model for DIME components (Diplomatic, Information, Military, Economic)."""
    description: str
    overall_assessment: Optional[str] = None
    strength_score: Optional[float] = 0.5  # 0-1 scale
    trend: Optional[str] = "stable"  # improving, stable, declining
    factors: List[DIMEFactor]
    key_players: Optional[List[str]] = []
    strategic_implications: Optional[str] = None
    recommendations: Optional[List[str]] = []


class DIMECreateRequest(BaseModel):
    """DIME analysis creation request."""
    title: str
    scenario: str
    region: Optional[str] = None
    timeframe: Optional[str] = None
    strategic_objective: Optional[str] = None
    diplomatic: Optional[DIMEComponent] = None
    information: Optional[DIMEComponent] = None
    military: Optional[DIMEComponent] = None
    economic: Optional[DIMEComponent] = None
    request_ai_analysis: bool = True


class DIMEUpdateRequest(BaseModel):
    """DIME analysis update request."""
    title: Optional[str] = None
    scenario: Optional[str] = None
    region: Optional[str] = None
    timeframe: Optional[str] = None
    strategic_objective: Optional[str] = None
    diplomatic: Optional[DIMEComponent] = None
    information: Optional[DIMEComponent] = None
    military: Optional[DIMEComponent] = None
    economic: Optional[DIMEComponent] = None


class DIMEAnalysisResponse(BaseModel):
    """DIME analysis response."""
    session_id: int
    title: str
    scenario: str
    region: Optional[str]
    timeframe: Optional[str]
    strategic_objective: Optional[str]
    diplomatic: DIMEComponent
    information: DIMEComponent
    military: DIMEComponent
    economic: DIMEComponent
    integration_analysis: Optional[Dict] = None
    strategic_assessment: Optional[Dict] = None
    ai_analysis: Optional[Dict] = None
    status: str
    version: int


class DIMEIntegrationRequest(BaseModel):
    """Request for DIME integration analysis."""
    focus_areas: Optional[List[str]] = None  # diplomatic, information, military, economic
    integration_scenarios: Optional[List[str]] = None
    time_horizon: Optional[str] = "short-term"  # short-term, medium-term, long-term


@router.post("/create", response_model=DIMEAnalysisResponse)
async def create_dime_analysis(
    request: DIMECreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DIMEAnalysisResponse:
    """
    Create a new DIME analysis session.
    
    Args:
        request: DIME creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DIMEAnalysisResponse: Created DIME analysis
    """
    logger.info(f"Creating DIME analysis: {request.title} for user {current_user.username}")
    
    # Prepare DIME data
    dime_data = {
        "scenario": request.scenario,
        "region": request.region or "",
        "timeframe": request.timeframe or "",
        "strategic_objective": request.strategic_objective or "",
        "diplomatic": request.diplomatic.dict() if request.diplomatic else _get_default_component("diplomatic"),
        "information": request.information.dict() if request.information else _get_default_component("information"),
        "military": request.military.dict() if request.military else _get_default_component("military"),
        "economic": request.economic.dict() if request.economic else _get_default_component("economic"),
    }
    
    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.DIME,
                dime_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")
            
            # Merge AI suggestions with initial data
            if ai_analysis:
                for component in ["diplomatic", "information", "military", "economic"]:
                    if component in ai_analysis and isinstance(ai_analysis[component], dict):
                        # Merge AI suggestions into component
                        component_data = dime_data[component]
                        ai_component = ai_analysis[component]
                        
                        # Update component fields
                        for key, value in ai_component.items():
                            if key == "factors" and isinstance(value, list):
                                # Add AI-suggested factors
                                for idx, factor_data in enumerate(value):
                                    if isinstance(factor_data, dict):
                                        component_data["factors"].append({
                                            "id": f"{component}_ai_factor_{idx}",
                                            "name": factor_data.get("name", ""),
                                            "description": factor_data.get("description", ""),
                                            "current_state": factor_data.get("current_state", ""),
                                            "strength": factor_data.get("strength", 0.5),
                                            "trend": factor_data.get("trend", "stable"),
                                            "importance": factor_data.get("importance", 0.5),
                                            "indicators": factor_data.get("indicators", []),
                                            "risks": factor_data.get("risks", []),
                                            "opportunities": factor_data.get("opportunities", [])
                                        })
                            elif key in ["key_players", "recommendations"] and isinstance(value, list):
                                component_data[key].extend(value)
                            elif value and key not in ["factors"]:
                                component_data[key] = value
                        
        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.DIME,
        title=request.title,
        description=f"DIME Analysis - {request.scenario}",
        data=dime_data,
        tags=["dime", "strategic-analysis", "diplomatic", "information", "military", "economic"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    # Generate integration and strategic assessments
    integration_analysis = _generate_integration_analysis(dime_data)
    strategic_assessment = _generate_strategic_assessment(dime_data)
    
    return DIMEAnalysisResponse(
        session_id=session.id,
        title=session.title,
        scenario=dime_data["scenario"],
        region=dime_data.get("region"),
        timeframe=dime_data.get("timeframe"),
        strategic_objective=dime_data.get("strategic_objective"),
        diplomatic=DIMEComponent(**dime_data["diplomatic"]),
        information=DIMEComponent(**dime_data["information"]),
        military=DIMEComponent(**dime_data["military"]),
        economic=DIMEComponent(**dime_data["economic"]),
        integration_analysis=integration_analysis,
        strategic_assessment=strategic_assessment,
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=DIMEAnalysisResponse)
async def get_dime_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DIMEAnalysisResponse:
    """
    Get a specific DIME analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DIMEAnalysisResponse: DIME analysis data
    """
    logger.info(f"Getting DIME analysis {session_id}")
    
    # TODO: Implement database retrieval
    # For now, return comprehensive mock data
    diplomatic = DIMEComponent(
        description="Diplomatic and foreign policy environment",
        overall_assessment="Mixed diplomatic position with strong traditional alliances but emerging challenges",
        strength_score=0.7,
        trend="stable",
        factors=[
            DIMEFactor(
                id="diplo_1",
                name="Alliance Relationships",
                description="Strength of key bilateral and multilateral relationships",
                current_state="Strong NATO ties, mixed regional relationships",
                strength=0.8,
                trend="stable",
                importance=0.9,
                indicators=["Joint exercises", "Diplomatic visits", "Treaty compliance"],
                risks=["Alliance fatigue", "Burden sharing disputes"],
                opportunities=["Expanded partnerships", "New cooperation frameworks"]
            ),
            DIMEFactor(
                id="diplo_2",
                name="International Standing",
                description="Reputation and influence in international forums",
                current_state="Respected voice in multilateral institutions",
                strength=0.75,
                trend="declining",
                importance=0.8,
                indicators=["UN voting alignment", "Leadership positions", "Soft power metrics"],
                risks=["Isolation on key issues", "Reduced influence"],
                opportunities=["Leadership on global challenges", "Coalition building"]
            )
        ],
        key_players=["NATO allies", "Regional partners", "International organizations"],
        strategic_implications="Diplomatic strength provides foundation for broader strategic objectives but requires active management",
        recommendations=["Strengthen alliance consultation", "Invest in multilateral leadership", "Address partner concerns"]
    )
    
    information = DIMEComponent(
        description="Information environment and communication capabilities",
        overall_assessment="Strong information capabilities but facing significant disinformation challenges",
        strength_score=0.65,
        trend="declining",
        factors=[
            DIMEFactor(
                id="info_1",
                name="Information Operations",
                description="Ability to conduct and counter information operations",
                current_state="Developing capabilities with mixed effectiveness",
                strength=0.6,
                trend="improving",
                importance=0.9,
                indicators=["Counter-disinformation success", "Narrative reach", "Attribution capabilities"],
                risks=["Adversary sophistication", "Platform dependencies"],
                opportunities=["AI-enabled analysis", "Public-private partnerships"]
            ),
            DIMEFactor(
                id="info_2",
                name="Media Landscape",
                description="Domestic and international media environment",
                current_state="Fragmented media landscape with declining trust",
                strength=0.5,
                trend="declining",
                importance=0.7,
                indicators=["Media trust scores", "Information consumption patterns", "Fact-checking effectiveness"],
                risks=["Echo chambers", "Foreign manipulation"],
                opportunities=["Media literacy programs", "Trusted source promotion"]
            )
        ],
        key_players=["Media organizations", "Social media platforms", "Civil society"],
        strategic_implications="Information domain increasingly contested; requires comprehensive strategy",
        recommendations=["Develop information strategy", "Invest in counter-disinformation", "Promote media literacy"]
    )
    
    military = DIMEComponent(
        description="Military capabilities and security posture",
        overall_assessment="Strong conventional capabilities with growing focus on hybrid and cyber threats",
        strength_score=0.85,
        trend="stable",
        factors=[
            DIMEFactor(
                id="mil_1",
                name="Conventional Forces",
                description="Traditional military capabilities and readiness",
                current_state="Well-equipped professional military with high readiness",
                strength=0.9,
                trend="stable",
                importance=0.8,
                indicators=["Force readiness rates", "Equipment modernization", "Training standards"],
                risks=["Budget constraints", "Recruitment challenges"],
                opportunities=["Technology integration", "Allied interoperability"]
            ),
            DIMEFactor(
                id="mil_2",
                name="Cyber Capabilities",
                description="Cyber warfare and defense capabilities",
                current_state="Developing offensive and defensive cyber capabilities",
                strength=0.7,
                trend="improving",
                importance=0.9,
                indicators=["Cyber defense effectiveness", "Attribution capabilities", "Offensive options"],
                risks=["Adversary advancement", "Critical infrastructure vulnerabilities"],
                opportunities=["AI integration", "Public-private collaboration"]
            )
        ],
        key_players=["Armed forces", "Defense industry", "Intelligence services"],
        strategic_implications="Military strength provides deterrent effect but must adapt to hybrid threats",
        recommendations=["Modernize cyber capabilities", "Enhance hybrid threat response", "Maintain conventional deterrence"]
    )
    
    economic = DIMEComponent(
        description="Economic strength and leverage",
        overall_assessment="Robust economy with strong fundamentals but facing structural challenges",
        strength_score=0.75,
        trend="stable",
        factors=[
            DIMEFactor(
                id="econ_1",
                name="Economic Leverage",
                description="Ability to use economic tools for strategic objectives",
                current_state="Significant economic leverage through trade and financial systems",
                strength=0.8,
                trend="stable",
                importance=0.9,
                indicators=["Trade volumes", "Financial market influence", "Sanctions effectiveness"],
                risks=["Economic interdependence", "Retaliatory measures"],
                opportunities=["Economic partnerships", "Strategic autonomy"]
            ),
            DIMEFactor(
                id="econ_2",
                name="Economic Resilience",
                description="Ability to withstand economic shocks and disruptions",
                current_state="Generally resilient with some vulnerabilities",
                strength=0.7,
                trend="stable",
                importance=0.8,
                indicators=["GDP growth", "Debt levels", "Supply chain diversity"],
                risks=["Global economic shocks", "Critical dependencies"],
                opportunities=["Economic diversification", "Innovation investment"]
            )
        ],
        key_players=["Financial institutions", "Major corporations", "Trade partners"],
        strategic_implications="Economic strength enables strategic options but requires careful management of dependencies",
        recommendations=["Diversify supply chains", "Strengthen economic partnerships", "Invest in strategic sectors"]
    )
    
    integration_analysis = _generate_integration_analysis({
        "diplomatic": diplomatic.dict(),
        "information": information.dict(),
        "military": military.dict(),
        "economic": economic.dict()
    })
    
    strategic_assessment = _generate_strategic_assessment({
        "diplomatic": diplomatic.dict(),
        "information": information.dict(),
        "military": military.dict(),
        "economic": economic.dict()
    })
    
    return DIMEAnalysisResponse(
        session_id=session_id,
        title="Regional Strategic Assessment",
        scenario="Comprehensive strategic analysis for regional engagement",
        region="Eastern Europe",
        timeframe="2025-2027",
        strategic_objective="Maintain regional stability while advancing strategic interests",
        diplomatic=diplomatic,
        information=information,
        military=military,
        economic=economic,
        integration_analysis=integration_analysis,
        strategic_assessment=strategic_assessment,
        status="in_progress",
        version=1
    )


@router.put("/{session_id}", response_model=DIMEAnalysisResponse)
async def update_dime_analysis(
    session_id: int,
    request: DIMEUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DIMEAnalysisResponse:
    """
    Update a DIME analysis session.
    
    Args:
        session_id: Session ID
        request: Update request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DIMEAnalysisResponse: Updated DIME analysis
    """
    logger.info(f"Updating DIME analysis {session_id}")
    
    # Build update data
    updates = {}
    dime_data = {}
    
    if request.title:
        updates["title"] = request.title
    
    for field in ["scenario", "region", "timeframe", "strategic_objective"]:
        value = getattr(request, field)
        if value is not None:
            dime_data[field] = value
    
    for component in ["diplomatic", "information", "military", "economic"]:
        value = getattr(request, component)
        if value is not None:
            dime_data[component] = value.dict()
    
    if dime_data:
        updates["data"] = dime_data
    
    # Update session
    session = await framework_service.update_session(
        db, session_id, current_user, updates
    )
    
    # Parse data
    import json
    data = json.loads(session.data)
    
    integration_analysis = _generate_integration_analysis(data)
    strategic_assessment = _generate_strategic_assessment(data)
    
    return DIMEAnalysisResponse(
        session_id=session.id,
        title=session.title,
        scenario=data.get("scenario", ""),
        region=data.get("region"),
        timeframe=data.get("timeframe"),
        strategic_objective=data.get("strategic_objective"),
        diplomatic=DIMEComponent(**data.get("diplomatic", _get_default_component("diplomatic"))),
        information=DIMEComponent(**data.get("information", _get_default_component("information"))),
        military=DIMEComponent(**data.get("military", _get_default_component("military"))),
        economic=DIMEComponent(**data.get("economic", _get_default_component("economic"))),
        integration_analysis=integration_analysis,
        strategic_assessment=strategic_assessment,
        status=session.status.value,
        version=session.version
    )


@router.put("/{session_id}/component/{component_name}")
async def update_dime_component(
    session_id: int,
    component_name: str,
    component_data: DIMEComponent,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update a specific DIME component.
    
    Args:
        session_id: Session ID
        component_name: Component to update (diplomatic, information, military, economic)
        component_data: Updated component data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    valid_components = ["diplomatic", "information", "military", "economic"]
    
    if component_name not in valid_components:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid component. Must be one of: {', '.join(valid_components)}"
        )
    
    logger.info(f"Updating {component_name} component for DIME {session_id}")
    
    # TODO: Implement actual database update
    # For now, return success response
    
    return {
        "message": f"Successfully updated {component_name} component",
        "session_id": session_id,
        "component": component_name,
        "updated_data": component_data.dict()
    }


@router.post("/{session_id}/integration-analysis")
async def perform_integration_analysis(
    session_id: int,
    request: DIMEIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Perform DIME integration analysis.
    
    Args:
        session_id: Session ID
        request: Integration analysis parameters
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Integration analysis results
    """
    logger.info(f"Performing DIME integration analysis for {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    dime_data = {
        "scenario": "Regional strategic assessment",
        "diplomatic": {"strength_score": 0.7},
        "information": {"strength_score": 0.65},
        "military": {"strength_score": 0.85},
        "economic": {"strength_score": 0.75}
    }
    
    # Perform AI integration analysis
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.DIME,
        {**dime_data, "integration_request": request.dict()},
        "integrate"
    )
    
    # Generate comprehensive integration analysis
    integration_results = {
        "overall_strategic_posture": {
            "strength": "strong",
            "confidence": 0.75,
            "assessment": "Well-balanced strategic capabilities with room for improvement in information domain"
        },
        "component_synergies": [
            {
                "components": ["military", "diplomatic"],
                "synergy_type": "deterrence_diplomacy",
                "strength": 0.8,
                "description": "Military capabilities enhance diplomatic leverage"
            },
            {
                "components": ["economic", "diplomatic"],
                "synergy_type": "economic_statecraft",
                "strength": 0.75,
                "description": "Economic tools support diplomatic objectives"
            },
            {
                "components": ["information", "military"],
                "synergy_type": "information_warfare",
                "strength": 0.6,
                "description": "Growing integration of information and military operations"
            }
        ],
        "strategic_gaps": [
            {
                "area": "information_coordination",
                "severity": "medium",
                "description": "Limited coordination between information and other DIME elements",
                "recommendations": ["Establish integrated planning process", "Cross-domain training"]
            },
            {
                "area": "economic_security_nexus",
                "severity": "low",
                "description": "Economic security considerations not fully integrated",
                "recommendations": ["Economic security assessment", "Supply chain analysis"]
            }
        ],
        "recommended_strategies": [
            {
                "strategy": "Integrated deterrence",
                "components": ["military", "economic", "diplomatic"],
                "timeline": "immediate",
                "expected_impact": "high"
            },
            {
                "strategy": "Information environment shaping",
                "components": ["information", "diplomatic"],
                "timeline": "medium-term",
                "expected_impact": "medium"
            }
        ],
        "scenario_analysis": [
            {
                "scenario": "Diplomatic crisis",
                "dime_utilization": {
                    "diplomatic": "primary",
                    "economic": "supporting",
                    "information": "supporting",
                    "military": "deterrent"
                },
                "effectiveness": 0.8
            },
            {
                "scenario": "Economic coercion",
                "dime_utilization": {
                    "economic": "primary",
                    "diplomatic": "supporting",
                    "information": "supporting",
                    "military": "background"
                },
                "effectiveness": 0.75
            }
        ]
    }
    
    return {
        "session_id": session_id,
        "analysis_parameters": request.dict(),
        "integration_results": integration_results,
        "ai_insights": ai_result.get("analysis", {}),
        "timestamp": ai_result.get("timestamp")
    }


@router.get("/{session_id}/strategic-matrix")
async def get_strategic_matrix(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get the DIME strategic matrix visualization.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Strategic matrix visualization data
    """
    logger.info(f"Getting strategic matrix for DIME {session_id}")
    
    # TODO: Get actual data from database
    # For now, return mock matrix data
    matrix = {
        "components": {
            "diplomatic": {
                "strength": 0.7,
                "trend": "stable",
                "key_factors": ["Alliance relationships", "International standing"],
                "priority_actions": ["Strengthen partnerships", "Enhance multilateral engagement"]
            },
            "information": {
                "strength": 0.65,
                "trend": "declining",
                "key_factors": ["Information operations", "Media landscape"],
                "priority_actions": ["Counter disinformation", "Improve strategic communication"]
            },
            "military": {
                "strength": 0.85,
                "trend": "stable",
                "key_factors": ["Conventional forces", "Cyber capabilities"],
                "priority_actions": ["Modernize capabilities", "Enhance readiness"]
            },
            "economic": {
                "strength": 0.75,
                "trend": "stable",
                "key_factors": ["Economic leverage", "Economic resilience"],
                "priority_actions": ["Diversify supply chains", "Strengthen partnerships"]
            }
        },
        "cross_cutting_themes": [
            {
                "theme": "Technology integration",
                "impact_areas": ["military", "information", "economic"],
                "priority": "high"
            },
            {
                "theme": "Alliance coordination",
                "impact_areas": ["diplomatic", "military", "economic"],
                "priority": "high"
            },
            {
                "theme": "Resilience building",
                "impact_areas": ["economic", "information", "military"],
                "priority": "medium"
            }
        ],
        "strategic_priorities": [
            {
                "priority": "Enhance information domain capabilities",
                "components": ["information", "diplomatic"],
                "urgency": "high",
                "resources_required": "medium"
            },
            {
                "priority": "Strengthen economic security",
                "components": ["economic", "military"],
                "urgency": "medium",
                "resources_required": "high"
            },
            {
                "priority": "Maintain military edge",
                "components": ["military"],
                "urgency": "medium",
                "resources_required": "high"
            }
        ]
    }
    
    return {
        "session_id": session_id,
        "strategic_matrix": matrix
    }


@router.post("/{session_id}/export")
async def export_dime_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export DIME analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json, pptx)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting DIME analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json", "pptx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json, pptx"
        )
    
    # TODO: Implement actual export functionality
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/dime_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_dime_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available DIME analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "National Strategic Assessment",
            "description": "Comprehensive national-level DIME analysis template",
            "components": {
                "diplomatic": {
                    "factors": ["Alliance relationships", "International standing", "Multilateral engagement", "Regional influence"],
                    "considerations": ["Diplomatic capital", "Soft power", "International law", "Treaty obligations"]
                },
                "information": {
                    "factors": ["Information operations", "Media influence", "Cyber information", "Strategic communication"],
                    "considerations": ["Narrative control", "Counter-disinformation", "Public opinion", "Information warfare"]
                },
                "military": {
                    "factors": ["Conventional forces", "Nuclear capabilities", "Cyber warfare", "Space capabilities"],
                    "considerations": ["Deterrence", "Defense readiness", "Power projection", "Force modernization"]
                },
                "economic": {
                    "factors": ["Economic leverage", "Trade relationships", "Financial systems", "Economic resilience"],
                    "considerations": ["Sanctions capability", "Supply chain security", "Economic coercion", "Market access"]
                }
            }
        },
        {
            "id": 2,
            "name": "Regional Competition Assessment",
            "description": "DIME analysis for regional strategic competition",
            "components": {
                "diplomatic": {
                    "factors": ["Regional alliances", "Bilateral relationships", "International support", "Diplomatic isolation"],
                    "considerations": ["Regional influence", "Coalition building", "Mediation capabilities", "Diplomatic initiatives"]
                },
                "information": {
                    "factors": ["Regional narrative", "Media presence", "Information campaigns", "Disinformation threats"],
                    "considerations": ["Message resonance", "Counter-narratives", "Information credibility", "Audience reach"]
                },
                "military": {
                    "factors": ["Regional balance", "Military presence", "Defense partnerships", "Threat capabilities"],
                    "considerations": ["Deterrent effect", "Escalation risks", "Military cooperation", "Force posture"]
                },
                "economic": {
                    "factors": ["Economic integration", "Trade flows", "Investment patterns", "Economic dependencies"],
                    "considerations": ["Economic influence", "Leverage points", "Vulnerability assessment", "Economic tools"]
                }
            }
        },
        {
            "id": 3,
            "name": "Crisis Response Assessment",
            "description": "DIME analysis for crisis response planning",
            "components": {
                "diplomatic": {
                    "factors": ["Crisis diplomacy", "International support", "Mediation options", "Escalation management"],
                    "considerations": ["Diplomatic solutions", "International legitimacy", "Coalition support", "Communication channels"]
                },
                "information": {
                    "factors": ["Crisis communication", "Information warfare", "Public messaging", "Counter-disinformation"],
                    "considerations": ["Narrative control", "Public support", "International perception", "Information security"]
                },
                "military": {
                    "factors": ["Military options", "Force readiness", "Escalation dynamics", "Deterrent capabilities"],
                    "considerations": ["Military effectiveness", "Risk assessment", "Collateral damage", "Exit strategies"]
                },
                "economic": {
                    "factors": ["Economic tools", "Sanctions options", "Economic support", "Resource allocation"],
                    "considerations": ["Economic pressure", "Humanitarian impact", "Allied coordination", "Long-term effects"]
                }
            }
        },
        {
            "id": 4,
            "name": "Adversary Assessment Template",
            "description": "DIME analysis for understanding adversary capabilities",
            "components": {
                "diplomatic": {
                    "factors": ["Diplomatic isolation", "Alliance structures", "International support", "Diplomatic strategies"],
                    "considerations": ["Diplomatic vulnerabilities", "Relationship patterns", "Influence operations", "Coalition potential"]
                },
                "information": {
                    "factors": ["Information capabilities", "Propaganda systems", "Cyber operations", "Influence networks"],
                    "considerations": ["Information threats", "Disinformation campaigns", "Narrative strategies", "Information vulnerabilities"]
                },
                "military": {
                    "factors": ["Military capabilities", "Force structure", "Modernization programs", "Strategic weapons"],
                    "considerations": ["Threat assessment", "Capability gaps", "Military intentions", "Force projection"]
                },
                "economic": {
                    "factors": ["Economic strength", "Resource dependencies", "Trade patterns", "Economic tools"],
                    "considerations": ["Economic vulnerabilities", "Leverage points", "Economic warfare", "Resource constraints"]
                }
            }
        }
    ]
    
    return templates


def _get_default_component(component_type: str) -> dict:
    """Get default component structure for a DIME component type."""
    return {
        "description": f"{component_type.title()} component analysis",
        "overall_assessment": "",
        "strength_score": 0.5,
        "trend": "stable",
        "factors": [],
        "key_players": [],
        "strategic_implications": "",
        "recommendations": []
    }


def _generate_integration_analysis(dime_data: dict) -> dict:
    """Generate integration analysis from DIME components."""
    # Calculate overall strength scores
    components = ["diplomatic", "information", "military", "economic"]
    strength_scores = {}
    
    for component in components:
        if component in dime_data and "strength_score" in dime_data[component]:
            strength_scores[component] = dime_data[component]["strength_score"]
        else:
            strength_scores[component] = 0.5
    
    overall_strength = sum(strength_scores.values()) / len(strength_scores)
    
    # Identify strongest and weakest components
    strongest = max(strength_scores, key=strength_scores.get)
    weakest = min(strength_scores, key=strength_scores.get)
    
    return {
        "overall_strength": round(overall_strength, 2),
        "component_scores": strength_scores,
        "strongest_component": {
            "component": strongest,
            "score": strength_scores[strongest],
            "assessment": f"{strongest.title()} component provides significant strategic advantage"
        },
        "weakest_component": {
            "component": weakest,
            "score": strength_scores[weakest],
            "assessment": f"{weakest.title()} component requires attention and investment"
        },
        "balance_assessment": "balanced" if max(strength_scores.values()) - min(strength_scores.values()) < 0.3 else "unbalanced",
        "integration_opportunities": [
            f"Leverage {strongest} strength to support {weakest} objectives",
            "Develop cross-domain strategies that utilize multiple DIME elements",
            "Create integrated planning processes for better coordination"
        ]
    }


def _generate_strategic_assessment(dime_data: dict) -> dict:
    """Generate strategic assessment from DIME data."""
    # Mock strategic assessment based on component data
    return {
        "strategic_posture": "defensive-competitive",
        "key_advantages": [
            "Strong military deterrent capability",
            "Robust economic leverage tools",
            "Established diplomatic networks"
        ],
        "key_vulnerabilities": [
            "Information environment challenges",
            "Adversary disinformation campaigns",
            "Economic interdependencies"
        ],
        "strategic_recommendations": [
            {
                "priority": "high",
                "recommendation": "Strengthen information domain capabilities",
                "rationale": "Critical gap in contested information environment",
                "timeline": "6-12 months"
            },
            {
                "priority": "medium",
                "recommendation": "Enhance economic resilience",
                "rationale": "Reduce vulnerabilities to economic coercion",
                "timeline": "12-24 months"
            },
            {
                "priority": "medium",
                "recommendation": "Maintain military modernization",
                "rationale": "Preserve deterrent capability against evolving threats",
                "timeline": "ongoing"
            }
        ],
        "risk_factors": [
            {
                "risk": "Information warfare escalation",
                "likelihood": "high",
                "impact": "medium",
                "mitigation": "Develop comprehensive information strategy"
            },
            {
                "risk": "Economic decoupling pressures",
                "likelihood": "medium",
                "impact": "high",
                "mitigation": "Diversify economic partnerships"
            }
        ]
    }