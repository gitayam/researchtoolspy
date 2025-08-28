"""
Tests for health check endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_endpoint(client: AsyncClient):
    """Test root endpoint returns correct information."""
    response = await client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert "environment" in data
    assert data["message"] == "OmniCore API is running"


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test basic health check endpoint."""
    response = await client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_detailed_health_check(client: AsyncClient):
    """Test detailed health check with database status."""
    response = await client.get("/api/v1/health/detailed")
    
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "service" in data
    assert data["service"] == "omnicore-api"