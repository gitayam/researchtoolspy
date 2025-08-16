"""
Framework analysis service layer.
Handles business logic for all intelligence analysis frameworks.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.framework import (
    FrameworkSession,
    FrameworkStatus,
    FrameworkTemplate,
    FrameworkType,
)
from app.models.user import User
from app.services.ai_service import ai_service

logger = get_logger(__name__)


class FrameworkData(BaseModel):
    """Generic framework data model."""
    framework_type: FrameworkType
    title: str
    description: Optional[str] = None
    data: Dict[str, Any]
    config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None


class SWOTAnalysisData(BaseModel):
    """SWOT Analysis specific data model."""
    objective: str
    context: Optional[str] = None
    strengths: List[str]
    weaknesses: List[str]
    opportunities: List[str]
    threats: List[str]
    ai_suggestions: Optional[Dict[str, List[str]]] = None


class COGAnalysisData(BaseModel):
    """Center of Gravity analysis data model."""
    user_details: str
    desired_end_state: str
    entities: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    critical_capabilities: Optional[List[str]] = None
    critical_requirements: Optional[List[str]] = None
    critical_vulnerabilities: Optional[List[str]] = None


class PMESIIPTData(BaseModel):
    """PMESII-PT analysis data model."""
    scenario: str
    political: Dict[str, Any]
    military: Dict[str, Any]
    economic: Dict[str, Any]
    social: Dict[str, Any]
    infrastructure: Dict[str, Any]
    information: Dict[str, Any]
    physical_environment: Dict[str, Any]
    time: Dict[str, Any]


class FrameworkAnalysisService:
    """
    Service for managing framework analysis sessions.
    Provides methods for creating, updating, and analyzing framework data.
    """
    
    def __init__(self):
        """Initialize framework service."""
        self.framework_handlers = {
            FrameworkType.SWOT: self._handle_swot_analysis,
            FrameworkType.COG: self._handle_cog_analysis,
            FrameworkType.PMESII_PT: self._handle_pmesii_pt_analysis,
            FrameworkType.DOTMLPF: self._handle_dotmlpf_analysis,
            FrameworkType.ACH: self._handle_ach_analysis,
            FrameworkType.DECEPTION_DETECTION: self._handle_deception_detection,
            FrameworkType.BEHAVIORAL_ANALYSIS: self._handle_behavioral_analysis,
            FrameworkType.STARBURSTING: self._handle_starbursting,
            FrameworkType.CAUSEWAY: self._handle_causeway,
            FrameworkType.DIME: self._handle_dime_analysis,
        }
    
    async def create_session(
        self,
        db: AsyncSession,
        user: User,
        framework_data: FrameworkData
    ) -> FrameworkSession:
        """
        Create a new framework analysis session.
        
        Args:
            db: Database session
            user: User creating the session
            framework_data: Framework data
            
        Returns:
            FrameworkSession: Created session
        """
        session = FrameworkSession(
            title=framework_data.title,
            description=framework_data.description,
            framework_type=framework_data.framework_type,
            status=FrameworkStatus.DRAFT,
            user_id=user.id,
            data=json.dumps(framework_data.data),
            config=json.dumps(framework_data.config) if framework_data.config else None,
            tags=json.dumps(framework_data.tags) if framework_data.tags else None,
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        logger.info(
            f"Created framework session {session.id} "
            f"({framework_data.framework_type}) for user {user.username}"
        )
        
        return session
    
    async def update_session(
        self,
        db: AsyncSession,
        session_id: int,
        user: User,
        updates: Dict[str, Any]
    ) -> FrameworkSession:
        """
        Update an existing framework session.
        
        Args:
            db: Database session
            session_id: Session ID
            user: User updating the session
            updates: Updates to apply
            
        Returns:
            FrameworkSession: Updated session
        """
        # Get session
        result = await db.execute(
            select(FrameworkSession).where(
                FrameworkSession.id == session_id,
                FrameworkSession.user_id == user.id
            )
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError(f"Framework session {session_id} not found")
        
        # Apply updates
        for key, value in updates.items():
            if key == "data":
                session.data = json.dumps(value)
            elif key == "config":
                session.config = json.dumps(value)
            elif key == "tags":
                session.tags = json.dumps(value)
            elif hasattr(session, key):
                setattr(session, key, value)
        
        # Update version and timestamp
        session.version += 1
        session.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"Updated framework session {session_id} to version {session.version}")
        
        return session
    
    async def analyze_with_ai(
        self,
        framework_type: FrameworkType,
        data: Dict[str, Any],
        action: str = "suggest"
    ) -> Dict[str, Any]:
        """
        Perform AI analysis on framework data.
        
        Args:
            framework_type: Type of framework
            data: Framework data
            action: Analysis action (suggest, validate, enhance)
            
        Returns:
            Dict: AI analysis results
        """
        handler = self.framework_handlers.get(framework_type)
        if not handler:
            raise ValueError(f"Unsupported framework type: {framework_type}")
        
        return await handler(data, action)
    
    async def _handle_swot_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """
        Handle SWOT analysis with AI.
        
        Args:
            data: SWOT data
            action: Analysis action
            
        Returns:
            Dict: AI analysis results
        """
        if action == "suggest":
            prompt = (
                f"Analyze this scenario for SWOT analysis:\n"
                f"Objective: {data.get('objective', 'Not specified')}\n"
                f"Context: {data.get('context', 'Not specified')}\n\n"
                f"Current analysis:\n"
                f"Strengths: {data.get('strengths', [])}\n"
                f"Weaknesses: {data.get('weaknesses', [])}\n"
                f"Opportunities: {data.get('opportunities', [])}\n"
                f"Threats: {data.get('threats', [])}\n\n"
                "Provide additional SWOT insights as JSON with keys: "
                "strengths, weaknesses, opportunities, threats. "
                "Each should be an array of 3-5 specific, actionable points "
                "that complement the existing analysis."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "swot", data
            )
            
            return {
                "suggestions": suggestions,
                "analysis_type": "swot",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        elif action == "validate":
            return await ai_service.validate_analysis(
                json.dumps(data), "swot"
            )
        
        return {}
    
    async def _handle_cog_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """
        Handle Center of Gravity analysis with AI.
        
        Args:
            data: COG data
            action: Analysis action
            
        Returns:
            Dict: AI analysis results
        """
        if action == "suggest":
            prompt = (
                f"Perform Center of Gravity analysis:\n"
                f"User Details: {data.get('user_details', '')}\n"
                f"Desired End State: {data.get('desired_end_state', '')}\n"
                f"Current Entities: {data.get('entities', [])}\n\n"
                "Identify:\n"
                "1. Critical Centers of Gravity\n"
                "2. Critical Capabilities\n"
                "3. Critical Requirements\n"
                "4. Critical Vulnerabilities\n\n"
                "Return as JSON with keys: centers_of_gravity, "
                "critical_capabilities, critical_requirements, critical_vulnerabilities"
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "cog", data
            )
            
            return {
                "suggestions": suggestions,
                "analysis_type": "cog",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        return {}
    
    async def _handle_pmesii_pt_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """
        Handle PMESII-PT analysis with AI.
        
        Args:
            data: PMESII-PT data
            action: Analysis action
            
        Returns:
            Dict: AI analysis results
        """
        if action == "suggest":
            components = [
                "political", "military", "economic", "social",
                "infrastructure", "information", "physical_environment", "time"
            ]
            
            prompt = (
                f"Analyze this scenario using PMESII-PT framework:\n"
                f"Scenario: {data.get('scenario', 'Not specified')}\n\n"
            )
            
            for component in components:
                prompt += f"{component.title()}: {data.get(component, {})}\n"
            
            prompt += (
                "\nProvide comprehensive analysis for each PMESII-PT component. "
                "Return as JSON with keys for each component containing "
                "detailed insights and recommendations."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "pmesii_pt", data
            )
            
            return {
                "suggestions": suggestions,
                "analysis_type": "pmesii_pt",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        return {}
    
    async def _handle_dotmlpf_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle DOTMLPF analysis with AI."""
        if action == "suggest":
            prompt = (
                f"Analyze capability gaps using DOTMLPF framework:\n"
                f"Context: {data.get('context', '')}\n\n"
                "Assess gaps in:\n"
                "- Doctrine\n"
                "- Organization\n"
                "- Training\n"
                "- Materiel\n"
                "- Leadership\n"
                "- Personnel\n"
                "- Facilities\n\n"
                "Return as JSON with analysis for each component."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "dotmlpf", data
            )
            
            return {"suggestions": suggestions, "analysis_type": "dotmlpf"}
        
        return {}
    
    async def _handle_ach_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle Analysis of Competing Hypotheses with AI."""
        if action == "suggest":
            prompt = (
                f"Apply ACH methodology to:\n"
                f"Scenario: {data.get('scenario', '')}\n"
                f"Hypotheses: {data.get('hypotheses', [])}\n"
                f"Evidence: {data.get('evidence', [])}\n\n"
                "Evaluate each hypothesis against evidence. "
                "Return as JSON with hypothesis evaluations and recommendations."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "ach", data
            )
            
            return {"suggestions": suggestions, "analysis_type": "ach"}
        
        return {}
    
    async def _handle_deception_detection(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle deception detection analysis with AI."""
        if action == "analyze":
            prompt = (
                f"Analyze for potential deception:\n"
                f"Content: {data.get('content', '')}\n"
                f"Source: {data.get('source', 'Unknown')}\n\n"
                "Identify:\n"
                "1. Deception indicators\n"
                "2. Consistency issues\n"
                "3. Reliability assessment\n"
                "Return as JSON with detailed analysis."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "deception", data
            )
            
            return {"analysis": suggestions, "analysis_type": "deception_detection"}
        
        return {}
    
    async def _handle_behavioral_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle behavioral analysis with AI."""
        if action == "analyze":
            prompt = (
                f"Perform behavioral analysis on:\n"
                f"Subject: {data.get('subject', '')}\n"
                f"Behaviors: {data.get('behaviors', [])}\n"
                f"Context: {data.get('context', '')}\n\n"
                "Analyze patterns, motivations, and predictions. "
                "Return as JSON with behavioral insights."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "behavioral", data
            )
            
            return {"analysis": suggestions, "analysis_type": "behavioral_analysis"}
        
        return {}
    
    async def _handle_starbursting(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle starbursting analysis with AI."""
        if action == "generate":
            prompt = (
                f"Generate starbursting questions for:\n"
                f"Topic: {data.get('topic', '')}\n"
                f"Context: {data.get('context', '')}\n\n"
                "Generate comprehensive questions using:\n"
                "- Who\n- What\n- When\n- Where\n- Why\n- How\n"
                "Return as JSON with categorized questions."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "starbursting", data
            )
            
            return {"questions": suggestions, "analysis_type": "starbursting"}
        
        return {}
    
    async def _handle_causeway(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle CauseWay analysis with AI."""
        if action == "analyze":
            prompt = (
                f"Perform CauseWay issue analysis:\n"
                f"Issue: {data.get('issue', '')}\n"
                f"Context: {data.get('context', '')}\n\n"
                "Identify root causes, effects, and relationships. "
                "Return as JSON with causal analysis."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "causeway", data
            )
            
            return {"analysis": suggestions, "analysis_type": "causeway"}
        
        return {}
    
    async def _handle_dime_analysis(
        self,
        data: Dict[str, Any],
        action: str
    ) -> Dict[str, Any]:
        """Handle DIME analysis with AI."""
        if action == "suggest":
            prompt = (
                f"Analyze using DIME framework:\n"
                f"Scenario: {data.get('scenario', '')}\n"
                f"Diplomatic: {data.get('diplomatic', {})}\n"
                f"Information: {data.get('information', {})}\n"
                f"Military: {data.get('military', {})}\n"
                f"Economic: {data.get('economic', {})}\n\n"
                "Provide comprehensive DIME analysis. "
                "Return as JSON with insights for each component."
            )
            
            suggestions = await ai_service.generate_framework_suggestions(
                "dime", data
            )
            
            return {"suggestions": suggestions, "analysis_type": "dime"}
        
        return {}


# Global service instance
framework_service = FrameworkAnalysisService()