"""
Deception Detection Framework API endpoints.
Information reliability and veracity assessment for intelligence analysis.
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
import re

logger = get_logger(__name__)
router = APIRouter()


class DeceptionIndicator(BaseModel):
    """Individual deception indicator."""
    id: str
    category: str  # linguistic, behavioral, contextual, logical
    indicator_type: str
    description: str
    severity: str  # high, medium, low
    confidence: float  # 0-1 scale
    evidence: str | None = None
    notes: str | None = None


class ContentAnalysis(BaseModel):
    """Content analysis for deception detection."""
    content_type: str  # text, speech, document, communication
    source: str
    timestamp: str | None = None
    content: str
    metadata: dict | None = {}


class DeceptionCreateRequest(BaseModel):
    """Deception detection analysis creation request."""
    title: str
    content_to_analyze: ContentAnalysis
    analysis_type: str = "comprehensive"  # comprehensive, linguistic, behavioral, contextual
    context: str | None = None
    known_facts: list[str] | None = []
    request_ai_analysis: bool = True


class DeceptionUpdateRequest(BaseModel):
    """Deception detection analysis update request."""
    title: str | None = None
    indicators: list[DeceptionIndicator] | None = None
    additional_context: str | None = None
    verified_facts: list[str] | None = None


class DeceptionAnalysisResponse(BaseModel):
    """Deception detection analysis response."""
    session_id: int
    title: str
    content_analyzed: ContentAnalysis
    indicators: list[DeceptionIndicator]
    overall_assessment: dict
    reliability_score: float  # 0-1 scale
    deception_probability: float  # 0-1 scale
    ai_analysis: dict | None = None
    recommendations: list[str]
    status: str
    version: int


class ReliabilityMetrics(BaseModel):
    """Reliability assessment metrics."""
    consistency_score: float  # Internal consistency
    corroboration_score: float  # External corroboration
    source_credibility: float  # Source reliability
    logical_coherence: float  # Logical consistency
    temporal_consistency: float  # Timeline consistency
    overall_reliability: float  # Combined score


@router.post("/create", response_model=DeceptionAnalysisResponse)
async def create_deception_analysis(
    request: DeceptionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DeceptionAnalysisResponse:
    """
    Create a new deception detection analysis session.
    
    Args:
        request: Deception detection creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DeceptionAnalysisResponse: Created deception analysis
    """
    logger.info(f"Creating deception analysis: {request.title} for user {current_user.username}")

    # Prepare deception data
    deception_data = {
        "content_to_analyze": request.content_to_analyze.dict(),
        "analysis_type": request.analysis_type,
        "context": request.context or "",
        "known_facts": request.known_facts or [],
        "indicators": [],
        "reliability_metrics": {},
        "overall_assessment": {}
    }

    # Get AI analysis if requested
    ai_analysis = None
    indicators = []

    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.DECEPTION_DETECTION,
                deception_data,
                "analyze"
            )
            ai_analysis = ai_result.get("analysis")

            # Extract indicators from AI analysis
            if ai_analysis and "indicators" in ai_analysis:
                for idx, indicator in enumerate(ai_analysis["indicators"]):
                    if isinstance(indicator, dict):
                        indicator["id"] = f"ind_ai_{idx}"
                        indicators.append(indicator)

            # Update overall assessment
            if ai_analysis and "assessment" in ai_analysis:
                deception_data["overall_assessment"] = ai_analysis["assessment"]

        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")

    # Calculate initial scores
    reliability_score = 0.7  # Default moderate reliability
    deception_probability = 0.3  # Default low deception probability

    if ai_analysis:
        reliability_score = ai_analysis.get("reliability_score", 0.7)
        deception_probability = ai_analysis.get("deception_probability", 0.3)

    deception_data["indicators"] = indicators
    deception_data["reliability_score"] = reliability_score
    deception_data["deception_probability"] = deception_probability

    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.DECEPTION_DETECTION,
        title=request.title,
        description=f"Deception Detection - {request.content_to_analyze.source}",
        data=deception_data,
        tags=["deception-detection", "veracity-assessment", "reliability-analysis"]
    )

    session = await framework_service.create_session(db, current_user, framework_data)

    # Generate recommendations
    recommendations = _generate_recommendations(deception_probability, reliability_score)

    return DeceptionAnalysisResponse(
        session_id=session.id,
        title=session.title,
        content_analyzed=ContentAnalysis(**deception_data["content_to_analyze"]),
        indicators=[DeceptionIndicator(**ind) for ind in indicators],
        overall_assessment=deception_data["overall_assessment"],
        reliability_score=reliability_score,
        deception_probability=deception_probability,
        ai_analysis=ai_analysis,
        recommendations=recommendations,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=DeceptionAnalysisResponse)
async def get_deception_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> DeceptionAnalysisResponse:
    """
    Get a specific deception detection analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        DeceptionAnalysisResponse: Deception analysis data
    """
    logger.info(f"Getting deception analysis {session_id}")

    # Get real data from database
    session = await framework_service.get_session(db, current_user, session_id, FrameworkType.DECEPTION_DETECTION)
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deception analysis session not found"
        )

    # Extract data from session
    session_data = session.data or {}
    
    # Parse content data
    content_data = session_data.get("content_to_analyze", {})
    content = ContentAnalysis(**content_data) if content_data else ContentAnalysis(
        content_type="text",
        source="Unknown",
        content="No content provided",
        metadata={}
    )
    
    # Parse indicators
    indicators_data = session_data.get("indicators", [])
    indicators = [DeceptionIndicator(**ind) for ind in indicators_data if isinstance(ind, dict)]
    
    # Get assessment data
    overall_assessment = session_data.get("overall_assessment", {
        "summary": "Analysis in progress",
        "key_concerns": [],
        "reliability_assessment": "Pending",
        "recommended_action": "Complete analysis"
    })
    
    # Get scores
    reliability_score = session_data.get("reliability_score", 0.5)
    deception_probability = session_data.get("deception_probability", 0.5)
    
    # Generate recommendations based on current data
    recommendations = _generate_recommendations(deception_probability, reliability_score)
    
    # Get AI analysis if available
    ai_analysis = session_data.get("ai_analysis")

    return DeceptionAnalysisResponse(
        session_id=session.id,
        title=session.title,
        content_analyzed=content,
        indicators=indicators,
        overall_assessment=overall_assessment,
        reliability_score=reliability_score,
        deception_probability=deception_probability,
        ai_analysis=ai_analysis,
        recommendations=recommendations,
        status=session.status.value,
        version=session.version
    )


@router.post("/{session_id}/analyze")
async def analyze_content(
    session_id: int,
    content: ContentAnalysis,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Analyze specific content for deception indicators.
    
    Args:
        session_id: Session ID
        content: Content to analyze
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Analysis results
    """
    logger.info(f"Analyzing content for deception in session {session_id}")

    # Perform deception analysis
    analysis_data = {
        "content": content.dict(),
        "analysis_type": "detailed"
    }

    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.DECEPTION_DETECTION,
        analysis_data,
        "analyze"
    )

    return {
        "session_id": session_id,
        "content_analyzed": content.dict(),
        "analysis": ai_result.get("analysis", {}),
        "indicators_found": ai_result.get("indicators", []),
        "timestamp": "2025-08-16T00:00:00Z"
    }


@router.get("/{session_id}/indicators")
async def get_deception_indicators(
    session_id: int,
    category: str | None = None,
    severity: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get deception indicators for analysis.
    
    Args:
        session_id: Session ID
        category: Filter by category (linguistic, behavioral, contextual, logical)
        severity: Filter by severity (high, medium, low)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Deception indicators
    """
    logger.info(f"Getting deception indicators for session {session_id}")

    # All possible indicators
    all_indicators = {
        "linguistic": [
            {"type": "Passive voice overuse", "description": "Distancing from statements"},
            {"type": "Lack of detail", "description": "Vague or generalized claims"},
            {"type": "Qualifying language", "description": "Excessive hedging"},
            {"type": "Tense changes", "description": "Inconsistent temporal references"}
        ],
        "behavioral": [
            {"type": "Response latency", "description": "Unusual delays in responses"},
            {"type": "Inconsistent emotions", "description": "Mismatched emotional responses"},
            {"type": "Avoidance patterns", "description": "Avoiding specific topics"}
        ],
        "contextual": [
            {"type": "Contradictory information", "description": "Conflicts with known facts"},
            {"type": "Impossible claims", "description": "Physically or logically impossible"},
            {"type": "Unverifiable details", "description": "Cannot be independently confirmed"}
        ],
        "logical": [
            {"type": "Internal inconsistencies", "description": "Self-contradicting statements"},
            {"type": "Logical fallacies", "description": "Flawed reasoning patterns"},
            {"type": "Timeline conflicts", "description": "Chronological impossibilities"}
        ]
    }

    # Filter if needed
    if category:
        all_indicators = {category: all_indicators.get(category, [])}

    return {
        "session_id": session_id,
        "indicators": all_indicators,
        "total_count": sum(len(ind) for ind in all_indicators.values()),
        "filters_applied": {
            "category": category,
            "severity": severity
        }
    }


@router.post("/{session_id}/reliability")
async def assess_reliability(
    session_id: int,
    metrics: ReliabilityMetrics,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Assess overall reliability based on metrics.
    
    Args:
        session_id: Session ID
        metrics: Reliability metrics
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Reliability assessment
    """
    logger.info(f"Assessing reliability for session {session_id}")

    # Calculate weighted reliability score
    weights = {
        "consistency_score": 0.2,
        "corroboration_score": 0.3,
        "source_credibility": 0.2,
        "logical_coherence": 0.2,
        "temporal_consistency": 0.1
    }

    weighted_score = sum(
        getattr(metrics, metric) * weight
        for metric, weight in weights.items()
    )

    # Determine reliability level
    if weighted_score >= 0.8:
        reliability_level = "High"
        confidence = "High confidence in information accuracy"
    elif weighted_score >= 0.6:
        reliability_level = "Moderate"
        confidence = "Moderate confidence, some verification needed"
    elif weighted_score >= 0.4:
        reliability_level = "Low"
        confidence = "Low confidence, significant verification required"
    else:
        reliability_level = "Very Low"
        confidence = "Very low confidence, treat with extreme caution"

    return {
        "session_id": session_id,
        "metrics": metrics.dict(),
        "weighted_score": weighted_score,
        "reliability_level": reliability_level,
        "confidence_assessment": confidence,
        "recommendations": _generate_reliability_recommendations(weighted_score)
    }


@router.post("/{session_id}/export")
async def export_deception_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export deception analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting deception analysis {session_id} as {format}")

    if format not in ["pdf", "docx", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json"
        )

    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/deception_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


def _generate_recommendations(deception_prob: float, reliability: float) -> list[str]:
    """Generate recommendations based on analysis results."""
    recommendations = []

    if deception_prob > 0.7:
        recommendations.extend([
            "High deception probability - treat information with extreme caution",
            "Seek multiple independent sources for verification",
            "Consider source motivation and potential gains from deception"
        ])
    elif deception_prob > 0.4:
        recommendations.extend([
            "Moderate deception probability - verify key claims",
            "Cross-reference with reliable sources",
            "Request additional documentation or evidence"
        ])
    else:
        recommendations.extend([
            "Low deception probability - information appears credible",
            "Standard verification procedures recommended",
            "Monitor for any changes or contradictions"
        ])

    if reliability < 0.5:
        recommendations.extend([
            "Low reliability score - additional verification critical",
            "Identify and address specific reliability concerns",
            "Consider alternative information sources"
        ])

    return recommendations


def _generate_reliability_recommendations(score: float) -> list[str]:
    """Generate recommendations based on reliability score."""
    if score >= 0.8:
        return [
            "Information appears highly reliable",
            "Standard verification procedures sufficient",
            "Document source for future reference"
        ]
    elif score >= 0.6:
        return [
            "Moderate reliability - some verification needed",
            "Focus on verifying critical claims",
            "Seek corroboration for key facts"
        ]
    elif score >= 0.4:
        return [
            "Low reliability - comprehensive verification required",
            "Treat all claims as provisional",
            "Actively seek alternative sources"
        ]
    else:
        return [
            "Very low reliability - extreme caution advised",
            "Do not act on information without extensive verification",
            "Consider information potentially deceptive or false",
            "Document concerns for intelligence assessment"
        ]


@router.get("/templates/list")
async def list_deception_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available deception detection templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Intelligence Report Verification",
            "description": "Assess veracity of intelligence reports",
            "indicators": ["Source reliability", "Content consistency", "Corroboration"],
            "use_cases": ["HUMINT verification", "Report validation", "Source assessment"]
        },
        {
            "id": 2,
            "name": "Communication Analysis",
            "description": "Analyze communications for deception",
            "indicators": ["Linguistic patterns", "Behavioral cues", "Contextual analysis"],
            "use_cases": ["Email analysis", "Interview assessment", "Message verification"]
        },
        {
            "id": 3,
            "name": "Document Authentication",
            "description": "Verify document authenticity and accuracy",
            "indicators": ["Internal consistency", "External verification", "Metadata analysis"],
            "use_cases": ["Document verification", "Forgery detection", "Content validation"]
        }
    ]

    return templates


# AI-Enhanced Deception Detection Endpoints

@router.post("/ai/multi-modal-analysis")
async def multi_modal_deception_analysis(
    request: dict
) -> dict:
    """
    Perform multi-modal deception analysis using text, image, and audio analysis.
    """
    try:
        content_type = request.get("content_type", "text")  # text, image, audio, video
        content_data = request.get("content_data", "")
        metadata = request.get("metadata", {})
        analysis_depth = request.get("analysis_depth", "comprehensive")
        
        analysis_results = {
            "text_analysis": {},
            "behavioral_analysis": {},
            "contextual_analysis": {},
            "temporal_analysis": {}
        }
        
        # Text-based linguistic analysis
        if content_type in ["text", "video", "audio"]:
            text_analysis = await _perform_linguistic_analysis(content_data)
            analysis_results["text_analysis"] = text_analysis
        
        # Behavioral pattern analysis (for video/audio)
        if content_type in ["video", "audio"]:
            behavioral_analysis = await _perform_behavioral_analysis(content_data, metadata)
            analysis_results["behavioral_analysis"] = behavioral_analysis
        
        # Image/video facial expression analysis
        if content_type in ["image", "video"]:
            facial_analysis = await _perform_facial_expression_analysis(content_data)
            analysis_results["facial_analysis"] = facial_analysis
        
        # Audio tone and stress analysis
        if content_type in ["audio", "video"]:
            audio_analysis = await _perform_audio_stress_analysis(content_data)
            analysis_results["audio_analysis"] = audio_analysis
        
        # Comprehensive AI assessment
        comprehensive_prompt = f"""
        As an expert deception detection specialist, analyze this multi-modal content for deception indicators.

        Content Type: {content_type}
        Analysis Results:
        {json.dumps(analysis_results, indent=2)}

        Metadata: {json.dumps(metadata, indent=2)}

        Provide analysis on:
        1. Linguistic deception indicators and patterns
        2. Behavioral inconsistencies and stress markers
        3. Facial expression micro-expressions (if applicable)
        4. Voice stress and tone anomalies (if applicable)
        5. Cross-modal consistency assessment
        6. Overall deception probability with confidence intervals

        Format as structured JSON with specific indicators, confidence scores, and recommendations.
        """
        
        ai_assessment = await ai_service.analyze_with_ai_detailed(comprehensive_prompt, "deception_analysis")
        
        # Calculate overall deception probability
        deception_indicators = _extract_deception_indicators(analysis_results)
        overall_probability = _calculate_deception_probability(deception_indicators)
        
        return {
            "multi_modal_analysis": analysis_results,
            "ai_assessment": ai_assessment["content"],
            "deception_indicators": deception_indicators,
            "overall_assessment": {
                "deception_probability": overall_probability,
                "confidence_level": _calculate_confidence_level(analysis_results),
                "risk_classification": _classify_risk_level(overall_probability),
                "primary_concerns": _identify_primary_concerns(deception_indicators)
            },
            "recommendations": _generate_multi_modal_recommendations(overall_probability, content_type),
            "analysis_metadata": {
                "content_type": content_type,
                "analysis_depth": analysis_depth,
                "timestamp": datetime.now().isoformat(),
                "methodology": "Multi-Modal AI Deception Detection"
            }
        }
        
    except Exception as e:
        logger.error(f"Multi-modal deception analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Multi-modal analysis failed")


@router.post("/ai/timeline-consistency")
async def timeline_consistency_analysis(
    request: dict
) -> dict:
    """
    Analyze timeline consistency and detect chronological contradictions.
    """
    try:
        statements = request.get("statements", [])
        timeline_data = request.get("timeline_data", {})
        known_facts = request.get("known_facts", [])
        
        # AI-powered timeline analysis
        timeline_prompt = f"""
        As an expert forensic analyst specializing in timeline analysis, examine these statements for chronological inconsistencies and contradictions.

        Statements to Analyze:
        {json.dumps(statements, indent=2)}

        Timeline Data:
        {json.dumps(timeline_data, indent=2)}

        Known Facts:
        {', '.join(known_facts)}

        Analyze for:
        1. Internal chronological contradictions
        2. Impossible time sequences
        3. Inconsistent temporal references
        4. Gaps or jumps in timeline
        5. Conflicts with known facts
        6. Temporal precision anomalies

        For each inconsistency found, provide:
        - Specific contradiction description
        - Evidence from statements
        - Severity level (critical, moderate, minor)
        - Probability of intentional deception (0-100%)
        - Alternative explanations (memory error, confusion, etc.)

        Format as structured JSON for detailed analysis.
        """
        
        timeline_analysis = await ai_service.analyze_with_ai_detailed(timeline_prompt, "timeline_analysis")
        
        # Process timeline inconsistencies
        inconsistencies = _extract_timeline_inconsistencies(timeline_analysis["content"])
        
        # Generate timeline visualization data
        timeline_viz = _generate_timeline_visualization(statements, timeline_data)
        
        return {
            "timeline_analysis": {
                "content": timeline_analysis["content"],
                "inconsistencies_found": len(inconsistencies),
                "critical_issues": len([i for i in inconsistencies if i.get("severity") == "critical"]),
                "overall_consistency_score": _calculate_timeline_consistency_score(inconsistencies)
            },
            "inconsistencies": inconsistencies,
            "timeline_visualization": timeline_viz,
            "deception_assessment": {
                "timeline_reliability": _assess_timeline_reliability(inconsistencies),
                "intentional_deception_probability": _calculate_intentional_deception_probability(inconsistencies),
                "alternative_explanations": _suggest_alternative_explanations(inconsistencies)
            },
            "recommendations": [
                "Focus verification efforts on critical timeline inconsistencies",
                "Request clarification on temporal gaps and contradictions",
                "Cross-reference timeline with independent sources",
                "Consider memory limitations and stress factors"
            ],
            "analysis_timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Timeline consistency analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Timeline analysis failed")


@router.post("/ai/fact-verification")
async def automated_fact_verification(
    request: dict
) -> dict:
    """
    Perform automated fact-checking against reliable databases and sources.
    """
    try:
        claims = request.get("claims", [])
        source_context = request.get("source_context", "")
        verification_depth = request.get("verification_depth", "standard")
        trusted_sources = request.get("trusted_sources", [])
        
        verification_results = []
        
        for i, claim in enumerate(claims):
            # Simulate fact verification (in production would query fact-checking APIs and databases)
            verification_result = await _verify_factual_claim(claim, trusted_sources)
            verification_results.append({
                "claim_id": i + 1,
                "claim_text": claim,
                "verification_status": verification_result["status"],
                "confidence_score": verification_result["confidence"],
                "supporting_sources": verification_result["sources"],
                "contradicting_evidence": verification_result["contradictions"],
                "verification_notes": verification_result["notes"]
            })
        
        # AI analysis of verification patterns
        verification_pattern_prompt = f"""
        Analyze the fact verification results for patterns that might indicate systematic deception or misinformation.

        Verification Results:
        {json.dumps(verification_results, indent=2)}

        Source Context: {source_context}

        Look for:
        1. Patterns of false or unverifiable claims
        2. Mixing of true and false information (disinformation technique)
        3. Claims that are technically true but misleading in context
        4. Verifiable details used to lend credibility to false claims
        5. Sources cited that don't actually support the claims
        6. Outdated information presented as current

        Assess the overall credibility pattern and likelihood of intentional deception.
        """
        
        pattern_analysis = await ai_service.analyze_with_ai_detailed(verification_pattern_prompt, "fact_verification")
        
        # Calculate overall verification scores
        total_claims = len(verification_results)
        verified_claims = len([r for r in verification_results if r["verification_status"] == "verified"])
        false_claims = len([r for r in verification_results if r["verification_status"] == "false"])
        unverifiable_claims = len([r for r in verification_results if r["verification_status"] == "unverifiable"])
        
        return {
            "fact_verification": {
                "total_claims_analyzed": total_claims,
                "verified_claims": verified_claims,
                "false_claims": false_claims,
                "unverifiable_claims": unverifiable_claims,
                "verification_rate": verified_claims / max(total_claims, 1),
                "false_claim_rate": false_claims / max(total_claims, 1)
            },
            "individual_results": verification_results,
            "pattern_analysis": pattern_analysis["content"],
            "credibility_assessment": {
                "overall_credibility_score": _calculate_credibility_score(verification_results),
                "deception_likelihood": _assess_deception_likelihood(verification_results),
                "information_quality": _assess_information_quality(verification_results),
                "source_reliability": _assess_source_reliability(verification_results)
            },
            "red_flags": _identify_verification_red_flags(verification_results),
            "recommendations": [
                "Focus additional verification on unverifiable claims",
                "Investigate sources for false claims",
                "Cross-reference with additional authoritative sources",
                "Consider motivation for any false information"
            ],
            "verification_metadata": {
                "verification_depth": verification_depth,
                "trusted_sources_used": len(trusted_sources),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Fact verification failed: {e}")
        raise HTTPException(status_code=500, detail="Fact verification failed")


@router.post("/ai/digital-forensics")
async def digital_content_authenticity_analysis(
    request: dict
) -> dict:
    """
    Analyze digital content for authenticity and detect potential manipulation.
    """
    try:
        content_url = request.get("content_url", "")
        content_type = request.get("content_type", "image")  # image, video, audio, document
        metadata = request.get("metadata", {})
        
        # Simulate digital forensics analysis
        authenticity_analysis = {
            "metadata_analysis": await _analyze_content_metadata(metadata, content_type),
            "manipulation_detection": await _detect_content_manipulation(content_url, content_type),
            "source_tracing": await _trace_content_source(content_url, metadata),
            "timestamp_verification": await _verify_content_timestamp(metadata)
        }
        
        # AI-powered authenticity assessment
        authenticity_prompt = f"""
        As a digital forensics expert, analyze this content for authenticity and potential manipulation.

        Content Type: {content_type}
        Content URL: {content_url}
        
        Forensics Analysis Results:
        {json.dumps(authenticity_analysis, indent=2)}

        Metadata: {json.dumps(metadata, indent=2)}

        Assess:
        1. Digital signature authenticity
        2. Metadata consistency and tampering signs
        3. Content manipulation indicators
        4. Source verification and chain of custody
        5. Timestamp integrity and chronological consistency
        6. Technical indicators of forgery or modification

        Provide detailed assessment with confidence levels and specific technical evidence.
        """
        
        ai_forensics = await ai_service.analyze_with_ai_detailed(authenticity_prompt, "digital_forensics")
        
        # Calculate authenticity scores
        authenticity_score = _calculate_authenticity_score(authenticity_analysis)
        manipulation_probability = _calculate_manipulation_probability(authenticity_analysis)
        
        return {
            "digital_forensics": authenticity_analysis,
            "ai_assessment": ai_forensics["content"],
            "authenticity_evaluation": {
                "authenticity_score": authenticity_score,
                "manipulation_probability": manipulation_probability,
                "confidence_level": _calculate_forensics_confidence(authenticity_analysis),
                "integrity_status": _determine_integrity_status(authenticity_score)
            },
            "technical_indicators": {
                "metadata_integrity": authenticity_analysis["metadata_analysis"].get("integrity_score", 0.5),
                "content_integrity": authenticity_analysis["manipulation_detection"].get("integrity_score", 0.5),
                "source_authenticity": authenticity_analysis["source_tracing"].get("authenticity_score", 0.5),
                "temporal_consistency": authenticity_analysis["timestamp_verification"].get("consistency_score", 0.5)
            },
            "recommendations": _generate_forensics_recommendations(authenticity_score, manipulation_probability),
            "analysis_metadata": {
                "content_type": content_type,
                "analysis_timestamp": datetime.now().isoformat(),
                "methodology": "AI-Enhanced Digital Forensics"
            }
        }
        
    except Exception as e:
        logger.error(f"Digital forensics analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Digital forensics analysis failed")


# Helper functions for AI-enhanced deception detection

async def _perform_linguistic_analysis(content: str) -> dict:
    """Perform linguistic analysis for deception indicators."""
    # Simulate linguistic analysis (in production would use NLP libraries)
    word_count = len(content.split())
    sentence_count = len([s for s in content.split('.') if s.strip()])
    
    # Look for linguistic indicators
    indicators = {
        "passive_voice_frequency": _count_passive_voice(content),
        "hedge_words_count": _count_hedge_words(content),
        "detail_specificity": _assess_detail_specificity(content),
        "temporal_references": _analyze_temporal_references(content),
        "emotional_language": _analyze_emotional_language(content)
    }
    
    return {
        "word_count": word_count,
        "sentence_count": sentence_count,
        "average_sentence_length": word_count / max(sentence_count, 1),
        "linguistic_indicators": indicators,
        "deception_score": _calculate_linguistic_deception_score(indicators)
    }


def _count_passive_voice(text: str) -> float:
    """Count passive voice frequency as deception indicator."""
    # Simple passive voice detection (would use more sophisticated NLP in production)
    passive_indicators = ['was', 'were', 'been', 'being']
    total_words = len(text.split())
    passive_count = sum(text.lower().count(indicator) for indicator in passive_indicators)
    return passive_count / max(total_words, 1)


def _count_hedge_words(text: str) -> int:
    """Count hedge words that may indicate uncertainty or deception."""
    hedge_words = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'seems', 'appears', 'allegedly']
    return sum(text.lower().count(word) for word in hedge_words)


def _assess_detail_specificity(text: str) -> float:
    """Assess level of detail specificity."""
    # Simple metric based on presence of specific details
    specific_indicators = ['at', 'on', 'in', 'during', 'approximately', 'exactly']
    specific_count = sum(text.lower().count(indicator) for indicator in specific_indicators)
    return min(specific_count / max(len(text.split()), 1) * 10, 1.0)


def _analyze_temporal_references(text: str) -> dict:
    """Analyze temporal reference patterns."""
    temporal_words = ['yesterday', 'today', 'tomorrow', 'then', 'now', 'before', 'after', 'when']
    temporal_count = sum(text.lower().count(word) for word in temporal_words)
    
    return {
        "temporal_word_count": temporal_count,
        "temporal_density": temporal_count / max(len(text.split()), 1),
        "tense_consistency": 0.8  # Placeholder for tense analysis
    }


def _analyze_emotional_language(text: str) -> dict:
    """Analyze emotional language patterns."""
    emotional_words = ['angry', 'happy', 'sad', 'frustrated', 'excited', 'nervous', 'calm']
    emotional_count = sum(text.lower().count(word) for word in emotional_words)
    
    return {
        "emotional_word_count": emotional_count,
        "emotional_intensity": emotional_count / max(len(text.split()), 1),
        "emotional_consistency": 0.7  # Placeholder for emotional consistency analysis
    }


def _calculate_linguistic_deception_score(indicators: dict) -> float:
    """Calculate linguistic deception score from indicators."""
    # Weighted scoring of linguistic indicators
    weights = {
        "passive_voice_frequency": 0.3,
        "hedge_words_count": 0.2,
        "detail_specificity": -0.3,  # Negative weight - more detail = less deceptive
        "temporal_references": 0.1,
        "emotional_language": 0.1
    }
    
    score = 0.5  # Base score
    for indicator, value in indicators.items():
        if indicator in weights:
            if isinstance(value, dict):
                # Handle nested dictionaries
                avg_value = sum(value.values()) / len(value) if value else 0
                score += weights[indicator] * avg_value
            else:
                score += weights[indicator] * value
    
    return max(0.0, min(1.0, score))


async def _perform_behavioral_analysis(content: str, metadata: dict) -> dict:
    """Perform behavioral analysis for video/audio content."""
    # Simulate behavioral analysis
    return {
        "response_latency": metadata.get("response_times", []),
        "speech_patterns": {
            "pace_variations": 0.3,
            "volume_changes": 0.2,
            "pause_frequency": 0.4
        },
        "behavioral_inconsistencies": ["Fidgeting during key statements", "Avoiding eye contact"],
        "stress_indicators": 0.6
    }


async def _perform_facial_expression_analysis(content: str) -> dict:
    """Analyze facial expressions for deception indicators."""
    # Simulate facial expression analysis
    return {
        "micro_expressions": ["Brief fear expression", "Concealed disgust"],
        "eye_movement_patterns": {
            "gaze_aversion": 0.4,
            "blink_rate": "elevated",
            "pupil_dilation": "consistent with stress"
        },
        "facial_tension": 0.7,
        "expression_authenticity": 0.3
    }


async def _perform_audio_stress_analysis(content: str) -> dict:
    """Analyze audio for stress and deception indicators."""
    # Simulate audio stress analysis
    return {
        "voice_stress_level": 0.6,
        "pitch_variations": 0.4,
        "speech_rate_changes": 0.3,
        "vocal_tremor": "mild",
        "background_noise": "minimal",
        "audio_authenticity": 0.8
    }


def _extract_deception_indicators(analysis_results: dict) -> list[dict]:
    """Extract deception indicators from analysis results."""
    indicators = []
    
    # Process text analysis
    if "text_analysis" in analysis_results:
        text_data = analysis_results["text_analysis"]
        if text_data.get("deception_score", 0) > 0.6:
            indicators.append({
                "type": "linguistic",
                "severity": "high",
                "description": "High linguistic deception indicators",
                "confidence": 0.8
            })
    
    # Process behavioral analysis
    if "behavioral_analysis" in analysis_results:
        behavioral_data = analysis_results["behavioral_analysis"]
        if behavioral_data.get("stress_indicators", 0) > 0.7:
            indicators.append({
                "type": "behavioral",
                "severity": "medium",
                "description": "Elevated stress indicators",
                "confidence": 0.7
            })
    
    return indicators


def _calculate_deception_probability(indicators: list[dict]) -> float:
    """Calculate overall deception probability from indicators."""
    if not indicators:
        return 0.3  # Default neutral probability
    
    total_weight = 0
    weighted_sum = 0
    
    for indicator in indicators:
        confidence = indicator.get("confidence", 0.5)
        severity_weights = {"high": 1.0, "medium": 0.7, "low": 0.4}
        severity_weight = severity_weights.get(indicator.get("severity", "medium"), 0.7)
        
        weight = confidence * severity_weight
        total_weight += weight
        weighted_sum += weight * 0.8  # Assume each indicator contributes to deception
    
    return min(0.95, weighted_sum / max(total_weight, 1))


def _calculate_confidence_level(analysis_results: dict) -> float:
    """Calculate confidence level of the analysis."""
    # Base confidence on amount and quality of analysis performed
    analysis_types = len([k for k, v in analysis_results.items() if v])
    max_analysis_types = 4  # text, behavioral, facial, audio
    
    base_confidence = analysis_types / max_analysis_types
    return min(0.95, base_confidence * 0.9)  # Cap at 95%


def _classify_risk_level(probability: float) -> str:
    """Classify risk level based on deception probability."""
    if probability >= 0.8:
        return "Critical"
    elif probability >= 0.6:
        return "High"
    elif probability >= 0.4:
        return "Medium"
    elif probability >= 0.2:
        return "Low"
    else:
        return "Minimal"


def _identify_primary_concerns(indicators: list[dict]) -> list[str]:
    """Identify primary concerns from deception indicators."""
    concerns = []
    
    high_severity_indicators = [i for i in indicators if i.get("severity") == "high"]
    if high_severity_indicators:
        concerns.append("Multiple high-severity deception indicators detected")
    
    behavioral_indicators = [i for i in indicators if i.get("type") == "behavioral"]
    if len(behavioral_indicators) > 2:
        concerns.append("Significant behavioral inconsistencies observed")
    
    linguistic_indicators = [i for i in indicators if i.get("type") == "linguistic"]
    if linguistic_indicators:
        concerns.append("Linguistic patterns suggest potential deception")
    
    return concerns if concerns else ["No significant concerns identified"]


def _generate_multi_modal_recommendations(probability: float, content_type: str) -> list[str]:
    """Generate recommendations based on multi-modal analysis."""
    recommendations = []
    
    if probability > 0.7:
        recommendations.extend([
            "High deception probability - comprehensive verification required",
            "Consider content potentially deceptive or manipulated",
            "Seek independent corroboration from multiple sources"
        ])
    elif probability > 0.4:
        recommendations.extend([
            "Moderate deception indicators - enhanced verification recommended",
            "Focus on specific areas of concern identified in analysis",
            "Consider additional verification methods"
        ])
    else:
        recommendations.extend([
            "Low deception probability - standard verification procedures",
            "Monitor for any changes or inconsistencies",
            "Document analysis for future reference"
        ])
    
    # Content-specific recommendations
    if content_type in ["video", "audio"]:
        recommendations.append("Consider technical authentication of media files")
    
    if content_type == "text":
        recommendations.append("Verify key factual claims through independent sources")
    
    return recommendations


def _extract_timeline_inconsistencies(analysis_content: str) -> list[dict]:
    """Extract timeline inconsistencies from AI analysis."""
    # Simulate extraction of inconsistencies
    return [
        {
            "id": 1,
            "description": "Claims to be at two different locations at same time",
            "severity": "critical",
            "evidence": "Statement A says downtown at 3pm, Statement B says airport at 3pm",
            "deception_probability": 0.9
        },
        {
            "id": 2,
            "description": "Timeline gap of 2 hours unexplained",
            "severity": "moderate",
            "evidence": "No account of activities between 2pm and 4pm",
            "deception_probability": 0.6
        }
    ]


def _calculate_timeline_consistency_score(inconsistencies: list[dict]) -> float:
    """Calculate timeline consistency score."""
    if not inconsistencies:
        return 0.95
    
    critical_count = len([i for i in inconsistencies if i.get("severity") == "critical"])
    moderate_count = len([i for i in inconsistencies if i.get("severity") == "moderate"])
    minor_count = len([i for i in inconsistencies if i.get("severity") == "minor"])
    
    # Weight different severity levels
    penalty = (critical_count * 0.3) + (moderate_count * 0.2) + (minor_count * 0.1)
    
    return max(0.0, 1.0 - penalty)


def _generate_timeline_visualization(statements: list, timeline_data: dict) -> dict:
    """Generate timeline visualization data."""
    return {
        "timeline_events": [
            {"time": "14:00", "event": "Left office", "source": "Statement 1"},
            {"time": "15:30", "event": "Arrived at meeting", "source": "Statement 2"},
            {"time": "16:00", "event": "CONFLICT: Two different locations claimed", "source": "Analysis"}
        ],
        "visualization_type": "timeline_chart",
        "inconsistency_markers": [{"time": "16:00", "type": "conflict", "severity": "critical"}]
    }


def _assess_timeline_reliability(inconsistencies: list[dict]) -> str:
    """Assess overall timeline reliability."""
    critical_issues = len([i for i in inconsistencies if i.get("severity") == "critical"])
    
    if critical_issues > 2:
        return "Very Low"
    elif critical_issues > 0:
        return "Low"
    elif len(inconsistencies) > 3:
        return "Moderate"
    else:
        return "High"


def _calculate_intentional_deception_probability(inconsistencies: list[dict]) -> float:
    """Calculate probability of intentional deception vs memory error."""
    if not inconsistencies:
        return 0.1
    
    critical_issues = [i for i in inconsistencies if i.get("severity") == "critical"]
    high_probability_issues = [i for i in critical_issues if i.get("deception_probability", 0) > 0.8]
    
    return min(0.95, len(high_probability_issues) * 0.3 + 0.2)


def _suggest_alternative_explanations(inconsistencies: list[dict]) -> list[str]:
    """Suggest alternative explanations for inconsistencies."""
    explanations = [
        "Memory errors due to stress or time elapsed",
        "Confusion about specific times or locations",
        "Misunderstanding of questions or context",
        "Multiple similar events causing confusion"
    ]
    
    critical_count = len([i for i in inconsistencies if i.get("severity") == "critical"])
    if critical_count > 2:
        explanations.append("Pattern suggests possible intentional deception")
    
    return explanations


async def _verify_factual_claim(claim: str, trusted_sources: list) -> dict:
    """Verify a factual claim against trusted sources."""
    # Simulate fact verification (would integrate with fact-checking APIs in production)
    verification_status = "verified"  # verified, false, unverifiable
    confidence = 0.8
    
    # Simple simulation based on claim characteristics
    if "impossible" in claim.lower() or "never" in claim.lower():
        verification_status = "false"
        confidence = 0.9
    elif len(claim.split()) < 5:
        verification_status = "unverifiable"
        confidence = 0.6
    
    return {
        "status": verification_status,
        "confidence": confidence,
        "sources": trusted_sources[:2],  # Simulate sources used
        "contradictions": [] if verification_status == "verified" else ["Conflicts with known facts"],
        "notes": f"Verification attempted using {len(trusted_sources)} sources"
    }


def _calculate_credibility_score(verification_results: list[dict]) -> float:
    """Calculate overall credibility score from verification results."""
    if not verification_results:
        return 0.5
    
    verified_count = len([r for r in verification_results if r["verification_status"] == "verified"])
    false_count = len([r for r in verification_results if r["verification_status"] == "false"])
    total_count = len(verification_results)
    
    # Score based on verification rate and false claim rate
    verification_rate = verified_count / total_count
    false_rate = false_count / total_count
    
    return max(0.0, verification_rate - (false_rate * 2))  # False claims heavily penalized


def _assess_deception_likelihood(verification_results: list[dict]) -> str:
    """Assess likelihood of intentional deception."""
    false_count = len([r for r in verification_results if r["verification_status"] == "false"])
    total_count = len(verification_results)
    false_rate = false_count / max(total_count, 1)
    
    if false_rate > 0.5:
        return "High"
    elif false_rate > 0.3:
        return "Moderate" 
    elif false_rate > 0.1:
        return "Low"
    else:
        return "Minimal"


def _assess_information_quality(verification_results: list[dict]) -> str:
    """Assess overall information quality."""
    verified_count = len([r for r in verification_results if r["verification_status"] == "verified"])
    total_count = len(verification_results)
    verification_rate = verified_count / max(total_count, 1)
    
    if verification_rate > 0.8:
        return "High Quality"
    elif verification_rate > 0.6:
        return "Good Quality"
    elif verification_rate > 0.4:
        return "Moderate Quality"
    else:
        return "Poor Quality"


def _assess_source_reliability(verification_results: list[dict]) -> float:
    """Assess source reliability based on verification patterns."""
    # Simulate source reliability assessment
    avg_confidence = sum(r["confidence_score"] for r in verification_results) / max(len(verification_results), 1)
    return avg_confidence


def _identify_verification_red_flags(verification_results: list[dict]) -> list[str]:
    """Identify red flags from verification results."""
    red_flags = []
    
    false_count = len([r for r in verification_results if r["verification_status"] == "false"])
    if false_count > 2:
        red_flags.append("Multiple false claims detected")
    
    unverifiable_count = len([r for r in verification_results if r["verification_status"] == "unverifiable"])
    total_count = len(verification_results)
    
    if unverifiable_count / max(total_count, 1) > 0.5:
        red_flags.append("High proportion of unverifiable claims")
    
    # Check for mixing of true and false claims (disinformation technique)
    verified_count = len([r for r in verification_results if r["verification_status"] == "verified"])
    if verified_count > 0 and false_count > 0:
        red_flags.append("Mixing of true and false information suggests possible disinformation")
    
    return red_flags if red_flags else ["No significant red flags identified"]


async def _analyze_content_metadata(metadata: dict, content_type: str) -> dict:
    """Analyze content metadata for authenticity indicators."""
    return {
        "creation_timestamp": metadata.get("created", "unknown"),
        "modification_history": metadata.get("modified", []),
        "device_information": metadata.get("device", "unknown"),
        "software_signatures": metadata.get("software", []),
        "integrity_score": 0.8,  # Simulate metadata integrity assessment
        "tampering_indicators": []
    }


async def _detect_content_manipulation(content_url: str, content_type: str) -> dict:
    """Detect content manipulation using technical analysis."""
    return {
        "compression_artifacts": "normal",
        "pixel_analysis": "consistent",
        "noise_patterns": "uniform",
        "edge_detection": "natural",
        "manipulation_probability": 0.2,
        "integrity_score": 0.8,
        "technical_indicators": []
    }


async def _trace_content_source(content_url: str, metadata: dict) -> dict:
    """Trace content source and verify origin."""
    return {
        "origin_domain": "example.com",
        "creation_source": "camera_device",
        "distribution_path": ["original_device", "cloud_storage", "current_location"],
        "authenticity_score": 0.7,
        "verification_status": "partially_verified",
        "source_credibility": 0.8
    }


async def _verify_content_timestamp(metadata: dict) -> dict:
    """Verify content timestamp authenticity."""
    return {
        "timestamp_format": "ISO8601",
        "timezone_consistency": True,
        "temporal_accuracy": 0.9,
        "consistency_score": 0.8,
        "verification_method": "metadata_analysis",
        "anomalies_detected": []
    }


def _calculate_authenticity_score(analysis: dict) -> float:
    """Calculate overall authenticity score."""
    scores = []
    
    if "metadata_analysis" in analysis:
        scores.append(analysis["metadata_analysis"].get("integrity_score", 0.5))
    
    if "manipulation_detection" in analysis:
        scores.append(analysis["manipulation_detection"].get("integrity_score", 0.5))
    
    if "source_tracing" in analysis:
        scores.append(analysis["source_tracing"].get("authenticity_score", 0.5))
    
    if "timestamp_verification" in analysis:
        scores.append(analysis["timestamp_verification"].get("consistency_score", 0.5))
    
    return sum(scores) / max(len(scores), 1)


def _calculate_manipulation_probability(analysis: dict) -> float:
    """Calculate probability of content manipulation."""
    manipulation_indicators = 0
    total_indicators = 0
    
    if "manipulation_detection" in analysis:
        manipulation_prob = analysis["manipulation_detection"].get("manipulation_probability", 0)
        manipulation_indicators += manipulation_prob
        total_indicators += 1
    
    if "metadata_analysis" in analysis:
        tampering = len(analysis["metadata_analysis"].get("tampering_indicators", []))
        if tampering > 0:
            manipulation_indicators += min(tampering * 0.2, 1.0)
        total_indicators += 1
    
    return manipulation_indicators / max(total_indicators, 1)


def _calculate_forensics_confidence(analysis: dict) -> float:
    """Calculate confidence level of forensics analysis."""
    # Base confidence on completeness of analysis
    analysis_completeness = len([k for k, v in analysis.items() if v])
    max_completeness = 4  # metadata, manipulation, source, timestamp
    
    return (analysis_completeness / max_completeness) * 0.9


def _determine_integrity_status(authenticity_score: float) -> str:
    """Determine overall integrity status."""
    if authenticity_score >= 0.8:
        return "High Integrity"
    elif authenticity_score >= 0.6:
        return "Moderate Integrity"
    elif authenticity_score >= 0.4:
        return "Low Integrity"
    else:
        return "Questionable Integrity"


def _generate_forensics_recommendations(authenticity_score: float, manipulation_probability: float) -> list[str]:
    """Generate recommendations based on forensics analysis."""
    recommendations = []
    
    if manipulation_probability > 0.7:
        recommendations.extend([
            "High manipulation probability - treat content as potentially altered",
            "Conduct detailed technical analysis with specialized tools",
            "Seek original source for comparison"
        ])
    elif manipulation_probability > 0.4:
        recommendations.extend([
            "Moderate manipulation indicators - additional verification recommended",
            "Cross-reference with other sources",
            "Consider technical authentication methods"
        ])
    else:
        recommendations.extend([
            "Low manipulation probability - content appears authentic",
            "Standard verification procedures sufficient",
            "Document analysis for chain of custody"
        ])
    
    if authenticity_score < 0.5:
        recommendations.append("Low authenticity score - exercise extreme caution")
    
    return recommendations
