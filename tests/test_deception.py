import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import the DeceptionDetection class
from frameworks.deception_detection import DeceptionDetection

class TestDeceptionDetection(unittest.TestCase):
    """Test cases for the DeceptionDetection class."""
    
    def setUp(self):
        """Set up test environment."""
        # Mock streamlit session state
        self.session_state_patch = patch('streamlit.session_state', {})
        self.mock_session_state = self.session_state_patch.start()
        
    def tearDown(self):
        """Clean up after tests."""
        self.session_state_patch.stop()
    
    @patch('streamlit.title')
    @patch('streamlit.write')
    def test_render_header(self, mock_write, mock_title):
        """Test that the header renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Call the _render_header method
        dd._render_header()
        
        # Verify that the title was set correctly
        mock_title.assert_called_once_with("Deception Detection Framework")
        
        # Verify that write was called (content check not needed for this test)
        mock_write.assert_called()
    
    def test_initialize_session_state(self):
        """Test that session state is initialized with correct default values."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Call initialize_session_state
        dd.initialize_session_state()
        
        # Check that all required keys are in session_state with default values
        expected_keys = [
            "mom_responses", "pop_responses", "moses_responses", "eve_responses",
            "scenario", "search_results", "analysis_history", "current_analysis_id",
            "saved_analyses", "url_input", "scraped_content", "scraped_metadata",
            "url_analysis_summary"
        ]
        
        # Mock the session_state to simulate what would happen after initialization
        mock_session_state = {}
        for key, value in dd.initialize_session_state_dict().items():
            mock_session_state[key] = value
            
        # Check each key exists in our mocked session state
        for key in expected_keys:
            self.assertIn(key, mock_session_state)

    @patch('streamlit.text_area')
    @patch('streamlit.button')
    @patch('streamlit.markdown')
    def test_render_scenario_section(self, mock_markdown, mock_button, mock_text_area):
        """Test that the scenario section renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Mock session state
        self.mock_session_state["scenario"] = "Test scenario"
        
        # Call the _render_scenario_section method
        dd._render_scenario_section()
        
        # Verify that text_area was called with the correct parameters
        mock_text_area.assert_called_with(
            "Describe the scenario or information being analyzed",
            value="Test scenario",
            height=150,
            help="Provide detailed context about the situation where deception might be present. Include key actors, timeline, and any suspicious patterns or anomalies. If you paste a URL, the content will be automatically analyzed.",
            placeholder="Example: A foreign company has made an unexpected offer to acquire a strategic technology firm... or paste a news article URL."
        )
        
        # Verify that markdown was called (content check not needed for this test)
        mock_markdown.assert_called()
        
        # Verify that button was called (content check not needed for this test)
        mock_button.assert_called()

    @patch('streamlit.text_area')
    @patch('streamlit.button')
    @patch('streamlit.markdown')
    def test_render_mom_section(self, mock_markdown, mock_button, mock_text_area):
        """Test that the MOM section renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Mock session state
        self.mock_session_state["mom_responses"] = {"motive": "Test motive"}
        
        # Call the _render_mom_section method
        dd._render_mom_section()
        
        # Verify that text_area was called with the correct parameters
        mock_text_area.assert_called_with(
            "Answer for: What are the goals and motives of the potential deceiver?",
            value="Test motive",
            label_visibility="collapsed",
            key="mom_motive",
            height=100
        )
        
        # Verify that markdown was called (content check not needed for this test)
        mock_markdown.assert_called()
        
        # Verify that button was called (content check not needed for this test)
        mock_button.assert_called()

    @patch('streamlit.text_area')
    @patch('streamlit.button')
    @patch('streamlit.markdown')
    def test_render_pop_section(self, mock_markdown, mock_button, mock_text_area):
        """Test that the POP section renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Mock session state
        self.mock_session_state["pop_responses"] = {"history": "Test history"}
        
        # Call the _render_pop_section method
        dd._render_pop_section()
        
        # Verify that text_area was called with the correct parameters
        mock_text_area.assert_called_with(
            "Answer for: What is the history of deception by this actor or similar actors?",
            value="Test history",
            label_visibility="collapsed",
            key="pop_history",
            height=100
        )
        
        # Verify that markdown was called (content check not needed for this test)
        mock_markdown.assert_called()
        
        # Verify that button was called (content check not needed for this test)
        mock_button.assert_called()

    @patch('streamlit.text_area')
    @patch('streamlit.button')
    @patch('streamlit.markdown')
    def test_render_moses_section(self, mock_markdown, mock_button, mock_text_area):
        """Test that the MOSES section renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Mock session state
        self.mock_session_state["moses_responses"] = {"control": "Test control"}
        
        # Call the _render_moses_section method
        dd._render_moses_section()
        
        # Verify that text_area was called with the correct parameters
        mock_text_area.assert_called_with(
            "Answer for: How much control does the potential deceiver have over our sources?",
            value="Test control",
            label_visibility="collapsed",
            key="moses_control",
            height=100
        )
        
        # Verify that markdown was called (content check not needed for this test)
        mock_markdown.assert_called()
        
        # Verify that button was called (content check not needed for this test)
        mock_button.assert_called()

    @patch('streamlit.text_area')
    @patch('streamlit.button')
    @patch('streamlit.markdown')
    def test_render_eve_section(self, mock_markdown, mock_button, mock_text_area):
        """Test that the EVE section renders correctly."""
        # Create an instance of DeceptionDetection
        dd = DeceptionDetection()
        
        # Mock session state
        self.mock_session_state["eve_responses"] = {"consistency": "Test consistency"}
        
        # Call the _render_eve_section method
        dd._render_eve_section()
        
        # Verify that text_area was called with the correct parameters
        mock_text_area.assert_called_with(
            "Answer for: Is the information internally consistent?",
            value="Test consistency",
            label_visibility="collapsed",
            key="eve_consistency",
            height=100
        )
        
        # Verify that markdown was called (content check not needed for this test)
        mock_markdown.assert_called()
        
        # Verify that button was called (content check not needed for this test)
        mock_button.assert_called()

if __name__ == '__main__':
    unittest.main()
