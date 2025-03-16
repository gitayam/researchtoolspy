import pytest
import io
from unittest.mock import patch, MagicMock
from utilities.url_processing import generate_pdf, async_generate_pdf_from_url, display_link_card, wayback_tool_page

def test_generate_pdf():
    """Test the card PDF generation function"""
    # Sample card data
    card_data = {
        "url": "https://example.com",
        "archived_url": "https://web.archive.org/web/20230101000000/https://example.com",
        "citation": "Example citation",
        "metadata": {
            "title": "Example Title",
            "description": "Example description",
            "keywords": "example, test",
            "author": "Test Author",
            "date_published": "2023-01-01"
        }
    }
    
    # Call the function
    result = generate_pdf(card_data)
    
    # Assert that result is bytes and not empty
    assert isinstance(result, bytes)
    assert len(result) > 0
    
    # Optionally check PDF content
    assert b"%PDF" in result  # PDF files start with %PDF

def test_async_generate_pdf_from_url():
    """Test the webpage PDF generation function"""
    # Mock URL
    url = "https://example.com"
    
    # Call the function
    result = async_generate_pdf_from_url(url)
    
    # Assert that result is bytes and not empty
    assert isinstance(result, bytes)
    assert len(result) > 0
    
    # Optionally check PDF content
    assert b"%PDF" in result  # PDF files start with %PDF

@pytest.mark.streamlit
def test_display_link_card():
    """Test the display_link_card function with mocked Streamlit components"""
    with patch("streamlit.columns") as mock_columns:
        # Mock column objects
        col1 = MagicMock()
        col2 = MagicMock()
        mock_columns.return_value = [col1, col2]
        
        # Mock session_state
        with patch("streamlit.session_state", {}):
            # Mock button click
            col1.button.return_value = True
            
            # Mock PDF generation
            with patch("utilities.url_processing.generate_pdf") as mock_generate_pdf:
                mock_generate_pdf.return_value = b"%PDF-1.4 test pdf content"
                
                # Call the function
                display_link_card(
                    url="https://example.com",
                    citation="Example citation",
                    title="Example Title",
                    description="Example description",
                    keywords="example, test",
                    author="Test Author",
                    date_published="2023-01-01"
                )
                
                # Assert PDF generation was called
                mock_generate_pdf.assert_called_once()

def test_wayback_tool_page():
    """Test the wayback_tool_page function"""
    # Mock URL
    url = "https://example.com"
    
    # Call the function
    result = wayback_tool_page(url)
    
    # Assert that result is bytes and not empty
    assert isinstance(result, bytes)
    assert len(result) > 0
    
    # Optionally check PDF content
    assert b"%PDF" in result  # PDF files start with %PDF 