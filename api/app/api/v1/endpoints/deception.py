"""
Deception Detection Framework API endpoints.
Information reliability and veracity assessment for intelligence analysis.
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


class DeceptionIndicator(BaseModel):
    """Individual deception indicator."""
    id: str
    category: str  # linguistic, behavioral, contextual, logical
    indicator_type: str
    description: str
    severity: str  # high, medium, low
    confidence: float  # 0-1 scale
    evidence: Optional[str] = None
    notes: Optional[str] = None


class ContentAnalysis(BaseModel):
    """Content analysis for deception detection."""
    content_type: str  # text, speech, document, communication
    source: str
    timestamp: Optional[str] = None
    content: str
    metadata: Optional[Dict] = {}


class DeceptionCreateRequest(BaseModel):
    """Deception detection analysis creation request."""
    title: str
    content_to_analyze: ContentAnalysis
    analysis_type: str = "comprehensive"  # comprehensive, linguistic, behavioral, contextual
    context: Optional[str] = None
    known_facts: Optional[List[str]] = []
    request_ai_analysis: bool = True


class DeceptionUpdateRequest(BaseModel):
    """Deception detection analysis update request."""
    title: Optional[str] = None
    indicators: Optional[List[DeceptionIndicator]] = None
    additional_context: Optional[str] = None
    verified_facts: Optional[List[str]] = None


class DeceptionAnalysisResponse(BaseModel):
    """Deception detection analysis response."""
    session_id: int
    title: str
    content_analyzed: ContentAnalysis
    indicators: List[DeceptionIndicator]
    overall_assessment: Dict
    reliability_score: float  # 0-1 scale
    deception_probability: float  # 0-1 scale
    ai_analysis: Optional[Dict] = None
    recommendations: List[str]
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
    
    # Mock data for demonstration
    content = ContentAnalysis(
        content_type="text",
        source="Intelligence report",
        timestamp="2025-08-15T12:00:00Z",
        content="Subject claims to have insider knowledge of planned operations...",
        metadata={"length": 500, "language": "en"}
    )
    
    indicators = [
        DeceptionIndicator(
            id="ind1",
            category="linguistic",
            indicator_type="Lack of specific details",
            description="Vague descriptions without concrete specifics",
            severity="medium",
            confidence=0.75,
            evidence="Multiple instances of generalization",
            notes="Common deception pattern"
        ),
        DeceptionIndicator(
            id="ind2",
            category="behavioral",
            indicator_type="Inconsistent timeline",
            description="Events described don't align with known timeline",
            severity="high",
            confidence=0.85,
            evidence="Date discrepancies identified",
            notes="Significant reliability concern"
        ),
        DeceptionIndicator(
            id="ind3",
            category="contextual",
            indicator_type="Unverifiable claims",
            description="Key claims cannot be independently verified",
            severity="medium",
            confidence=0.7,
            evidence="No corroborating sources found",
            notes="Requires further investigation"
        )
    ]
    
    overall_assessment = {
        "summary": "Moderate to high likelihood of deception detected",
        "key_concerns": [
            "Timeline inconsistencies",
            "Lack of specific details",
            "Unverifiable claims"
        ],
        "reliability_assessment": "Low to moderate reliability",
        "recommended_action": "Seek corroboration before acting on information"
    }
    
    recommendations = [
        "Verify timeline through independent sources",
        "Request specific details and documentation",
        "Cross-reference with known reliable sources",
        "Consider source motivation and potential biases",
        "Apply additional verification methods"
    ]
    
    return DeceptionAnalysisResponse(
        session_id=session_id,
        title="Intelligence Report Veracity Assessment",
        content_analyzed=content,
        indicators=indicators,
        overall_assessment=overall_assessment,
        reliability_score=0.4,
        deception_probability=0.7,
        recommendations=recommendations,
        status="completed",
        version=1
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
    category: Optional[str] = None,
    severity: Optional[str] = None,
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


def _generate_recommendations(deception_prob: float, reliability: float) -> List[str]:
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


def _generate_reliability_recommendations(score: float) -> List[str]:
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