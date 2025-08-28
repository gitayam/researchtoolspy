import pytest
from utilities.helpers import clean_text

def test_clean_text():
    # Test URL removal
    text = "Visit https://example.com for more info"
    assert "https://example.com" not in clean_text(text, remove_urls=True)
    
    # Test special character removal
    text = "Hello! This has special chars: @#$%"
    assert "@#$%" not in clean_text(text, remove_special_chars=True)
    
    # Test lowercase conversion
    text = "UPPERCASE TEXT"
    assert clean_text(text, lowercase=True) == "uppercase text"
    
    # Test empty input
    assert clean_text("") == ""
    assert clean_text(None) == ""
