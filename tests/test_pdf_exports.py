import pytest
from unittest.mock import patch, MagicMock
import io
import logging
from utilities.url_processing import generate_pdf, check_pdf_tools_installed

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
    with patch("xhtml2pdf.pisa.CreatePDF") as mock_create_pdf:
        # Mock the PDF creation
        mock_status = MagicMock()
        mock_status.err = False
        mock_create_pdf.return_value = mock_status
        
        # Set up the side effect to write to the output
        def side_effect(_, dest):
            dest.write(b"%PDF-1.4 test pdf content")
            return mock_status
        
        mock_create_pdf.side_effect = side_effect
        
        result = generate_pdf(card_data)
        
        # Assert that result is bytes and not empty
        assert isinstance(result, bytes)
        assert len(result) > 0
        
        # Check PDF content
        assert b"%PDF" in result

def test_async_generate_pdf_from_url():
    """Test the webpage PDF generation function"""
    # Mock URL
    url = "https://example.com"
    
    # Import the function here to ensure the patch works
    from utilities.url_processing import async_generate_pdf_from_url
    
    # Test case 1: pdfkit succeeds
    with patch("utilities.url_processing.generate_pdf_from_url") as mock_generate_pdf:
        with patch("utilities.url_processing.generate_pdf_using_playwright") as mock_playwright_pdf:
            # Set up the mocks
            mock_generate_pdf.return_value = b"%PDF-1.4 test pdf content"  # pdfkit succeeds
            
            result = async_generate_pdf_from_url(url)
            
            # Assert that result is bytes and not empty
            assert isinstance(result, bytes)
            assert len(result) > 0
            
            # Check PDF content
            assert b"%PDF" in result
            
            # Verify that only pdfkit was called
            mock_generate_pdf.assert_called_once_with(url)
            mock_playwright_pdf.assert_not_called()
    
    # Test case 2: pdfkit fails, xhtml2pdf fails, playwright succeeds
    with patch("utilities.url_processing.generate_pdf_from_url") as mock_generate_pdf:
        with patch("utilities.url_processing.generate_pdf_using_playwright") as mock_playwright_pdf:
            with patch("requests.get") as mock_requests_get:
                with patch("xhtml2pdf.pisa.CreatePDF") as mock_create_pdf:
                    # Set up the mocks
                    mock_generate_pdf.return_value = None  # pdfkit fails
                    mock_requests_get.side_effect = Exception("Request failed")  # xhtml2pdf fails
                    mock_playwright_pdf.return_value = b"%PDF-1.4 test pdf content"  # playwright succeeds
                    
                    result = async_generate_pdf_from_url(url)
                    
                    # Assert that result is bytes and not empty
                    assert isinstance(result, bytes)
                    assert len(result) > 0
                    
                    # Check PDF content
                    assert b"%PDF" in result
                    
                    # Verify that both methods were attempted
                    mock_generate_pdf.assert_called_once_with(url)
                    mock_playwright_pdf.assert_called_once_with(url)

def test_playwright_pdf_generation():
    """Test the Playwright PDF generation function"""
    # Mock URL
    url = "https://example.com"
    
    # We need to patch the import inside the function
    with patch("playwright.sync_api.sync_playwright") as mock_playwright:
        # Set up the mock playwright instance
        mock_page = MagicMock()
        mock_page.pdf.return_value = b"%PDF-1.4 test pdf content"
        
        mock_browser = MagicMock()
        mock_browser.new_page.return_value = mock_page
        
        mock_playwright_instance = MagicMock()
        mock_playwright_instance.chromium.launch.return_value = mock_browser
        
        # Configure the context manager to return our mock
        mock_playwright.return_value.__enter__.return_value = mock_playwright_instance
        
        # Import the function here to ensure the patch works
        from utilities.url_processing import generate_pdf_using_playwright
        
        result = generate_pdf_using_playwright(url)
        
        # Assert that result is bytes and not empty
        assert isinstance(result, bytes)
        assert len(result) > 0
        
        # Check PDF content
        assert b"%PDF" in result 

def test_check_pdf_tools_installed():
    """Test the check_pdf_tools_installed function"""
    with patch("os.path.exists") as mock_exists:
        with patch("importlib.util.find_spec") as mock_find_spec:
            # Configure mocks
            mock_exists.return_value = False
            mock_find_spec.return_value = None
            
            # Call the function
            result = check_pdf_tools_installed()
            
            # Check the result
            assert isinstance(result, dict)
            assert "xhtml2pdf" in result
            assert "wkhtmltopdf" in result
            assert "playwright" in result
            
            # xhtml2pdf should always be True as it's a Python package
            assert result["xhtml2pdf"] is True 