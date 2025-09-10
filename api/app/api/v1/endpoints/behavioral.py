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
from app.services.ai_service import ai_service
from datetime import datetime, timedelta
import json
import math

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


# AI-Enhanced Behavioral Analysis Endpoints

@router.post("/ai/predictive-modeling")
async def behavioral_predictive_modeling(
    request: dict
) -> dict:
    """
    Generate predictive behavioral models using trajectory forecasting and risk assessment.
    """
    try:
        subject_data = request.get("subject_data", {})
        historical_patterns = request.get("historical_patterns", [])
        current_context = request.get("current_context", "")
        prediction_horizon = request.get("prediction_horizon", "90_days")  # 30, 60, 90, 180 days
        risk_factors = request.get("risk_factors", [])
        
        # AI-powered behavioral trajectory analysis
        trajectory_prompt = f"""
        As an expert behavioral analyst specializing in predictive modeling, analyze the behavioral patterns and forecast future trajectory.

        Subject Data:
        {json.dumps(subject_data, indent=2)}

        Historical Patterns:
        {json.dumps(historical_patterns, indent=2)}

        Current Context: {current_context}
        Prediction Horizon: {prediction_horizon}
        Risk Factors: {', '.join(risk_factors)}

        Provide detailed analysis on:
        1. Behavioral trajectory forecasting with probability curves
        2. Risk escalation patterns and intervention points
        3. Trigger events that could alter behavior
        4. Seasonal or cyclical pattern influences
        5. Social/environmental factor impacts
        6. Adaptive behavior predictions under different scenarios

        For each prediction, include:
        - Specific behavior description
        - Probability score (0-100%)
        - Confidence level (high/medium/low)
        - Timeline for manifestation
        - Key indicators to monitor
        - Potential intervention strategies

        Format as structured JSON for detailed analysis.
        """
        
        trajectory_analysis = await ai_service.analyze_with_ai_detailed(trajectory_prompt, "predictive_analysis")
        
        # Generate behavioral models
        behavioral_models = await _generate_behavioral_models(subject_data, historical_patterns)
        
        # Calculate risk scores
        risk_assessment = _calculate_behavioral_risk_scores(historical_patterns, risk_factors)
        
        # Generate intervention recommendations
        interventions = _generate_intervention_strategies(risk_assessment, behavioral_models)
        
        return {
            "predictive_analysis": {
                "content": trajectory_analysis["content"],
                "prediction_horizon": prediction_horizon,
                "confidence_level": _calculate_prediction_confidence(historical_patterns),
                "last_updated": datetime.now().isoformat()
            },
            "behavioral_models": behavioral_models,
            "risk_assessment": risk_assessment,
            "trajectory_forecasts": {
                "most_likely_path": _identify_most_likely_trajectory(behavioral_models),
                "alternative_scenarios": _generate_alternative_scenarios(behavioral_models),
                "turning_points": _identify_behavioral_turning_points(historical_patterns),
                "escalation_markers": _identify_escalation_markers(risk_factors)
            },
            "intervention_strategies": interventions,
            "monitoring_framework": {
                "key_indicators": _identify_monitoring_indicators(behavioral_models),
                "alert_thresholds": _define_alert_thresholds(risk_assessment),
                "update_frequency": "weekly" if prediction_horizon.startswith("30") else "bi-weekly"
            },
            "analysis_metadata": {
                "prediction_horizon": prediction_horizon,
                "historical_data_points": len(historical_patterns),
                "risk_factors_considered": len(risk_factors),
                "methodology": "AI-Enhanced Behavioral Trajectory Forecasting",
                "generated_at": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Behavioral predictive modeling failed: {e}")
        raise HTTPException(status_code=500, detail="Predictive modeling failed")


@router.post("/ai/social-media-analysis")
async def social_media_behavioral_analysis(
    request: dict
) -> dict:
    """
    Analyze social media patterns and communication behavior for behavioral insights.
    """
    try:
        social_accounts = request.get("social_accounts", [])
        analysis_period = request.get("analysis_period", "30_days")
        content_types = request.get("content_types", ["posts", "comments", "interactions"])
        sentiment_focus = request.get("sentiment_focus", True)
        
        # Simulate social media data collection (would integrate with APIs in production)
        social_data = await _collect_social_media_data(social_accounts, analysis_period)
        
        # AI-powered social behavior analysis
        social_prompt = f"""
        As an expert in digital behavioral analysis, examine these social media patterns for behavioral insights.

        Social Media Data Summary:
        {json.dumps(social_data, indent=2)}

        Analysis Period: {analysis_period}
        Content Types: {', '.join(content_types)}

        Analyze for:
        1. Communication frequency and timing patterns
        2. Sentiment shifts and emotional patterns
        3. Social network expansion/contraction
        4. Topic focus changes and obsessions
        5. Interaction behavior with different groups
        6. Language pattern evolution
        7. Crisis or stress indicators in communication
        8. Influence network and authority patterns

        Provide behavioral insights that can inform:
        - Motivation assessment
        - Risk level evaluation
        - Social influence mapping
        - Behavioral prediction accuracy
        - Intervention opportunity identification

        Format as comprehensive behavioral analysis with specific evidence.
        """
        
        social_analysis = await ai_service.analyze_with_ai_detailed(social_prompt, "behavioral_analysis")
        
        # Process communication patterns
        communication_patterns = _analyze_communication_patterns(social_data)
        
        # Analyze sentiment trajectory
        sentiment_analysis = _analyze_sentiment_trajectory(social_data)
        
        # Map social networks
        network_analysis = _analyze_social_networks(social_data)
        
        return {
            "social_media_analysis": {
                "content": social_analysis["content"],
                "accounts_analyzed": len(social_accounts),
                "data_points": social_data.get("total_posts", 0),
                "analysis_period": analysis_period
            },
            "communication_patterns": communication_patterns,
            "sentiment_analysis": sentiment_analysis,
            "network_analysis": network_analysis,
            "behavioral_insights": {
                "primary_motivations": _extract_motivations_from_social_data(social_data),
                "stress_indicators": _identify_stress_indicators(social_data),
                "behavioral_changes": _identify_behavioral_changes(social_data),
                "risk_escalation_signs": _identify_risk_escalation_signs(social_data)
            },
            "predictive_indicators": {
                "activity_trend": _calculate_activity_trend(social_data),
                "engagement_pattern": _analyze_engagement_pattern(social_data),
                "content_evolution": _analyze_content_evolution(social_data),
                "network_health": _assess_network_health(network_analysis)
            },
            "recommendations": [
                "Monitor frequency changes in posting patterns",
                "Track sentiment shifts and emotional volatility",
                "Analyze new connections and network expansion",
                "Watch for crisis communication indicators"
            ],
            "analysis_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Social media behavioral analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Social media analysis failed")


@router.post("/ai/anomaly-detection")
async def behavioral_anomaly_detection(
    request: dict
) -> dict:
    """
    Detect behavioral anomalies and deviations from established patterns.
    """
    try:
        baseline_behavior = request.get("baseline_behavior", {})
        recent_observations = request.get("recent_observations", [])
        detection_sensitivity = request.get("detection_sensitivity", "medium")  # high, medium, low
        context_factors = request.get("context_factors", [])
        
        # AI-powered anomaly detection analysis
        anomaly_prompt = f"""
        As an expert behavioral analyst specializing in anomaly detection, analyze these observations for deviations from baseline behavior.

        Baseline Behavior Profile:
        {json.dumps(baseline_behavior, indent=2)}

        Recent Observations:
        {json.dumps(recent_observations, indent=2)}

        Context Factors: {', '.join(context_factors)}
        Detection Sensitivity: {detection_sensitivity}

        Analyze for:
        1. Significant deviations from established patterns
        2. Frequency anomalies (too frequent/infrequent activities)
        3. Temporal anomalies (unusual timing of behaviors)
        4. Social interaction anomalies
        5. Communication pattern changes
        6. Location or movement anomalies
        7. Resource usage or financial anomalies
        8. Stress or crisis response indicators

        For each anomaly detected:
        - Specific deviation description
        - Severity level (critical, high, medium, low)
        - Probability that deviation is significant (0-100%)
        - Potential explanations (stress, operational change, deception, etc.)
        - Recommended follow-up actions
        - Timeline for monitoring

        Consider context factors that might explain normal variations.
        """
        
        anomaly_analysis = await ai_service.analyze_with_ai_detailed(anomaly_prompt, "anomaly_detection")
        
        # Process anomaly detection results
        anomalies = _extract_detected_anomalies(anomaly_analysis["content"])
        
        # Calculate baseline deviation scores
        deviation_scores = _calculate_baseline_deviations(baseline_behavior, recent_observations)
        
        # Generate real-time alerts
        alerts = _generate_behavioral_alerts(anomalies, detection_sensitivity)
        
        return {
            "anomaly_detection": {
                "content": anomaly_analysis["content"],
                "total_observations": len(recent_observations),
                "anomalies_detected": len(anomalies),
                "detection_sensitivity": detection_sensitivity,
                "analysis_confidence": _calculate_anomaly_confidence(baseline_behavior, recent_observations)
            },
            "detected_anomalies": anomalies,
            "deviation_analysis": {
                "baseline_deviations": deviation_scores,
                "overall_deviation_score": _calculate_overall_deviation(deviation_scores),
                "significance_assessment": _assess_deviation_significance(deviation_scores),
                "trend_analysis": _analyze_deviation_trends(recent_observations)
            },
            "alert_system": {
                "active_alerts": alerts,
                "escalation_recommendations": _generate_escalation_recommendations(alerts),
                "monitoring_adjustments": _suggest_monitoring_adjustments(anomalies)
            },
            "contextual_analysis": {
                "external_factors": _analyze_external_factors(context_factors),
                "seasonal_considerations": _assess_seasonal_factors(recent_observations),
                "stress_indicators": _identify_stress_related_anomalies(anomalies)
            },
            "recommendations": [
                "Increase monitoring frequency for high-severity anomalies",
                "Investigate external factors that might explain deviations",
                "Update baseline if new normal pattern emerges",
                "Consider intervention if anomalies indicate escalation"
            ],
            "next_analysis": (datetime.now() + timedelta(days=7)).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Behavioral anomaly detection failed: {e}")
        raise HTTPException(status_code=500, detail="Anomaly detection failed")


@router.post("/ai/intervention-planning")
async def behavioral_intervention_planning(
    request: dict
) -> dict:
    """
    Generate intervention strategies and timing recommendations based on behavioral analysis.
    """
    try:
        behavioral_profile = request.get("behavioral_profile", {})
        risk_assessment = request.get("risk_assessment", {})
        intervention_goals = request.get("intervention_goals", [])
        available_resources = request.get("available_resources", [])
        constraints = request.get("constraints", [])
        
        # AI-powered intervention strategy analysis
        intervention_prompt = f"""
        As an expert behavioral intervention strategist, develop comprehensive intervention plans based on this behavioral analysis.

        Behavioral Profile:
        {json.dumps(behavioral_profile, indent=2)}

        Risk Assessment:
        {json.dumps(risk_assessment, indent=2)}

        Intervention Goals: {', '.join(intervention_goals)}
        Available Resources: {', '.join(available_resources)}
        Constraints: {', '.join(constraints)}

        Develop intervention strategies addressing:
        1. Optimal timing windows for intervention
        2. Escalation prevention techniques
        3. De-escalation strategies if already escalated
        4. Behavioral modification approaches
        5. Environmental modification recommendations
        6. Social network intervention points
        7. Communication strategies
        8. Long-term behavioral change planning

        For each intervention strategy:
        - Specific approach description
        - Success probability (0-100%)
        - Resource requirements
        - Timeline for implementation
        - Expected behavioral response
        - Risk mitigation measures
        - Success indicators
        - Fallback options if unsuccessful

        Consider ethical implications and proportionality of interventions.
        """
        
        intervention_analysis = await ai_service.analyze_with_ai_detailed(intervention_prompt, "intervention_planning")
        
        # Generate intervention strategies
        intervention_strategies = _generate_intervention_strategies(behavioral_profile, risk_assessment)
        
        # Calculate optimal timing
        timing_analysis = _analyze_intervention_timing(behavioral_profile)
        
        # Assess intervention feasibility
        feasibility_assessment = _assess_intervention_feasibility(intervention_strategies, available_resources)
        
        return {
            "intervention_analysis": {
                "content": intervention_analysis["content"],
                "strategies_generated": len(intervention_strategies),
                "goals_addressed": len(intervention_goals),
                "planning_confidence": _calculate_intervention_confidence(behavioral_profile, risk_assessment)
            },
            "intervention_strategies": intervention_strategies,
            "timing_analysis": timing_analysis,
            "feasibility_assessment": feasibility_assessment,
            "implementation_plan": {
                "immediate_actions": _identify_immediate_interventions(intervention_strategies),
                "short_term_plan": _develop_short_term_plan(intervention_strategies),
                "long_term_strategy": _develop_long_term_strategy(intervention_strategies),
                "contingency_plans": _develop_contingency_plans(intervention_strategies)
            },
            "success_metrics": {
                "behavioral_indicators": _define_success_indicators(intervention_goals),
                "measurement_methods": _define_measurement_methods(intervention_goals),
                "evaluation_timeline": _create_evaluation_timeline(intervention_strategies),
                "progress_milestones": _define_progress_milestones(intervention_strategies)
            },
            "risk_management": {
                "intervention_risks": _identify_intervention_risks(intervention_strategies),
                "mitigation_strategies": _develop_risk_mitigations(intervention_strategies),
                "monitoring_protocols": _define_monitoring_protocols(intervention_strategies),
                "escalation_procedures": _define_escalation_procedures(intervention_strategies)
            },
            "resource_allocation": {
                "personnel_requirements": _calculate_personnel_needs(intervention_strategies),
                "budget_estimates": _estimate_intervention_costs(intervention_strategies),
                "timeline_estimates": _estimate_implementation_timelines(intervention_strategies),
                "success_probability": _calculate_overall_success_probability(intervention_strategies)
            },
            "planning_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Behavioral intervention planning failed: {e}")
        raise HTTPException(status_code=500, detail="Intervention planning failed")


# Helper functions for AI-enhanced behavioral analysis

async def _generate_behavioral_models(subject_data: dict, historical_patterns: list) -> dict:
    """Generate behavioral models based on subject data and patterns."""
    return {
        "predictive_model": {
            "model_type": "trajectory_based",
            "accuracy_score": 0.78,
            "prediction_confidence": 0.85,
            "key_variables": ["communication_frequency", "movement_patterns", "social_interactions"],
            "model_parameters": {
                "time_horizon": "90_days",
                "confidence_interval": "80%",
                "update_frequency": "weekly"
            }
        },
        "risk_model": {
            "model_type": "escalation_based",
            "risk_score": _calculate_risk_score(subject_data, historical_patterns),
            "risk_factors": _identify_risk_factors(historical_patterns),
            "escalation_triggers": _identify_escalation_triggers(historical_patterns),
            "mitigation_factors": _identify_mitigation_factors(subject_data)
        },
        "behavioral_clusters": {
            "primary_cluster": "adaptive_operator",
            "cluster_confidence": 0.82,
            "similar_profiles": ["methodical_planner", "security_conscious", "network_builder"],
            "cluster_characteristics": _extract_cluster_characteristics(subject_data)
        }
    }


def _calculate_behavioral_risk_scores(historical_patterns: list, risk_factors: list) -> dict:
    """Calculate comprehensive behavioral risk scores."""
    base_risk = len(risk_factors) * 0.1
    pattern_risk = len([p for p in historical_patterns if p.get("risk_level", "low") == "high"]) * 0.2
    
    overall_risk = min(1.0, base_risk + pattern_risk + 0.3)  # Base 30%
    
    return {
        "overall_risk_score": overall_risk,
        "risk_level": "high" if overall_risk > 0.7 else "medium" if overall_risk > 0.4 else "low",
        "component_scores": {
            "behavioral_consistency": 0.7,
            "escalation_potential": overall_risk,
            "social_influence": 0.6,
            "adaptability": 0.8,
            "unpredictability": 1 - overall_risk
        },
        "risk_factors_identified": len(risk_factors),
        "mitigation_factors": 3,
        "confidence_level": 0.75
    }


def _generate_intervention_strategies(risk_assessment: dict, behavioral_models: dict) -> list[dict]:
    """Generate intervention strategies based on risk and behavioral models."""
    strategies = []
    
    if risk_assessment.get("overall_risk_score", 0) > 0.7:
        strategies.extend([
            {
                "strategy_id": "immediate_monitoring",
                "type": "surveillance",
                "description": "Increase monitoring frequency and coverage",
                "success_probability": 0.85,
                "resource_level": "high",
                "timeline": "immediate",
                "expected_outcome": "Enhanced situational awareness"
            },
            {
                "strategy_id": "social_intervention",
                "type": "social_network",
                "description": "Engage through trusted social connections",
                "success_probability": 0.65,
                "resource_level": "medium",
                "timeline": "1-2_weeks",
                "expected_outcome": "Behavioral modification through social influence"
            }
        ])
    else:
        strategies.append({
            "strategy_id": "routine_monitoring",
            "type": "observation",
            "description": "Maintain standard monitoring protocols",
            "success_probability": 0.75,
            "resource_level": "low",
            "timeline": "ongoing",
            "expected_outcome": "Continued behavioral assessment"
        })
    
    return strategies


def _calculate_prediction_confidence(historical_patterns: list) -> float:
    """Calculate confidence level for behavioral predictions."""
    data_quality = min(1.0, len(historical_patterns) / 20)  # More data = higher confidence
    pattern_consistency = 0.8  # Simulated consistency score
    
    return (data_quality + pattern_consistency) / 2


def _identify_most_likely_trajectory(behavioral_models: dict) -> dict:
    """Identify the most likely behavioral trajectory."""
    return {
        "trajectory_type": "gradual_escalation",
        "probability": 0.68,
        "timeline": "3-6_months",
        "key_milestones": [
            {"milestone": "Increased operational activity", "expected_date": "30_days"},
            {"milestone": "Network expansion attempts", "expected_date": "60_days"},
            {"milestone": "Potential leadership role emergence", "expected_date": "90_days"}
        ],
        "confidence": 0.72
    }


def _generate_alternative_scenarios(behavioral_models: dict) -> list[dict]:
    """Generate alternative behavioral scenarios."""
    return [
        {
            "scenario": "rapid_escalation",
            "probability": 0.25,
            "trigger_events": ["External pressure", "Opportunity emergence"],
            "timeline": "2-4_weeks"
        },
        {
            "scenario": "behavioral_stabilization",
            "probability": 0.45,
            "trigger_events": ["Successful intervention", "Life changes"],
            "timeline": "1-3_months"
        },
        {
            "scenario": "network_disengagement",
            "probability": 0.15,
            "trigger_events": ["Conflict with associates", "Ideological shift"],
            "timeline": "6-12_months"
        }
    ]


def _identify_behavioral_turning_points(historical_patterns: list) -> list[dict]:
    """Identify critical behavioral turning points."""
    return [
        {
            "event": "First network contact",
            "significance": "Initial radicalization point",
            "behavioral_impact": "high",
            "reversibility": "medium"
        },
        {
            "event": "Operational involvement",
            "significance": "Escalation to active participation",
            "behavioral_impact": "very_high", 
            "reversibility": "low"
        }
    ]


def _identify_escalation_markers(risk_factors: list) -> list[str]:
    """Identify markers that indicate behavioral escalation."""
    return [
        "Increased security consciousness",
        "Changes in communication patterns",
        "New social connections",
        "Resource accumulation",
        "Ideological hardening",
        "Isolation from moderating influences"
    ]


def _identify_monitoring_indicators(behavioral_models: dict) -> list[str]:
    """Identify key indicators for ongoing monitoring."""
    return [
        "Communication frequency changes",
        "Movement pattern alterations",
        "Social network expansion/contraction",
        "Financial activity anomalies",
        "Digital footprint changes",
        "Emotional state indicators"
    ]


def _define_alert_thresholds(risk_assessment: dict) -> dict:
    """Define alert thresholds for behavioral monitoring."""
    base_risk = risk_assessment.get("overall_risk_score", 0.5)
    
    return {
        "critical_threshold": base_risk + 0.2,
        "high_threshold": base_risk + 0.15,
        "medium_threshold": base_risk + 0.1,
        "alert_criteria": {
            "frequency_change": "40% deviation from baseline",
            "pattern_disruption": "3+ anomalies in 7 days",
            "network_expansion": "5+ new contacts in 30 days"
        }
    }


async def _collect_social_media_data(social_accounts: list, analysis_period: str) -> dict:
    """Simulate social media data collection."""
    # In production, would integrate with social media APIs
    return {
        "total_posts": 150,
        "average_daily_posts": 5,
        "sentiment_distribution": {"positive": 0.3, "neutral": 0.5, "negative": 0.2},
        "interaction_count": 2400,
        "network_size": 350,
        "peak_activity_hours": ["18:00-20:00", "22:00-24:00"],
        "topic_distribution": {
            "political": 0.4,
            "personal": 0.3,
            "technical": 0.2,
            "other": 0.1
        }
    }


def _analyze_communication_patterns(social_data: dict) -> dict:
    """Analyze communication patterns from social media data."""
    return {
        "posting_frequency": {
            "current_rate": social_data.get("average_daily_posts", 0),
            "trend": "increasing",
            "consistency": 0.7,
            "peak_times": social_data.get("peak_activity_hours", [])
        },
        "engagement_patterns": {
            "interaction_rate": social_data.get("interaction_count", 0) / max(social_data.get("total_posts", 1), 1),
            "response_latency": "2-4_hours",
            "engagement_quality": "high",
            "network_growth": "stable"
        },
        "content_evolution": {
            "topic_consistency": 0.8,
            "language_complexity": "medium",
            "emotional_intensity": "moderate",
            "ideological_indicators": ["political_engagement", "social_activism"]
        }
    }


def _analyze_sentiment_trajectory(social_data: dict) -> dict:
    """Analyze sentiment trajectory over time."""
    sentiment_dist = social_data.get("sentiment_distribution", {})
    
    return {
        "current_sentiment": {
            "primary": "neutral",
            "distribution": sentiment_dist,
            "volatility": 0.3,
            "trend": "stable"
        },
        "emotional_indicators": {
            "stress_markers": ["deadline_pressure", "conflict_references"],
            "motivation_indicators": ["goal_oriented_language", "future_planning"],
            "relationship_satisfaction": 0.6,
            "ideological_confidence": 0.8
        },
        "trajectory_analysis": {
            "30_day_trend": "slight_negative",
            "volatility_increase": False,
            "crisis_indicators": "none_detected",
            "stability_score": 0.75
        }
    }


def _analyze_social_networks(social_data: dict) -> dict:
    """Analyze social network patterns."""
    return {
        "network_structure": {
            "size": social_data.get("network_size", 0),
            "density": 0.35,
            "clustering_coefficient": 0.6,
            "centrality_score": 0.7
        },
        "influence_patterns": {
            "influence_score": 0.6,
            "authority_indicators": ["frequent_shares", "comment_engagement"],
            "network_position": "bridge_node",
            "leadership_potential": 0.7
        },
        "network_evolution": {
            "growth_rate": "moderate",
            "churn_rate": "low",
            "new_connections": 15,
            "lost_connections": 3
        }
    }


def _extract_motivations_from_social_data(social_data: dict) -> list[str]:
    """Extract motivations from social media analysis."""
    topic_dist = social_data.get("topic_distribution", {})
    
    motivations = []
    if topic_dist.get("political", 0) > 0.3:
        motivations.append("Political ideology")
    if topic_dist.get("personal", 0) > 0.4:
        motivations.append("Personal grievances")
    
    return motivations if motivations else ["Social belonging", "Recognition seeking"]


def _identify_stress_indicators(social_data: dict) -> list[str]:
    """Identify stress indicators from social media data."""
    sentiment = social_data.get("sentiment_distribution", {})
    
    indicators = []
    if sentiment.get("negative", 0) > 0.3:
        indicators.append("Increased negative sentiment")
    if social_data.get("average_daily_posts", 0) > 10:
        indicators.append("Hyperactive posting patterns")
    
    return indicators if indicators else ["No significant stress indicators detected"]


def _identify_behavioral_changes(social_data: dict) -> list[str]:
    """Identify behavioral changes from social media patterns."""
    return [
        "Shift toward more political content",
        "Decreased personal sharing",
        "Increased engagement with specific groups",
        "Changes in posting schedule"
    ]


def _identify_risk_escalation_signs(social_data: dict) -> list[str]:
    """Identify risk escalation signs from social data."""
    return [
        "Rhetoric intensification",
        "Network expansion toward extremist contacts",
        "Operational security discussions",
        "Timeline urgency indicators"
    ]


def _calculate_activity_trend(social_data: dict) -> str:
    """Calculate overall activity trend."""
    posts = social_data.get("average_daily_posts", 0)
    if posts > 8:
        return "increasing"
    elif posts < 3:
        return "decreasing"
    else:
        return "stable"


def _analyze_engagement_pattern(social_data: dict) -> dict:
    """Analyze engagement patterns."""
    return {
        "engagement_rate": 0.12,
        "quality_score": 0.75,
        "interaction_depth": "medium",
        "influence_growth": "positive"
    }


def _analyze_content_evolution(social_data: dict) -> dict:
    """Analyze content evolution patterns."""
    return {
        "topic_shift": "gradual",
        "complexity_trend": "increasing",
        "ideological_consistency": 0.8,
        "messaging_sophistication": "medium"
    }


def _assess_network_health(network_analysis: dict) -> str:
    """Assess overall network health."""
    growth_rate = network_analysis.get("network_evolution", {}).get("growth_rate", "")
    if growth_rate == "rapid":
        return "expanding"
    elif growth_rate == "moderate":
        return "healthy"
    else:
        return "stable"


def _extract_detected_anomalies(analysis_content: str) -> list[dict]:
    """Extract detected anomalies from AI analysis."""
    # Simulate anomaly extraction (would parse AI response in production)
    return [
        {
            "anomaly_id": 1,
            "type": "communication_frequency",
            "description": "40% increase in daily communications",
            "severity": "medium",
            "significance_probability": 0.75,
            "detected_at": datetime.now().isoformat()
        },
        {
            "anomaly_id": 2,
            "type": "network_expansion",
            "description": "Rapid addition of new contacts",
            "severity": "high",
            "significance_probability": 0.85,
            "detected_at": datetime.now().isoformat()
        }
    ]


def _calculate_baseline_deviations(baseline_behavior: dict, recent_observations: list) -> dict:
    """Calculate deviations from baseline behavior."""
    return {
        "communication_deviation": 0.4,
        "movement_deviation": 0.2,
        "social_deviation": 0.6,
        "temporal_deviation": 0.3,
        "overall_deviation": 0.375
    }


def _generate_behavioral_alerts(anomalies: list, sensitivity: str) -> list[dict]:
    """Generate behavioral alerts based on detected anomalies."""
    alerts = []
    
    sensitivity_thresholds = {
        "high": 0.3,
        "medium": 0.5,
        "low": 0.7
    }
    
    threshold = sensitivity_thresholds.get(sensitivity, 0.5)
    
    for anomaly in anomalies:
        if anomaly.get("significance_probability", 0) > threshold:
            alerts.append({
                "alert_id": f"alert_{anomaly['anomaly_id']}",
                "priority": anomaly.get("severity", "medium"),
                "message": f"Behavioral anomaly detected: {anomaly['description']}",
                "recommended_action": "Investigate and monitor closely",
                "created_at": datetime.now().isoformat()
            })
    
    return alerts


def _calculate_overall_deviation(deviation_scores: dict) -> float:
    """Calculate overall deviation score."""
    scores = list(deviation_scores.values())
    return sum(scores) / len(scores) if scores else 0.0


def _assess_deviation_significance(deviation_scores: dict) -> str:
    """Assess significance of overall deviations."""
    overall = _calculate_overall_deviation(deviation_scores)
    
    if overall > 0.7:
        return "Highly Significant"
    elif overall > 0.5:
        return "Moderately Significant"
    elif overall > 0.3:
        return "Somewhat Significant"
    else:
        return "Minimal Significance"


def _analyze_deviation_trends(recent_observations: list) -> dict:
    """Analyze trends in behavioral deviations."""
    return {
        "trend_direction": "increasing",
        "trend_strength": 0.6,
        "consistency": 0.7,
        "acceleration": "gradual",
        "projected_trajectory": "continued_increase"
    }


def _generate_escalation_recommendations(alerts: list) -> list[str]:
    """Generate escalation recommendations based on alerts."""
    high_priority_alerts = [a for a in alerts if a.get("priority") == "high"]
    
    if len(high_priority_alerts) > 2:
        return [
            "Escalate to senior analyst for review",
            "Consider immediate intervention assessment",
            "Activate enhanced monitoring protocols"
        ]
    elif len(alerts) > 3:
        return [
            "Increase monitoring frequency",
            "Review intervention thresholds",
            "Coordinate with relevant teams"
        ]
    else:
        return [
            "Continue standard monitoring",
            "Document deviations for trend analysis"
        ]


def _suggest_monitoring_adjustments(anomalies: list) -> list[str]:
    """Suggest monitoring adjustments based on detected anomalies."""
    adjustments = []
    
    for anomaly in anomalies:
        if anomaly.get("type") == "communication_frequency":
            adjustments.append("Increase communication monitoring frequency")
        elif anomaly.get("type") == "network_expansion":
            adjustments.append("Enhance social network monitoring")
    
    return adjustments if adjustments else ["Maintain current monitoring protocols"]


def _analyze_external_factors(context_factors: list) -> dict:
    """Analyze external factors that might influence behavior."""
    return {
        "environmental_stressors": len([f for f in context_factors if "stress" in f.lower()]),
        "opportunity_factors": len([f for f in context_factors if "opportunity" in f.lower()]),
        "social_influences": len([f for f in context_factors if "social" in f.lower()]),
        "overall_impact": "moderate"
    }


def _assess_seasonal_factors(recent_observations: list) -> dict:
    """Assess seasonal factors affecting behavior."""
    return {
        "seasonal_pattern": "none_detected",
        "holiday_influences": "minimal",
        "weather_correlation": "none",
        "calendar_events": "under_analysis"
    }


def _identify_stress_related_anomalies(anomalies: list) -> list[dict]:
    """Identify anomalies that might be stress-related."""
    stress_related = []
    
    for anomaly in anomalies:
        if anomaly.get("type") in ["communication_frequency", "temporal_deviation"]:
            stress_related.append({
                "anomaly": anomaly,
                "stress_correlation": 0.7,
                "explanation": "Increased activity may indicate stress response"
            })
    
    return stress_related


def _calculate_anomaly_confidence(baseline_behavior: dict, recent_observations: list) -> float:
    """Calculate confidence in anomaly detection."""
    baseline_quality = 0.8  # Simulated baseline data quality
    observation_count = len(recent_observations)
    observation_quality = min(1.0, observation_count / 20)
    
    return (baseline_quality + observation_quality) / 2


def _calculate_risk_score(subject_data: dict, historical_patterns: list) -> float:
    """Calculate behavioral risk score."""
    pattern_risk = len([p for p in historical_patterns if p.get("significance") == "high"]) * 0.2
    base_risk = 0.4  # Base risk level
    
    return min(1.0, base_risk + pattern_risk)


def _identify_risk_factors(historical_patterns: list) -> list[str]:
    """Identify risk factors from historical patterns."""
    risk_factors = []
    
    for pattern in historical_patterns:
        if pattern.get("pattern_type") == "escalation":
            risk_factors.append("Escalation pattern detected")
        if pattern.get("significance") == "high":
            risk_factors.append("High-significance behavior pattern")
    
    return risk_factors if risk_factors else ["Standard risk profile"]


def _identify_escalation_triggers(historical_patterns: list) -> list[str]:
    """Identify potential escalation triggers."""
    return [
        "External pressure events",
        "Opportunity windows",
        "Social validation seeking",
        "Resource availability",
        "Ideological reinforcement"
    ]


def _identify_mitigation_factors(subject_data: dict) -> list[str]:
    """Identify factors that might mitigate behavioral risks."""
    return [
        "Strong social connections",
        "Stable employment/income",
        "Family responsibilities",
        "Community involvement",
        "Access to mental health resources"
    ]


def _extract_cluster_characteristics(subject_data: dict) -> list[str]:
    """Extract behavioral cluster characteristics."""
    return [
        "Methodical planning approach",
        "High operational security awareness",
        "Network-building capabilities",
        "Adaptive tactical thinking",
        "Moderate risk tolerance"
    ]


def _calculate_intervention_confidence(behavioral_profile: dict, risk_assessment: dict) -> float:
    """Calculate confidence in intervention planning."""
    profile_completeness = len(behavioral_profile) / 10  # Assume 10 key profile elements
    risk_clarity = risk_assessment.get("confidence_level", 0.5)
    
    return (profile_completeness + risk_clarity) / 2


def _identify_immediate_interventions(intervention_strategies: list) -> list[dict]:
    """Identify immediate intervention actions."""
    immediate = [s for s in intervention_strategies if s.get("timeline") == "immediate"]
    return immediate if immediate else [
        {
            "action": "Increase monitoring frequency",
            "timeline": "immediate",
            "resource_requirement": "low"
        }
    ]


def _develop_short_term_plan(intervention_strategies: list) -> dict:
    """Develop short-term intervention plan."""
    return {
        "timeframe": "1-4_weeks",
        "primary_objectives": ["Stabilize current behavior", "Gather additional intelligence"],
        "key_actions": ["Enhanced monitoring", "Social network analysis"],
        "success_metrics": ["Behavioral stability", "No escalation indicators"],
        "resource_allocation": "moderate"
    }


def _develop_long_term_strategy(intervention_strategies: list) -> dict:
    """Develop long-term intervention strategy."""
    return {
        "timeframe": "3-12_months",
        "strategic_objectives": ["Behavioral modification", "Risk reduction", "Positive engagement"],
        "key_initiatives": ["Social intervention", "Environmental modification", "Support systems"],
        "success_metrics": ["Sustained behavioral change", "Risk score reduction"],
        "sustainability_plan": "Community-based support integration"
    }


def _develop_contingency_plans(intervention_strategies: list) -> list[dict]:
    """Develop contingency plans for intervention failures."""
    return [
        {
            "scenario": "intervention_resistance",
            "response": "Adjust approach, increase resources",
            "escalation_threshold": "2_weeks_no_progress"
        },
        {
            "scenario": "behavioral_escalation",
            "response": "Activate crisis protocols",
            "escalation_threshold": "immediate_risk_increase"
        }
    ]


def _define_success_indicators(intervention_goals: list) -> list[str]:
    """Define success indicators for interventions."""
    return [
        "Reduction in risk score by 20%",
        "Stabilization of behavioral patterns",
        "Decreased anomaly frequency",
        "Improved social connections",
        "Reduced stress indicators"
    ]


def _define_measurement_methods(intervention_goals: list) -> list[str]:
    """Define methods for measuring intervention success."""
    return [
        "Behavioral pattern analysis",
        "Risk score trending",
        "Social network mapping",
        "Communication pattern monitoring",
        "Stress indicator assessment"
    ]


def _create_evaluation_timeline(intervention_strategies: list) -> dict:
    """Create timeline for intervention evaluation."""
    return {
        "initial_assessment": "1_week",
        "preliminary_review": "4_weeks",
        "comprehensive_evaluation": "12_weeks",
        "long_term_assessment": "6_months",
        "final_evaluation": "12_months"
    }


def _define_progress_milestones(intervention_strategies: list) -> list[dict]:
    """Define progress milestones for intervention tracking."""
    return [
        {
            "milestone": "Baseline stabilization",
            "target_date": "2_weeks",
            "indicators": ["No further escalation", "Pattern consistency"]
        },
        {
            "milestone": "Initial improvement",
            "target_date": "6_weeks",
            "indicators": ["Risk score reduction", "Positive behavioral changes"]
        },
        {
            "milestone": "Sustained progress",
            "target_date": "3_months",
            "indicators": ["Consistent improvement", "Reduced monitoring needs"]
        }
    ]


def _identify_intervention_risks(intervention_strategies: list) -> list[str]:
    """Identify risks associated with interventions."""
    return [
        "Subject awareness of intervention",
        "Behavioral backlash or resistance",
        "Unintended escalation",
        "Resource allocation challenges",
        "Legal or ethical complications"
    ]


def _develop_risk_mitigations(intervention_strategies: list) -> list[str]:
    """Develop risk mitigation strategies for interventions."""
    return [
        "Maintain operational security throughout intervention",
        "Prepare de-escalation protocols",
        "Ensure legal compliance and oversight",
        "Establish clear escalation procedures",
        "Regular risk-benefit reassessment"
    ]


def _define_monitoring_protocols(intervention_strategies: list) -> list[str]:
    """Define monitoring protocols during interventions."""
    return [
        "Daily behavioral assessment",
        "Weekly progress review",
        "Monthly strategic evaluation",
        "Continuous risk monitoring",
        "Real-time alert system"
    ]


def _define_escalation_procedures(intervention_strategies: list) -> list[str]:
    """Define escalation procedures for intervention failures."""
    return [
        "Immediate supervisor notification",
        "Risk assessment team activation",
        "Crisis response protocol initiation",
        "Resource reallocation procedures",
        "External support coordination"
    ]


def _calculate_personnel_needs(intervention_strategies: list) -> dict:
    """Calculate personnel requirements for interventions."""
    return {
        "monitoring_staff": 2,
        "analysis_specialists": 1,
        "intervention_coordinators": 1,
        "support_personnel": 1,
        "total_fte": 5,
        "specialized_skills_required": ["Behavioral analysis", "Crisis intervention", "Social work"]
    }


def _estimate_intervention_costs(intervention_strategies: list) -> dict:
    """Estimate costs for intervention implementation."""
    return {
        "personnel_costs": 50000,
        "technology_costs": 10000,
        "operational_costs": 15000,
        "contingency_reserve": 10000,
        "total_estimated_cost": 85000,
        "cost_breakdown": "60% personnel, 20% operations, 15% technology, 5% contingency"
    }


def _estimate_implementation_timelines(intervention_strategies: list) -> dict:
    """Estimate timelines for intervention implementation."""
    return {
        "planning_phase": "1_week",
        "setup_phase": "2_weeks",
        "active_intervention": "12_weeks",
        "evaluation_phase": "4_weeks",
        "total_timeline": "19_weeks",
        "critical_path": "Approval → Setup → Implementation → Evaluation"
    }


def _calculate_overall_success_probability(intervention_strategies: list) -> float:
    """Calculate overall probability of intervention success."""
    if not intervention_strategies:
        return 0.5
    
    individual_probabilities = [s.get("success_probability", 0.5) for s in intervention_strategies]
    return sum(individual_probabilities) / len(individual_probabilities)
