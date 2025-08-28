"""
Tests for authentication endpoints.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_registration(client: AsyncClient, mock_user_data: dict):
    """Test user registration endpoint."""
    response = await client.post(
        "/api/v1/auth/register",
        json=mock_user_data
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == mock_user_data["username"]
    assert data["email"] == mock_user_data["email"]
    assert data["full_name"] == mock_user_data["full_name"]
    assert "id" in data
    assert "is_active" in data
    assert "is_verified" in data


@pytest.mark.asyncio
async def test_user_login_success(client: AsyncClient):
    """Test successful user login."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test",
            "password": "test"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert "tokens" in data
    assert "access_token" in data["tokens"]
    assert "refresh_token" in data["tokens"]
    assert data["tokens"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_user_login_failure(client: AsyncClient):
    """Test failed user login with invalid credentials."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "invalid",
            "password": "wrongpassword"
        }
    )
    
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data
    assert "Incorrect username or password" in data["detail"]


@pytest.mark.asyncio
async def test_admin_login(client: AsyncClient):
    """Test admin user login."""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "admin",
            "password": "admin"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "admin"
    assert data["user"]["username"] == "admin"


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    """Test token refresh endpoint."""
    # First, login to get tokens
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test",
            "password": "test"
        }
    )
    
    tokens = login_response.json()["tokens"]
    refresh_token = tokens["refresh_token"]
    
    # Use refresh token to get new tokens
    response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "token_type" in data


@pytest.mark.asyncio
async def test_get_current_user(client: AsyncClient):
    """Test getting current user information."""
    # First, login to get token
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test",
            "password": "test"
        }
    )
    
    access_token = login_response.json()["tokens"]["access_token"]
    
    # Get current user with token
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "test"
    assert "email" in data
    assert "role" in data