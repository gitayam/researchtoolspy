"""
Center of Gravity (COG) Analysis API endpoints.
Strategic analysis for intelligence professionals.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.core.logging import get_logger
from app.models.framework import FrameworkType
from app.models.user import User
from app.services.framework_service import (
    COGAnalysisData,
    FrameworkData,
    framework_service,
)

logger = get_logger(__name__)
router = APIRouter()


class COGCreateRequest(BaseModel):
    """COG analysis creation request."""
    title: str
    user_details: str
    desired_end_state: str
    initial_entities: Optional[list[dict]] = []
    initial_relationships: Optional[list[dict]] = []
    request_ai_analysis: bool = True


class COGUpdateRequest(BaseModel):
    """COG analysis update request."""
    title: Optional[str] = None
    user_details: Optional[str] = None
    desired_end_state: Optional[str] = None
    entities: Optional[list[dict]] = None
    relationships: Optional[list[dict]] = None
    critical_capabilities: Optional[list[str]] = None
    critical_requirements: Optional[list[str]] = None
    critical_vulnerabilities: Optional[list[str]] = None


class COGAnalysisResponse(BaseModel):
    """COG analysis response."""
    session_id: int
    title: str
    user_details: str
    desired_end_state: str
    entities: list[dict]
    relationships: list[dict]
    critical_capabilities: Optional[list[str]]
    critical_requirements: Optional[list[str]]
    critical_vulnerabilities: Optional[list[str]]
    ai_analysis: Optional[dict] = None
    status: str
    version: int


class COGEntityRequest(BaseModel):
    """Request to add/update COG entity."""
    name: str
    type: str  # actor, capability, requirement, vulnerability
    description: Optional[str] = None
    attributes: Optional[dict] = None


class COGRelationshipRequest(BaseModel):
    """Request to add/update COG relationship."""
    source_entity: str
    target_entity: str
    relationship_type: str  # supports, requires, threatens, etc.
    strength: Optional[float] = 1.0  # 0-1 scale
    description: Optional[str] = None


@router.post("/create", response_model=COGAnalysisResponse)
async def create_cog_analysis(
    request: COGCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> COGAnalysisResponse:
    """
    Create a new COG analysis session.
    
    Args:
        request: COG creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        COGAnalysisResponse: Created COG analysis
    """
    logger.info(f"Creating COG analysis: {request.title} for user {current_user.username}")
    
    # Prepare COG data
    cog_data = {
        "user_details": request.user_details,
        "desired_end_state": request.desired_end_state,
        "entities": request.initial_entities or [],
        "relationships": request.initial_relationships or [],
        "critical_capabilities": [],
        "critical_requirements": [],
        "critical_vulnerabilities": [],
    }
    
    # Get AI analysis if requested
    ai_analysis = None
    if request.request_ai_analysis:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.COG,
                cog_data,
                "suggest"
            )
            ai_analysis = ai_result.get("suggestions")
            
            # Merge AI suggestions with initial data
            if ai_analysis:
                if "critical_capabilities" in ai_analysis:
                    cog_data["critical_capabilities"] = ai_analysis["critical_capabilities"]
                if "critical_requirements" in ai_analysis:
                    cog_data["critical_requirements"] = ai_analysis["critical_requirements"]
                if "critical_vulnerabilities" in ai_analysis:
                    cog_data["critical_vulnerabilities"] = ai_analysis["critical_vulnerabilities"]
                if "centers_of_gravity" in ai_analysis:
                    # Convert COG suggestions to entities
                    for cog in ai_analysis.get("centers_of_gravity", []):
                        cog_data["entities"].append({
                            "name": cog,
                            "type": "center_of_gravity",
                            "ai_generated": True
                        })
                        
        except Exception as e:
            logger.warning(f"Failed to get AI analysis: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.COG,
        title=request.title,
        description=f"COG Analysis - End State: {request.desired_end_state}",
        data=cog_data,
        tags=["cog", "strategic-analysis", "center-of-gravity"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    return COGAnalysisResponse(
        session_id=session.id,
        title=session.title,
        user_details=cog_data["user_details"],
        desired_end_state=cog_data["desired_end_state"],
        entities=cog_data["entities"],
        relationships=cog_data["relationships"],
        critical_capabilities=cog_data["critical_capabilities"],
        critical_requirements=cog_data["critical_requirements"],
        critical_vulnerabilities=cog_data["critical_vulnerabilities"],
        ai_analysis=ai_analysis,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=COGAnalysisResponse)
async def get_cog_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> COGAnalysisResponse:
    """
    Get a specific COG analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        COGAnalysisResponse: COG analysis data
    """
    # TODO: Implement database retrieval
    # For now, return mock data
    logger.info(f"Getting COG analysis {session_id}")
    
    return COGAnalysisResponse(
        session_id=session_id,
        title="Strategic COG Analysis",
        user_details="Intelligence Analyst - Regional Assessment",
        desired_end_state="Achieve strategic stability in the region",
        entities=[
            {
                "name": "Government Forces",
                "type": "actor",
                "description": "Primary state military forces",
                "attributes": {"strength": "high", "cohesion": "moderate"}
            },
            {
                "name": "Critical Infrastructure",
                "type": "capability",
                "description": "Essential services and facilities",
                "attributes": {"resilience": "low", "importance": "critical"}
            },
            {
                "name": "Public Support",
                "type": "requirement",
                "description": "Popular legitimacy and backing",
                "attributes": {"level": "moderate", "trend": "declining"}
            }
        ],
        relationships=[
            {
                "source": "Government Forces",
                "target": "Critical Infrastructure",
                "type": "protects",
                "strength": 0.7
            },
            {
                "source": "Public Support",
                "target": "Government Forces",
                "type": "enables",
                "strength": 0.6
            }
        ],
        critical_capabilities=["Force projection", "Intelligence gathering", "Logistics"],
        critical_requirements=["Supply lines", "Communication networks", "Political support"],
        critical_vulnerabilities=["Extended supply chains", "Cyber infrastructure", "Coalition cohesion"],
        status="in_progress",
        version=1
    )


@router.post("/{session_id}/entities", response_model=dict)
async def add_cog_entity(
    session_id: int,
    entity: COGEntityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add an entity to COG analysis.
    
    Args:
        session_id: Session ID
        entity: Entity data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message with entity ID
    """
    logger.info(f"Adding entity to COG analysis {session_id}: {entity.name}")
    
    # TODO: Implement actual database update
    # For now, return mock response
    
    entity_data = {
        "id": f"entity_{session_id}_{entity.name.lower().replace(' ', '_')}",
        "name": entity.name,
        "type": entity.type,
        "description": entity.description,
        "attributes": entity.attributes or {},
        "created_at": "2025-08-16T00:00:00Z"
    }
    
    return {
        "message": "Entity added successfully",
        "entity": entity_data
    }


@router.post("/{session_id}/relationships", response_model=dict)
async def add_cog_relationship(
    session_id: int,
    relationship: COGRelationshipRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add a relationship to COG analysis.
    
    Args:
        session_id: Session ID
        relationship: Relationship data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message with relationship ID
    """
    logger.info(
        f"Adding relationship to COG {session_id}: "
        f"{relationship.source_entity} -> {relationship.target_entity}"
    )
    
    # TODO: Implement actual database update
    
    relationship_data = {
        "id": f"rel_{session_id}_{len(str(session_id))}",
        "source": relationship.source_entity,
        "target": relationship.target_entity,
        "type": relationship.relationship_type,
        "strength": relationship.strength,
        "description": relationship.description,
        "created_at": "2025-08-16T00:00:00Z"
    }
    
    return {
        "message": "Relationship added successfully",
        "relationship": relationship_data
    }


@router.post("/{session_id}/normalize")
async def normalize_cog_entities(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Normalize and analyze COG entities using AI.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Normalization results
    """
    logger.info(f"Normalizing COG entities for session {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    cog_data = {
        "entities": [
            {"name": "Government Forces", "type": "actor"},
            {"name": "Critical Infrastructure", "type": "capability"},
        ],
        "desired_end_state": "Strategic stability"
    }
    
    # Analyze with AI
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.COG,
        cog_data,
        "suggest"
    )
    
    return {
        "message": "Entities normalized successfully",
        "normalized_entities": ai_result.get("suggestions", {}).get("entities", []),
        "suggested_relationships": ai_result.get("suggestions", {}).get("relationships", []),
        "analysis": ai_result
    }


@router.post("/{session_id}/export")
async def export_cog_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export COG analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json, graphml)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting COG analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json", "graphml"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json, graphml"
        )
    
    # TODO: Implement actual export functionality
    # For now, return mock response
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/cog_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_cog_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available COG analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    # Return common COG templates
    templates = [
        {
            "id": 1,
            "name": "Military COG Analysis",
            "description": "Template for military strategic planning",
            "entities": [
                {"type": "actor", "examples": ["Command structure", "Combat forces", "Support units"]},
                {"type": "capability", "examples": ["Firepower", "Mobility", "Intelligence"]},
                {"type": "requirement", "examples": ["Logistics", "Communications", "Morale"]},
                {"type": "vulnerability", "examples": ["Supply lines", "Command nodes", "Public support"]}
            ]
        },
        {
            "id": 2,
            "name": "Political COG Analysis",
            "description": "Template for political stability assessment",
            "entities": [
                {"type": "actor", "examples": ["Government", "Opposition", "Civil society"]},
                {"type": "capability", "examples": ["Legitimacy", "Control", "Resources"]},
                {"type": "requirement", "examples": ["Popular support", "International recognition", "Economic stability"]},
                {"type": "vulnerability", "examples": ["Corruption", "Ethnic tensions", "Economic inequality"]}
            ]
        },
        {
            "id": 3,
            "name": "Economic COG Analysis",
            "description": "Template for economic system analysis",
            "entities": [
                {"type": "actor", "examples": ["Central bank", "Major corporations", "Trade partners"]},
                {"type": "capability", "examples": ["Production capacity", "Financial reserves", "Trade networks"]},
                {"type": "requirement", "examples": ["Energy supply", "Raw materials", "Skilled workforce"]},
                {"type": "vulnerability", "examples": ["Debt levels", "Currency stability", "Trade dependencies"]}
            ]
        }
    ]
    
    return templates