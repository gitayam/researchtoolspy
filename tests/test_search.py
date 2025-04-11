# tests/test_search.py
import os
import sys
import pytest
from unittest.mock import patch, MagicMock

# Add the project root to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from utilities.search_generator import perform_search

def test_perform_search_basic():
    """Test basic search functionality with static data"""
    # Test with a term that should match Panama-related references
    results = perform_search("panama")
    assert len(results) == 2
    assert "Control the Panama Canal" in results
    assert "Economic Influence in Panama" in results
    
    # Test with a term that should match Article-related references
    results = perform_search("article")
    assert len(results) == 1
    assert "Article 1" in results
    
    # Test with a non-existent term
    results = perform_search("nonexistent")
    assert len(results) == 0

def test_perform_search_case_insensitive():
    """Test that search is case insensitive"""
    results_lower = perform_search("panama")
    results_upper = perform_search("PANAMA")
    results_mixed = perform_search("Panama")
    
    # All searches should return the same results regardless of case
    assert results_lower == results_upper
    assert results_upper == results_mixed
    assert len(results_lower) == 2

@pytest.mark.parametrize("query,expected_count,expected_title", [
    ("panama", 2, "Control the Panama Canal"),
    ("article", 1, "Article 1"),
    ("research", 1, "Research Paper A"),
    ("economic", 1, "Economic Influence in Panama"),
    ("nonexistent", 0, None)
])
def test_perform_search_parametrized(query, expected_count, expected_title):
    """Test search with different parameters"""
    results = perform_search(query)
    assert len(results) == expected_count
    
    if expected_title:
        assert expected_title in results
    else:
        assert len(results) == 0

def test_search_references_function():
    """Test the search_references function in the COG framework"""
    # Import perform_search module
    import utilities.search_generator
    
    # We need to import here to avoid circular imports
    from frameworks.cog import search_references
    
    # Mock the streamlit components and perform_search
    with patch("streamlit.text_input", return_value="panama"), \
         patch("streamlit.button", return_value=True), \
         patch("streamlit.markdown") as mock_markdown, \
         patch("streamlit.info") as mock_info, \
         patch("streamlit.warning") as mock_warning, \
         patch("streamlit.subheader"), \
         patch("utilities.search_generator.perform_search", return_value={
             "Control the Panama Canal": "https://example.com/panama-canal",
             "Economic Influence in Panama": "https://example.com/economic-influence"
         }):
        
        # Call the function
        search_references()
        
        # Verify results were displayed correctly
        expected_results = [
            f"- [Control the Panama Canal](https://example.com/panama-canal)",
            f"- [Economic Influence in Panama](https://example.com/economic-influence)"
        ]
        
        # Check that markdown was called for each result
        assert mock_markdown.call_count >= 2
        for expected in expected_results:
            mock_markdown.assert_any_call(expected)
        
        # Info and warning should not have been called
        mock_info.assert_not_called()
        mock_warning.assert_not_called()

def test_search_references_empty_query():
    """Test search_references function with an empty query"""
    from frameworks.cog import search_references
    
    # Mock the streamlit components
    with patch("streamlit.text_input", return_value=""), \
         patch("streamlit.button", return_value=True), \
         patch("streamlit.warning") as mock_warning, \
         patch("streamlit.subheader"):
        
        # Call the function
        search_references()
        
        # Verify warning was displayed
        mock_warning.assert_called_once_with("Please enter a search query.")

def test_search_references_no_results():
    """Test search_references function when no results are found"""
    import utilities.search_generator
    from frameworks.cog import search_references
    
    # Mock the streamlit components and perform_search to return empty results
    with patch("streamlit.text_input", return_value="nonexistent"), \
         patch("streamlit.button", return_value=True), \
         patch("streamlit.info") as mock_info, \
         patch("streamlit.subheader"), \
         patch("utilities.search_generator.perform_search", return_value={}):
        
        # Call the function
        search_references()
        
        # Verify info message was displayed
        mock_info.assert_called_once_with("No results found for your search.")

def test_search_references_not_clicked():
    """Test search_references function when the button is not clicked"""
    from frameworks.cog import search_references
    
    # Mock the streamlit components
    with patch("streamlit.text_input", return_value="panama"), \
         patch("streamlit.button", return_value=False), \
         patch("streamlit.markdown") as mock_markdown, \
         patch("streamlit.subheader"):
        
        # Call the function
        search_references()
        
        # Verify that no results were displayed
        mock_markdown.assert_not_called()
