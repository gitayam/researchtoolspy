import unittest
from unittest.mock import patch, MagicMock
import streamlit as st
import json
from frameworks.cog import (
    initialize_session_state,
    get_fallback_suggestions,
    clean_json_response,
    generate_cog_recommendations,
    generate_cog,
    manage_capabilities,
    manage_requirements,
    visualize_cog_network
)

class TestCOGAnalysis(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test"""
        # Mock streamlit session state
        if not hasattr(st, 'session_state'):
            st.session_state = {}
        
        # Test data
        self.test_entity = {
            'type': 'Opponent',
            'name': 'Test Entity',
            'goals': 'Test Goals',
            'presence': 'Test Areas',
            'desired_end_state': 'Test End State'
        }

    def tearDown(self):
        """Clean up after each test"""
        st.session_state.clear()

    def test_initialize_session_state(self):
        """Test session state initialization"""
        initialize_session_state()
        
        # Check that all required keys are present
        required_keys = [
            "capabilities",
            "requirements_text",
            "vulnerabilities_dict",
            "final_cog",
            "current_suggestions",
            "cog_graph",
            "vulnerability_scores",
            "criteria",
            "cog_suggestions",
            "entity_name",
            "entity_type",
            "entity_goals",
            "entity_presence",
            "domain_answers",
            "requirements",
            "vulnerabilities",
            "final_scores",
            "desired_end_state"
        ]
        
        for key in required_keys:
            self.assertIn(key, st.session_state)
            
        # Check default values
        self.assertEqual(st.session_state["capabilities"], [])
        self.assertEqual(st.session_state["requirements_text"], "")
        self.assertEqual(st.session_state["vulnerabilities_dict"], {})
        self.assertEqual(st.session_state["requirements"], {})  # Check that requirements is initialized as empty dict

    def test_get_fallback_suggestions(self):
        """Test fallback suggestions generation"""
        result = get_fallback_suggestions(
            self.test_entity['type'],
            self.test_entity['name'],
            self.test_entity['goals'],
            self.test_entity['presence'],
            self.test_entity['desired_end_state']
        )
        
        # Check structure of fallback suggestions
        self.assertIn('cog', result)
        self.assertIn('capabilities', result)
        self.assertIn('requirements', result)
        self.assertIn('vulnerabilities', result)
        
        # Check that entity name is used in fallback COG
        self.assertEqual(result['cog']['name'], self.test_entity['name'])

    def test_clean_json_response(self):
        """Test JSON response cleaning"""
        # Test markdown code block removal
        markdown_input = "```json\n{\"test\": \"value\"}\n```"
        expected = "{\"test\": \"value\"}"
        self.assertEqual(clean_json_response(markdown_input), expected)
        
        # Test handling of mixed content
        mixed_input = "Here's the JSON: {\"test\": \"value\"} and some extra text"
        self.assertEqual(clean_json_response(mixed_input), "{\"test\": \"value\"}")
        
        # Test nested JSON handling
        nested_input = "{\"outer\": {\"inner\": \"value\"}}"
        self.assertEqual(clean_json_response(nested_input), nested_input)

    @patch('frameworks.cog.get_chat_completion')
    def test_generate_cog_recommendations(self, mock_get_chat_completion):
        """Test COG recommendations generation"""
        # Mock successful API response
        mock_get_chat_completion.return_value = "COG 1; COG 2; COG 3"
        
        result = generate_cog_recommendations(
            self.test_entity['type'],
            self.test_entity['name'],
            self.test_entity['goals'],
            self.test_entity['presence'],
            self.test_entity['desired_end_state']
        )
        
        self.assertEqual(len(result), 3)
        self.assertIsInstance(result, list)
        
        # Test API failure handling
        mock_get_chat_completion.side_effect = Exception("API Error")
        result = generate_cog_recommendations(
            self.test_entity['type'],
            self.test_entity['name'],
            self.test_entity['goals'],
            self.test_entity['presence'],
            self.test_entity['desired_end_state']
        )
        
        self.assertEqual(len(result), 3)  # Should return default suggestions
        self.assertIn("Command and Control Network", result)

    @patch('frameworks.cog.get_completion')
    def test_generate_cog(self, mock_get_completion):
        """Test COG generation"""
        initialize_session_state()
        
        # Mock successful API response
        mock_get_completion.return_value = "Test COG 1; Test COG 2; Test COG 3"
        
        # Mock streamlit button
        with patch('streamlit.button') as mock_button:
            mock_button.return_value = True
            generate_cog(
                self.test_entity['type'],
                self.test_entity['name'],
                self.test_entity['goals'],
                self.test_entity['presence'],
                self.test_entity['desired_end_state']
            )
        
        self.assertIn("cog_suggestions", st.session_state)
        self.assertEqual(len(st.session_state["cog_suggestions"]), 3)
        
        # Test error handling
        mock_get_completion.side_effect = Exception("API Error")
        with patch('streamlit.button') as mock_button:
            mock_button.return_value = True
            generate_cog(
                self.test_entity['type'],
                self.test_entity['name'],
                self.test_entity['goals'],
                self.test_entity['presence'],
                self.test_entity['desired_end_state']
            )
        
        # Should still have suggestions from fallback
        self.assertIn("cog_suggestions", st.session_state)
        self.assertGreater(len(st.session_state["cog_suggestions"]), 0)

    @patch('frameworks.cog.get_chat_completion')
    def test_manage_capabilities(self, mock_get_chat_completion):
        """Test capabilities management"""
        initialize_session_state()
        st.session_state["final_cog"] = "Test COG"
        
        # Mock successful API response
        mock_get_chat_completion.return_value = "Capability 1; Capability 2; Capability 3"
        
        # Test adding a capability manually
        with patch('streamlit.text_input') as mock_input:
            mock_input.return_value = "Test Capability"
            with patch('streamlit.button') as mock_button:
                mock_button.return_value = True
                manage_capabilities(
                    "Test COG",
                    self.test_entity['type'],
                    self.test_entity['name'],
                    self.test_entity['goals'],
                    self.test_entity['presence']
                )
        
        self.assertIn("capabilities", st.session_state)
        self.assertIn("Test Capability", st.session_state["capabilities"])
        
        # Test AI suggestion handling
        mock_get_chat_completion.side_effect = Exception("API Error")
        with patch('streamlit.button') as mock_button:
            mock_button.return_value = True
            manage_capabilities(
                "Test COG",
                self.test_entity['type'],
                self.test_entity['name'],
                self.test_entity['goals'],
                self.test_entity['presence']
            )

    def test_manage_requirements(self):
        """Test requirements management"""
        initialize_session_state()
        test_capability = "Test Capability"
        
        # Test adding a requirement manually
        with patch('streamlit.text_input') as mock_input:
            mock_input.return_value = "Test Requirement"
            with patch('streamlit.button') as mock_button:
                mock_button.return_value = True
                manage_requirements(test_capability)
        
        self.assertIn("requirements", st.session_state)
        self.assertIn(test_capability, st.session_state["requirements"])
        self.assertIn("Test Requirement", st.session_state["requirements"][test_capability])

    @patch('networkx.spring_layout')
    def test_visualize_cog_network(self, mock_spring_layout):
        """Test network visualization"""
        # Mock networkx layout
        mock_spring_layout.return_value = {
            'node1': [0, 0],
            'node2': [1, 1]
        }
        
        # Test with valid input
        result = visualize_cog_network(
            cog="Test COG",
            capabilities=["Capability 1", "Capability 2"],
            vulnerabilities_dict={"Capability 1": ["Vulnerability 1"]},
            requirements_text="Requirement 1; Requirement 2"
        )
        
        self.assertIsNotNone(result)
        self.assertTrue(hasattr(result, 'number_of_nodes'))
        self.assertTrue(hasattr(result, 'number_of_edges'))
        
        # Test with empty input
        result = visualize_cog_network("", [], {}, "")
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main() 