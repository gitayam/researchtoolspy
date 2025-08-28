import pytest
from unittest.mock import patch, MagicMock
from utilities.url_processing import extract_domain, clean_url, fetch_wayback_snapshots

def test_extract_domain():
    assert extract_domain("https://www.example.com/page") == "example.com"
    assert extract_domain("http://subdomain.example.co.uk/test?q=1") == "example.co.uk"
    
def test_clean_url():
    assert clean_url("https://www.example.com/page?utm_source=test") == "https://www.example.com/page"
    assert clean_url("https://example.com/path//to///page") == "https://example.com/path/to/page"

@pytest.mark.parametrize("status_code", [200, 404, 500])
def test_fetch_wayback_snapshots(status_code):
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = status_code
        if status_code == 200:
            mock_response.json.return_value = {"archived_snapshots": {"closest": {"url": "test_url"}}}
        mock_get.return_value = mock_response
        
        result = fetch_wayback_snapshots("https://example.com")
        if status_code == 200:
            assert "test_url" in result
        else:
            assert result is None
