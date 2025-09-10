"""
Behavioral Analysis Framework API endpoints.
Pattern recognition and motivation analysis for intelligence assessment.
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


class BehaviorPattern(BaseModel):
    """Individual behavior pattern."""
    id: str
    pattern_type: str  # routine, anomaly, trend, cyclical
    description: str
    frequency: str | None = None  # daily, weekly, sporadic, etc.
    confidence: float  # 0-1 scale
    evidence: list[str]
    timeframe: str | None = None
    significance: str  # high, medium, low


class MotivationFactor(BaseModel):
    """Motivation factor in behavioral analysis."""
    id: str
    factor_type: str  # intrinsic, extrinsic, ideological, personal, financial
    description: str
    strength: float  # 0-1 scale
    evidence: list[str]
    reliability: float  # 0-1 scale


class BehaviorProfile(BaseModel):
    """Complete behavioral profile."""
    subject_id: str
    subject_type: str  # individual, group, organization, nation-state
    patterns: list[BehaviorPattern]
    motivations: list[MotivationFactor]
    risk_level: str  # high, medium, low
    predictability: float  # 0-1 scale
    assessment: str


class BehavioralCreateRequest(BaseModel):
    """Behavioral analysis creation request."""
    title: str
    subject: str  # Who/what is being analyzed
    subject_type: str  # individual, group, organization, nation-state
    context: str
    observation_period: str | None = None
    data_sources: list[str] | None = []
    known_behaviors: list[str] | None = []
    request_ai_analysis: bool = True


class BehavioralUpdateRequest(BaseModel):
    """Behavioral analysis update request."""
    title: str | None = None
    patterns: list[BehaviorPattern] | None = None
    motivations: list[MotivationFactor] | None = None
    new_observations: list[str] | None = None


class BehavioralAnalysisResponse(BaseModel):
    """Behavioral analysis response."""
    session_id: int
    title: str
    subject: str
    subject_type: str
    context: str
    profile: BehaviorProfile
    patterns: list[BehaviorPattern]
    motivations: list[MotivationFactor]
    predictions: list[dict]
    ai_analysis: dict | None = None
    status: str
    version: int


@router.post("/create", response_model=BehavioralAnalysisResponse)
async def create_behavioral_analysis(
    request: BehavioralCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> BehavioralAnalysisResponse:
    """
    Create a new behavioral analysis session.
    
    Args:
        request: Behavioral analysis creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        BehavioralAnalysisResponse: Created behavioral analysis
    """
    logger.info(f"Creating behavioral analysis: {request.title} for user {current_user.username}")

    # Prepare behavioral data
    behavioral_data = {
        "subject": request.subject,
        "subject_type": request.subject_type,
        "context": request.context,
        "observation_period": request.observation_period or "",
        "data_sources": request.data_sources or [],
        "known_behaviors": request.known_behaviors or [],
        "patterns": [],
        "motivations": [],
        "predictions": []
    }

    # Get AI analysis if requested
    ai_analysis = None
    patterns = []
    motivations = []
    predictions = []

    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.BEHAVIORAL_ANALYSIS,
                behavioral_data,
                "analyze"
            )
            ai_analysis = ai_result.get("analysis")

            # Extract patterns from AI analysis
            if ai_analysis and "patterns" in ai_analysis:
                for idx, pattern in enumerate(ai_analysis["patterns"]):
                    if isinstance(pattern, dict):
                        pattern["id"] = f"pat_ai_{idx}"
                        patterns.append(pattern)

            # Extract motivations
            if ai_analysis and "motivations" in ai_analysis:
                for idx, motivation in enumerate(ai_analysis["motivations"]):
                    if isinstance(motivation, dict):
                        motivation["id"] = f"mot_ai_{idx}"
                        motivations.append(motivation)

            # Extract predictions
            if ai_analysis and "predictions" in ai_analysis:
                predictions = ai_analysis["predictions"]

        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")

    # Default patterns if none from AI
    if not patterns:
        patterns = [
            {
                "id": "pat_default_1",
                "pattern_type": "routine",
                "description": "Regular operational patterns observed",
                "frequency": "daily",
                "confidence": 0.7,
                "evidence": request.known_behaviors[:3] if request.known_behaviors else ["Initial observation"],
                "significance": "medium"
            }
        ]

    # Default motivations if none from AI
    if not motivations:
        motivations = [
            {
                "id": "mot_default_1",
                "factor_type": "unknown",
                "description": "Motivation factors to be determined",
                "strength": 0.5,
                "evidence": ["Requires further analysis"],
                "reliability": 0.3
            }
        ]

    behavioral_data["patterns"] = patterns
    behavioral_data["motivations"] = motivations
    behavioral_data["predictions"] = predictions

    # Create behavior profile
    profile = BehaviorProfile(
        subject_id=request.subject,
        subject_type=request.subject_type,
        patterns=[BehaviorPattern(**p) for p in patterns],
        motivations=[MotivationFactor(**m) for m in motivations],
        risk_level="medium",  # Default, would be calculated
        predictability=0.5,  # Default, would be calculated
        assessment="Initial behavioral profile created. Further observation recommended."
    )

    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.BEHAVIORAL_ANALYSIS,
        title=request.title,
        description=f"Behavioral Analysis - {request.subject}",
        data=behavioral_data,
        tags=["behavioral-analysis", "pattern-recognition", "motivation-assessment"]
    )

    session = await framework_service.create_session(db, current_user, framework_data)

    return BehavioralAnalysisResponse(
        session_id=session.id,
        title=session.title,
        subject=behavioral_data["subject"],
        subject_type=behavioral_data["subject_type"],
        context=behavioral_data["context"],
        profile=profile,
        patterns=[BehaviorPattern(**p) for p in patterns],
        motivations=[MotivationFactor(**m) for m in motivations],
        predictions=predictions,
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=BehavioralAnalysisResponse)
async def get_behavioral_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> BehavioralAnalysisResponse:
    """
    Get a specific behavioral analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        BehavioralAnalysisResponse: Behavioral analysis data
    """
    logger.info(f"Getting behavioral analysis {session_id}")

    # Get real data from database
    session = await framework_service.get_session(db, current_user, session_id, FrameworkType.BEHAVIORAL)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Behavioral analysis session not found"
        )

    # Extract data from session
    session_data = session.data or {}
    
    # Parse patterns
    patterns_data = session_data.get("patterns", [])
    patterns = [BehaviorPattern(**pat) for pat in patterns_data if isinstance(pat, dict)]
    
    # Parse motivations
    motivations_data = session_data.get("motivations", [])
    motivations = [MotivationFactor(**mot) for mot in motivations_data if isinstance(mot, dict)]
    
    # Parse profile data
    profile_data = session_data.get("profile", {})
    profile = BehaviorProfile(**profile_data) if profile_data else BehaviorProfile(
        subject_id=session_data.get("subject", "Unknown"),
        subject_type=session_data.get("subject_type", "individual"),
        patterns=patterns,
        motivations=motivations,
        risk_level="pending",
        predictability=0.5,
        assessment="Analysis in progress"
    )
    
    # Get predictions
    predictions = session_data.get("predictions", [])
    
    # Get basic info
    subject = session_data.get("subject", "Subject")
    subject_type = session_data.get("subject_type", "individual")
    context = session_data.get("context", "Behavioral analysis")

    return BehavioralAnalysisResponse(
        session_id=session.id,
        title=session.title,
        subject=subject,
        subject_type=subject_type,
        context=context,
        profile=profile,
        patterns=patterns,
        motivations=motivations,
        predictions=predictions,
        status=session.status.value,
        version=session.version
    )


@router.post("/{session_id}/patterns")
async def analyze_patterns(
    session_id: int,
    observations: list[str],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Analyze behavioral patterns from observations.
    
    Args:
        session_id: Session ID
        observations: List of behavioral observations
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Pattern analysis results
    """
    logger.info(f"Analyzing patterns for session {session_id}")

    # Analyze patterns using AI
    analysis_data = {
        "observations": observations,
        "analysis_type": "pattern_recognition"
    }

    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.BEHAVIORAL_ANALYSIS,
        analysis_data,
        "analyze"
    )

    return {
        "session_id": session_id,
        "observations_analyzed": len(observations),
        "patterns_identified": ai_result.get("patterns", []),
        "pattern_confidence": ai_result.get("confidence", 0.5),
        "recommendations": ai_result.get("recommendations", [])
    }


@router.post("/{session_id}/motivations")
async def assess_motivations(
    session_id: int,
    evidence: list[str],
    context: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Assess motivations based on evidence.
    
    Args:
        session_id: Session ID
        evidence: List of evidence items
        context: Additional context
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Motivation assessment
    """
    logger.info(f"Assessing motivations for session {session_id}")

    # Assess motivations using AI
    analysis_data = {
        "evidence": evidence,
        "context": context or "",
        "analysis_type": "motivation_assessment"
    }

    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.BEHAVIORAL_ANALYSIS,
        analysis_data,
        "analyze"
    )

    return {
        "session_id": session_id,
        "evidence_analyzed": len(evidence),
        "motivations": ai_result.get("motivations", []),
        "primary_motivation": ai_result.get("primary_motivation", "Unknown"),
        "confidence": ai_result.get("confidence", 0.5)
    }


@router.post("/{session_id}/predict")
async def predict_behavior(
    session_id: int,
    timeframe: str = "30_days",
    scenario: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Predict future behavior based on analysis.
    
    Args:
        session_id: Session ID
        timeframe: Prediction timeframe
        scenario: Specific scenario to consider
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Behavioral predictions
    """
    logger.info(f"Generating predictions for session {session_id}")

    # Mock predictions (would use actual analysis data)
    predictions = [
        {
            "behavior": "Maintain current operational pattern",
            "probability": 0.75,
            "indicators": ["Historical consistency", "No major disruptions"],
            "confidence": "high"
        },
        {
            "behavior": "Attempt to expand network",
            "probability": 0.6,
            "indicators": ["Recent recruitment activities", "Resource accumulation"],
            "confidence": "moderate"
        },
        {
            "behavior": "Change communication methods",
            "probability": 0.45,
            "indicators": ["Security concerns", "Past adaptations"],
            "confidence": "low"
        }
    ]

    return {
        "session_id": session_id,
        "timeframe": timeframe,
        "scenario": scenario,
        "predictions": predictions,
        "most_likely": predictions[0],
        "assessment_date": "2025-08-16T00:00:00Z"
    }


@router.get("/{session_id}/profiles")
async def get_behavior_profiles(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get behavioral profile templates and comparisons.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Behavioral profiles
    """
    logger.info(f"Getting behavioral profiles for session {session_id}")

    profiles = {
        "current_profile": {
            "type": "adaptive_operator",
            "characteristics": [
                "High operational security awareness",
                "Flexible tactics",
                "Strong ideological motivation",
                "Network-oriented"
            ],
            "risk_level": "high",
            "predictability": 0.6
        },
        "similar_profiles": [
            {
                "type": "ideological_extremist",
                "match_percentage": 0.75,
                "key_similarities": ["Motivation structure", "Operational patterns"]
            },
            {
                "type": "professional_operative",
                "match_percentage": 0.6,
                "key_similarities": ["Security consciousness", "Methodical approach"]
            }
        ],
        "profile_evolution": {
            "initial": "Low-level supporter",
            "current": "Active operator",
            "projected": "Potential leadership role",
            "timeline": "18 months progression"
        }
    }

    return {
        "session_id": session_id,
        "profiles": profiles,
        "comparison_method": "pattern_matching",
        "confidence": 0.7
    }


@router.post("/{session_id}/export")
async def export_behavioral_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export behavioral analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting behavioral analysis {session_id} as {format}")

    if format not in ["pdf", "docx", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json"
        )

    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/behavioral_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_behavioral_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available behavioral analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Individual Threat Assessment",
            "description": "Behavioral analysis for individual threat actors",
            "focus_areas": ["Pattern recognition", "Motivation assessment", "Risk evaluation"],
            "typical_patterns": ["Communication", "Movement", "Financial", "Social"]
        },
        {
            "id": 2,
            "name": "Group Dynamics Analysis",
            "description": "Analyze group or organization behavior",
            "focus_areas": ["Leadership structure", "Group cohesion", "Decision patterns"],
            "typical_patterns": ["Hierarchy", "Communication flow", "Resource allocation"]
        },
        {
            "id": 3,
            "name": "Nation-State Behavior",
            "description": "Strategic behavioral analysis of nation-state actors",
            "focus_areas": ["Strategic patterns", "Escalation triggers", "Decision-making"],
            "typical_patterns": ["Diplomatic", "Military", "Economic", "Information operations"]
        }
    ]

    return templates
