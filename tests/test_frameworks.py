import os
import sys

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

import pytest
import streamlit as st
from pages.Frameworks import frameworks_page, framework_sidebar
import importlib
from unittest.mock import patch, MagicMock
from frameworks.swot import process_swot_analysis
from frameworks.ach import calculate_consistency_score

def test_process_swot_analysis():
    with patch("streamlit.session_state", {"swot_strengths": ["S1", "S2"]}):
        result = process_swot_analysis()
        assert "S1" in result["strengths"]
        assert "S2" in result["strengths"]

def test_calculate_consistency_score():
    # Test with various combinations of evidence and hypotheses
    score = calculate_consistency_score({"E1": "CC", "E2": "I"})
    assert score == 1.0  # CC (2.0) + I (-1.0) = 1.0
    
    score = calculate_consistency_score({"E1": "CC", "E2": "CC"})
    assert score > 0  # Consistent evidence should result in positive score

def test_frameworks_page_rendering():
    """Test that the frameworks page renders correctly"""
    with patch('streamlit.title'):
        frameworks_page()

def test_framework_navigation():
    """Test framework navigation and internal links"""
    # Test all framework mappings
    framework_param_map = {
        "SWOT": "swot",
        "DIME": "dime",
        "COG": "cog",
        "PMESII": "pmesii_pt",
        "DOTMLPF": "dotmlpf",
        "ACH": "ach",
        "STARBURSTING": "starbursting",
        "DECEPTION": "deception_detection",
        "BEHAVIOR": "behavior_analysis",
        "FLOW": "fundamental_flow"
    }
    
    framework_modules = {
        "swot": "frameworks.swot",
        "dime": "frameworks.dime",
        "cog": "frameworks.cog",
        "pmesii_pt": "frameworks.pmesii_pt",
        "dotmlpf": "frameworks.dotmlpf",
        "ach": "frameworks.ach",
        "starbursting": "frameworks.starbursting",
        "deception_detection": "frameworks.deception_detection",
        "behavior_analysis": "frameworks.behavior_analysis",
        "fundamental_flow": "frameworks.fundamental_flow"
    }
    
    # Framework display names mapping
    framework_display_names = {
        "SWOT": "SWOT Analysis",
        "DIME": "DIME Framework",
        "COG": "COG Analysis",
        "PMESII": "PMESII-PT Framework",
        "DOTMLPF": "DOTMLPF Framework",
        "ACH": "ACH Analysis",
        "STARBURSTING": "Starbursting",
        "DECEPTION": "Deception Detection",
        "BEHAVIOR": "Behavioral Analysis",
        "FLOW": "Fundamental Flow"
    }

    # Mock streamlit functions
    with patch('streamlit.sidebar.radio') as mock_radio, \
         patch('streamlit.sidebar.button') as mock_button, \
         patch('streamlit.query_params', new_callable=MagicMock) as mock_params, \
         patch('importlib.import_module') as mock_import, \
         patch('streamlit.session_state', new_callable=dict) as mock_state:
        
        # Test each framework navigation
        for internal_name, param_value in framework_param_map.items():
            # Setup mock returns
            display_name = framework_display_names[internal_name]
            mock_radio.return_value = display_name
            mock_button.return_value = False
            mock_params.get.return_value = param_value
            mock_state.clear()
            
            # Create a mock module
            mock_module = MagicMock()
            mock_import.return_value = mock_module
            
            # Call the framework page
            frameworks_page()
            
            # Verify importlib tried to import the correct module
            expected_module = framework_modules[param_value]
            mock_import.assert_called_with(expected_module)
            
            # Reset mocks for next iteration
            mock_import.reset_mock()

def test_framework_sidebar_state():
    """Test that framework sidebar maintains correct state"""
    with patch('streamlit.sidebar.radio') as mock_radio, \
         patch('streamlit.sidebar.button') as mock_button, \
         patch('streamlit.session_state', new_callable=dict) as mock_state:
        
        # Initialize session state
        mock_state.clear()
        
        # Test selecting a framework updates session state
        mock_radio.return_value = "Fundamental Flow"
        mock_button.return_value = False
        
        framework_sidebar()
        
        assert mock_state.get("current_framework") == "FLOW"

def test_framework_param_consistency():
    """Test that framework parameter mappings are consistent across all locations"""
    # Framework options from sidebar
    framework_options = {
        "SWOT Analysis": "SWOT",
        "DIME Framework": "DIME",
        "COG Analysis": "COG",
        "PMESII-PT Framework": "PMESII",
        "DOTMLPF Framework": "DOTMLPF",
        "ACH Analysis": "ACH",
        "Starbursting": "STARBURSTING",
        "Deception Detection": "DECEPTION",
        "Behavioral Analysis": "BEHAVIOR",
        "Fundamental Flow": "FLOW"
    }
    
    # Parameter map
    framework_param_map = {
        "SWOT": "swot",
        "DIME": "dime",
        "COG": "cog",
        "PMESII": "pmesii_pt",
        "DOTMLPF": "dotmlpf",
        "ACH": "ach",
        "STARBURSTING": "starbursting",
        "DECEPTION": "deception_detection",
        "BEHAVIOR": "behavior_analysis",
        "FLOW": "fundamental_flow"
    }
    
    # Framework module map
    framework_map = {
        "swot": {"module": "frameworks.swot", "function": "swot_page"},
        "ach": {"module": "frameworks.ach", "function": "ach_page"},
        "cog": {"module": "frameworks.cog", "function": "cog_analysis"},
        "deception_detection": {"module": "frameworks.deception_detection", "function": "deception_detection"},
        "dime": {"module": "frameworks.dime", "function": "dime_page"},
        "pmesii_pt": {"module": "frameworks.pmesii_pt", "function": "pmesii_pt_page"},
        "dotmlpf": {"module": "frameworks.dotmlpf", "function": "dotmlpf_page"},
        "starbursting": {"module": "frameworks.starbursting", "function": "starbursting_page"},
        "behavior_analysis": {"module": "frameworks.behavior_analysis", "function": "behavior_analysis_page"},
        "fundamental_flow": {"module": "frameworks.fundamental_flow", "function": "fundamental_flow_page"}
    }
    
    # Test that all framework options have corresponding parameter mappings
    for display_name, internal_name in framework_options.items():
        assert internal_name in framework_param_map, f"Missing parameter mapping for {display_name}"
        param_value = framework_param_map[internal_name]
        assert param_value in framework_map, f"Missing framework implementation for {display_name}"

def test_legacy_parameter_handling():
    """Test that legacy parameters are handled correctly"""
    with patch('streamlit.query_params', new_callable=MagicMock) as mock_params, \
         patch('importlib.import_module') as mock_import, \
         patch('streamlit.session_state', new_callable=dict) as mock_state:
        
        # Initialize session state
        mock_state.clear()
        
        # Test pmesii -> pmesii_pt mapping
        mock_params.get.return_value = "pmesii"
        frameworks_page()
        mock_import.assert_called_with("frameworks.pmesii_pt")
        
        # Test deception -> deception_detection mapping
        mock_params.reset_mock()
        mock_params.get.return_value = "deception"
        frameworks_page()
        mock_import.assert_called_with("frameworks.deception_detection")
