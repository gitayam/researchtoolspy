# /researchtools_streamlit/tests/test_utils_openai.py
import os
import pytest
from unittest.mock import patch
from utils_openai import generate_advanced_query

@pytest.mark.parametrize("search_platform", ["Google", "Microsoft Portal", "Windows CMD Search"])
def test_generate_advanced_query(search_platform):
    with patch("utils_openai.openai.ChatCompletion.create") as mock_create:
        # Configure the mock to return a dummy response
        mock_create.return_value = {
            "choices": [
                {"message": {"content": "Mocked advanced query"}}
            ]
        }

        result = generate_advanced_query("test search", search_platform, model="gpt-3.5-turbo")
        assert result == "Mocked advanced query"
        # Also check that openai.ChatCompletion.create was called properly
        mock_create.assert_called_once()