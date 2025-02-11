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

# Create aliases for shorter imports
swot = swot_page
ach = ach_page
cog = cog_analysis
deception = deception_detection
dime = dime_page
pmesii = pmesii_pt_page
dotmlpf = dotmlpf_page
starbursting = starbursting_page

# Export all modules
__all__ = [
    'swot',
    'ach', 
    'cog',
    'deception',
    'dime',
    'pmesii',
    'dotmlpf',
    'starbursting'
]