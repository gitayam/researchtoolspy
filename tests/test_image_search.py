import pytest
from unittest.mock import patch, MagicMock, mock_open
from utilities.ImageSearch import calculate_image_hash, generate_search_urls

def test_calculate_image_hash():
    # Mock PIL.Image.open
    with patch("PIL.Image.open") as mock_image_open:
        mock_img = MagicMock()
        mock_image_open.return_value = mock_img
        
        # Mock imagehash.average_hash
        with patch("imagehash.average_hash") as mock_hash:
            mock_hash.return_value = "test_hash"
            
            result = calculate_image_hash("test_image.jpg")
            assert result == "test_hash"

def test_generate_search_urls():
    search_urls = generate_search_urls("abc123")
    assert "abc123" in search_urls["google"]
    assert "abc123" in search_urls["yandex"]
    assert "abc123" in search_urls["bing"]
