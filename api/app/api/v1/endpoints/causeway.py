"""
CauseWay API endpoints.
Issue-focused causal analysis framework for understanding root causes and effects.
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


class CauseNode(BaseModel):
    """Individual cause node in the causal chain."""
    id: str
    description: str
    type: str  # root_cause, contributing_cause, immediate_cause, effect, consequence
    evidence: Optional[List[str]] = []
    confidence: Optional[float] = 0.5  # 0-1 scale
    impact_level: Optional[str] = "medium"  # low, medium, high, critical
    likelihood: Optional[float] = 0.5  # 0-1 scale
    timeframe: Optional[str] = None
    status: str = "identified"  # identified, validated, disproven, uncertain
    mitigation_actions: Optional[List[str]] = []


class CausalRelationship(BaseModel):
    """Relationship between cause nodes."""
    id: str
    source_id: str  # Causing node
    target_id: str  # Effect node
    relationship_type: str  # direct_cause, contributing_factor, catalyst, necessary_condition
    strength: Optional[float] = 0.5  # 0-1 scale
    evidence: Optional[List[str]] = []
    confidence: Optional[float] = 0.5  # 0-1 scale
    description: Optional[str] = None


class CausewayCreateRequest(BaseModel):
    """CauseWay analysis creation request."""
    title: str
    central_issue: str
    problem_statement: str
    context: Optional[str] = None
    initial_causes: Optional[List[CauseNode]] = []
    initial_relationships: Optional[List[CausalRelationship]] = []
    request_ai_analysis: bool = True


class CausewayUpdateRequest(BaseModel):
    """CauseWay analysis update request."""
    title: Optional[str] = None
    central_issue: Optional[str] = None
    problem_statement: Optional[str] = None
    context: Optional[str] = None
    causes: Optional[List[CauseNode]] = None
    relationships: Optional[List[CausalRelationship]] = None


class CausewayAnalysisResponse(BaseModel):
    """CauseWay analysis response."""
    session_id: int
    title: str
    central_issue: str
    problem_statement: str
    context: Optional[str]
    causes: List[CauseNode]
    relationships: List[CausalRelationship]
    causal_chains: Optional[List[List[str]]] = []
    risk_assessment: Optional[Dict] = None
    ai_analysis: Optional[Dict] = None
    status: str
    version: int


class RootCauseAnalysisRequest(BaseModel):
    """Request for root cause analysis."""
    focus_area: Optional[str] = None
    analysis_depth: int = 3  # Number of "why" levels to explore
    include_external_factors: bool = True


@router.post("/create", response_model=CausewayAnalysisResponse)
async def create_causeway_analysis(
    request: CausewayCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CausewayAnalysisResponse:
    """
    Create a new CauseWay analysis session.
    
    Args:
        request: CauseWay creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        CausewayAnalysisResponse: Created CauseWay analysis
    """
    logger.info(f"Creating CauseWay analysis: {request.title} for user {current_user.username}")
    
    # Prepare CauseWay data
    causeway_data = {
        "central_issue": request.central_issue,
        "problem_statement": request.problem_statement,
        "context": request.context or "",
        "causes": [c.dict() for c in request.initial_causes] if request.initial_causes else [],
        "relationships": [r.dict() for r in request.initial_relationships] if request.initial_relationships else [],
    }
    
    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.CAUSEWAY,
                causeway_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")
            
            # Add AI-suggested causes and relationships
            if ai_analysis:
                if "causes" in ai_analysis and isinstance(ai_analysis["causes"], list):
                    for idx, cause_data in enumerate(ai_analysis["causes"]):
                        if isinstance(cause_data, dict):
                            cause_id = f"ai_cause_{idx}"
                            causeway_data["causes"].append({
                                "id": cause_id,
                                "description": cause_data.get("description", ""),
                                "type": cause_data.get("type", "contributing_cause"),
                                "evidence": cause_data.get("evidence", []),
                                "confidence": cause_data.get("confidence", 0.5),
                                "impact_level": cause_data.get("impact_level", "medium"),
                                "likelihood": cause_data.get("likelihood", 0.5),
                                "status": "identified",
                                "mitigation_actions": cause_data.get("mitigation_actions", [])
                            })
                
                if "relationships" in ai_analysis and isinstance(ai_analysis["relationships"], list):
                    for idx, rel_data in enumerate(ai_analysis["relationships"]):
                        if isinstance(rel_data, dict):
                            rel_id = f"ai_rel_{idx}"
                            causeway_data["relationships"].append({
                                "id": rel_id,
                                "source_id": rel_data.get("source_id", ""),
                                "target_id": rel_data.get("target_id", ""),
                                "relationship_type": rel_data.get("type", "contributing_factor"),
                                "strength": rel_data.get("strength", 0.5),
                                "evidence": rel_data.get("evidence", []),
                                "confidence": rel_data.get("confidence", 0.5),
                                "description": rel_data.get("description", "")
                            })
                        
        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.CAUSEWAY,
        title=request.title,
        description=f"CauseWay Analysis - {request.central_issue}",
        data=causeway_data,
        tags=["causeway", "root-cause-analysis", "causal-modeling"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    # Generate causal chains and risk assessment
    causes = [CauseNode(**c) for c in causeway_data["causes"]]
    relationships = [CausalRelationship(**r) for r in causeway_data["relationships"]]
    causal_chains = _generate_causal_chains(causes, relationships)
    risk_assessment = _generate_risk_assessment(causes, relationships)
    
    return CausewayAnalysisResponse(
        session_id=session.id,
        title=session.title,
        central_issue=causeway_data["central_issue"],
        problem_statement=causeway_data["problem_statement"],
        context=causeway_data.get("context"),
        causes=causes,
        relationships=relationships,
        causal_chains=causal_chains,
        risk_assessment=risk_assessment,
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=CausewayAnalysisResponse)
async def get_causeway_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CausewayAnalysisResponse:
    """
    Get a specific CauseWay analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        CausewayAnalysisResponse: CauseWay analysis data
    """
    logger.info(f"Getting CauseWay analysis {session_id}")
    
    # TODO: Implement database retrieval
    # For now, return mock data
    causes = [
        CauseNode(
            id="root_1",
            description="Inadequate cybersecurity training program",
            type="root_cause",
            evidence=["Training records show 60% completion rate", "No hands-on exercises", "Outdated curriculum"],
            confidence=0.8,
            impact_level="high",
            likelihood=0.9,
            status="validated",
            mitigation_actions=["Redesign training program", "Implement mandatory completion", "Add practical exercises"]
        ),
        CauseNode(
            id="contrib_1",
            description="Insufficient budget allocation for security",
            type="contributing_cause",
            evidence=["Budget analysis shows 15% decrease", "Security team understaffed", "Delayed security tool updates"],
            confidence=0.7,
            impact_level="high",
            likelihood=0.8,
            status="validated",
            mitigation_actions=["Request budget increase", "Justify ROI for security investments"]
        ),
        CauseNode(
            id="immed_1",
            description="Employee clicked malicious email link",
            type="immediate_cause",
            evidence=["Email logs", "User admission", "Timeline analysis"],
            confidence=0.95,
            impact_level="critical",
            likelihood=1.0,
            status="validated",
            mitigation_actions=["Implement email filtering", "User behavior monitoring"]
        ),
        CauseNode(
            id="effect_1",
            description="Malware infection on workstation",
            type="effect",
            evidence=["Antivirus logs", "System forensics", "Network traffic analysis"],
            confidence=1.0,
            impact_level="critical",
            likelihood=1.0,
            status="validated"
        ),
        CauseNode(
            id="conseq_1",
            description="Data exfiltration and system downtime",
            type="consequence",
            evidence=["Network monitoring logs", "Missing sensitive files", "System unavailability"],
            confidence=0.9,
            impact_level="critical",
            likelihood=1.0,
            status="validated"
        )
    ]
    
    relationships = [
        CausalRelationship(
            id="rel_1",
            source_id="root_1",
            target_id="immed_1",
            relationship_type="contributing_factor",
            strength=0.8,
            evidence=["Training completion records", "User knowledge assessment"],
            confidence=0.8,
            description="Poor training led to user susceptibility"
        ),
        CausalRelationship(
            id="rel_2",
            source_id="contrib_1",
            target_id="root_1",
            relationship_type="contributing_factor",
            strength=0.6,
            evidence=["Budget allocation records", "Training program limitations"],
            confidence=0.7,
            description="Budget constraints limited training program effectiveness"
        ),
        CausalRelationship(
            id="rel_3",
            source_id="immed_1",
            target_id="effect_1",
            relationship_type="direct_cause",
            strength=0.95,
            evidence=["System logs", "Timeline correlation"],
            confidence=0.95,
            description="Malicious link directly caused malware infection"
        ),
        CausalRelationship(
            id="rel_4",
            source_id="effect_1",
            target_id="conseq_1",
            relationship_type="direct_cause",
            strength=0.9,
            evidence=["System impact analysis", "Data loss assessment"],
            confidence=0.9,
            description="Malware infection led to data compromise and downtime"
        )
    ]
    
    causal_chains = _generate_causal_chains(causes, relationships)
    risk_assessment = _generate_risk_assessment(causes, relationships)
    
    return CausewayAnalysisResponse(
        session_id=session_id,
        title="Cybersecurity Incident Root Cause Analysis",
        central_issue="Data breach through phishing attack",
        problem_statement="Organization experienced a data breach resulting from a successful phishing attack that led to malware infection and data exfiltration",
        context="Post-incident analysis to identify root causes and prevent recurrence",
        causes=causes,
        relationships=relationships,
        causal_chains=causal_chains,
        risk_assessment=risk_assessment,
        status="in_progress",
        version=1
    )


@router.put("/{session_id}", response_model=CausewayAnalysisResponse)
async def update_causeway_analysis(
    session_id: int,
    request: CausewayUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CausewayAnalysisResponse:
    """
    Update a CauseWay analysis session.
    
    Args:
        session_id: Session ID
        request: Update request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        CausewayAnalysisResponse: Updated CauseWay analysis
    """
    logger.info(f"Updating CauseWay analysis {session_id}")
    
    # Build update data
    updates = {}
    causeway_data = {}
    
    if request.title:
        updates["title"] = request.title
    
    if request.central_issue is not None:
        causeway_data["central_issue"] = request.central_issue
    
    if request.problem_statement is not None:
        causeway_data["problem_statement"] = request.problem_statement
    
    if request.context is not None:
        causeway_data["context"] = request.context
    
    if request.causes is not None:
        causeway_data["causes"] = [c.dict() for c in request.causes]
    
    if request.relationships is not None:
        causeway_data["relationships"] = [r.dict() for r in request.relationships]
    
    if causeway_data:
        updates["data"] = causeway_data
    
    # Update session
    session = await framework_service.update_session(
        db, session_id, current_user, updates
    )
    
    # Parse data
    import json
    data = json.loads(session.data)
    
    causes = [CauseNode(**c) for c in data.get("causes", [])]
    relationships = [CausalRelationship(**r) for r in data.get("relationships", [])]
    causal_chains = _generate_causal_chains(causes, relationships)
    risk_assessment = _generate_risk_assessment(causes, relationships)
    
    return CausewayAnalysisResponse(
        session_id=session.id,
        title=session.title,
        central_issue=data.get("central_issue", ""),
        problem_statement=data.get("problem_statement", ""),
        context=data.get("context"),
        causes=causes,
        relationships=relationships,
        causal_chains=causal_chains,
        risk_assessment=risk_assessment,
        status=session.status.value,
        version=session.version
    )


@router.post("/{session_id}/causes")
async def add_cause_node(
    session_id: int,
    cause: CauseNode,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add a new cause node to CauseWay analysis.
    
    Args:
        session_id: Session ID
        cause: Cause node data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Adding cause node to CauseWay {session_id}: {cause.description}")
    
    return {
        "message": "Cause node added successfully",
        "session_id": session_id,
        "cause": cause.dict()
    }


@router.post("/{session_id}/relationships")
async def add_causal_relationship(
    session_id: int,
    relationship: CausalRelationship,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add a causal relationship to CauseWay analysis.
    
    Args:
        session_id: Session ID
        relationship: Causal relationship data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Adding causal relationship to CauseWay {session_id}")
    
    return {
        "message": "Causal relationship added successfully",
        "session_id": session_id,
        "relationship": relationship.dict()
    }


@router.post("/{session_id}/root-cause-analysis")
async def perform_root_cause_analysis(
    session_id: int,
    request: RootCauseAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Perform AI-powered root cause analysis.
    
    Args:
        session_id: Session ID
        request: Root cause analysis parameters
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Root cause analysis results
    """
    logger.info(f"Performing root cause analysis for CauseWay {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    causeway_data = {
        "central_issue": "Data breach through phishing attack",
        "problem_statement": "Successful phishing attack led to data compromise",
        "causes": [],
        "relationships": []
    }
    
    # Perform AI root cause analysis
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.CAUSEWAY,
        {**causeway_data, "analysis_request": request.dict()},
        "analyze"
    )
    
    # Mock comprehensive root cause analysis results
    analysis_results = {
        "primary_root_causes": [
            {
                "cause": "Inadequate cybersecurity training",
                "confidence": 0.85,
                "evidence_strength": "high",
                "impact": "critical",
                "why_analysis": [
                    "Why did user click malicious link? - Lack of awareness",
                    "Why lack of awareness? - Insufficient training",
                    "Why insufficient training? - Outdated program and low completion rates"
                ]
            },
            {
                "cause": "Weak email security controls",
                "confidence": 0.78,
                "evidence_strength": "medium",
                "impact": "high",
                "why_analysis": [
                    "Why did malicious email reach user? - Email filters ineffective",
                    "Why were filters ineffective? - Not updated for latest threats",
                    "Why not updated? - Lack of proactive threat intelligence integration"
                ]
            }
        ],
        "contributing_factors": [
            {
                "factor": "Budget constraints for security",
                "impact_level": "medium",
                "relationship": "Limited resources for security improvements"
            },
            {
                "factor": "Organizational culture",
                "impact_level": "medium",
                "relationship": "Security not prioritized in daily operations"
            }
        ],
        "recommendations": [
            {
                "priority": "high",
                "action": "Redesign and mandate cybersecurity training program",
                "expected_impact": "Reduce user susceptibility to phishing by 70%",
                "timeline": "3 months"
            },
            {
                "priority": "high",
                "action": "Implement advanced email threat protection",
                "expected_impact": "Block 95% of malicious emails",
                "timeline": "1 month"
            },
            {
                "priority": "medium",
                "action": "Establish security awareness culture program",
                "expected_impact": "Improve security mindset organization-wide",
                "timeline": "6 months"
            }
        ]
    }
    
    return {
        "session_id": session_id,
        "analysis_parameters": request.dict(),
        "analysis_results": analysis_results,
        "ai_insights": ai_result.get("analysis", {}),
        "timestamp": ai_result.get("timestamp")
    }


@router.get("/{session_id}/causal-map")
async def get_causal_map(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get the causal map visualization data.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Causal map visualization data
    """
    logger.info(f"Getting causal map for CauseWay {session_id}")
    
    # TODO: Get actual data from database
    # For now, return mock causal map data
    causal_map = {
        "nodes": [
            {
                "id": "root_1",
                "label": "Inadequate Training",
                "type": "root_cause",
                "level": 1,
                "impact": "high",
                "confidence": 0.8
            },
            {
                "id": "contrib_1",
                "label": "Budget Constraints",
                "type": "contributing_cause",
                "level": 1,
                "impact": "medium",
                "confidence": 0.7
            },
            {
                "id": "immed_1",
                "label": "User Clicked Link",
                "type": "immediate_cause",
                "level": 2,
                "impact": "critical",
                "confidence": 0.95
            },
            {
                "id": "effect_1",
                "label": "Malware Infection",
                "type": "effect",
                "level": 3,
                "impact": "critical",
                "confidence": 1.0
            },
            {
                "id": "conseq_1",
                "label": "Data Breach",
                "type": "consequence",
                "level": 4,
                "impact": "critical",
                "confidence": 0.9
            }
        ],
        "edges": [
            {
                "from": "contrib_1",
                "to": "root_1",
                "type": "contributing_factor",
                "strength": 0.6,
                "label": "Limited training budget"
            },
            {
                "from": "root_1",
                "to": "immed_1",
                "type": "contributing_factor",
                "strength": 0.8,
                "label": "User lacks awareness"
            },
            {
                "from": "immed_1",
                "to": "effect_1",
                "type": "direct_cause",
                "strength": 0.95,
                "label": "Executed malware"
            },
            {
                "from": "effect_1",
                "to": "conseq_1",
                "type": "direct_cause",
                "strength": 0.9,
                "label": "System compromise"
            }
        ],
        "layout": {
            "type": "hierarchical",
            "direction": "top-down",
            "levels": 4
        }
    }
    
    return {
        "session_id": session_id,
        "causal_map": causal_map
    }


@router.post("/{session_id}/export")
async def export_causeway_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export CauseWay analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json, png)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting CauseWay analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json", "png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json, png"
        )
    
    # TODO: Implement actual export functionality
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/causeway_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_causeway_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available CauseWay analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Cybersecurity Incident Template",
            "description": "Template for analyzing cybersecurity incidents and breaches",
            "cause_types": [
                {"type": "root_cause", "examples": ["Inadequate training", "Poor security controls", "Insufficient policies"]},
                {"type": "contributing_cause", "examples": ["Budget constraints", "Organizational culture", "Technology limitations"]},
                {"type": "immediate_cause", "examples": ["User error", "System failure", "Attack vector"]},
                {"type": "effect", "examples": ["System compromise", "Data exposure", "Service disruption"]},
                {"type": "consequence", "examples": ["Financial loss", "Reputation damage", "Regulatory penalties"]}
            ]
        },
        {
            "id": 2,
            "name": "Operational Failure Template",
            "description": "Template for analyzing operational failures and process breakdowns",
            "cause_types": [
                {"type": "root_cause", "examples": ["Process deficiencies", "Skills gaps", "Resource limitations"]},
                {"type": "contributing_cause", "examples": ["Communication issues", "Time pressures", "Tool limitations"]},
                {"type": "immediate_cause", "examples": ["Human error", "Equipment failure", "External disruption"]},
                {"type": "effect", "examples": ["Process failure", "Quality issues", "Delays"]},
                {"type": "consequence", "examples": ["Customer impact", "Cost overruns", "Schedule delays"]}
            ]
        },
        {
            "id": 3,
            "name": "Safety Incident Template",
            "description": "Template for analyzing safety incidents and accidents",
            "cause_types": [
                {"type": "root_cause", "examples": ["Safety culture", "Training deficiencies", "Design flaws"]},
                {"type": "contributing_cause", "examples": ["Work environment", "Pressure factors", "Resource constraints"]},
                {"type": "immediate_cause", "examples": ["Unsafe act", "Unsafe condition", "Equipment failure"]},
                {"type": "effect", "examples": ["Incident occurrence", "Near miss", "Property damage"]},
                {"type": "consequence", "examples": ["Injury", "Environmental impact", "Business disruption"]}
            ]
        },
        {
            "id": 4,
            "name": "Strategic Initiative Failure Template",
            "description": "Template for analyzing why strategic initiatives fail",
            "cause_types": [
                {"type": "root_cause", "examples": ["Poor planning", "Lack of leadership support", "Inadequate resources"]},
                {"type": "contributing_cause", "examples": ["Change resistance", "Communication gaps", "Skill shortages"]},
                {"type": "immediate_cause", "examples": ["Milestone failures", "Budget overruns", "Key person departure"]},
                {"type": "effect", "examples": ["Project delays", "Quality compromises", "Scope reduction"]},
                {"type": "consequence", "examples": ["Strategic objectives not met", "Competitive disadvantage", "Stakeholder disappointment"]}
            ]
        }
    ]
    
    return templates


def _generate_causal_chains(causes: List[CauseNode], relationships: List[CausalRelationship]) -> List[List[str]]:
    """
    Generate causal chains from causes and relationships.
    
    Args:
        causes: List of cause nodes
        relationships: List of causal relationships
        
    Returns:
        list: List of causal chains (sequences of cause IDs)
    """
    # Build adjacency map
    adj_map = {}
    for rel in relationships:
        if rel.source_id not in adj_map:
            adj_map[rel.source_id] = []
        adj_map[rel.source_id].append(rel.target_id)
    
    # Find root causes (nodes with no incoming edges)
    incoming = set()
    for rel in relationships:
        incoming.add(rel.target_id)
    
    root_causes = [c.id for c in causes if c.id not in incoming and c.type == "root_cause"]
    
    # Generate chains from each root cause
    chains = []
    for root in root_causes:
        chain = _build_chain(root, adj_map, [])
        if chain:
            chains.append(chain)
    
    return chains


def _build_chain(node_id: str, adj_map: dict, visited: List[str]) -> List[str]:
    """
    Build a causal chain from a starting node.
    
    Args:
        node_id: Starting node ID
        adj_map: Adjacency map of relationships
        visited: Already visited nodes (to prevent cycles)
        
    Returns:
        list: Causal chain
    """
    if node_id in visited:
        return []
    
    chain = [node_id]
    visited = visited + [node_id]
    
    if node_id in adj_map:
        # Follow the strongest relationship
        next_nodes = adj_map[node_id]
        if next_nodes:
            next_node = next_nodes[0]  # Simplified - take first relationship
            rest_of_chain = _build_chain(next_node, adj_map, visited)
            chain.extend(rest_of_chain)
    
    return chain


def _generate_risk_assessment(causes: List[CauseNode], relationships: List[CausalRelationship]) -> Dict:
    """
    Generate risk assessment from causes and relationships.
    
    Args:
        causes: List of cause nodes
        relationships: List of causal relationships
        
    Returns:
        dict: Risk assessment summary
    """
    # Calculate risk metrics
    total_causes = len(causes)
    high_impact_causes = len([c for c in causes if c.impact_level in ["high", "critical"]])
    validated_causes = len([c for c in causes if c.status == "validated"])
    
    # Risk levels
    risk_levels = {
        "critical": len([c for c in causes if c.impact_level == "critical"]),
        "high": len([c for c in causes if c.impact_level == "high"]),
        "medium": len([c for c in causes if c.impact_level == "medium"]),
        "low": len([c for c in causes if c.impact_level == "low"])
    }
    
    # Overall risk score (simplified calculation)
    risk_score = 0
    for cause in causes:
        impact_weight = {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(cause.impact_level, 2)
        likelihood = cause.likelihood or 0.5
        confidence = cause.confidence or 0.5
        risk_score += impact_weight * likelihood * confidence
    
    normalized_risk_score = min(risk_score / (total_causes * 4), 1.0) if total_causes > 0 else 0
    
    return {
        "overall_risk_level": "high" if normalized_risk_score > 0.7 else "medium" if normalized_risk_score > 0.4 else "low",
        "risk_score": round(normalized_risk_score, 2),
        "total_causes": total_causes,
        "high_impact_causes": high_impact_causes,
        "validated_causes": validated_causes,
        "validation_rate": round(validated_causes / total_causes * 100, 1) if total_causes > 0 else 0,
        "risk_distribution": risk_levels,
        "top_risk_factors": [
            {
                "cause": cause.description,
                "impact": cause.impact_level,
                "likelihood": cause.likelihood,
                "confidence": cause.confidence
            }
            for cause in sorted(causes, 
                              key=lambda x: (x.likelihood or 0.5) * ({"low": 1, "medium": 2, "high": 3, "critical": 4}.get(x.impact_level, 2)), 
                              reverse=True)[:3]
        ]
    }