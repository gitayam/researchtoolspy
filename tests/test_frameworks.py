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

def test_cog_ui_ux_components():
    """Test that all UI/UX components of the COG framework are present and functional"""
    with patch('streamlit.session_state', new_callable=dict) as mock_state, \
         patch('streamlit.tabs') as mock_tabs, \
         patch('streamlit.button') as mock_button, \
         patch('streamlit.text_input') as mock_text_input, \
         patch('streamlit.text_area') as mock_text_area, \
         patch('streamlit.selectbox') as mock_selectbox, \
         patch('streamlit.markdown') as mock_markdown, \
         patch('streamlit.columns') as mock_columns, \
         patch('streamlit.expander') as mock_expander, \
         patch('streamlit.container') as mock_container:
        
        # Initialize session state
        mock_state.clear()
        mock_state["capabilities"] = []
        mock_state["requirements_text"] = ""
        mock_state["vulnerabilities_dict"] = {}
        mock_state["final_cog"] = ""
        mock_state["current_suggestions"] = None
        mock_state["cog_graph"] = None
        mock_state["vulnerability_scores"] = {}
        mock_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]
        mock_state["cog_suggestions"] = []
        mock_state["assumptions"] = []
        
        mock_tabs.return_value = [MagicMock(), MagicMock(), MagicMock(), MagicMock()]
        # Make columns return a list of the requested length
        def mock_columns_side_effect(*args):
            if not args:
                return [MagicMock(), MagicMock()]
            if isinstance(args[0], int):
                return [MagicMock() for _ in range(args[0])]
            if isinstance(args[0], (list, tuple)):
                return [MagicMock() for _ in range(len(args[0]))]
            return [MagicMock(), MagicMock()]
        mock_columns.side_effect = mock_columns_side_effect
        mock_expander.return_value.__enter__.return_value = MagicMock()
        mock_container.return_value.__enter__.return_value = MagicMock()
        
        # Import the cog module
        from frameworks.cog import cog_analysis, initialize_session_state
        
        # Test basic UI structure
        cog_analysis()
        
        # Verify tabs are created with correct labels
        mock_tabs.assert_called_once_with([
            "🎯 Basic Info & AI Analysis",
            "🔄 Capabilities & Requirements",
            "⚠️ Vulnerabilities & Scoring",
            "📊 Visualization & Export"
        ])
        
        # Verify entity input fields
        mock_selectbox.assert_any_call(
            "Entity Type",
            ["Friendly", "Opponent", "Host Nation", "Customer"],
            help="Select the type of entity you're analyzing"
        )
        
        mock_text_input.assert_any_call(
            "Entity Name",
            help="Enter a clear identifier for the entity"
        )
        
        # Verify text areas for entity details
        mock_text_area.assert_any_call(
            "Entity Goals",
            help="What are the entity's primary objectives?",
            height=100
        )
        
        mock_text_area.assert_any_call(
            "Areas of Presence",
            help="Where does this entity operate or have influence?",
            height=100
        )
        
        # Verify AI generation button
        mock_button.assert_any_call(
            "🤖 Generate Complete COG Analysis",
            type="primary",
            use_container_width=True
        )
        
        # Verify session state initialization
        assert "capabilities" in mock_state
        assert "requirements_text" in mock_state
        assert "vulnerabilities_dict" in mock_state
        assert "final_cog" in mock_state
        assert "current_suggestions" in mock_state
        assert "cog_graph" in mock_state
        assert "vulnerability_scores" in mock_state
        assert "criteria" in mock_state
        assert "cog_suggestions" in mock_state
        assert "assumptions" in mock_state

def test_cog_theme_visibility():
    """Test that COG framework UI elements are visible in both light and dark themes"""
    with patch('streamlit.session_state', new_callable=dict) as mock_state, \
         patch('streamlit.markdown') as mock_markdown, \
         patch('streamlit.button') as mock_button:
        
        # Import the cog module
        from frameworks.cog import display_ai_suggestions
        
        # Test suggestions with light theme
        test_suggestions = {
            'cog': {
                'name': 'Test COG',
                'description': 'Test Description',
                'rationale': 'Test Rationale'
            },
            'capabilities': [{
                'name': 'Test Capability',
                'type': 'Test Type',
                'importance': 8,
                'rationale': 'Test Rationale'
            }],
            'requirements': [{
                'capability': 'Test Capability',
                'items': ['Test Requirement']
            }],
            'vulnerabilities': [{
                'capability': 'Test Capability',
                'items': [{
                    'name': 'Test Vulnerability',
                    'impact': 7,
                    'rationale': 'Test Rationale'
                }]
            }]
        }
        
        # Initialize required session state
        mock_state["capabilities"] = []
        mock_state["vulnerabilities_dict"] = {}
        mock_state["requirements_text"] = ""
        mock_state["final_cog"] = ""
        mock_state["current_suggestions"] = None
        mock_state["cog_graph"] = None
        mock_state["vulnerability_scores"] = {}
        mock_state["criteria"] = ["Impact", "Attainability", "Strategic Advantage Potential"]
        mock_state["cog_suggestions"] = []
        
        # Verify CSS includes both light and dark theme variables
        display_ai_suggestions(test_suggestions)
        
        # Check that theme-specific styles are included
        css_calls = [call for call in mock_markdown.call_args_list if 'style' in str(call)]
        css_content = str(css_calls[0])
        
        # Verify essential style elements
        assert 'background-color:' in css_content
        assert 'color:' in css_content
        assert '.suggestion-card' in css_content
        assert '.importance-high' in css_content
        assert '.importance-medium' in css_content
        assert '.importance-low' in css_content
        
        # Verify contrast ratios in style definitions
        assert 'box-shadow:' in css_content
        
        # Verify text content is wrapped in appropriate containers
        content_calls = [call for call in mock_markdown.call_args_list if 'suggestion-card' in str(call)]
        assert len(content_calls) > 0
        
        # Get all markdown calls that aren't style-related
        content_calls = [call for call in mock_markdown.call_args_list if 'style' not in str(call)]
        assert len(content_calls) > 0
        
        # Check that at least one call contains a suggestion card
        found_suggestion_card = False
        for call in content_calls:
            call_content = str(call)
            if '<div class="suggestion-card">' in call_content:
                found_suggestion_card = True
                assert '<h4>' in call_content or '<h5>' in call_content
                assert '<p>' in call_content
                break
        assert found_suggestion_card, "No suggestion card found in markdown calls"
