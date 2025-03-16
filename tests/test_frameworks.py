import pytest
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
