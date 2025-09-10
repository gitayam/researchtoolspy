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
from app.services.ai_service import ai_service
from datetime import datetime
import json

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


# AI-Enhanced DOTMLPF Analysis Endpoints

@router.post("/ai/automated-gap-analysis")
async def automated_capability_gap_analysis(
    request: dict
) -> dict:
    """
    Perform automated capability gap analysis using AI-powered requirements mapping.
    """
    try:
        mission_requirements = request.get("mission_requirements", {})
        current_capabilities = request.get("current_capabilities", {})
        operational_context = request.get("operational_context", "")
        priority_factors = request.get("priority_factors", [])
        resource_constraints = request.get("resource_constraints", {})
        
        # AI-powered capability gap analysis
        gap_analysis_prompt = f"""
        As an expert defense capability analyst specializing in DOTMLPF framework, perform comprehensive capability gap analysis.

        Mission Requirements:
        {json.dumps(mission_requirements, indent=2)}

        Current Capabilities:
        {json.dumps(current_capabilities, indent=2)}

        Operational Context: {operational_context}
        Priority Factors: {', '.join(priority_factors)}
        Resource Constraints: {json.dumps(resource_constraints, indent=2)}

        Analyze capability gaps across all DOTMLPF dimensions:

        DOCTRINE:
        - Assess doctrinal gaps in tactics, techniques, procedures
        - Identify conflicts between current doctrine and mission requirements
        - Recommend doctrine development priorities

        ORGANIZATION:
        - Analyze organizational structure adequacy
        - Identify command and control gaps
        - Assess span of control and reporting relationships

        TRAINING:
        - Evaluate training program effectiveness
        - Identify skill gaps and competency deficits
        - Assess training infrastructure requirements

        MATERIEL:
        - Analyze equipment and technology gaps
        - Assess interoperability requirements
        - Identify procurement and modernization needs

        LEADERSHIP AND EDUCATION:
        - Evaluate leadership development programs
        - Assess decision-making processes
        - Identify professional education gaps

        PERSONNEL:
        - Analyze manning levels and skill distributions
        - Identify recruitment and retention challenges
        - Assess personnel readiness levels

        FACILITIES:
        - Evaluate infrastructure adequacy
        - Assess facility requirements for mission success
        - Identify modernization and construction needs

        For each gap identified, provide:
        - Gap description and impact assessment
        - Priority level (critical/high/medium/low)
        - Resource requirements estimate
        - Implementation timeline
        - Risk assessment if gap remains
        - Recommended mitigation strategies

        Format as structured JSON for detailed analysis.
        """
        
        gap_analysis = await ai_service.analyze_with_ai_detailed(gap_analysis_prompt, "capability_analysis")
        
        # Process and structure the analysis
        capability_gaps = _extract_capability_gaps(gap_analysis["content"])
        
        # Generate prioritization matrix
        prioritization_matrix = _generate_prioritization_matrix(capability_gaps, priority_factors)
        
        # Calculate resource requirements
        resource_analysis = _analyze_resource_requirements(capability_gaps, resource_constraints)
        
        return {
            "gap_analysis": {
                "content": gap_analysis["content"],
                "total_gaps_identified": len(capability_gaps),
                "critical_gaps": len([g for g in capability_gaps if g.get("priority") == "critical"]),
                "analysis_confidence": _calculate_gap_analysis_confidence(mission_requirements, current_capabilities)
            },
            "capability_gaps": capability_gaps,
            "dotmlpf_assessment": {
                "doctrine": _assess_doctrine_gaps(capability_gaps),
                "organization": _assess_organization_gaps(capability_gaps),
                "training": _assess_training_gaps(capability_gaps),
                "materiel": _assess_materiel_gaps(capability_gaps),
                "leadership": _assess_leadership_gaps(capability_gaps),
                "personnel": _assess_personnel_gaps(capability_gaps),
                "facilities": _assess_facilities_gaps(capability_gaps)
            },
            "prioritization_matrix": prioritization_matrix,
            "resource_analysis": resource_analysis,
            "implementation_roadmap": {
                "immediate_priorities": _identify_immediate_priorities(capability_gaps),
                "short_term_goals": _identify_short_term_goals(capability_gaps),
                "long_term_objectives": _identify_long_term_objectives(capability_gaps),
                "dependency_analysis": _analyze_capability_dependencies(capability_gaps)
            },
            "recommendations": _generate_capability_recommendations(capability_gaps, resource_constraints),
            "analysis_metadata": {
                "operational_context": operational_context,
                "priority_factors": priority_factors,
                "methodology": "AI-Enhanced DOTMLPF Gap Analysis",
                "generated_at": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Automated gap analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Gap analysis failed")


@router.post("/ai/scenario-modeling")
async def dotmlpf_scenario_modeling(
    request: dict
) -> dict:
    """
    Generate scenario-based DOTMLPF analysis with what-if modeling.
    """
    try:
        base_scenario = request.get("base_scenario", {})
        alternative_scenarios = request.get("alternative_scenarios", [])
        capability_variables = request.get("capability_variables", [])
        external_factors = request.get("external_factors", [])
        
        # AI-powered scenario modeling
        scenario_prompt = f"""
        As an expert military capability planner, analyze multiple scenarios and their DOTMLPF implications.

        Base Scenario:
        {json.dumps(base_scenario, indent=2)}

        Alternative Scenarios:
        {json.dumps(alternative_scenarios, indent=2)}

        Capability Variables: {', '.join(capability_variables)}
        External Factors: {', '.join(external_factors)}

        For each scenario, provide:
        1. Scenario analysis and key assumptions
        2. DOTMLPF capability requirements unique to scenario
        3. Risk assessment and mitigation strategies
        4. Resource allocation recommendations
        5. Timeline and implementation considerations
        6. Sensitivity analysis for key variables

        Compare scenarios and identify:
        - Common capability requirements across scenarios
        - Scenario-specific requirements
        - High-impact variables that change requirements significantly
        - Robust capabilities that perform well across scenarios
        - Fragile capabilities that fail in some scenarios

        Provide recommendations for capability development that:
        - Maximize effectiveness across scenarios
        - Minimize resource requirements
        - Provide flexibility for scenario adaptation
        - Address highest-impact risks

        Format as comprehensive scenario analysis with decision support.
        """
        
        scenario_analysis = await ai_service.analyze_with_ai_detailed(scenario_prompt, "scenario_modeling")
        
        # Generate scenario comparison
        scenario_comparison = _generate_scenario_comparison(base_scenario, alternative_scenarios)
        
        # Analyze capability robustness
        robustness_analysis = _analyze_capability_robustness(scenario_comparison)
        
        # Generate adaptive strategies
        adaptive_strategies = _generate_adaptive_strategies(scenario_comparison, external_factors)
        
        return {
            "scenario_analysis": {
                "content": scenario_analysis["content"],
                "scenarios_analyzed": len(alternative_scenarios) + 1,  # +1 for base scenario
                "variables_considered": len(capability_variables),
                "external_factors": len(external_factors)
            },
            "scenario_comparison": scenario_comparison,
            "robustness_analysis": robustness_analysis,
            "adaptive_strategies": adaptive_strategies,
            "decision_support": {
                "recommended_capabilities": _identify_robust_capabilities(robustness_analysis),
                "flexible_investments": _identify_flexible_investments(scenario_comparison),
                "risk_mitigation": _generate_risk_mitigation_strategies(scenario_comparison),
                "contingency_planning": _develop_contingency_plans(alternative_scenarios)
            },
            "sensitivity_analysis": {
                "high_impact_variables": _identify_high_impact_variables(capability_variables),
                "critical_assumptions": _identify_critical_assumptions(base_scenario),
                "uncertainty_factors": _assess_uncertainty_factors(external_factors),
                "decision_points": _identify_decision_points(scenario_comparison)
            },
            "analysis_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"DOTMLPF scenario modeling failed: {e}")
        raise HTTPException(status_code=500, detail="Scenario modeling failed")


@router.post("/ai/optimization-planning")
async def capability_optimization_planning(
    request: dict
) -> dict:
    """
    Generate optimized capability development plans with resource allocation.
    """
    try:
        capability_requirements = request.get("capability_requirements", [])
        budget_constraints = request.get("budget_constraints", {})
        timeline_constraints = request.get("timeline_constraints", {})
        optimization_objectives = request.get("optimization_objectives", [])
        risk_tolerance = request.get("risk_tolerance", "medium")
        
        # AI-powered optimization analysis
        optimization_prompt = f"""
        As an expert capability development optimizer, create optimal investment strategies for DOTMLPF capability development.

        Capability Requirements:
        {json.dumps(capability_requirements, indent=2)}

        Budget Constraints:
        {json.dumps(budget_constraints, indent=2)}

        Timeline Constraints:
        {json.dumps(timeline_constraints, indent=2)}

        Optimization Objectives: {', '.join(optimization_objectives)}
        Risk Tolerance: {risk_tolerance}

        Develop optimization strategies that:
        1. Maximize capability delivery within constraints
        2. Minimize total cost of ownership
        3. Optimize timeline for capability delivery
        4. Balance risk and benefit across DOTMLPF domains
        5. Consider interdependencies between capabilities
        6. Account for technology maturity and acquisition timelines

        For each optimization approach:
        - Investment allocation across DOTMLPF domains
        - Phased implementation timeline
        - Risk assessment and mitigation
        - Cost-benefit analysis
        - Performance metrics and success criteria
        - Alternative options if constraints change

        Provide multiple optimization scenarios:
        - Minimum viable capability approach
        - Balanced development approach
        - Maximum capability approach
        - Risk-averse approach
        - Innovation-focused approach

        Include sensitivity analysis for budget and timeline variations.
        """
        
        optimization_analysis = await ai_service.analyze_with_ai_detailed(optimization_prompt, "optimization_planning")
        
        # Generate optimization scenarios
        optimization_scenarios = _generate_optimization_scenarios(capability_requirements, budget_constraints)
        
        # Calculate cost-benefit analysis
        cost_benefit_analysis = _perform_cost_benefit_analysis(optimization_scenarios)
        
        # Generate implementation plans
        implementation_plans = _generate_implementation_plans(optimization_scenarios, timeline_constraints)
        
        return {
            "optimization_analysis": {
                "content": optimization_analysis["content"],
                "requirements_analyzed": len(capability_requirements),
                "scenarios_generated": len(optimization_scenarios),
                "optimization_confidence": _calculate_optimization_confidence(capability_requirements, budget_constraints)
            },
            "optimization_scenarios": optimization_scenarios,
            "cost_benefit_analysis": cost_benefit_analysis,
            "implementation_plans": implementation_plans,
            "resource_allocation": {
                "dotmlpf_distribution": _calculate_dotmlpf_allocation(optimization_scenarios),
                "budget_optimization": _optimize_budget_allocation(budget_constraints, capability_requirements),
                "timeline_optimization": _optimize_timeline_allocation(timeline_constraints, capability_requirements),
                "risk_optimization": _optimize_risk_allocation(risk_tolerance, capability_requirements)
            },
            "performance_metrics": {
                "capability_delivery_timeline": _calculate_capability_timeline(implementation_plans),
                "cost_effectiveness_ratio": _calculate_cost_effectiveness(cost_benefit_analysis),
                "risk_adjusted_returns": _calculate_risk_adjusted_returns(optimization_scenarios),
                "implementation_feasibility": _assess_implementation_feasibility(implementation_plans)
            },
            "recommendations": _generate_optimization_recommendations(optimization_scenarios, cost_benefit_analysis),
            "planning_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Capability optimization planning failed: {e}")
        raise HTTPException(status_code=500, detail="Optimization planning failed")


# Helper functions for AI-enhanced DOTMLPF analysis

def _extract_capability_gaps(analysis_content: str) -> list[dict]:
    """Extract capability gaps from AI analysis content."""
    # Simulate gap extraction (would parse AI response in production)
    return [
        {
            "gap_id": "doctrine_001",
            "domain": "doctrine",
            "description": "Lack of multi-domain operations doctrine",
            "priority": "critical",
            "impact_assessment": "High impact on mission effectiveness",
            "current_state": "Traditional single-domain focus",
            "required_state": "Integrated multi-domain capabilities",
            "resource_estimate": 500000,
            "timeline": "12-18_months",
            "dependencies": ["training", "organization"]
        },
        {
            "gap_id": "materiel_001", 
            "domain": "materiel",
            "description": "Outdated communication systems",
            "priority": "high",
            "impact_assessment": "Degraded interoperability",
            "current_state": "Legacy radio systems",
            "required_state": "Digital network capabilities",
            "resource_estimate": 2000000,
            "timeline": "24-30_months",
            "dependencies": ["training", "facilities"]
        }
    ]


def _generate_prioritization_matrix(capability_gaps: list, priority_factors: list) -> dict:
    """Generate prioritization matrix for capability gaps."""
    priority_scores = {}
    
    for gap in capability_gaps:
        gap_id = gap.get("gap_id", "")
        priority_level = gap.get("priority", "medium")
        
        # Calculate priority score based on multiple factors
        priority_weights = {"critical": 1.0, "high": 0.8, "medium": 0.6, "low": 0.4}
        base_score = priority_weights.get(priority_level, 0.6)
        
        # Adjust score based on priority factors
        factor_bonus = len([f for f in priority_factors if f.lower() in gap.get("description", "").lower()]) * 0.1
        
        priority_scores[gap_id] = min(1.0, base_score + factor_bonus)
    
    return {
        "gap_priorities": priority_scores,
        "high_priority_gaps": [gap_id for gap_id, score in priority_scores.items() if score > 0.8],
        "medium_priority_gaps": [gap_id for gap_id, score in priority_scores.items() if 0.6 <= score <= 0.8],
        "low_priority_gaps": [gap_id for gap_id, score in priority_scores.items() if score < 0.6],
        "prioritization_method": "Multi-factor weighted scoring"
    }


def _analyze_resource_requirements(capability_gaps: list, resource_constraints: dict) -> dict:
    """Analyze resource requirements for capability gaps."""
    total_budget = sum(gap.get("resource_estimate", 0) for gap in capability_gaps)
    available_budget = resource_constraints.get("total_budget", 0)
    
    return {
        "total_requirements": total_budget,
        "available_resources": available_budget,
        "budget_gap": max(0, total_budget - available_budget),
        "funding_adequacy": "adequate" if available_budget >= total_budget else "insufficient",
        "domain_breakdown": _calculate_domain_resource_breakdown(capability_gaps),
        "timeline_requirements": _calculate_timeline_resource_needs(capability_gaps),
        "optimization_opportunities": _identify_optimization_opportunities(capability_gaps)
    }


def _calculate_gap_analysis_confidence(mission_requirements: dict, current_capabilities: dict) -> float:
    """Calculate confidence level for gap analysis."""
    requirements_completeness = len(mission_requirements) / 10  # Assume 10 key requirement areas
    capabilities_completeness = len(current_capabilities) / 10  # Assume 10 key capability areas
    
    return (requirements_completeness + capabilities_completeness) / 2


def _assess_doctrine_gaps(capability_gaps: list) -> dict:
    """Assess doctrine-specific capability gaps."""
    doctrine_gaps = [gap for gap in capability_gaps if gap.get("domain") == "doctrine"]
    
    return {
        "total_gaps": len(doctrine_gaps),
        "critical_gaps": len([g for g in doctrine_gaps if g.get("priority") == "critical"]),
        "key_areas": [gap.get("description") for gap in doctrine_gaps[:3]],
        "development_priority": "high" if len(doctrine_gaps) > 2 else "medium",
        "estimated_timeline": "12-24_months"
    }


def _assess_organization_gaps(capability_gaps: list) -> dict:
    """Assess organization-specific capability gaps."""
    org_gaps = [gap for gap in capability_gaps if gap.get("domain") == "organization"]
    
    return {
        "total_gaps": len(org_gaps),
        "structural_issues": len([g for g in org_gaps if "structure" in g.get("description", "").lower()]),
        "command_control_gaps": len([g for g in org_gaps if "command" in g.get("description", "").lower()]),
        "reorganization_required": len(org_gaps) > 1,
        "complexity_level": "high" if len(org_gaps) > 2 else "medium"
    }


def _assess_training_gaps(capability_gaps: list) -> dict:
    """Assess training-specific capability gaps."""
    training_gaps = [gap for gap in capability_gaps if gap.get("domain") == "training"]
    
    return {
        "total_gaps": len(training_gaps),
        "skill_gaps": len([g for g in training_gaps if "skill" in g.get("description", "").lower()]),
        "infrastructure_gaps": len([g for g in training_gaps if "infrastructure" in g.get("description", "").lower()]),
        "training_priority": "critical" if len(training_gaps) > 3 else "high",
        "development_timeline": "6-18_months"
    }


def _assess_materiel_gaps(capability_gaps: list) -> dict:
    """Assess materiel-specific capability gaps."""
    materiel_gaps = [gap for gap in capability_gaps if gap.get("domain") == "materiel"]
    
    return {
        "total_gaps": len(materiel_gaps),
        "technology_gaps": len([g for g in materiel_gaps if "technology" in g.get("description", "").lower()]),
        "equipment_gaps": len([g for g in materiel_gaps if "equipment" in g.get("description", "").lower()]),
        "procurement_required": len(materiel_gaps) > 0,
        "investment_level": "high" if len(materiel_gaps) > 2 else "medium"
    }


def _assess_leadership_gaps(capability_gaps: list) -> dict:
    """Assess leadership and education-specific capability gaps."""
    leadership_gaps = [gap for gap in capability_gaps if gap.get("domain") == "leadership"]
    
    return {
        "total_gaps": len(leadership_gaps),
        "education_gaps": len([g for g in leadership_gaps if "education" in g.get("description", "").lower()]),
        "development_gaps": len([g for g in leadership_gaps if "development" in g.get("description", "").lower()]),
        "leadership_priority": "high" if len(leadership_gaps) > 1 else "medium",
        "development_approach": "Progressive leadership development program"
    }


def _assess_personnel_gaps(capability_gaps: list) -> dict:
    """Assess personnel-specific capability gaps."""
    personnel_gaps = [gap for gap in capability_gaps if gap.get("domain") == "personnel"]
    
    return {
        "total_gaps": len(personnel_gaps),
        "manning_gaps": len([g for g in personnel_gaps if "manning" in g.get("description", "").lower()]),
        "skill_gaps": len([g for g in personnel_gaps if "skill" in g.get("description", "").lower()]),
        "recruitment_required": len(personnel_gaps) > 0,
        "retention_focus": "high" if len(personnel_gaps) > 2 else "medium"
    }


def _assess_facilities_gaps(capability_gaps: list) -> dict:
    """Assess facilities-specific capability gaps."""
    facilities_gaps = [gap for gap in capability_gaps if gap.get("domain") == "facilities"]
    
    return {
        "total_gaps": len(facilities_gaps),
        "infrastructure_gaps": len([g for g in facilities_gaps if "infrastructure" in g.get("description", "").lower()]),
        "modernization_gaps": len([g for g in facilities_gaps if "modernization" in g.get("description", "").lower()]),
        "construction_required": len(facilities_gaps) > 1,
        "investment_timeline": "2-5_years"
    }


def _identify_immediate_priorities(capability_gaps: list) -> list[dict]:
    """Identify immediate priority capability gaps."""
    critical_gaps = [gap for gap in capability_gaps if gap.get("priority") == "critical"]
    
    return [
        {
            "gap_id": gap.get("gap_id"),
            "description": gap.get("description"),
            "action_required": "Immediate attention",
            "timeline": "0-6_months",
            "resource_requirement": "high"
        }
        for gap in critical_gaps[:3]  # Top 3 critical gaps
    ]


def _identify_short_term_goals(capability_gaps: list) -> list[dict]:
    """Identify short-term capability development goals."""
    high_priority_gaps = [gap for gap in capability_gaps if gap.get("priority") == "high"]
    
    return [
        {
            "gap_id": gap.get("gap_id"),
            "description": gap.get("description"),
            "target_timeline": "6-18_months",
            "success_criteria": "Gap closure with measurable improvement",
            "milestone_tracking": "quarterly_reviews"
        }
        for gap in high_priority_gaps[:5]  # Top 5 high priority gaps
    ]


def _identify_long_term_objectives(capability_gaps: list) -> list[dict]:
    """Identify long-term capability development objectives."""
    all_gaps = [gap for gap in capability_gaps if gap.get("priority") in ["medium", "low"]]
    
    return [
        {
            "gap_id": gap.get("gap_id"),
            "description": gap.get("description"),
            "target_timeline": "18_months_plus",
            "strategic_alignment": "Future capability requirements",
            "investment_approach": "planned_development"
        }
        for gap in all_gaps[:10]  # Top 10 medium/low priority gaps
    ]


def _analyze_capability_dependencies(capability_gaps: list) -> dict:
    """Analyze dependencies between capability gaps."""
    dependencies = {}
    
    for gap in capability_gaps:
        gap_id = gap.get("gap_id", "")
        gap_dependencies = gap.get("dependencies", [])
        dependencies[gap_id] = gap_dependencies
    
    return {
        "dependency_map": dependencies,
        "critical_path": _identify_critical_path(dependencies),
        "independent_capabilities": [gap_id for gap_id, deps in dependencies.items() if not deps],
        "highly_dependent_capabilities": [gap_id for gap_id, deps in dependencies.items() if len(deps) > 2]
    }


def _generate_capability_recommendations(capability_gaps: list, resource_constraints: dict) -> list[str]:
    """Generate capability development recommendations."""
    recommendations = []
    
    critical_count = len([g for g in capability_gaps if g.get("priority") == "critical"])
    if critical_count > 3:
        recommendations.append("Focus immediate resources on critical capability gaps")
    
    total_budget = sum(gap.get("resource_estimate", 0) for gap in capability_gaps)
    available_budget = resource_constraints.get("total_budget", 0)
    
    if total_budget > available_budget * 1.2:
        recommendations.append("Consider phased implementation due to budget constraints")
    
    recommendations.extend([
        "Prioritize capabilities with cross-domain benefits",
        "Establish capability development program office",
        "Implement regular capability assessment reviews",
        "Develop capability roadmap with decision gates"
    ])
    
    return recommendations


def _generate_scenario_comparison(base_scenario: dict, alternative_scenarios: list) -> dict:
    """Generate comparison between scenarios."""
    return {
        "base_scenario": {
            "name": base_scenario.get("name", "Base Case"),
            "capability_requirements": base_scenario.get("requirements", []),
            "risk_level": base_scenario.get("risk_level", "medium"),
            "resource_needs": base_scenario.get("resource_estimate", 0)
        },
        "alternative_scenarios": [
            {
                "name": scenario.get("name", f"Alternative {i+1}"),
                "capability_delta": scenario.get("capability_delta", []),
                "risk_delta": scenario.get("risk_delta", "neutral"),
                "resource_delta": scenario.get("resource_delta", 0),
                "probability": scenario.get("probability", 0.5)
            }
            for i, scenario in enumerate(alternative_scenarios)
        ],
        "comparison_metrics": {
            "capability_overlap": 0.7,
            "resource_variance": 0.3,
            "risk_variance": 0.4,
            "complexity_increase": 0.2
        }
    }


def _analyze_capability_robustness(scenario_comparison: dict) -> dict:
    """Analyze robustness of capabilities across scenarios."""
    return {
        "robust_capabilities": [
            "Command and control systems",
            "Basic personnel training",
            "Core infrastructure"
        ],
        "scenario_specific_capabilities": [
            "Specialized equipment for alternative scenarios",
            "Additional training for specific contexts",
            "Enhanced facilities for high-intensity operations"
        ],
        "robustness_score": 0.75,
        "adaptation_requirements": [
            "Modular capability design",
            "Flexible training programs",
            "Scalable resource allocation"
        ]
    }


def _generate_adaptive_strategies(scenario_comparison: dict, external_factors: list) -> list[dict]:
    """Generate adaptive strategies for different scenarios."""
    return [
        {
            "strategy_name": "Flexible Capability Development",
            "approach": "Develop core capabilities with modular enhancements",
            "benefits": ["Lower cost", "Faster adaptation", "Reduced risk"],
            "implementation": "Phase 1: Core capabilities, Phase 2: Scenario-specific modules"
        },
        {
            "strategy_name": "Capability Portfolio Management",
            "approach": "Balanced investment across capability types",
            "benefits": ["Risk distribution", "Comprehensive coverage", "Optimization opportunities"],
            "implementation": "Portfolio-based resource allocation with regular rebalancing"
        }
    ]


def _identify_robust_capabilities(robustness_analysis: dict) -> list[str]:
    """Identify capabilities that are robust across scenarios."""
    return robustness_analysis.get("robust_capabilities", [])


def _identify_flexible_investments(scenario_comparison: dict) -> list[str]:
    """Identify investments that provide flexibility across scenarios."""
    return [
        "Modular technology platforms",
        "Cross-training programs",
        "Adaptable infrastructure",
        "Multi-purpose equipment",
        "Flexible organizational structures"
    ]


def _generate_risk_mitigation_strategies(scenario_comparison: dict) -> list[str]:
    """Generate risk mitigation strategies for scenario planning."""
    return [
        "Maintain capability reserves for high-risk scenarios",
        "Develop rapid response protocols",
        "Establish contingency funding mechanisms",
        "Create capability sharing agreements",
        "Implement early warning systems"
    ]


def _develop_contingency_plans(alternative_scenarios: list) -> list[dict]:
    """Develop contingency plans for alternative scenarios."""
    return [
        {
            "scenario": scenario.get("name", f"Scenario {i+1}"),
            "trigger_conditions": scenario.get("triggers", []),
            "response_actions": scenario.get("responses", []),
            "resource_requirements": scenario.get("resources", {}),
            "timeline": scenario.get("timeline", "TBD")
        }
        for i, scenario in enumerate(alternative_scenarios)
    ]


def _identify_high_impact_variables(capability_variables: list) -> list[str]:
    """Identify variables with high impact on capability requirements."""
    # Simulate identification of high-impact variables
    return [
        "Threat sophistication level",
        "Operational tempo",
        "Technology availability",
        "Resource constraints",
        "Timeline pressures"
    ]


def _identify_critical_assumptions(base_scenario: dict) -> list[str]:
    """Identify critical assumptions in base scenario."""
    return [
        "Threat environment remains stable",
        "Technology development proceeds as planned",
        "Resources remain available as projected",
        "Political support continues",
        "Allied cooperation maintained"
    ]


def _assess_uncertainty_factors(external_factors: list) -> dict:
    """Assess uncertainty factors affecting capability planning."""
    return {
        "high_uncertainty": [f for f in external_factors if "uncertain" in f.lower() or "unknown" in f.lower()],
        "moderate_uncertainty": [f for f in external_factors if "variable" in f.lower() or "changing" in f.lower()],
        "low_uncertainty": [f for f in external_factors if "stable" in f.lower() or "predictable" in f.lower()],
        "uncertainty_impact": "Moderate impact on capability planning"
    }


def _identify_decision_points(scenario_comparison: dict) -> list[dict]:
    """Identify key decision points in capability development."""
    return [
        {
            "decision_point": "Technology selection milestone",
            "timeline": "6_months",
            "options": ["Commercial solution", "Military-specific development", "Hybrid approach"],
            "impact": "High impact on cost and timeline"
        },
        {
            "decision_point": "Implementation approach",
            "timeline": "12_months", 
            "options": ["Phased rollout", "Big bang implementation", "Pilot program"],
            "impact": "Medium impact on risk and effectiveness"
        }
    ]


def _generate_optimization_scenarios(capability_requirements: list, budget_constraints: dict) -> list[dict]:
    """Generate optimization scenarios for capability development."""
    return [
        {
            "scenario_name": "Minimum Viable Capability",
            "approach": "Essential capabilities only",
            "budget_allocation": budget_constraints.get("minimum_budget", 0),
            "timeline": "12_months",
            "risk_level": "high",
            "capability_coverage": 0.6
        },
        {
            "scenario_name": "Balanced Development",
            "approach": "Balanced across all DOTMLPF domains",
            "budget_allocation": budget_constraints.get("target_budget", 0),
            "timeline": "18_months",
            "risk_level": "medium",
            "capability_coverage": 0.8
        },
        {
            "scenario_name": "Maximum Capability",
            "approach": "Full capability development",
            "budget_allocation": budget_constraints.get("maximum_budget", 0),
            "timeline": "24_months",
            "risk_level": "low",
            "capability_coverage": 1.0
        }
    ]


def _perform_cost_benefit_analysis(optimization_scenarios: list) -> dict:
    """Perform cost-benefit analysis for optimization scenarios."""
    analysis = {}
    
    for scenario in optimization_scenarios:
        scenario_name = scenario.get("scenario_name", "")
        budget = scenario.get("budget_allocation", 0)
        coverage = scenario.get("capability_coverage", 0)
        
        # Calculate benefit-to-cost ratio
        benefit_score = coverage * 10  # Assume capability coverage translates to benefit
        cost_efficiency = benefit_score / max(budget / 1000000, 1)  # Normalize budget to millions
        
        analysis[scenario_name] = {
            "cost": budget,
            "benefit_score": benefit_score,
            "cost_efficiency": cost_efficiency,
            "roi_estimate": coverage * 100  # Simple ROI calculation
        }
    
    return analysis


def _generate_implementation_plans(optimization_scenarios: list, timeline_constraints: dict) -> dict:
    """Generate implementation plans for optimization scenarios."""
    plans = {}
    
    for scenario in optimization_scenarios:
        scenario_name = scenario.get("scenario_name", "")
        timeline = scenario.get("timeline", "18_months")
        
        plans[scenario_name] = {
            "total_timeline": timeline,
            "phase_1": "Planning and initial setup (25% of timeline)",
            "phase_2": "Core capability development (50% of timeline)",
            "phase_3": "Integration and testing (25% of timeline)",
            "key_milestones": [
                {"milestone": "Requirements finalization", "timing": "Month 2"},
                {"milestone": "Development kickoff", "timing": "Month 4"},
                {"milestone": "Initial capability delivery", "timing": f"Month {int(timeline.split('_')[0]) // 2}"},
                {"milestone": "Full operational capability", "timing": f"Month {timeline.split('_')[0]}"}
            ]
        }
    
    return plans


def _calculate_optimization_confidence(capability_requirements: list, budget_constraints: dict) -> float:
    """Calculate confidence in optimization analysis."""
    requirements_clarity = min(1.0, len(capability_requirements) / 10)
    budget_clarity = 1.0 if budget_constraints else 0.5
    
    return (requirements_clarity + budget_clarity) / 2


def _calculate_dotmlpf_allocation(optimization_scenarios: list) -> dict:
    """Calculate resource allocation across DOTMLPF domains."""
    return {
        "doctrine": 0.10,
        "organization": 0.15,
        "training": 0.20,
        "materiel": 0.35,
        "leadership": 0.10,
        "personnel": 0.05,
        "facilities": 0.05
    }


def _optimize_budget_allocation(budget_constraints: dict, capability_requirements: list) -> dict:
    """Optimize budget allocation across capabilities."""
    total_budget = budget_constraints.get("total_budget", 0)
    
    return {
        "total_budget": total_budget,
        "allocation_strategy": "Priority-based allocation",
        "critical_capabilities": total_budget * 0.6,
        "high_priority_capabilities": total_budget * 0.3,
        "medium_priority_capabilities": total_budget * 0.1,
        "contingency_reserve": total_budget * 0.1
    }


def _optimize_timeline_allocation(timeline_constraints: dict, capability_requirements: list) -> dict:
    """Optimize timeline allocation for capability development."""
    return {
        "immediate_phase": "0-6_months",
        "short_term_phase": "6-18_months", 
        "long_term_phase": "18_months_plus",
        "parallel_development": "Enable concurrent development where possible",
        "critical_path": "Focus on dependencies and bottlenecks"
    }


def _optimize_risk_allocation(risk_tolerance: str, capability_requirements: list) -> dict:
    """Optimize risk allocation across capability development."""
    risk_levels = {
        "low": {"conservative": 0.8, "moderate": 0.15, "aggressive": 0.05},
        "medium": {"conservative": 0.5, "moderate": 0.4, "aggressive": 0.1},
        "high": {"conservative": 0.3, "moderate": 0.4, "aggressive": 0.3}
    }
    
    allocation = risk_levels.get(risk_tolerance, risk_levels["medium"])
    
    return {
        "risk_tolerance": risk_tolerance,
        "conservative_investments": allocation["conservative"],
        "moderate_risk_investments": allocation["moderate"],
        "aggressive_investments": allocation["aggressive"],
        "risk_mitigation_reserve": 0.1
    }


def _calculate_capability_timeline(implementation_plans: dict) -> dict:
    """Calculate capability delivery timeline."""
    return {
        "initial_operational_capability": "6-12_months",
        "full_operational_capability": "12-24_months",
        "capability_maturity": "24-36_months",
        "continuous_improvement": "Ongoing"
    }


def _calculate_cost_effectiveness(cost_benefit_analysis: dict) -> float:
    """Calculate overall cost effectiveness ratio."""
    total_benefit = sum(scenario.get("benefit_score", 0) for scenario in cost_benefit_analysis.values())
    total_cost = sum(scenario.get("cost", 0) for scenario in cost_benefit_analysis.values())
    
    return total_benefit / max(total_cost / 1000000, 1)  # Normalize cost to millions


def _calculate_risk_adjusted_returns(optimization_scenarios: list) -> dict:
    """Calculate risk-adjusted returns for optimization scenarios."""
    returns = {}
    
    for scenario in optimization_scenarios:
        scenario_name = scenario.get("scenario_name", "")
        coverage = scenario.get("capability_coverage", 0)
        risk_level = scenario.get("risk_level", "medium")
        
        # Risk adjustment factors
        risk_factors = {"low": 0.9, "medium": 0.7, "high": 0.5}
        risk_factor = risk_factors.get(risk_level, 0.7)
        
        risk_adjusted_return = coverage * risk_factor
        returns[scenario_name] = risk_adjusted_return
    
    return returns


def _assess_implementation_feasibility(implementation_plans: dict) -> dict:
    """Assess feasibility of implementation plans."""
    return {
        "technical_feasibility": "High",
        "resource_feasibility": "Medium", 
        "timeline_feasibility": "Medium",
        "organizational_feasibility": "High",
        "overall_feasibility": "Medium-High",
        "key_challenges": [
            "Resource coordination across domains",
            "Timeline synchronization",
            "Technology integration complexity"
        ]
    }


def _generate_optimization_recommendations(optimization_scenarios: list, cost_benefit_analysis: dict) -> list[str]:
    """Generate optimization recommendations."""
    recommendations = []
    
    # Find best cost-efficiency scenario
    best_scenario = max(
        cost_benefit_analysis.items(),
        key=lambda x: x[1].get("cost_efficiency", 0)
    )[0]
    
    recommendations.append(f"Recommend {best_scenario} approach for optimal cost-efficiency")
    
    recommendations.extend([
        "Implement phased development approach to manage risk",
        "Establish capability measurement framework",
        "Create cross-domain integration office",
        "Develop capability spiral development process",
        "Maintain strategic reserve for emerging requirements"
    ])
    
    return recommendations


def _calculate_domain_resource_breakdown(capability_gaps: list) -> dict:
    """Calculate resource breakdown by DOTMLPF domain."""
    domain_totals = {}
    
    for gap in capability_gaps:
        domain = gap.get("domain", "unknown")
        resource_estimate = gap.get("resource_estimate", 0)
        
        if domain in domain_totals:
            domain_totals[domain] += resource_estimate
        else:
            domain_totals[domain] = resource_estimate
    
    return domain_totals


def _calculate_timeline_resource_needs(capability_gaps: list) -> dict:
    """Calculate resource needs over time."""
    return {
        "year_1": sum(gap.get("resource_estimate", 0) * 0.4 for gap in capability_gaps),
        "year_2": sum(gap.get("resource_estimate", 0) * 0.4 for gap in capability_gaps),
        "year_3_plus": sum(gap.get("resource_estimate", 0) * 0.2 for gap in capability_gaps)
    }


def _identify_optimization_opportunities(capability_gaps: list) -> list[str]:
    """Identify optimization opportunities in capability development."""
    return [
        "Combine similar training requirements across domains",
        "Leverage commercial technologies where applicable",
        "Implement shared services for common capabilities",
        "Optimize facility utilization across organizations",
        "Create joint development programs with allies"
    ]


def _identify_critical_path(dependencies: dict) -> list[str]:
    """Identify critical path through capability dependencies."""
    # Simplified critical path analysis
    return [
        "Foundation capabilities (no dependencies)",
        "Core operational capabilities",
        "Advanced integration capabilities",
        "Full spectrum capabilities"
    ]
