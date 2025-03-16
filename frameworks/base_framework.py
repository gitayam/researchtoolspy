import os
import json
from typing import Dict, List, Any, Optional, Union
from abc import ABC, abstractmethod

class BaseFramework(ABC):
    """Base class for all analytical frameworks"""
    
    def __init__(self, name: str):
        self.name = name
        self.questions: Dict[str, List[str]] = {}
        self.responses: Dict[str, Any] = {}
        self.components: List[str] = []
    
    @abstractmethod
    def generate_questions(self, component: str) -> List[str]:
        """Generate questions for a specific component"""
        pass
    
    def generate_all_questions(self) -> Dict[str, List[str]]:
        """Generate questions for all components"""
        result = {}
        for component in self.components:
            result[component] = self.generate_questions(component)
        return result
    
    def set_response(self, component: str, response: Any) -> None:
        """Set response for a component"""
        self.responses[component] = response
    
    def get_response(self, component: str) -> Any:
        """Get response for a component"""
        return self.responses.get(component)
    
    def get_all_responses(self) -> Dict[str, Any]:
        """Get all responses"""
        return self.responses
    
    def export_to_json(self, filepath: Optional[str] = None) -> str:
        """Export framework data to JSON"""
        data = {
            "framework": self.name,
            "components": self.components,
            "questions": self.questions,
            "responses": self.responses
        }
        
        if filepath:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2)
                
        return json.dumps(data, indent=2)

    def select_all(self):
        """Generate analysis for all components"""
        return self.generate_all_questions() 