"""
Security hardening test suite.
Tests API functionality after security improvements.
"""

from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.main import app


class TestSecurityHardening:
    """Test security hardening features."""

    @pytest.fixture
    async def client(self):
        """Create test client."""
        async with AsyncClient(app=app, base_url="http://testserver") as ac:
            yield ac

    @pytest.mark.asyncio
    async def test_cors_security(self, client):
        """Test CORS configuration is secure."""
        # Test that disallowed origin is blocked
        response = await client.get(
            "/",
            headers={"Origin": "https://malicious-site.com"}
        )

        # Should not have CORS headers for disallowed origins
        assert "Access-Control-Allow-Origin" not in response.headers or \
               response.headers.get("Access-Control-Allow-Origin") != "https://malicious-site.com"

    @pytest.mark.asyncio
    async def test_security_headers(self, client):
        """Test security headers are present."""
        response = await client.get("/")

        # Check for security headers
        expected_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Referrer-Policy",
            "Content-Security-Policy"
        ]

        for header in expected_headers:
            assert header in response.headers, f"Missing security header: {header}"

    @pytest.mark.asyncio
    async def test_rate_limiting(self, client):
        """Test rate limiting functionality."""
        if not settings.ENABLE_RATE_LIMITING:
            pytest.skip("Rate limiting disabled")

        # Make multiple requests rapidly
        responses = []
        for i in range(settings.MAX_REQUESTS_PER_MINUTE + 5):
            response = await client.get("/health")
            responses.append(response)

            # Should eventually get rate limited
            if response.status_code == 429:
                break

        # Check that we got rate limited
        rate_limited = any(r.status_code == 429 for r in responses)
        assert rate_limited or len(responses) <= settings.MAX_REQUESTS_PER_MINUTE

    @pytest.mark.asyncio
    async def test_mock_auth_disabled_by_default(self, client):
        """Test that mock authentication is disabled by default."""
        # Try to login with mock credentials
        login_data = {
            "username": "admin",
            "password": "admin"
        }

        response = await client.post("/api/v1/auth/login", data=login_data)

        # Should fail if mock auth is disabled (default)
        if not settings.ENABLE_MOCK_AUTH:
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_web_scraping_url_validation(self, client):
        """Test web scraping URL validation."""
        # Test blocked internal URL
        scraping_request = {
            "url": "http://127.0.0.1:8080/admin",
            "extract_images": False,
            "extract_links": False
        }

        response = await client.post(
            "/api/v1/tools/web-scraping/scrape",
            json=scraping_request
        )

        # Should reject internal/private URLs
        assert response.status_code in [400, 422]  # Validation error

        # Test allowed URL
        allowed_request = {
            "url": "https://wikipedia.org/wiki/Test",
            "extract_images": False,
            "extract_links": False
        }

        # This might fail due to auth, but shouldn't fail due to URL validation
        response = await client.post(
            "/api/v1/tools/web-scraping/scrape",
            json=allowed_request
        )

        # Should not be a validation error (422)
        assert response.status_code != 422

    @pytest.mark.asyncio
    async def test_request_size_validation(self, client):
        """Test request size validation."""
        # Create large payload
        large_data = "x" * (settings.MAX_UPLOAD_SIZE + 1000)

        response = await client.post(
            "/api/v1/tools/web-scraping/scrape",
            json={"url": "https://wikipedia.org", "large_field": large_data},
            headers={"Content-Length": str(len(large_data) + 100)}
        )

        # Should reject large requests
        assert response.status_code == 413  # Request Entity Too Large

    @pytest.mark.asyncio
    async def test_trusted_host_validation(self, client):
        """Test trusted host middleware."""
        # Test request with invalid host header
        response = await client.get(
            "/",
            headers={"Host": "malicious-host.com"}
        )

        # In production, should reject invalid hosts
        if settings.ENVIRONMENT == "production":
            assert response.status_code == 400  # Bad Request

    @pytest.mark.asyncio
    async def test_api_docs_security(self, client):
        """Test API documentation security."""
        # Check docs endpoints
        docs_response = await client.get("/api/v1/docs")
        redoc_response = await client.get("/api/v1/redoc")
        openapi_response = await client.get("/api/v1/openapi.json")

        if settings.ENVIRONMENT == "production":
            # Should be disabled in production
            assert docs_response.status_code == 404
            assert redoc_response.status_code == 404
            assert openapi_response.status_code == 404
        else:
            # Should be available in development
            assert docs_response.status_code in [200, 401]  # May require auth

    @pytest.mark.asyncio
    async def test_error_information_disclosure(self, client):
        """Test that errors don't leak sensitive information."""
        # Test invalid endpoint
        response = await client.get("/api/v1/nonexistent")

        # Should not expose internal details
        error_text = response.text.lower()
        sensitive_keywords = [
            "traceback", "exception", "sqlalchemy", "database",
            "internal server", "stack trace", "debug"
        ]

        for keyword in sensitive_keywords:
            assert keyword not in error_text, f"Error response contains sensitive keyword: {keyword}"


class TestFunctionalityPreservation:
    """Test that security changes don't break functionality."""

    @pytest.fixture
    async def client(self):
        """Create test client."""
        async with AsyncClient(app=app, base_url="http://testserver") as ac:
            yield ac

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Test basic health check still works."""
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client):
        """Test root endpoint still works."""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data

    @pytest.mark.asyncio
    @patch("app.core.config.settings.ENABLE_MOCK_AUTH", True)
    async def test_mock_auth_when_enabled(self, client):
        """Test mock auth works when explicitly enabled."""
        login_data = {
            "username": "admin",
            "password": "admin"
        }

        response = await client.post("/api/v1/auth/login", data=login_data)

        # Should work when mock auth is enabled
        if settings.ENVIRONMENT == "development":
            assert response.status_code in [200, 500]  # May fail due to DB, but not auth

    @pytest.mark.asyncio
    async def test_frameworks_endpoint_accessible(self, client):
        """Test that frameworks endpoint is accessible."""
        response = await client.get("/api/v1/frameworks/")

        # Should not be blocked by security (may require auth)
        assert response.status_code in [200, 401]  # Either works or needs auth

    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, client):
        """Test rate limit headers are present."""
        if not settings.ENABLE_RATE_LIMITING:
            pytest.skip("Rate limiting disabled")

        response = await client.get("/health")

        # Check for rate limit headers
        rate_limit_headers = [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset"
        ]

        for header in rate_limit_headers:
            assert header in response.headers


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
