import streamlit as st
from urllib.parse import urlparse, parse_qs
from typing import Dict, Type, List, Any
from frameworks.base_framework import BaseFramework

# Import frameworks with error handling
framework_classes = {}

# Try to import each framework, but continue if one fails
try:
    from frameworks.dime import DIME
    framework_classes["dime"] = DIME
except ImportError as e:
    print(f"Warning: Could not import DIME framework: {e}")

try:
    from frameworks.swot import SWOT
    framework_classes["swot"] = SWOT
except ImportError as e:
    print(f"Warning: Could not import SWOT framework: {e}")

try:
    from frameworks.dotmlpf import DOTMLPF
    framework_classes["dotmlpf"] = DOTMLPF
except ImportError as e:
    print(f"Warning: Could not import DOTMLPF framework: {e}")

try:
    from frameworks.pmesii_pt import PMESII_PT
    framework_classes["pmesii_pt"] = PMESII_PT
except ImportError as e:
    print(f"Warning: Could not import PMESII_PT framework: {e}")

try:
    from frameworks.ach import ACH
    framework_classes["ach"] = ACH
except ImportError as e:
    print(f"Warning: Could not import ACH framework: {e}")

try:
    from frameworks.cog import COG
    framework_classes["cog"] = COG
except ImportError as e:
    print(f"Warning: Could not import COG framework: {e}")

try:
    from frameworks.starbursting import Starbursting
    framework_classes["starbursting"] = Starbursting
except ImportError as e:
    print(f"Warning: Could not import Starbursting framework: {e}")

try:
    from frameworks.behavior_analysis import BehaviorAnalysis
    framework_classes["behavior_analysis"] = BehaviorAnalysis
except ImportError as e:
    print(f"Warning: Could not import BehaviorAnalysis framework: {e}")

try:
    from frameworks.deception_detection import DeceptionDetection
    framework_classes["deception_detection"] = DeceptionDetection
except ImportError as e:
    print(f"Warning: Could not import DeceptionDetection framework: {e}")

def main():
    # Parse query parameters from the URL
    query_params = st.query_params
    framework = query_params.get('framework', [None])[0]

    if framework == 'swot':
        st.header("SWOT Analysis")
        # Add SWOT Analysis content here
    elif framework == 'ach':
        st.header("ACH Analysis")
        # Add ACH Analysis content here
    elif framework == 'cog':
        st.header("COG Analysis")
        # Add COG Analysis content here
    elif framework == 'deception':
        st.header("Deception Detection")
        # Add Deception Detection content here
    elif framework == 'dime':
        st.header("DIME Framework")
        # Add DIME Framework content here
    elif framework == 'pmesii':
        st.header("PMESII-PT Framework")
        # Add PMESII-PT Framework content here
    elif framework == 'dotmlpf':
        st.header("DOTMLPF Framework")
        # Add DOTMLPF Framework content here
    elif framework == 'starbursting':
        st.header("Starbursting")
        # Add Starbursting content here
    elif framework == 'behavior_analysis':
        st.header("Behavioral Analysis")
        # Add Behavioral Analysis content here
    else:
        st.warning("Please select a framework from the sidebar to view its details.")

class FrameworkRegistry:
    """Registry of all available analytical frameworks"""
    
    _frameworks: Dict[str, Type[BaseFramework]] = framework_classes
    
    @classmethod
    def get_framework(cls, name: str) -> BaseFramework:
        """Get framework instance by name"""
        name = name.lower()
        if name not in cls._frameworks:
            raise ValueError(f"Framework '{name}' not found. Available frameworks: {', '.join(cls._frameworks.keys())}")
        
        return cls._frameworks[name]()
    
    @classmethod
    def get_all_frameworks(cls) -> List[BaseFramework]:
        """Get instances of all available frameworks"""
        return [framework_class() for framework_class in cls._frameworks.values()]
    
    @classmethod
    def list_frameworks(cls) -> List[str]:
        """List all available framework names"""
        return list(cls._frameworks.keys())

if __name__ == "__main__":
    main() 