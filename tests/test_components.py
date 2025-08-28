import pytest
from unittest.mock import patch
from components.sidebar_menu import sidebar_menu

def test_sidebar_menu():
    with patch("streamlit.sidebar.markdown") as mock_markdown:
        sidebar_menu()
        assert mock_markdown.call_count > 0
