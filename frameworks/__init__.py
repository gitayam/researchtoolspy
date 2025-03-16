# /researchtools_streamlit/pages/frameworks/__init__.py

# Import all framework modules
from frameworks.swot import swot_page
from frameworks.ach import ach_page
from frameworks.cog import cog_analysis
from frameworks.deception_detection import deception_detection
from frameworks.dime import dime_page
from frameworks.pmesii_pt import pmesii_pt_page
from frameworks.dotmlpf import dotmlpf_page
from frameworks.starbursting import starbursting_page
from frameworks.base_framework import BaseFramework

# Create aliases for shorter imports
swot = swot_page
ach = ach_page
cog = cog_analysis
deception = deception_detection
dime = dime_page
pmesii = pmesii_pt_page
dotmlpf = dotmlpf_page
starbursting = starbursting_page

# Try to import the framework registry
try:
    from frameworks.frameworks import FrameworkRegistry
    get_framework = FrameworkRegistry.get_framework
    get_all_frameworks = FrameworkRegistry.get_all_frameworks
    list_frameworks = FrameworkRegistry.list_frameworks
except ImportError as e:
    print(f"Warning: Could not import FrameworkRegistry: {e}")
    # Provide dummy functions as fallbacks
    def get_framework(name):
        raise ImportError("FrameworkRegistry not available")
    def get_all_frameworks():
        return []
    def list_frameworks():
        return []

# Try to import individual framework functions for backward compatibility
try:
    from frameworks.cog import cog_analysis
except ImportError:
    def cog_analysis(*args, **kwargs):
        raise ImportError("COG framework not available")

try:
    from frameworks.dime import dime_page
except ImportError:
    def dime_page(*args, **kwargs):
        raise ImportError("DIME framework not available")

# Export all modules
__all__ = [
    'swot',
    'ach', 
    'cog',
    'deception',
    'dime',
    'pmesii',
    'dotmlpf',
    'starbursting',
    'BaseFramework',
    'get_framework',
    'get_all_frameworks',
    'list_frameworks',
    'cog_analysis',
    'dime_page'
]