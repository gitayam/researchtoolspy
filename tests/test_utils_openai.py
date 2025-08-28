# /researchtools_streamlit/tests/test_utils_openai.py
import os
import pytest
from unittest.mock import patch, MagicMock
from utilities.gpt import generate_advanced_query

@pytest.mark.parametrize("search_platform", ["Google", "Microsoft Portal", "Windows CMD Search"])
def test_generate_advanced_query(search_platform):
    # Create a mock response object with the structure expected by the function
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "Mocked advanced query"
    
    # Mock the OpenAI client and its chat completion
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    
    # Directly patch the function to return the mocked response
    with patch("utilities.gpt.OPENAI_AVAILABLE", True), \
         patch("utilities.gpt.client", mock_client), \
         patch("utilities.gpt.client.chat.completions.create", return_value=mock_response):
        result = generate_advanced_query("test search", search_platform, model="gpt-3.5-turbo")
        assert result == "Mocked advanced query"