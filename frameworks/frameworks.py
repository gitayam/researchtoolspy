import streamlit as st
from urllib.parse import urlparse, parse_qs
from typing import Dict, Type, List, Any, Callable
from frameworks.base_framework import BaseFramework

# Import frameworks with error handling
framework_functions = {}

# Try to import each framework, but continue if one fails
try:
    from frameworks.dime import dime_page
    framework_functions["dime"] = dime_page
except ImportError as e:
    print(f"Warning: Could not import DIME framework: {e}")

try:
    from frameworks.swot import swot_page
    framework_functions["swot"] = swot_page
except ImportError as e:
    print(f"Warning: Could not import SWOT framework: {e}")

try:
    from frameworks.dotmlpf import dotmlpf_page
    framework_functions["dotmlpf"] = dotmlpf_page
except ImportError as e:
    print(f"Warning: Could not import DOTMLPF framework: {e}")

try:
    from frameworks.pmesii_pt import pmesii_pt_page
    framework_functions["pmesii_pt"] = pmesii_pt_page
except ImportError as e:
    print(f"Warning: Could not import PMESII_PT framework: {e}")

try:
    from frameworks.ach import ach_page
    framework_functions["ach"] = ach_page
except ImportError as e:
    print(f"Warning: Could not import ACH framework: {e}")

try:
    from frameworks.cog import cog_analysis
    framework_functions["cog"] = cog_analysis
except ImportError as e:
    print(f"Warning: Could not import COG framework: {e}")

try:
    from frameworks.starbursting import starbursting_page
    framework_functions["starbursting"] = starbursting_page
except ImportError as e:
    print(f"Warning: Could not import Starbursting framework: {e}")

try:
    from frameworks.behavior_analysis import behavior_analysis_page
    framework_functions["behavior_analysis"] = behavior_analysis_page
except ImportError as e:
    print(f"Warning: Could not import BehaviorAnalysis framework: {e}")

try:
    from frameworks.deception_detection import deception_detection
    framework_functions["deception_detection"] = deception_detection
except ImportError as e:
    print(f"Warning: Could not import DeceptionDetection framework: {e}")

def main():
    # Parse query parameters from the URL
    query_params = st.query_params
    framework = query_params.get('framework', [None])[0]

    if framework in framework_functions:
        # Call the framework function
        framework_functions[framework]()
    else:
        st.warning("Please select a framework from the sidebar to view its details.")

class FrameworkRegistry:
    """Registry of all available analytical frameworks"""
    
    _frameworks: Dict[str, Callable] = framework_functions
    
    @classmethod
    def get_framework(cls, name: str) -> Callable:
        """Get framework function by name"""
        name = name.lower()
        if name not in cls._frameworks:
            raise ValueError(f"Framework '{name}' not found. Available frameworks: {', '.join(cls._frameworks.keys())}")
        
        return cls._frameworks[name]
    
    @classmethod
    def get_all_frameworks(cls) -> List[str]:
        """Get names of all available frameworks"""
        return list(cls._frameworks.keys())
    
    @classmethod
    def list_frameworks(cls) -> List[str]:
        """List all available framework names"""
        return list(cls._frameworks.keys())

if __name__ == "__main__":
    main() 