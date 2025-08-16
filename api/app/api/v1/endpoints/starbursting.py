"""
Starbursting API endpoints.
Question-based exploration framework using the 5 W's and H (Who, What, Where, When, Why, How).
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


class StarburstingQuestion(BaseModel):
    """Individual question model for Starbursting analysis."""
    id: str
    category: str  # who, what, where, when, why, how
    question: str
    answer: Optional[str] = None
    priority: Optional[int] = 1  # 1-5 scale
    source: Optional[str] = None
    status: str = "pending"  # pending, answered, researched, validated
    follow_up_questions: Optional[List[str]] = []


class StarburstingCreateRequest(BaseModel):
    """Starbursting analysis creation request."""
    title: str
    central_topic: str
    context: Optional[str] = None
    initial_questions: Optional[List[StarburstingQuestion]] = []
    request_ai_questions: bool = True


class StarburstingUpdateRequest(BaseModel):
    """Starbursting analysis update request."""
    title: Optional[str] = None
    central_topic: Optional[str] = None
    context: Optional[str] = None
    questions: Optional[List[StarburstingQuestion]] = None


class StarburstingAnalysisResponse(BaseModel):
    """Starbursting analysis response."""
    session_id: int
    title: str
    central_topic: str
    context: Optional[str]
    questions: List[StarburstingQuestion]
    categories: Dict[str, List[StarburstingQuestion]]
    ai_questions: Optional[Dict] = None
    status: str
    version: int


class StarburstingQuestionRequest(BaseModel):
    """Request for adding/updating individual questions."""
    category: str
    question: str
    answer: Optional[str] = None
    priority: Optional[int] = 1
    source: Optional[str] = None


@router.post("/create", response_model=StarburstingAnalysisResponse)
async def create_starbursting_analysis(
    request: StarburstingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StarburstingAnalysisResponse:
    """
    Create a new Starbursting analysis session.
    
    Args:
        request: Starbursting creation request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        StarburstingAnalysisResponse: Created Starbursting analysis
    """
    logger.info(f"Creating Starbursting analysis: {request.title} for user {current_user.username}")
    
    # Prepare Starbursting data
    starbursting_data = {
        "central_topic": request.central_topic,
        "context": request.context or "",
        "questions": [q.dict() for q in request.initial_questions] if request.initial_questions else [],
    }
    
    # Get AI-generated questions if requested
    ai_questions = None
    if request.request_ai_questions:
        try:
            ai_result = await framework_service.analyze_with_ai(
                FrameworkType.STARBURSTING,
                starbursting_data,
                "suggest"
            )
            ai_questions = ai_result.get("suggestions")
            
            # Add AI-suggested questions
            if ai_questions and "questions" in ai_questions:
                for category, questions in ai_questions["questions"].items():
                    if isinstance(questions, list):
                        for idx, question_text in enumerate(questions):
                            question_id = f"{category}_ai_{idx}"
                            starbursting_data["questions"].append({
                                "id": question_id,
                                "category": category,
                                "question": question_text,
                                "answer": None,
                                "priority": 3,
                                "source": "AI suggestion",
                                "status": "pending",
                                "follow_up_questions": []
                            })
                        
        except Exception as e:
            logger.warning(f"Failed to get AI questions: {e}")
    
    # Create framework session
    framework_data = FrameworkData(
        framework_type=FrameworkType.STARBURSTING,
        title=request.title,
        description=f"Starbursting Analysis - {request.central_topic}",
        data=starbursting_data,
        tags=["starbursting", "question-exploration", "5w1h"]
    )
    
    session = await framework_service.create_session(db, current_user, framework_data)
    
    # Parse questions into categories
    questions = [StarburstingQuestion(**q) for q in starbursting_data["questions"]]
    categories = _categorize_questions(questions)
    
    return StarburstingAnalysisResponse(
        session_id=session.id,
        title=session.title,
        central_topic=starbursting_data["central_topic"],
        context=starbursting_data.get("context"),
        questions=questions,
        categories=categories,
        ai_questions=ai_questions,
        status=session.status.value,
        version=session.version
    )


@router.get("/{session_id}", response_model=StarburstingAnalysisResponse)
async def get_starbursting_analysis(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StarburstingAnalysisResponse:
    """
    Get a specific Starbursting analysis session.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        StarburstingAnalysisResponse: Starbursting analysis data
    """
    logger.info(f"Getting Starbursting analysis {session_id}")
    
    # TODO: Implement database retrieval
    # For now, return mock data
    questions = [
        StarburstingQuestion(
            id="who_1",
            category="who",
            question="Who are the key stakeholders involved?",
            answer="Government agencies, private contractors, international partners",
            priority=5,
            source="Initial analysis",
            status="answered",
            follow_up_questions=["Who has decision-making authority?", "Who are the potential adversaries?"]
        ),
        StarburstingQuestion(
            id="what_1",
            category="what",
            question="What is the primary objective?",
            answer="Establish strategic intelligence capability",
            priority=5,
            source="Mission briefing",
            status="answered"
        ),
        StarburstingQuestion(
            id="where_1",
            category="where",
            question="Where will operations be conducted?",
            priority=4,
            status="pending"
        ),
        StarburstingQuestion(
            id="when_1",
            category="when",
            question="When is the target timeline?",
            answer="Q1-Q2 2025",
            priority=4,
            status="answered"
        ),
        StarburstingQuestion(
            id="why_1",
            category="why",
            question="Why is this initiative necessary?",
            answer="Emerging threats require enhanced intelligence capabilities",
            priority=5,
            status="answered"
        ),
        StarburstingQuestion(
            id="how_1",
            category="how",
            question="How will success be measured?",
            priority=3,
            status="pending"
        ),
        StarburstingQuestion(
            id="what_2",
            category="what",
            question="What resources are required?",
            priority=4,
            status="researched"
        ),
        StarburstingQuestion(
            id="who_2",
            category="who",
            question="Who are the subject matter experts?",
            priority=3,
            status="pending"
        )
    ]
    
    categories = _categorize_questions(questions)
    
    return StarburstingAnalysisResponse(
        session_id=session_id,
        title="Strategic Intelligence Initiative Analysis",
        central_topic="Development of next-generation intelligence analysis platform",
        context="Organizational transformation project for enhanced analytical capabilities",
        questions=questions,
        categories=categories,
        status="in_progress",
        version=1
    )


@router.put("/{session_id}", response_model=StarburstingAnalysisResponse)
async def update_starbursting_analysis(
    session_id: int,
    request: StarburstingUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StarburstingAnalysisResponse:
    """
    Update a Starbursting analysis session.
    
    Args:
        session_id: Session ID
        request: Update request
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        StarburstingAnalysisResponse: Updated Starbursting analysis
    """
    logger.info(f"Updating Starbursting analysis {session_id}")
    
    # Build update data
    updates = {}
    starbursting_data = {}
    
    if request.title:
        updates["title"] = request.title
    
    if request.central_topic is not None:
        starbursting_data["central_topic"] = request.central_topic
    
    if request.context is not None:
        starbursting_data["context"] = request.context
    
    if request.questions is not None:
        starbursting_data["questions"] = [q.dict() for q in request.questions]
    
    if starbursting_data:
        updates["data"] = starbursting_data
    
    # Update session
    session = await framework_service.update_session(
        db, session_id, current_user, updates
    )
    
    # Parse data
    import json
    data = json.loads(session.data)
    
    questions = [StarburstingQuestion(**q) for q in data.get("questions", [])]
    categories = _categorize_questions(questions)
    
    return StarburstingAnalysisResponse(
        session_id=session.id,
        title=session.title,
        central_topic=data.get("central_topic", ""),
        context=data.get("context"),
        questions=questions,
        categories=categories,
        status=session.status.value,
        version=session.version
    )


@router.post("/{session_id}/questions")
async def add_question(
    session_id: int,
    question_request: StarburstingQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Add a new question to Starbursting analysis.
    
    Args:
        session_id: Session ID
        question_request: Question data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    valid_categories = ["who", "what", "where", "when", "why", "how"]
    
    if question_request.category.lower() not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
    
    logger.info(f"Adding question to Starbursting {session_id}: {question_request.question}")
    
    # TODO: Implement actual database update
    # For now, return success response
    
    return {
        "message": "Question added successfully",
        "session_id": session_id,
        "question": {
            "category": question_request.category.lower(),
            "question": question_request.question,
            "answer": question_request.answer,
            "priority": question_request.priority,
            "source": question_request.source,
            "status": "pending"
        }
    }


@router.put("/{session_id}/questions/{question_id}")
async def update_question(
    session_id: int,
    question_id: str,
    question_update: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Update a specific question in Starbursting analysis.
    
    Args:
        session_id: Session ID
        question_id: Question ID to update
        question_update: Updated question data
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Success message
    """
    logger.info(f"Updating question {question_id} in Starbursting {session_id}")
    
    # TODO: Implement actual database update
    # For now, return success response
    
    return {
        "message": "Question updated successfully",
        "session_id": session_id,
        "question_id": question_id,
        "updated_data": question_update
    }


@router.post("/{session_id}/ai-questions")
async def generate_ai_questions(
    session_id: int,
    categories: Optional[List[str]] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Generate AI-powered questions for Starbursting analysis.
    
    Args:
        session_id: Session ID
        categories: Specific categories to generate questions for (None = all)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Generated questions
    """
    logger.info(f"Generating AI questions for Starbursting {session_id}")
    
    # TODO: Get actual session data from database
    # For now, use mock data
    starbursting_data = {
        "central_topic": "Strategic intelligence initiative",
        "context": "Development of enhanced analytical capabilities",
        "questions": []
    }
    
    # Get AI questions
    ai_result = await framework_service.analyze_with_ai(
        FrameworkType.STARBURSTING,
        starbursting_data,
        "suggest"
    )
    
    # Filter by categories if specified
    generated_questions = ai_result.get("suggestions", {}).get("questions", {})
    if categories:
        generated_questions = {k: v for k, v in generated_questions.items() 
                             if k in categories}
    
    return {
        "session_id": session_id,
        "generated_questions": generated_questions,
        "timestamp": ai_result.get("timestamp")
    }


@router.get("/{session_id}/matrix")
async def get_question_matrix(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get the Starbursting question matrix visualization.
    
    Args:
        session_id: Session ID
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Matrix visualization data
    """
    logger.info(f"Getting question matrix for Starbursting {session_id}")
    
    # TODO: Get actual data from database
    # For now, return mock matrix
    matrix = {
        "central_topic": "Strategic Intelligence Initiative",
        "categories": {
            "who": {
                "total_questions": 3,
                "answered": 2,
                "pending": 1,
                "priority_high": 2,
                "questions": [
                    "Who are the key stakeholders?",
                    "Who has decision authority?",
                    "Who are potential adversaries?"
                ]
            },
            "what": {
                "total_questions": 2,
                "answered": 1,
                "pending": 1,
                "priority_high": 2,
                "questions": [
                    "What is the primary objective?",
                    "What resources are required?"
                ]
            },
            "where": {
                "total_questions": 1,
                "answered": 0,
                "pending": 1,
                "priority_high": 1,
                "questions": [
                    "Where will operations be conducted?"
                ]
            },
            "when": {
                "total_questions": 1,
                "answered": 1,
                "pending": 0,
                "priority_high": 1,
                "questions": [
                    "When is the target timeline?"
                ]
            },
            "why": {
                "total_questions": 1,
                "answered": 1,
                "pending": 0,
                "priority_high": 1,
                "questions": [
                    "Why is this initiative necessary?"
                ]
            },
            "how": {
                "total_questions": 1,
                "answered": 0,
                "pending": 1,
                "priority_high": 0,
                "questions": [
                    "How will success be measured?"
                ]
            }
        },
        "summary": {
            "total_questions": 9,
            "answered": 5,
            "pending": 4,
            "completion_rate": 55.6
        }
    }
    
    return {
        "session_id": session_id,
        "matrix": matrix
    }


@router.post("/{session_id}/export")
async def export_starbursting_analysis(
    session_id: int,
    format: str = "pdf",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Export Starbursting analysis to various formats.
    
    Args:
        session_id: Session ID
        format: Export format (pdf, docx, json)
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        dict: Export information
    """
    logger.info(f"Exporting Starbursting analysis {session_id} as {format}")
    
    if format not in ["pdf", "docx", "json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid export format. Supported: pdf, docx, json"
        )
    
    # TODO: Implement actual export functionality
    return {
        "session_id": session_id,
        "format": format,
        "download_url": f"/api/v1/downloads/starbursting_{session_id}.{format}",
        "expires_at": "2025-08-17T00:00:00Z"
    }


@router.get("/templates/list")
async def list_starbursting_templates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """
    List available Starbursting analysis templates.
    
    Args:
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        list: Available templates
    """
    templates = [
        {
            "id": 1,
            "name": "Strategic Initiative Template",
            "description": "Template for analyzing strategic business or organizational initiatives",
            "categories": {
                "who": ["Who are the stakeholders?", "Who has decision authority?", "Who will be impacted?"],
                "what": ["What is the objective?", "What resources are needed?", "What are the deliverables?"],
                "where": ["Where will this take place?", "Where are the key locations?", "Where are potential risks?"],
                "when": ["When is the timeline?", "When are key milestones?", "When are decision points?"],
                "why": ["Why is this necessary?", "Why now?", "Why this approach?"],
                "how": ["How will this be implemented?", "How will success be measured?", "How will risks be mitigated?"]
            }
        },
        {
            "id": 2,
            "name": "Threat Analysis Template",
            "description": "Template for comprehensive threat assessment and analysis",
            "categories": {
                "who": ["Who is the threat actor?", "Who are potential targets?", "Who can respond?"],
                "what": ["What are the capabilities?", "What are the intentions?", "What are vulnerabilities?"],
                "where": ["Where might attacks occur?", "Where are vulnerabilities?", "Where are safe areas?"],
                "when": ["When might this occur?", "When are vulnerable periods?", "When should responses happen?"],
                "why": ["Why would they attack?", "Why this target?", "Why this method?"],
                "how": ["How might they attack?", "How can we detect?", "How should we respond?"]
            }
        },
        {
            "id": 3,
            "name": "Project Planning Template",
            "description": "Template for comprehensive project exploration and planning",
            "categories": {
                "who": ["Who is the project team?", "Who are the customers?", "Who are the suppliers?"],
                "what": ["What is the scope?", "What are requirements?", "What are constraints?"],
                "where": ["Where will work be done?", "Where are resources?", "Where are customers?"],
                "when": ["When is the deadline?", "When are milestones?", "When are dependencies?"],
                "why": ["Why is this project needed?", "Why this solution?", "Why these priorities?"],
                "how": ["How will we execute?", "How will we measure progress?", "How will we manage risks?"]
            }
        },
        {
            "id": 4,
            "name": "Intelligence Collection Template",
            "description": "Template for intelligence collection planning and requirements",
            "categories": {
                "who": ["Who are the targets?", "Who are the sources?", "Who needs the intelligence?"],
                "what": ["What information is needed?", "What are the gaps?", "What are the priorities?"],
                "where": ["Where should we collect?", "Where are the sources?", "Where will analysis occur?"],
                "when": ["When is intelligence needed?", "When are collection windows?", "When should reporting occur?"],
                "why": ["Why is this intelligence critical?", "Why these collection methods?", "Why these sources?"],
                "how": ["How will we collect?", "How will we analyze?", "How will we disseminate?"]
            }
        }
    ]
    
    return templates


def _categorize_questions(questions: List[StarburstingQuestion]) -> Dict[str, List[StarburstingQuestion]]:
    """
    Categorize questions by their 5W1H category.
    
    Args:
        questions: List of StarburstingQuestion objects
        
    Returns:
        dict: Questions organized by category
    """
    categories = {
        "who": [],
        "what": [],
        "where": [],
        "when": [],
        "why": [],
        "how": []
    }
    
    for question in questions:
        category = question.category.lower()
        if category in categories:
            categories[category].append(question)
    
    return categories