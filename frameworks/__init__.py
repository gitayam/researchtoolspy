# /researchtools_streamlit/pages/frameworks/__init__.py

# Import base framework
from frameworks.base_framework import BaseFramework

# Dictionary to store framework functions
framework_functions = {}

# Try to import each framework individually
try:
    from frameworks.swot import swot_page
    framework_functions["swot"] = swot_page
except ImportError as e:
    print(f"Warning: Could not import SWOT framework: {e}")

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
    def cog_analysis(*args, **kwargs):
        raise ImportError("COG framework not available - missing dependencies")

try:
    from frameworks.deception_detection import deception_detection
    framework_functions["deception"] = deception_detection
except ImportError as e:
    print(f"Warning: Could not import Deception Detection framework: {e}")

try:
    from frameworks.dime import dime_page
    framework_functions["dime"] = dime_page
except ImportError as e:
    print(f"Warning: Could not import DIME framework: {e}")

try:
    from frameworks.pmesii_pt import pmesii_pt_page
    framework_functions["pmesii"] = pmesii_pt_page
except ImportError as e:
    print(f"Warning: Could not import PMESII-PT framework: {e}")

try:
    from frameworks.dotmlpf import dotmlpf_page
    framework_functions["dotmlpf"] = dotmlpf_page
except ImportError as e:
    print(f"Warning: Could not import DOTMLPF framework: {e}")

try:
    from frameworks.starbursting import starbursting_page
    framework_functions["starbursting"] = starbursting_page
except ImportError as e:
    print(f"Warning: Could not import Starbursting framework: {e}")

# Create aliases for shorter imports
swot = framework_functions.get("swot")
ach = framework_functions.get("ach")
cog = framework_functions.get("cog", cog_analysis)  # Use dummy function if import failed
deception = framework_functions.get("deception")
dime = framework_functions.get("dime")
pmesii = framework_functions.get("pmesii")
dotmlpf = framework_functions.get("dotmlpf")
starbursting = framework_functions.get("starbursting")

# Framework registry functions
def get_framework(name: str):
    """Get framework function by name"""
    name = name.lower()
    if name not in framework_functions:
        raise ValueError(f"Framework '{name}' not found or not available")
    return framework_functions[name]

def get_all_frameworks():
    """Get list of all available frameworks"""
    return list(framework_functions.keys())

def list_frameworks():
    """List all available framework names"""
    return list(framework_functions.keys())

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
    'framework_functions'
]