import pytest
from unittest.mock import patch, MagicMock
from utilities.social_media_download import extract_platform, validate_url

def test_extract_platform():
    assert extract_platform("https://twitter.com/user/status/123") == "twitter"
    assert extract_platform("https://www.instagram.com/p/abc123/") == "instagram"
    assert extract_platform("https://www.youtube.com/watch?v=abc123") == "youtube"
    assert extract_platform("https://invalid-platform.com") == "unknown"

def test_validate_url():
    assert validate_url("https://twitter.com/user/status/123") is True
    assert validate_url("not-a-url") is False
    assert validate_url("ftp://example.com") is False
