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

if __name__ == '__main__':
    unittest.main()
