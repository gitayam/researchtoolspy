"""
Analysis of Competing Hypotheses (ACH) API endpoints.
Structured analytical technique for intelligence analysis.
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


class Hypothesis(BaseModel):
    """Hypothesis model for ACH analysis."""
    id: str
    description: str
    probability: Optional[float] = 0.5  # 0-1 scale
    notes: Optional[str] = None


class Evidence(BaseModel):
    """Evidence model for ACH analysis."""
    id: str
    description: str
    credibility: Optional[float] = 0.5  # 0-1 scale
    relevance: Optional[float] = 0.5  # 0-1 scale
    source: Optional[str] = None
    date: Optional[str] = None


class EvidenceAssessment(BaseModel):
    """Assessment of evidence against a hypothesis."""
    evidence_id: str
    hypothesis_id: str
    consistency: str  # "consistent", "inconsistent", "neutral", "not_applicable"
    weight: Optional[float] = 0.5  # 0-1 scale for importance
    notes: Optional[str] = None


class ACHCreateRequest(BaseModel):
    """ACH analysis creation request."""
    title: str
    scenario: str
    key_question: str
    initial_hypotheses: Optional[List[Hypothesis]] = []
    initial_evidence: Optional[List[Evidence]] = []
    request_ai_analysis: bool = True


class ACHUpdateRequest(BaseModel):
    """ACH analysis update request."""
    title: Optional[str] = None
    scenario: Optional[str] = None
    key_question: Optional[str] = None
    hypotheses: Optional[List[Hypothesis]] = None
    evidence: Optional[List[Evidence]] = None
    assessments: Optional[List[EvidenceAssessment]] = None


class ACHAnalysisResponse(BaseModel):
    """ACH analysis response."""
    session_id: int
    title: str
    scenario: str
    key_question: str
    hypotheses: List[Hypothesis]
    evidence: List[Evidence]
    assessments: List[EvidenceAssessment]
    matrix: Optional[Dict] = None
    ai_analysis: Optional[Dict] = None
    status: str
    version: int


@router.post("/", response_model=ACHAnalysisResponse)
async def create_ach_analysis_simple(
    request: ACHCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ACHAnalysisResponse:
    """Create ACH analysis (standard endpoint)."""
    return await create_ach_analysis(request, current_user, db)


@router.post("/create", response_model=ACHAnalysisResponse)
async def create_ach_analysis(
    request: ACHCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ACHAnalysisResponse:
    """
    Create a new ACH analysis session.
    
    Args:
        request: ACH creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ACHAnalysisResponse: Created ACH analysis
    """
    logger.info(f"Creating ACH analysis: {request.title} for user {current_user.username}")
    
    # Prepare ACH data
    ach_data = {
        "scenario": request.scenario,
        "key_question": request.key_question,
        "hypotheses": [h.dict() for h in request.initial_hypotheses] if request.initial_hypotheses else [],
        "evidence": [e.dict() for e in request.initial_evidence] if request.initial_evidence else [],
        "assessments": [],
    }
    
    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis and request.key_question:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.ACH,
                ach_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")
            
            # Add AI-suggested hypotheses and evidence
            if ai_analysis:
                if "hypotheses" in ai_analysis and isinstance(ai_analysis["hypotheses"], list):
                    for idx, hyp in enumerate(ai_analysis["hypotheses"]):
                        ach_data["hypotheses"].append({
                            "id": f"h_ai_{idx}",
                            "description": hyp,
                            "probability": 0.5,
                            "notes": "AI-generated hypothesis"
                        })
                
                if "evidence" in ai_analysis and isinstance(ai_analysis["evidence"], list):
                    for idx, ev in enumerate(ai_analysis["evidence"]):
                        ach_data["evidence"].append({
                            "id": f"e_ai_{idx}",
                            "description": ev,
                            "credibility": 0.5,
                            "relevance": 0.5,
                            "source": "AI suggestion"
                        })
                        
        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")
    
    # Create initial assessment matrix
    for hypothesis in ach_data["hypotheses"]:
        for evidence in ach_data["evidence"]:
            ach_data["assessments"].append({
                "evidence_id": evidence["id"],
                "hypothesis_id": hypothesis["id"],
                "consistency": "neutral",
                "weight": 0.5,
                "notes": ""
            })
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.ACH,
        title=request.title,
        description=f"ACH Analysis - {request.key_question}",
        data=ach_data,
        tags=["ach", "hypothesis-testing", "structured-analysis"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    # Generate matrix
    matrix = _generate_ach_matrix(ach_data["hypotheses"], ach_data["evidence"], ach_data["assessments"])
    
    return ACHAnalysisResponse(
        session_id=session.id,
        title=session.title,
        scenario=ach_data["scenario"],
        key_question=ach_data["key_question"],
        hypotheses=[Hypothesis(**h) for h in ach_data["hypotheses"]],
        evidence=[Evidence(**e) for e in ach_data["evidence"]],
        assessments=[EvidenceAssessment(**a) for a in ach_data["assessments"]],
        matrix=matrix,
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=ACHAnalysisResponse)
async def get_ach_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ACHAnalysisResponse:
    """
    Get a specific ACH analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ACHAnalysisResponse: ACH analysis data
    """
    logger.info(f"Getting ACH analysis {session_id}")
    
    # Mock data for demonstration
    hypotheses = [
        Hypothesis(
            id="h1",
            description="State-sponsored cyber attack",
            probability=0.7,
            notes="Multiple indicators point to APT group"
        ),
        Hypothesis(
            id="h2",
            description="Criminal ransomware operation",
            probability=0.5,
            notes="Financial motivation apparent"
        ),
        Hypothesis(
            id="h3",
            description="Insider threat",
            probability=0.3,
            notes="Less likely but cannot be ruled out"
        ),
    ]
    
    evidence = [
        Evidence(
            id="e1",
            description="Advanced persistent techniques observed",
            credibility=0.9,
            relevance=0.8,
            source="Network logs",
            date="2025-08-15"
        ),
        Evidence(
            id="e2",
            description="Ransom note discovered",
            credibility=0.7,
            relevance=0.9,
            source="Incident response team",
            date="2025-08-16"
        ),
        Evidence(
            id="e3",
            description="Attack occurred during business hours",
            credibility=1.0,
            relevance=0.6,
            source="SIEM data",
            date="2025-08-15"
        ),
    ]
    
    assessments = [
        EvidenceAssessment(evidence_id="e1", hypothesis_id="h1", consistency="consistent", weight=0.8),
        EvidenceAssessment(evidence_id="e1", hypothesis_id="h2", consistency="neutral", weight=0.5),
        EvidenceAssessment(evidence_id="e1", hypothesis_id="h3", consistency="inconsistent", weight=0.7),
        EvidenceAssessment(evidence_id="e2", hypothesis_id="h1", consistency="inconsistent", weight=0.6),
        EvidenceAssessment(evidence_id="e2", hypothesis_id="h2", consistency="consistent", weight=0.9),
        EvidenceAssessment(evidence_id="e2", hypothesis_id="h3", consistency="neutral", weight=0.4),
        EvidenceAssessment(evidence_id="e3", hypothesis_id="h1", consistency="neutral", weight=0.3),
        EvidenceAssessment(evidence_id="e3", hypothesis_id="h2", consistency="neutral", weight=0.3),
        EvidenceAssessment(evidence_id="e3", hypothesis_id="h3", consistency="consistent", weight=0.6),
    ]
    
    matrix = _generate_ach_matrix(hypotheses, evidence, assessments)
    
    return ACHAnalysisResponse(
        session_id=session_id,
        title="Cyber Incident Attribution Analysis",
        scenario="Major cyber incident affecting critical infrastructure",
        key_question="Who is responsible for the cyber attack?",
        hypotheses=hypotheses,
        evidence=evidence,
        assessments=assessments,
        matrix=matrix,
        status="in_progress",
        version=1
    )


@router.put("/{session_id}", response_model=ACHAnalysisResponse)
async def update_ach_analysis(
    session_id: int,
    request: ACHUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ACHAnalysisResponse:
    """
    Update an existing ACH analysis session.
    
    Args:
        session_id: Session ID
        request: ACH update request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ACHAnalysisResponse: Updated ACH analysis
    """
    logger.info(f"Updating ACH analysis {session_id}")
    
    # TODO: Implement actual database update
    # For now, return mock updated data
    
    # Get current session (mock)
    current_analysis = await get_ach_analysis(session_id, current_user, db)
    
    # Update fields
    updated_title = request.title or current_analysis.title
    updated_scenario = request.scenario or current_analysis.scenario
    updated_key_question = request.key_question or current_analysis.key_question
    updated_hypotheses = request.hypotheses or current_analysis.hypotheses
    updated_evidence = request.evidence or current_analysis.evidence
    updated_assessments = request.assessments or current_analysis.assessments
    
    # Generate updated matrix
    matrix = _generate_ach_matrix(updated_hypotheses, updated_evidence, updated_assessments)
    
    return ACHAnalysisResponse(
        session_id=session_id,
        title=updated_title,
        scenario=updated_scenario,
        key_question=updated_key_question,
        hypotheses=updated_hypotheses,
        evidence=updated_evidence,
        assessments=updated_assessments,
        matrix=matrix,
        status="in_progress",
        version=current_analysis.version + 1
    )


@router.post("/{session_id}/hypothesis")
async def add_hypothesis(
    session_id: int,
    hypothesis: Hypothesis,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add a hypothesis to ACH analysis.
    
    Args:
        session_id: Session ID
        hypothesis: Hypothesis data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Adding hypothesis to ACH {session_id}: {hypothesis.description}")
    
    return {
        "message": "Hypothesis added successfully",
        "hypothesis": hypothesis.dict(),
        "session_id": session_id
    }


@router.post("/{session_id}/evidence")
async def add_evidence(
    session_id: int,
    evidence: Evidence,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add evidence to ACH analysis.
    
    Args:
        session_id: Session ID
        evidence: Evidence data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Adding evidence to ACH {session_id}: {evidence.description}")
    
    return {
        "message": "Evidence added successfully",
        "evidence": evidence.dict(),
        "session_id": session_id
    }


@router.put("/{session_id}/assessment")
async def update_assessment(
    session_id: int,
    assessment: EvidenceAssessment,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update evidence-hypothesis assessment.
    
    Args:
        session_id: Session ID
        assessment: Assessment data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(
        f"Updating assessment in ACH {session_id}: "
        f"E{assessment.evidence_id} vs H{assessment.hypothesis_id} = {assessment.consistency}"
    )
    
    return {
        "message": "Assessment updated successfully",
        "assessment": assessment.dict(),
        "session_id": session_id
    }


@router.get("/{session_id}/matrix")
async def get_ach_matrix(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get the ACH matrix visualization data.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Matrix data for visualization
    """
    logger.info(f"Getting ACH matrix for session {session_id}")
    
    # TODO: Get actual data from database
    # For now, return mock matrix
    hypotheses = [
        {"id": "h1", "description": "State-sponsored", "score": 7.2},
        {"id": "h2", "description": "Criminal group", "score": 5.8},
        {"id": "h3", "description": "Insider threat", "score": 3.1},
    ]
    
    evidence = [
        {"id": "e1", "description": "Advanced techniques"},
        {"id": "e2", "description": "Ransom note"},
        {"id": "e3", "description": "Timing of attack"},
    ]
    
    return {
        "session_id": session_id,
        "hypotheses": hypotheses,
        "evidence": evidence,
        "matrix": [
            ["", "H1: State", "H2: Criminal", "H3: Insider"],
            ["E1: Techniques", "++", "0", "--"],
            ["E2: Ransom", "--", "++", "0"],
            ["E3: Timing", "0", "0", "+"],
        ],
        "legend": {
            "++": "Strongly Consistent",
            "+": "Consistent",
            "0": "Neutral",
            "-": "Inconsistent",
            "--": "Strongly Inconsistent",
            "NA": "Not Applicable"
        }
    }


@router.post("/{session_id}/calculate-probabilities")
async def calculate_probabilities(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Calculate hypothesis probabilities based on evidence assessments.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Updated probabilities
    """
    logger.info(f"Calculating probabilities for ACH {session_id}")
    
    # TODO: Implement Bayesian or weighted scoring algorithm
    # For now, return mock calculations
    
    probabilities = {
        "h1": {
            "hypothesis": "State-sponsored cyber attack",
            "initial_probability": 0.5,
            "updated_probability": 0.72,
            "confidence": 0.8,
            "supporting_evidence": 2,
            "contradicting_evidence": 1
        },
        "h2": {
            "hypothesis": "Criminal ransomware operation",
            "initial_probability": 0.5,
            "updated_probability": 0.58,
            "confidence": 0.7,
            "supporting_evidence": 1,
            "contradicting_evidence": 1
        },
        "h3": {
            "hypothesis": "Insider threat",
            "initial_probability": 0.5,
            "updated_probability": 0.31,
            "confidence": 0.6,
            "supporting_evidence": 1,
            "contradicting_evidence": 2
        }
    }
    
    return {
        "session_id": session_id,
        "probabilities": probabilities,
        "methodology": "Weighted evidence scoring",
        "timestamp": "2025-08-16T00:00:00Z"
    }


def _generate_ach_matrix(
    hypotheses: List,
    evidence: List,
    assessments: List
) -> Dict:
    """
    Generate ACH matrix from hypotheses, evidence, and assessments.
    
    Args:
        hypotheses: List of hypotheses
        evidence: List of evidence
        assessments: List of assessments
        
    Returns:
        dict: Matrix structure
    """
    matrix = {
        "headers": ["Evidence"] + [h.description if hasattr(h, 'description') else h["description"] 
                                   for h in hypotheses],
        "rows": []
    }
    
    for ev in evidence:
        ev_id = ev.id if hasattr(ev, 'id') else ev["id"]
        ev_desc = ev.description if hasattr(ev, 'description') else ev["description"]
        row = [ev_desc]
        
        for hyp in hypotheses:
            hyp_id = hyp.id if hasattr(hyp, 'id') else hyp["id"]
            
            # Find assessment for this evidence-hypothesis pair
            assessment = next(
                (a for a in assessments 
                 if (a.evidence_id if hasattr(a, 'evidence_id') else a["evidence_id"]) == ev_id and
                    (a.hypothesis_id if hasattr(a, 'hypothesis_id') else a["hypothesis_id"]) == hyp_id),
                None
            )
            
            if assessment:
                consistency = assessment.consistency if hasattr(assessment, 'consistency') else assessment["consistency"]
                symbol_map = {
                    "consistent": "+",
                    "strongly_consistent": "++",
                    "inconsistent": "-",
                    "strongly_inconsistent": "--",
                    "neutral": "0",
                    "not_applicable": "NA"
                }
                row.append(symbol_map.get(consistency, "0"))
            else:
                row.append("0")
        
        matrix["rows"].append(row)
    
    return matrix


@router.get("/templates/list")
async def list_ach_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available ACH analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Attribution Analysis",
            "description": "Template for attributing actions to actors",
            "sample_hypotheses": [
                "State-sponsored actor",
                "Criminal organization",
                "Hacktivist group",
                "Insider threat"
            ],
            "evidence_categories": [
                "Technical indicators",
                "Behavioral patterns",
                "Motivations",
                "Capabilities"
            ]
        },
        {
            "id": 2,
            "name": "Threat Assessment",
            "description": "Template for assessing potential threats",
            "sample_hypotheses": [
                "Imminent threat",
                "Developing threat",
                "Low probability threat",
                "No credible threat"
            ],
            "evidence_categories": [
                "Intelligence reports",
                "Open source information",
                "Technical indicators",
                "Historical patterns"
            ]
        },
        {
            "id": 3,
            "name": "Intent Analysis",
            "description": "Template for analyzing adversary intent",
            "sample_hypotheses": [
                "Espionage",
                "Sabotage",
                "Financial gain",
                "Political influence"
            ],
            "evidence_categories": [
                "Target selection",
                "Methods used",
                "Timing",
                "Communications"
            ]
        }
    ]
    
    return templates