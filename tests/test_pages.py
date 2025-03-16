import pytest
from unittest.mock import patch, MagicMock
import streamlit as st
from pages.Frameworks import frameworks_page
from pages.Tools import transformers_page
from pages.Transformers import transformers_page as data_transformers_page

@pytest.mark.parametrize("framework", [None, "swot", "ach", "cog", "pmesii_pt"])
def test_frameworks_page_rendering(framework, monkeypatch):
    # Mock st.query_params
    with patch("streamlit.query_params", {"framework": framework}):
        # Mock sidebar_menu and framework_sidebar
        with patch("pages.Frameworks.sidebar_menu"), patch("pages.Frameworks.framework_sidebar"):
            # Mock importlib.import_module for framework modules
            with patch("importlib.import_module") as mock_import:
                mock_module = MagicMock()
                mock_import.return_value = mock_module
                # Test that the page renders without errors
                frameworks_page()
                if framework:
                    # Verify the correct module was imported
                    mock_import.assert_called()
