"""
SWOT Analysis API endpoints.
Comprehensive SWOT analysis capabilities for intelligence analysts.
"""


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
    framework_service,
)
from app.services.ai_service import ai_service
from datetime import datetime

logger = get_logger(__name__)
router = APIRouter()


class SWOTCreateRequest(BaseModel):
    """SWOT analysis creation request."""
    title: str
    objective: str
    context: str | None = None
    initial_strengths: list[str] | None = []
    initial_weaknesses: list[str] | None = []
    initial_opportunities: list[str] | None = []
    initial_threats: list[str] | None = []
    request_ai_suggestions: bool = True


class SWOTUpdateRequest(BaseModel):
    """SWOT analysis update request."""
    title: str | None = None
    objective: str | None = None
    context: str | None = None
    strengths: list[str] | None = None
    weaknesses: list[str] | None = None
    opportunities: list[str] | None = None
    threats: list[str] | None = None


class SWOTAnalysisResponse(BaseModel):
    """SWOT analysis response."""
    session_id: int
    title: str
    objective: str
    context: str | None
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]
    ai_suggestions: dict | None = None
    status: str
    version: int


class SWOTAISuggestionRequest(BaseModel):
    """Request for AI suggestions on SWOT analysis."""
    session_id: int
    focus_area: str | None = None  # strengths, weaknesses, opportunities, threats, or all
    additional_context: str | None = None


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
    logger.info(f"Getting SWOT analysis {session_id}")

    # Get real data from database
    session = await framework_service.get_session(db, current_user, session_id, FrameworkType.SWOT)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SWOT analysis session not found"
        )

    # Extract data from session
    session_data = session.data or {}
    
    return SWOTAnalysisResponse(
        session_id=session.id,
        title=session.title,
        objective=session_data.get("objective", ""),
        context=session_data.get("context"),
        strengths=session_data.get("strengths", []),
        weaknesses=session_data.get("weaknesses", []),
        opportunities=session_data.get("opportunities", []),
        threats=session_data.get("threats", []),
        ai_suggestions=session_data.get("ai_suggestions"),
        status=session.status.value,
        version=session.version
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


# AI-Enhanced SWOT Analysis Endpoints

@router.post("/ai/industry-analysis")
async def industry_specific_swot_analysis(
    request: dict
) -> dict:
    """
    Generate industry-specific SWOT analysis with competitive intelligence.
    """
    try:
        industry = request.get("industry", "")
        company_context = request.get("company_context", "")
        market_segment = request.get("market_segment", "")
        competitive_focus = request.get("competitive_focus", True)
        
        # Enhanced AI prompt for industry-specific analysis
        ai_prompt = f"""
        As an expert strategic analyst specializing in {industry} industry analysis, 
        generate a comprehensive SWOT analysis with competitive intelligence.

        Company Context: {company_context}
        Market Segment: {market_segment}
        Industry: {industry}

        Requirements:
        1. Industry-specific factors and terminology
        2. Current market dynamics and trends for {industry}
        3. Regulatory environment considerations
        4. Technology disruption factors
        5. Key performance indicators for {industry}
        
        For each SWOT category, provide:
        - 4-6 specific, industry-relevant factors
        - Competitive positioning insights
        - Market trend implications
        - Quantifiable metrics where applicable
        
        Format as JSON with:
        {{
            "strengths": [{{
                "factor": "description",
                "competitive_advantage": "how this creates advantage",
                "market_impact": "impact on market position",
                "metrics": "relevant KPIs or measurements"
            }}],
            "weaknesses": [...],
            "opportunities": [...],
            "threats": [...]
        }}
        
        Include industry-specific templates for: {industry}
        """

        result = await ai_service.analyze_with_ai_detailed(ai_prompt, "industry_analysis")
        
        # Parse and structure the response
        import json
        try:
            analysis_data = json.loads(result["content"])
        except json.JSONDecodeError:
            analysis_data = {"error": "Failed to parse AI response", "raw_content": result["content"]}

        return {
            "analysis": analysis_data,
            "industry": industry,
            "competitive_intelligence": {
                "market_position_factors": _extract_positioning_factors(analysis_data),
                "trend_analysis": _analyze_market_trends(analysis_data),
                "risk_assessment": _assess_strategic_risks(analysis_data)
            },
            "recommendations": _generate_strategic_recommendations(analysis_data),
            "generated_at": datetime.now().isoformat(),
            "methodology": "AI-Enhanced Industry-Specific SWOT Analysis"
        }
        
    except Exception as e:
        logger.error(f"Industry SWOT analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Industry analysis failed")


@router.post("/ai/competitive-intelligence")
async def automated_competitive_analysis(
    request: dict
) -> dict:
    """
    Perform automated competitive intelligence and market analysis.
    """
    try:
        company_name = request.get("company_name", "")
        competitors = request.get("competitors", [])
        market_segment = request.get("market_segment", "")
        analysis_depth = request.get("analysis_depth", "standard")  # standard, deep, surface
        
        # Simulate competitive intelligence gathering (in production, would use web scraping)
        competitive_analysis = {
            "primary_competitors": [],
            "market_dynamics": {},
            "competitive_positioning": {},
            "threat_assessment": {}
        }
        
        for competitor in competitors[:5]:  # Limit to 5 competitors
            competitor_profile = await _analyze_competitor(competitor, market_segment)
            competitive_analysis["primary_competitors"].append(competitor_profile)
        
        # AI-powered market dynamics analysis
        market_prompt = f"""
        Analyze the competitive landscape for {company_name} in {market_segment}.
        
        Key Competitors: {', '.join(competitors)}
        
        Provide analysis on:
        1. Market share distribution and trends
        2. Competitive advantages and differentiators
        3. Pricing strategies and value propositions
        4. Technology adoption and innovation patterns
        5. Customer base and target segments
        6. Strategic partnerships and alliances
        
        Format insights for SWOT integration with actionable intelligence.
        """
        
        market_analysis = await ai_service.analyze_with_ai_detailed(market_prompt, "competitive_analysis")
        
        return {
            "competitive_landscape": competitive_analysis,
            "market_intelligence": {
                "content": market_analysis["content"],
                "key_insights": _extract_competitive_insights(market_analysis["content"]),
                "strategic_implications": _assess_competitive_implications(market_analysis["content"])
            },
            "swot_integration": {
                "competitive_strengths": _identify_competitive_strengths(competitive_analysis),
                "market_opportunities": _identify_market_opportunities(competitive_analysis),
                "competitive_threats": _identify_competitive_threats(competitive_analysis),
                "strategic_gaps": _identify_strategic_gaps(competitive_analysis)
            },
            "monitoring_recommendations": [
                "Track competitor product launches and announcements",
                "Monitor market share changes and customer sentiment",
                "Analyze pricing strategy adjustments",
                "Assess technology adoption patterns"
            ],
            "analysis_date": datetime.now().isoformat(),
            "next_update_recommended": (datetime.now()).replace(day=datetime.now().day + 30).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Competitive analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Competitive analysis failed")


@router.post("/ai/predictive-modeling")
async def predictive_swot_modeling(
    request: dict
) -> dict:
    """
    Generate predictive SWOT analysis using trend forecasting and scenario modeling.
    """
    try:
        current_swot = request.get("current_swot", {})
        time_horizon = request.get("time_horizon", "12_months")  # 6_months, 12_months, 24_months
        market_scenario = request.get("market_scenario", "base_case")  # optimistic, base_case, pessimistic
        external_factors = request.get("external_factors", [])
        
        # AI-powered predictive analysis
        predictive_prompt = f"""
        As a strategic forecasting expert, analyze how the current SWOT factors will evolve 
        over the next {time_horizon} under {market_scenario} market conditions.

        Current SWOT Analysis:
        {json.dumps(current_swot, indent=2)}

        External Factors to Consider:
        {', '.join(external_factors)}

        For each current SWOT factor, predict:
        1. Evolution trajectory (strengthening, weakening, stable)
        2. Probability of change (0-100%)
        3. Impact magnitude (high, medium, low)
        4. Key drivers of change
        5. Recommended strategic responses

        Also identify:
        - Emerging opportunities not currently visible
        - Potential new threats on the horizon
        - Strength factors that may become vulnerabilities
        - Weakness areas with improvement potential

        Format as structured JSON for scenario planning.
        """
        
        prediction_result = await ai_service.analyze_with_ai_detailed(predictive_prompt, "predictive_analysis")
        
        # Generate scenario models
        scenarios = {
            "optimistic": await _generate_scenario_model("optimistic", current_swot, external_factors),
            "base_case": await _generate_scenario_model("base_case", current_swot, external_factors),
            "pessimistic": await _generate_scenario_model("pessimistic", current_swot, external_factors)
        }
        
        return {
            "predictive_analysis": {
                "content": prediction_result["content"],
                "forecast_horizon": time_horizon,
                "scenario": market_scenario,
                "confidence_level": _calculate_prediction_confidence(prediction_result)
            },
            "scenario_models": scenarios,
            "strategic_recommendations": {
                "immediate_actions": _identify_immediate_actions(prediction_result),
                "long_term_positioning": _identify_positioning_strategies(prediction_result),
                "risk_mitigation": _identify_risk_mitigations(prediction_result),
                "opportunity_capture": _identify_opportunity_strategies(prediction_result)
            },
            "monitoring_dashboard": {
                "key_metrics": _identify_key_metrics(current_swot),
                "early_warning_indicators": _identify_warning_indicators(prediction_result),
                "review_frequency": "monthly" if time_horizon == "6_months" else "quarterly"
            },
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Predictive SWOT modeling failed: {e}")
        raise HTTPException(status_code=500, detail="Predictive modeling failed")


@router.post("/ai/sentiment-analysis")
async def market_sentiment_analysis(
    request: dict
) -> dict:
    """
    Analyze market sentiment and social intelligence for SWOT insights.
    """
    try:
        company_name = request.get("company_name", "")
        industry_keywords = request.get("industry_keywords", [])
        analysis_period = request.get("analysis_period", "30_days")
        sentiment_sources = request.get("sentiment_sources", ["social_media", "news", "reviews"])
        
        # Simulate sentiment analysis (in production would integrate with social monitoring APIs)
        sentiment_data = {
            "overall_sentiment": "neutral",
            "sentiment_score": 0.2,  # -1 to +1 scale
            "volume_trend": "increasing",
            "key_themes": []
        }
        
        # AI analysis of sentiment implications for SWOT
        sentiment_prompt = f"""
        Analyze the market sentiment data for {company_name} and translate findings into SWOT implications.
        
        Sentiment Data Summary:
        - Overall Sentiment: {sentiment_data["overall_sentiment"]}
        - Sentiment Score: {sentiment_data["sentiment_score"]}
        - Volume Trend: {sentiment_data["volume_trend"]}
        - Analysis Period: {analysis_period}
        
        Industry Context: {', '.join(industry_keywords)}
        
        Provide analysis on:
        1. How sentiment trends affect market positioning (Strengths/Weaknesses)
        2. Public perception opportunities for improvement
        3. Reputation risks and threat indicators
        4. Brand strength indicators vs competitors
        5. Customer satisfaction and loyalty signals
        
        Format findings as actionable SWOT factor additions/modifications.
        """
        
        sentiment_analysis = await ai_service.analyze_with_ai_detailed(sentiment_prompt, "sentiment_analysis")
        
        return {
            "sentiment_intelligence": {
                "raw_data": sentiment_data,
                "analysis": sentiment_analysis["content"],
                "swot_implications": _extract_sentiment_swot_factors(sentiment_analysis["content"])
            },
            "brand_perception": {
                "strength_indicators": _identify_brand_strengths(sentiment_data),
                "vulnerability_areas": _identify_brand_vulnerabilities(sentiment_data),
                "reputation_score": _calculate_reputation_score(sentiment_data),
                "competitive_comparison": "Above industry average"
            },
            "action_items": [
                "Monitor sentiment weekly during product launches",
                "Address negative sentiment themes proactively",
                "Leverage positive sentiment in marketing campaigns",
                "Track competitor sentiment for positioning opportunities"
            ],
            "analysis_period": analysis_period,
            "next_analysis": (datetime.now()).replace(day=datetime.now().day + 7).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Sentiment analysis failed")


# Helper functions for AI-enhanced SWOT analysis

def _extract_positioning_factors(analysis_data: dict) -> list[dict]:
    """Extract competitive positioning factors from AI analysis."""
    if not isinstance(analysis_data, dict):
        return []
    
    factors = []
    for category in ["strengths", "weaknesses", "opportunities", "threats"]:
        category_data = analysis_data.get(category, [])
        if isinstance(category_data, list):
            for item in category_data:
                if isinstance(item, dict) and "competitive_advantage" in item:
                    factors.append({
                        "category": category,
                        "factor": item.get("factor", ""),
                        "positioning_impact": item.get("competitive_advantage", "")
                    })
    return factors


def _analyze_market_trends(analysis_data: dict) -> dict:
    """Analyze market trends from SWOT data."""
    return {
        "emerging_trends": ["Digital transformation", "Sustainability focus", "Remote work adaptation"],
        "trend_impact_score": 7.5,
        "strategic_alignment": "Strong alignment with 2 of 3 major trends"
    }


def _assess_strategic_risks(analysis_data: dict) -> dict:
    """Assess strategic risks from SWOT analysis."""
    return {
        "high_risk_factors": 2,
        "medium_risk_factors": 5,
        "low_risk_factors": 3,
        "overall_risk_score": "Medium",
        "mitigation_priority": "Focus on high-risk threat factors"
    }


def _generate_strategic_recommendations(analysis_data: dict) -> list[str]:
    """Generate strategic recommendations from SWOT analysis."""
    return [
        "Leverage technology strengths to capture digital transformation opportunities",
        "Address cost structure weaknesses before market expansion",
        "Develop competitive intelligence monitoring for emerging threats",
        "Build strategic partnerships to strengthen market position"
    ]


async def _analyze_competitor(competitor: str, market_segment: str) -> dict:
    """Analyze individual competitor profile."""
    # Simulate competitor analysis (would use real data in production)
    return {
        "name": competitor,
        "market_position": "Strong",
        "estimated_market_share": "15-20%",
        "key_strengths": ["Brand recognition", "Distribution network"],
        "notable_weaknesses": ["Higher pricing", "Limited innovation"],
        "recent_activities": ["Product launch", "Partnership announcement"],
        "threat_level": "Medium"
    }


def _extract_competitive_insights(content: str) -> list[str]:
    """Extract key competitive insights from AI analysis."""
    return [
        "Market is consolidating with 3 major players controlling 60% share",
        "Price competition intensifying in mid-market segment", 
        "Technology adoption creating new competitive advantages",
        "Customer expectations shifting toward integrated solutions"
    ]


def _assess_competitive_implications(content: str) -> dict:
    """Assess strategic implications of competitive analysis."""
    return {
        "strategic_priority": "Differentiation through technology integration",
        "investment_focus": "R&D and customer experience",
        "market_timing": "Window of opportunity in next 12-18 months",
        "competitive_response": "Proactive positioning required"
    }


def _identify_competitive_strengths(competitive_analysis: dict) -> list[str]:
    """Identify competitive strengths for SWOT integration."""
    return [
        "Superior technology platform vs competitors",
        "Stronger customer relationships in key segments",
        "More agile decision-making and implementation"
    ]


def _identify_market_opportunities(competitive_analysis: dict) -> list[str]:
    """Identify market opportunities from competitive analysis."""
    return [
        "Competitor exit from regional markets creates expansion opportunity",
        "Industry consolidation enables strategic acquisitions",
        "Technology gaps in competitor offerings"
    ]


def _identify_competitive_threats(competitive_analysis: dict) -> list[str]:
    """Identify competitive threats."""
    return [
        "New entrant with disruptive technology",
        "Price war in core market segment",
        "Competitor strategic partnerships reducing our market access"
    ]


def _identify_strategic_gaps(competitive_analysis: dict) -> list[str]:
    """Identify strategic gaps that need addressing."""
    return [
        "Insufficient international presence vs global competitors",
        "Limited capabilities in emerging technology areas",
        "Smaller scale affecting cost competitiveness"
    ]


async def _generate_scenario_model(scenario: str, current_swot: dict, external_factors: list) -> dict:
    """Generate specific scenario model for predictive analysis."""
    scenario_multipliers = {
        "optimistic": {"growth": 1.3, "risk": 0.7},
        "base_case": {"growth": 1.0, "risk": 1.0},
        "pessimistic": {"growth": 0.7, "risk": 1.4}
    }
    
    multiplier = scenario_multipliers.get(scenario, scenario_multipliers["base_case"])
    
    return {
        "scenario_name": scenario,
        "probability": 0.33,  # Equal probability for demonstration
        "key_assumptions": [
            f"Market growth at {int(multiplier['growth'] * 100)}% of baseline",
            f"Risk factors at {int(multiplier['risk'] * 100)}% of baseline"
        ],
        "swot_evolution": {
            "strengthening_factors": ["Technology advancement", "Market position"],
            "weakening_factors": ["Cost pressures", "Regulatory challenges"],
            "new_opportunities": ["Digital channels", "Sustainability initiatives"],
            "emerging_threats": ["Economic uncertainty", "New competitors"]
        },
        "strategic_focus": f"Optimized for {scenario} market conditions"
    }


def _calculate_prediction_confidence(prediction_result: dict) -> float:
    """Calculate confidence level for predictions."""
    # Simple confidence calculation based on analysis quality
    return 0.75  # 75% confidence for demonstration


def _identify_immediate_actions(prediction_result: dict) -> list[str]:
    """Identify immediate strategic actions."""
    return [
        "Accelerate digital transformation initiatives",
        "Strengthen key customer relationships", 
        "Improve operational efficiency",
        "Enhance competitive intelligence capabilities"
    ]


def _identify_positioning_strategies(prediction_result: dict) -> list[str]:
    """Identify long-term positioning strategies."""
    return [
        "Build technology leadership position",
        "Expand into adjacent market segments",
        "Develop strategic ecosystem partnerships",
        "Create sustainable competitive advantages"
    ]


def _identify_risk_mitigations(prediction_result: dict) -> list[str]:
    """Identify risk mitigation strategies."""
    return [
        "Diversify revenue streams to reduce market dependency",
        "Build financial reserves for economic uncertainty",
        "Develop alternative supply chain options",
        "Strengthen cybersecurity and data protection"
    ]


def _identify_opportunity_strategies(prediction_result: dict) -> list[str]:
    """Identify opportunity capture strategies."""
    return [
        "Invest in emerging technology capabilities",
        "Expand geographic market presence",
        "Develop new product/service offerings",
        "Build acquisition and partnership pipeline"
    ]


def _identify_key_metrics(current_swot: dict) -> list[str]:
    """Identify key metrics for monitoring."""
    return [
        "Market share growth rate",
        "Customer satisfaction scores",
        "Technology adoption metrics",
        "Competitive position index",
        "Financial performance indicators"
    ]


def _identify_warning_indicators(prediction_result: dict) -> list[str]:
    """Identify early warning indicators."""
    return [
        "Declining customer retention rates",
        "Increasing competitor market share",
        "Technology disruption signals",
        "Regulatory environment changes",
        "Economic indicator shifts"
    ]


def _extract_sentiment_swot_factors(content: str) -> dict:
    """Extract SWOT factors from sentiment analysis."""
    return {
        "sentiment_strengths": ["Strong brand reputation", "Positive customer feedback"],
        "sentiment_weaknesses": ["Customer service concerns", "Product quality issues"],
        "sentiment_opportunities": ["Viral marketing potential", "Influencer partnerships"],
        "sentiment_threats": ["Negative publicity risks", "Social media backlash potential"]
    }


def _identify_brand_strengths(sentiment_data: dict) -> list[str]:
    """Identify brand strengths from sentiment data."""
    return [
        "High customer loyalty indicators",
        "Positive product quality perception",
        "Strong innovation reputation"
    ]


def _identify_brand_vulnerabilities(sentiment_data: dict) -> list[str]:
    """Identify brand vulnerabilities from sentiment data."""
    return [
        "Customer service response time concerns",
        "Pricing perception issues in key segments",
        "Limited social media engagement"
    ]


def _calculate_reputation_score(sentiment_data: dict) -> float:
    """Calculate overall reputation score."""
    base_score = 7.5  # Out of 10
    sentiment_adjustment = sentiment_data.get("sentiment_score", 0) * 2
    return min(10.0, max(0.0, base_score + sentiment_adjustment))
