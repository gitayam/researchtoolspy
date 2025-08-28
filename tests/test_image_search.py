import pytest
from unittest.mock import patch, MagicMock
import importlib.util
from utilities.ImageSearch import calculate_image_hash, generate_search_urls

# Check if imagehash is installed
imagehash_installed = importlib.util.find_spec("imagehash") is not None

@pytest.mark.skipif(not imagehash_installed, reason="imagehash module not installed")
def test_calculate_image_hash():
    # Mock PIL.Image.open
    with patch("PIL.Image.open") as mock_image_open:
        mock_img = MagicMock()
        mock_image_open.return_value = mock_img
        
        # Mock imagehash.average_hash
        with patch("imagehash.average_hash") as mock_hash:
            mock_hash.return_value = "test_hash"
            
            # Import the function here to avoid import errors
            from utilities.ImageSearch import calculate_image_hash
            
            result = calculate_image_hash("test_image.jpg")
            assert result == "test_hash"
            mock_image_open.assert_called_once_with("test_image.jpg")
            mock_hash.assert_called_once_with(mock_img)

def test_generate_search_urls():
    from utilities.ImageSearch import generate_search_urls
    search_urls = generate_search_urls("abc123")
    
    # Check that the hash value is in each URL (case-insensitive)
    for engine, url in search_urls.items():
        assert "abc123" in url
    
    # Check that all expected search engines are present (case-insensitive)
    engine_names = [engine.lower() for engine in search_urls.keys()]
    assert "google" in engine_names
    assert "bing" in engine_names
    assert "yandex" in engine_names
    assert "tineye" in engine_names
