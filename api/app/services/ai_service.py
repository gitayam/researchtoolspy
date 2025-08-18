"""
AI Service for GPT-5-mini integration.
Provides intelligent analysis capabilities for intel analysts and researchers.
"""

import json
import os
from typing import Any, Dict, List, Optional

import httpx
from openai import AsyncOpenAI, OpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class AIAnalysisRequest(BaseModel):
    """AI analysis request model."""
    prompt: str
    context: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    framework_type: Optional[str] = None
    system_prompt: Optional[str] = None


class AIAnalysisResponse(BaseModel):
    """AI analysis response model."""
    content: str
    tokens_used: int
    model: str
    framework_type: Optional[str] = None


class IntelligenceAnalysisService:
    """
    Service for AI-powered intelligence analysis using GPT-4o-mini.
    Optimized for intel analysts and researchers with fast, cost-effective AI.
    """
    
    def __init__(self):
        """Initialize AI service with OpenAI client."""
        self.client = None
        self.async_client = None
        self.model = "gpt-5-mini"  # Fast, cost-effective model
        
        # Check for API key in settings or environment
        api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get('OPENAI_API_KEY')
        
        if api_key and api_key not in ("", "YOUR_OPENAI_API_KEY_HERE"):
            self.client = OpenAI(api_key=api_key)
            self.async_client = AsyncOpenAI(api_key=api_key)
            logger.info(f"AI Service initialized with model: {self.model}")
        else:
            logger.warning("OpenAI API key not configured - AI features will be limited")
    
    async def analyze(
        self,
        request: AIAnalysisRequest
    ) -> AIAnalysisResponse:
        """
        Perform AI analysis using GPT-5.
        
        Args:
            request: Analysis request with prompt and parameters
            
        Returns:
            AIAnalysisResponse: AI-generated analysis
        """
        if not self.async_client:
            raise ValueError("OpenAI API key not configured")
        
        try:
            # Prepare system prompt for intelligence analysis
            system_prompt = request.system_prompt or self._get_intel_system_prompt(
                request.framework_type
            )
            
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            if request.context:
                messages.append({
                    "role": "user",
                    "content": f"Context: {request.context}"
                })
            
            messages.append({"role": "user", "content": request.prompt})
            
            # Call GPT-4o-mini API
            response = await self.async_client.chat.completions.create(
                model=self.model,  # Use GPT-4o-mini
                messages=messages,
                max_tokens=request.max_tokens or getattr(settings, 'OPENAI_MAX_TOKENS', 1500),
                temperature=request.temperature or getattr(settings, 'OPENAI_TEMPERATURE', 0.7),
            )
            
            # Extract response
            content = response.choices[0].message.content
            tokens_used = response.usage.total_tokens if response.usage else 0
            
            logger.info(
                f"AI analysis completed - Model: {self.model}, "
                f"Tokens: {tokens_used}, Framework: {request.framework_type}"
            )
            
            return AIAnalysisResponse(
                content=content,
                tokens_used=tokens_used,
                model=self.model,
                framework_type=request.framework_type
            )
            
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            raise
    
    def _get_intel_system_prompt(self, framework_type: Optional[str] = None) -> str:
        """
        Get specialized system prompt for intelligence analysis.
        
        Args:
            framework_type: Type of analysis framework
            
        Returns:
            str: System prompt optimized for intel analysis
        """
        base_prompt = (
            "You are an expert intelligence analyst assistant powered by GPT-4o-mini. "
            "You provide comprehensive, objective, and actionable intelligence analysis "
            "for professional analysts and researchers. Your responses should be:\n"
            "- Structured and systematic\n"
            "- Evidence-based and factual\n"
            "- Clear about certainty levels and assumptions\n"
            "- Focused on actionable insights\n"
            "- Aware of potential biases and alternative hypotheses\n"
        )
        
        framework_prompts = {
            "swot": (
                "Focus on strategic analysis using the SWOT framework. "
                "Identify and analyze Strengths, Weaknesses, Opportunities, and Threats. "
                "Provide specific, measurable insights for each category."
            ),
            "cog": (
                "Apply Center of Gravity analysis methodology. "
                "Identify critical capabilities, requirements, and vulnerabilities. "
                "Focus on strategic centers that, if affected, would have decisive impact."
            ),
            "pmesii_pt": (
                "Analyze using the PMESII-PT framework. "
                "Systematically examine Political, Military, Economic, Social, "
                "Infrastructure, Information, Physical Environment, and Time factors."
            ),
            "ach": (
                "Apply Analysis of Competing Hypotheses methodology. "
                "Identify multiple hypotheses, evaluate evidence systematically, "
                "and assess the relative probability of each hypothesis."
            ),
            "deception": (
                "Focus on deception detection and analysis. "
                "Identify potential deception indicators, analyze consistency, "
                "and assess the reliability of information sources."
            ),
        }
        
        if framework_type and framework_type.lower() in framework_prompts:
            return f"{base_prompt}\n\n{framework_prompts[framework_type.lower()]}"
        
        return base_prompt
    
    async def generate_framework_suggestions(
        self,
        framework_type: str,
        current_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate AI suggestions for framework analysis.
        
        Args:
            framework_type: Type of framework
            current_data: Current framework data
            
        Returns:
            Dict containing AI-generated suggestions
        """
        prompt = self._build_framework_prompt(framework_type, current_data)
        
        request = AIAnalysisRequest(
            prompt=prompt,
            framework_type=framework_type,
            temperature=0.7,
            max_tokens=1500
        )
        
        response = await self.analyze(request)
        
        try:
            # Try to parse as JSON if the response is structured
            suggestions = json.loads(response.content)
        except json.JSONDecodeError:
            # If not JSON, return as text suggestions
            suggestions = {"suggestions": response.content}
        
        return suggestions
    
    def _build_framework_prompt(
        self,
        framework_type: str,
        current_data: Dict[str, Any]
    ) -> str:
        """
        Build prompt for framework-specific suggestions.
        
        Args:
            framework_type: Type of framework
            current_data: Current framework data
            
        Returns:
            str: Constructed prompt
        """
        prompts = {
            "swot": (
                f"Based on this partial SWOT analysis:\n{json.dumps(current_data, indent=2)}\n\n"
                "Provide additional insights and suggestions for each category. "
                "Return as JSON with keys: strengths, weaknesses, opportunities, threats. "
                "Each should be an array of specific, actionable points."
            ),
            "cog": (
                f"Given this COG analysis context:\n{json.dumps(current_data, indent=2)}\n\n"
                "Identify critical centers of gravity, their critical capabilities, "
                "critical requirements, and critical vulnerabilities. "
                "Return as structured JSON."
            ),
            "pmesii_pt": (
                f"Based on this PMESII-PT analysis:\n{json.dumps(current_data, indent=2)}\n\n"
                "Provide comprehensive analysis for each factor. "
                "Return as JSON with keys for each PMESII-PT component."
            ),
        }
        
        return prompts.get(
            framework_type,
            f"Analyze this data and provide insights:\n{json.dumps(current_data, indent=2)}"
        )
    
    async def validate_analysis(
        self,
        content: str,
        framework_type: str
    ) -> Dict[str, Any]:
        """
        Validate and enhance analysis content using AI.
        
        Args:
            content: Analysis content to validate
            framework_type: Type of framework
            
        Returns:
            Dict containing validation results and suggestions
        """
        prompt = (
            f"Review this {framework_type} analysis for:\n"
            "1. Completeness and thoroughness\n"
            "2. Logical consistency\n"
            "3. Potential biases or gaps\n"
            "4. Supporting evidence quality\n\n"
            f"Analysis:\n{content}\n\n"
            "Provide feedback as JSON with keys: "
            "completeness_score (0-100), issues (array), suggestions (array)"
        )
        
        request = AIAnalysisRequest(
            prompt=prompt,
            framework_type=framework_type,
            temperature=0.3,  # Lower temperature for validation
            max_tokens=1000
        )
        
        response = await self.analyze(request)
        
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return {
                "completeness_score": 0,
                "issues": ["Could not parse validation response"],
                "suggestions": [response.content]
            }
    
    async def extract_entities(
        self,
        text: str
    ) -> List[Dict[str, str]]:
        """
        Extract entities from text for intelligence analysis.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of extracted entities
        """
        prompt = (
            "Extract all relevant entities from this text for intelligence analysis. "
            "Include: persons, organizations, locations, events, concepts. "
            f"Text:\n{text}\n\n"
            "Return as JSON array with objects containing: "
            "name, type, relevance, context"
        )
        
        request = AIAnalysisRequest(
            prompt=prompt,
            temperature=0.3,
            max_tokens=1000
        )
        
        response = await self.analyze(request)
        
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse entity extraction response")
            return []
    
    async def generate_5w_analysis(self, content: str) -> Dict[str, str]:
        """
        Extract 5W (Who, What, Where, When, Why) information from content.
        Specifically for Starbursting framework.
        """
        if not self.async_client:
            return {
                "who": "AI unavailable - configure OpenAI API key",
                "what": "AI unavailable", 
                "where": "AI unavailable",
                "when": "AI unavailable",
                "why": "AI unavailable"
            }
        
        prompt = f"""Analyze this content and extract the 5W information:
        
Content: {content[:3000]}

Provide concise analysis for each:
- WHO: Key people, organizations, entities
- WHAT: Main events, actions, topics  
- WHERE: Locations, contexts
- WHEN: Time periods, dates
- WHY: Reasons, motivations

Format as:
WHO: [analysis]
WHAT: [analysis]
WHERE: [analysis]
WHEN: [analysis]
WHY: [analysis]"""

        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert analyst extracting key information."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.5
            )
            
            result = response.choices[0].message.content
            analysis = {}
            
            for line in result.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    if key in ['who', 'what', 'where', 'when', 'why']:
                        analysis[key] = value.strip()
            
            for key in ['who', 'what', 'where', 'when', 'why']:
                if key not in analysis:
                    analysis[key] = "Not identified"
            
            return analysis
            
        except Exception as e:
            logger.error(f"5W analysis error: {e}")
            return {k: "Analysis failed" for k in ['who', 'what', 'where', 'when', 'why']}
    
    async def generate_starbursting_questions(self, central_idea: str, context: str = "") -> List[str]:
        """
        Generate expansion questions for Starbursting framework.
        """
        if not self.async_client:
            return [
                f"Who are the key stakeholders in {central_idea}?",
                f"What are the main components of {central_idea}?",
                f"Where does {central_idea} apply?",
                f"When is {central_idea} relevant?",
                f"Why is {central_idea} important?",
                f"How can {central_idea} be implemented?"
            ]
        
        prompt = f"""Generate 6-8 expansion questions for Starbursting analysis.

Central Idea: {central_idea}
{f'Context: {context[:1000]}' if context else ''}

Create specific questions starting with Who, What, Where, When, Why, How.
One question per line."""

        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert in Starbursting analysis."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            questions = response.choices[0].message.content.strip().split('\n')
            return [q.strip() for q in questions if q.strip()]
            
        except Exception as e:
            logger.error(f"Question generation error: {e}")
            return [f"Who is involved?", f"What is happening?", f"Where?", f"When?", f"Why?", f"How?"]
    
    async def summarize_content(self, content: str, max_length: int = 200) -> str:
        """Generate a concise summary."""
        if not self.async_client:
            sentences = content.split('. ')[:3]
            return '. '.join(sentences) + '.'
        
        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional summarizer."},
                    {"role": "user", "content": f"Summarize in {max_length} words:\n\n{content[:4000]}"}
                ],
                max_tokens=max_length * 2,
                temperature=0.5
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Summarization error: {e}")
            return content[:500]
    
    async def generate_dime_suggestions(self, scenario: str, objective: str) -> Dict[str, List[str]]:
        """Generate DIME framework suggestions."""
        if not self.async_client:
            return {
                "diplomatic": ["Establish diplomatic channels"],
                "information": ["Develop information campaign"],
                "military": ["Assess military readiness"],
                "economic": ["Analyze economic impacts"]
            }
        
        prompt = f"""Analyze using DIME framework:
Scenario: {scenario}
Objective: {objective}

Provide 2-3 recommendations for each:
DIPLOMATIC: [recommendations]
INFORMATION: [recommendations]
MILITARY: [recommendations]
ECONOMIC: [recommendations]"""

        try:
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a DIME analysis expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.6
            )
            
            result = response.choices[0].message.content
            dime = {"diplomatic": [], "information": [], "military": [], "economic": []}
            current = None
            
            for line in result.split('\n'):
                if 'DIPLOMATIC' in line.upper(): current = 'diplomatic'
                elif 'INFORMATION' in line.upper(): current = 'information'
                elif 'MILITARY' in line.upper(): current = 'military'
                elif 'ECONOMIC' in line.upper(): current = 'economic'
                elif line.strip().startswith('-') and current:
                    dime[current].append(line[1:].strip())
            
            return dime
            
        except Exception as e:
            logger.error(f"DIME analysis error: {e}")
            return {"diplomatic": [], "information": [], "military": [], "economic": []}


# Global service instance
ai_service = IntelligenceAnalysisService()