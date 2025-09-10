"""
Causeway Framework API Endpoints

COG-based causal pathway analysis endpoints with AI enhancements.
"""

from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import json
import logging
from datetime import datetime

from app.services.ai_service import IntelligenceAnalysisService

router = APIRouter()

# Initialize AI service
ai_service = IntelligenceAnalysisService()

# Data Models
class ThreatSuggestionsRequest(BaseModel):
    issue: str = Field(..., description="Issue of concern")
    location: str = Field(..., description="Location context")

class UltimateTargetsRequest(BaseModel):
    issue: str = Field(..., description="Issue of concern")
    location: str = Field(..., description="Location context")
    threat: str = Field(..., description="Primary threat")

class CapabilitiesRequest(BaseModel):
    target_name: str = Field(..., description="Ultimate target name")
    target_objective: str = Field(..., description="Target's objective")
    issue: str = Field(..., description="Issue of concern")
    threat: str = Field(..., description="Primary threat")
    location: str = Field(..., description="Location context")

class RequirementsRequest(BaseModel):
    target_name: str = Field(..., description="Ultimate target name")
    capability: str = Field(..., description="Critical capability")
    target_objective: str = Field(..., description="Target's objective")
    issue: str = Field(..., description="Issue of concern")
    threat: str = Field(..., description="Primary threat")
    location: str = Field(..., description="Location context")

class ProximateTargetsRequest(BaseModel):
    target_name: str = Field(..., description="Ultimate target name")
    capability: str = Field(..., description="Critical capability")
    requirement: str = Field(..., description="Critical requirement")
    target_objective: str = Field(..., description="Target's objective")
    issue: str = Field(..., description="Issue of concern")
    threat: str = Field(..., description="Primary threat")
    location: str = Field(..., description="Location context")

# Helper Functions
def validate_causeway_request(request_data: Dict[str, Any]) -> bool:
    """Validate basic Causeway analysis request data."""
    required_fields = ["issue", "location"]
    return all(request_data.get(field) for field in required_fields)

def build_causeway_context(request_data: Dict[str, Any]) -> str:
    """Build context string for AI analysis."""
    context_parts = []
    if request_data.get("issue"):
        context_parts.append(f"Issue: {request_data['issue']}")
    if request_data.get("location"):
        context_parts.append(f"Location: {request_data['location']}")
    if request_data.get("threat"):
        context_parts.append(f"Threat: {request_data['threat']}")
    return "\\n".join(context_parts)

# API Endpoints

@router.post("/ai/threat-suggestions")
async def generate_threat_suggestions(request: ThreatSuggestionsRequest) -> Dict[str, Any]:
    """Generate AI-powered threat suggestions for Causeway analysis."""
    try:
        threat_prompt = f"""
        As a strategic planning AI specialized in identifying threats to specific issues, analyze this scenario:
        
        Issue: {request.issue}
        Location: {request.location}
        
        Identify 10 significant threats to the specified issue in this location. Each threat should be:
        - A general situation or phenomenon, not naming specific actors
        - Concise (3-7 words)
        - Focused on the threat itself, not its consequences
        - Relevant to the geographic and contextual setting
        
        Examples of well-formed threats:
        - "Water pollution from industrial waste"
        - "Decreased trust in election integrity"
        - "Disinformation campaigns targeting youth"
        
        Return only the threats as a numbered list, one per line.
        """
        
        threat_analysis = await ai_service.analyze_with_ai_detailed(
            threat_prompt, 
            "threat_identification",
            temperature=0.8,
            max_tokens=500
        )
        
        # Parse threats from AI response
        threat_lines = [line.strip() for line in threat_analysis["analysis"].split("\\n") if line.strip()]
        threats = []
        
        for line in threat_lines:
            # Remove numbering if present
            clean_threat = line
            if ". " in line and line[0].isdigit():
                clean_threat = line.split(". ", 1)[1] if len(line.split(". ", 1)) > 1 else line
            if clean_threat and len(clean_threat.split()) >= 2:
                threats.append(clean_threat)
        
        return {
            "threats": threats[:10],  # Limit to 10 threats
            "count": len(threats[:10]),
            "context": {
                "issue": request.issue,
                "location": request.location
            },
            "analysis_metadata": {
                "model": threat_analysis.get("model", "gpt-4o-mini"),
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "threat_identification"
            }
        }
        
    except Exception as e:
        logging.error(f"Threat suggestion generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate threat suggestions: {str(e)}")

@router.post("/ai/ultimate-targets")
async def generate_ultimate_targets(request: UltimateTargetsRequest) -> Dict[str, Any]:
    """Generate AI-powered ultimate target suggestions for Causeway analysis."""
    try:
        targets_prompt = f"""
        As a strategic planning AI specialized in COG analysis, identify ultimate targets for this scenario:
        
        Issue: {request.issue}
        Location: {request.location}
        Threat: {request.threat}
        
        Identify 8-10 specific, named entities (organizations or individuals) that directly pose this threat to the issue in this location. Focus on:
        - Ultimate targets that directly create or perpetuate the threat
        - Named entities, not generic categories
        - Entities with sufficient influence to meaningfully impact the issue
        - Mix of different types of actors (governmental, corporate, individual, etc.)
        
        Avoid entities that merely facilitate the threat - focus on primary actors.
        
        Return only the entity names as a numbered list, one per line.
        """
        
        targets_analysis = await ai_service.analyze_with_ai_detailed(
            targets_prompt,
            "ultimate_target_identification", 
            temperature=0.7,
            max_tokens=600
        )
        
        # Parse targets from AI response
        target_lines = [line.strip() for line in targets_analysis["analysis"].split("\\n") if line.strip()]
        targets = []
        
        for line in target_lines:
            # Remove numbering if present
            clean_target = line
            if ". " in line and line[0].isdigit():
                clean_target = line.split(". ", 1)[1] if len(line.split(". ", 1)) > 1 else line
            if clean_target and len(clean_target.strip()) > 2:
                targets.append(clean_target.strip())
        
        return {
            "targets": targets[:10],  # Limit to 10 targets
            "count": len(targets[:10]),
            "context": {
                "issue": request.issue,
                "location": request.location,
                "threat": request.threat
            },
            "analysis_metadata": {
                "model": targets_analysis.get("model", "gpt-4o-mini"),
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "ultimate_target_identification"
            }
        }
        
    except Exception as e:
        logging.error(f"Ultimate targets generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate ultimate targets: {str(e)}")

@router.post("/ai/critical-capabilities")
async def generate_critical_capabilities(request: CapabilitiesRequest) -> Dict[str, Any]:
    """Generate AI-powered critical capabilities for an ultimate target."""
    try:
        capabilities_prompt = f"""
        As a strategic planning AI specialized in COG analysis, identify critical capabilities for this ultimate target:
        
        Target: {request.target_name}
        Target Objective: {request.target_objective}
        Issue: {request.issue}
        Threat: {request.threat}
        Location: {request.location}
        
        List 5-7 Critical Capabilities that this target performs to achieve its objective and pose the threat. Ensure each capability:
        - Begins with an action verb
        - Is specific to this named entity, not generic to its class
        - Focuses on functions and abilities, not what these require
        - Does not combine conceptually distinct things
        - Is concise without explanatory text
        
        Examples:
        - "Coordinate disinformation narratives across platforms"
        - "Mobilize grassroots support through local networks"
        - "Influence policy through lobbying relationships"
        
        Return only the capabilities as a numbered list, one per line.
        """
        
        capabilities_analysis = await ai_service.analyze_with_ai_detailed(
            capabilities_prompt,
            "capability_analysis",
            temperature=0.7,
            max_tokens=700
        )
        
        # Parse capabilities from AI response
        capability_lines = [line.strip() for line in capabilities_analysis["analysis"].split("\\n") if line.strip()]
        capabilities = []
        
        for line in capability_lines:
            # Remove numbering if present
            clean_capability = line
            if ". " in line and line[0].isdigit():
                clean_capability = line.split(". ", 1)[1] if len(line.split(". ", 1)) > 1 else line
            if clean_capability and len(clean_capability.strip()) > 5:
                capabilities.append(clean_capability.strip())
        
        return {
            "capabilities": capabilities[:7],  # Limit to 7 capabilities
            "count": len(capabilities[:7]),
            "context": {
                "target_name": request.target_name,
                "target_objective": request.target_objective,
                "issue": request.issue,
                "threat": request.threat,
                "location": request.location
            },
            "analysis_metadata": {
                "model": capabilities_analysis.get("model", "gpt-4o-mini"),
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "capability_analysis"
            }
        }
        
    except Exception as e:
        logging.error(f"Critical capabilities generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate critical capabilities: {str(e)}")

@router.post("/ai/critical-requirements")
async def generate_critical_requirements(request: RequirementsRequest) -> Dict[str, Any]:
    """Generate AI-powered critical requirements for a capability."""
    try:
        requirements_prompt = f"""
        As a strategic planning AI specialized in COG analysis, identify critical requirements for this capability:
        
        Target: {request.target_name}
        Target Objective: {request.target_objective}
        Critical Capability: {request.capability}
        Issue: {request.issue}
        Threat: {request.threat}
        Location: {request.location}
        
        Identify 5-6 Critical Requirements for this capability. Critical Requirements are essential conditions, resources, and means that enable the capability to be fully operational. Focus on:
        - What the target absolutely needs to execute this capability
        - Resources, conditions, or dependencies that if removed would cripple the capability
        - Specific requirements, not generic categories
        - Requirements that could realistically be targeted or disrupted
        
        Examples:
        - "Access to encrypted communication channels"
        - "Network of trusted local intermediaries"
        - "Consistent funding stream from donors"
        
        Return only the requirements as a numbered list, one per line.
        """
        
        requirements_analysis = await ai_service.analyze_with_ai_detailed(
            requirements_prompt,
            "requirement_analysis",
            temperature=0.7,
            max_tokens=600
        )
        
        # Parse requirements from AI response
        requirement_lines = [line.strip() for line in requirements_analysis["analysis"].split("\\n") if line.strip()]
        requirements = []
        
        for line in requirement_lines:
            # Remove numbering if present
            clean_requirement = line
            if ". " in line and line[0].isdigit():
                clean_requirement = line.split(". ", 1)[1] if len(line.split(". ", 1)) > 1 else line
            if clean_requirement and len(clean_requirement.strip()) > 5:
                requirements.append(clean_requirement.strip())
        
        return {
            "requirements": requirements[:6],  # Limit to 6 requirements
            "count": len(requirements[:6]),
            "context": {
                "target_name": request.target_name,
                "capability": request.capability,
                "target_objective": request.target_objective,
                "issue": request.issue,
                "threat": request.threat,
                "location": request.location
            },
            "analysis_metadata": {
                "model": requirements_analysis.get("model", "gpt-4o-mini"),
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "requirement_analysis"
            }
        }
        
    except Exception as e:
        logging.error(f"Critical requirements generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate critical requirements: {str(e)}")

@router.post("/ai/proximate-targets")
async def generate_proximate_targets(request: ProximateTargetsRequest) -> Dict[str, Any]:
    """Generate AI-powered proximate targets for a requirement."""
    try:
        proximate_prompt = f"""
        As a strategic planning AI specialized in COG analysis, identify proximate targets for this requirement:
        
        Ultimate Target: {request.target_name}
        Target Objective: {request.target_objective}
        Critical Capability: {request.capability}
        Critical Requirement: {request.requirement}
        Issue: {request.issue}
        Threat: {request.threat}
        Location: {request.location}
        
        List 5-6 real-world entities (organizations, companies, individuals) that the ultimate target relies upon to support this critical requirement. Focus on:
        - Named entities the ultimate target depends on
        - Entities that if disrupted would impact the requirement
        - Mix of different types of dependencies (financial, operational, informational, etc.)
        - Entities that are realistically identifiable and targetable
        
        Examples:
        - "Deutsche Bank" (financial dependency)
        - "Telegram messaging platform" (communication dependency)
        - "Local militia commander Ahmed Hassan" (operational dependency)
        
        Return only the entity names as a numbered list, one per line.
        """
        
        proximate_analysis = await ai_service.analyze_with_ai_detailed(
            proximate_prompt,
            "proximate_target_analysis",
            temperature=0.7,
            max_tokens=600
        )
        
        # Parse proximate targets from AI response
        proximate_lines = [line.strip() for line in proximate_analysis["analysis"].split("\\n") if line.strip()]
        proximate_targets = []
        
        for line in proximate_lines:
            # Remove numbering if present
            clean_target = line
            if ". " in line and line[0].isdigit():
                clean_target = line.split(". ", 1)[1] if len(line.split(". ", 1)) > 1 else line
            if clean_target and len(clean_target.strip()) > 2:
                proximate_targets.append(clean_target.strip())
        
        return {
            "proximate_targets": proximate_targets[:6],  # Limit to 6 targets
            "count": len(proximate_targets[:6]),
            "context": {
                "target_name": request.target_name,
                "capability": request.capability,
                "requirement": request.requirement,
                "target_objective": request.target_objective,
                "issue": request.issue,
                "threat": request.threat,
                "location": request.location
            },
            "analysis_metadata": {
                "model": proximate_analysis.get("model", "gpt-4o-mini"),
                "timestamp": datetime.now().isoformat(),
                "analysis_type": "proximate_target_analysis"
            }
        }
        
    except Exception as e:
        logging.error(f"Proximate targets generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate proximate targets: {str(e)}")

@router.get("/analysis-template")
async def get_causeway_analysis_template() -> Dict[str, Any]:
    """Get the Causeway analysis template structure."""
    return {
        "template": {
            "scenario": {
                "issue": "",
                "location": "",
                "threat": ""
            },
            "ultimate_targets": [],
            "analysis_components": {
                "capabilities": {},
                "requirements": {},
                "proximate_targets": {}
            }
        },
        "guidelines": {
            "issue": "Should be neutrally framed, not as a threat (e.g., 'environmental sustainability', 'free speech')",
            "threat": "Should describe a phenomenon that poses risk to the issue, without naming responsible parties",
            "ultimate_targets": "Named entities that directly pose the threat to the issue",
            "capabilities": "Primary abilities/actions that enable the target to achieve its objective",
            "requirements": "Essential conditions, resources, means needed for capabilities to function",
            "proximate_targets": "Entities that ultimate targets rely on to satisfy their requirements"
        },
        "methodology": "Center of Gravity (COG) framework for strategic analysis",
        "created_at": datetime.now().isoformat()
    }

# Health check endpoint
@router.get("/health")
async def causeway_health_check() -> Dict[str, str]:
    """Health check for Causeway framework endpoints."""
    return {
        "status": "healthy",
        "framework": "causeway",
        "version": "1.0.0",
        "ai_service": "available" if ai_service else "unavailable"
    }