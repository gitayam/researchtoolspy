import pytest
from unittest.mock import patch, MagicMock
from utilities.url_processing import archive_url

def test_archive_url():
    with patch("requests.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"archived_url": "https://web.archive.org/web/123/http://example.com"}
        mock_post.return_value = mock_response
        
        result = archive_url("http://example.com")
        assert "web.archive.org" in result
        mock_post.assert_called_once()
