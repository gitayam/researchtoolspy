"""
Pytest configuration and fixtures for API tests.
"""

import asyncio
from typing import AsyncGenerator, Generator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    # Create test engine
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    TestSessionLocal = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )
    
    async with TestSessionLocal() as session:
        yield session
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with test database."""
    
    async def override_get_db():
        yield test_db
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user_data() -> dict:
    """Mock user data for testing."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "full_name": "Test User",
        "password": "testpassword123",
        "role": "researcher",
    }


@pytest.fixture
def mock_framework_data() -> dict:
    """Mock framework session data for testing."""
    return {
        "title": "Test SWOT Analysis",
        "description": "Test analysis for unit testing",
        "framework_type": "swot",
        "data": {
            "strengths": ["Test strength 1", "Test strength 2"],
            "weaknesses": ["Test weakness 1"],
            "opportunities": ["Test opportunity 1"],
            "threats": ["Test threat 1", "Test threat 2"],
        }
    }


@pytest.fixture
def auth_headers() -> dict:
    """Mock authentication headers for testing."""
    # In real tests, this would generate a valid JWT token
    return {
        "Authorization": "Bearer test-token-123"
    }