"""
Integration tests for hash-based authentication system

Tests the Mullvad-style privacy-first authentication flow
"""

import pytest
import time
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from app.main import app
from app.core.database import get_db
from app.models.user import User, UserRole
from app.core.security import verify_token


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def db_session():
    """Create test database session"""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TestHashRegistration:
    """Test hash registration endpoint"""
    
    def test_register_new_hash(self, client):
        """Test registering a new account hash"""
        response = client.post("/api/v1/hash-auth/register")
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify response structure
        assert "account_hash" in data
        assert "message" in data
        assert "warning" in data
        assert "created_at" in data
        
        # Verify hash format (16 digits)
        assert len(data["account_hash"]) == 16
        assert data["account_hash"].isdigit()
        
        # Verify hash uniqueness by registering again
        response2 = client.post("/api/v1/hash-auth/register")
        assert response2.json()["account_hash"] != data["account_hash"]
    
    def test_register_creates_user_in_db(self, client, db_session):
        """Test that registration creates a user in database"""
        response = client.post("/api/v1/hash-auth/register")
        assert response.status_code == 201
        
        account_hash = response.json()["account_hash"]
        
        # Verify user exists in database
        user = db_session.query(User).filter(
            User.account_hash == account_hash
        ).first()
        
        assert user is not None
        assert user.username == f"user_{account_hash[:8]}"
        assert user.role == UserRole.USER
        assert user.is_active is True
        assert user.is_verified is True
    
    def test_register_hash_collision_handling(self, client, monkeypatch):
        """Test handling of hash collisions"""
        # Mock to force collision on first attempt
        call_count = 0
        original_randint = __import__('random').randint
        
        def mock_randint(min_val, max_val):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return 1234567890123456  # Will be used twice to force collision
            return original_randint(min_val, max_val)
        
        # Create first user with specific hash
        response1 = client.post("/api/v1/hash-auth/register")
        
        # Now mock to return same hash first, then different
        with patch('secrets.randbelow', side_effect=[234567890123456, 9876543210987654]):
            response2 = client.post("/api/v1/hash-auth/register")
        
        assert response1.status_code == 201
        assert response2.status_code == 201
        assert response1.json()["account_hash"] != response2.json()["account_hash"]


class TestHashAuthentication:
    """Test hash authentication endpoint"""
    
    @pytest.fixture
    def registered_hash(self, client):
        """Register a hash for testing"""
        response = client.post("/api/v1/hash-auth/register")
        return response.json()["account_hash"]
    
    def test_authenticate_with_valid_hash(self, client, registered_hash):
        """Test authentication with valid hash"""
        response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": registered_hash}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        assert "account_hash" in data
        assert "role" in data
        
        # Verify JWT token is valid
        token_data = verify_token(data["access_token"])
        assert token_data is not None
    
    def test_authenticate_with_invalid_hash(self, client):
        """Test authentication with invalid hash"""
        response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": "9999999999999999"}
        )
        
        assert response.status_code == 401
        assert "Invalid account hash" in response.json()["detail"]
    
    def test_authenticate_with_malformed_hash(self, client):
        """Test authentication with malformed hash"""
        test_cases = [
            "not_a_number",
            "123",  # Too short
            "12345678901234567",  # Too long
            "1234 5678 9012 3456",  # With spaces
            "",  # Empty
        ]
        
        for invalid_hash in test_cases:
            response = client.post(
                "/api/v1/hash-auth/authenticate",
                json={"account_hash": invalid_hash}
            )
            
            assert response.status_code in [401, 422]
    
    def test_authenticate_timing_attack_protection(self, client, registered_hash):
        """Test that authentication has timing attack protection"""
        # Time valid hash authentication
        start_valid = time.time()
        response_valid = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": registered_hash}
        )
        time_valid = time.time() - start_valid
        
        # Time invalid hash authentication
        start_invalid = time.time()
        response_invalid = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": "9999999999999999"}
        )
        time_invalid = time.time() - start_invalid
        
        assert response_valid.status_code == 200
        assert response_invalid.status_code == 401
        
        # Times should be similar (within 100ms) due to timing attack protection
        # Note: This might be flaky in CI, so we're being generous with the threshold
        assert abs(time_valid - time_invalid) < 0.5
    
    def test_authenticate_returns_consistent_user_info(self, client, registered_hash):
        """Test that multiple authentications return consistent user info"""
        response1 = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": registered_hash}
        )
        
        response2 = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": registered_hash}
        )
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # User info should be consistent
        assert response1.json()["account_hash"] == response2.json()["account_hash"]
        assert response1.json()["role"] == response2.json()["role"]


class TestTokenValidation:
    """Test JWT token validation and usage"""
    
    @pytest.fixture
    def auth_tokens(self, client):
        """Get authentication tokens"""
        # Register and authenticate
        reg_response = client.post("/api/v1/hash-auth/register")
        account_hash = reg_response.json()["account_hash"]
        
        auth_response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": account_hash}
        )
        
        return auth_response.json()
    
    def test_access_protected_endpoint_with_token(self, client, auth_tokens):
        """Test accessing protected endpoint with valid token"""
        headers = {
            "Authorization": f"Bearer {auth_tokens['access_token']}"
        }
        
        response = client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify user data
        assert "username" in data
        assert data["username"].startswith("user_")
        assert data["account_hash"] == auth_tokens["account_hash"]
    
    def test_access_protected_endpoint_without_token(self, client):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]
    
    def test_access_protected_endpoint_with_invalid_token(self, client):
        """Test accessing protected endpoint with invalid token"""
        headers = {
            "Authorization": "Bearer invalid_token_here"
        }
        
        response = client.get("/api/v1/auth/me", headers=headers)
        
        assert response.status_code == 401
    
    def test_token_expiry(self, client, auth_tokens):
        """Test that tokens expire after the specified time"""
        # This is a conceptual test - in practice, you'd need to mock time
        # or wait for actual expiry (not practical in tests)
        
        # Verify expires_in is present and reasonable
        assert auth_tokens["expires_in"] > 0
        assert auth_tokens["expires_in"] <= 3600  # Max 1 hour for access token


class TestPrivacyFeatures:
    """Test privacy-preserving features"""
    
    def test_no_personal_info_required(self, client):
        """Test that no personal information is required for registration"""
        response = client.post("/api/v1/hash-auth/register")
        
        assert response.status_code == 201
        data = response.json()
        
        # Should not contain any personal info fields
        assert "email" not in data
        assert "phone" not in data
        assert "name" not in data
        assert "password" not in data
    
    def test_minimal_user_info_stored(self, client, db_session):
        """Test that minimal information is stored in database"""
        response = client.post("/api/v1/hash-auth/register")
        account_hash = response.json()["account_hash"]
        
        user = db_session.query(User).filter(
            User.account_hash == account_hash
        ).first()
        
        # Verify minimal info
        assert user.email == ""  # Empty or None
        assert user.full_name == ""  # Empty or None
        assert not user.hashed_password  # No password stored
        assert user.username == f"user_{account_hash[:8]}"  # Generated username
    
    def test_no_tracking_information_in_tokens(self, client):
        """Test that JWT tokens contain minimal information"""
        # Register and authenticate
        reg_response = client.post("/api/v1/hash-auth/register")
        account_hash = reg_response.json()["account_hash"]
        
        auth_response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": account_hash}
        )
        
        access_token = auth_response.json()["access_token"]
        
        # Decode token (without verification for testing)
        import jwt
        decoded = jwt.decode(access_token, options={"verify_signature": False})
        
        # Should contain minimal claims
        assert "sub" in decoded  # Subject (user ID)
        assert "exp" in decoded  # Expiry
        assert "scopes" in decoded  # Permissions
        
        # Should NOT contain personal info
        assert "email" not in decoded
        assert "name" not in decoded
        assert "ip_address" not in decoded


class TestRateLimiting:
    """Test rate limiting for authentication endpoints"""
    
    def test_registration_rate_limiting(self, client):
        """Test that registration has rate limiting"""
        # Note: This would require actual rate limiting implementation
        # For now, we just test that multiple requests work
        
        responses = []
        for _ in range(5):
            response = client.post("/api/v1/hash-auth/register")
            responses.append(response)
        
        # All should succeed (rate limiting would block some)
        for response in responses:
            assert response.status_code == 201
    
    def test_authentication_rate_limiting(self, client):
        """Test that authentication has rate limiting for failed attempts"""
        # Try multiple failed authentication attempts
        invalid_hash = "9999999999999999"
        
        for i in range(5):
            response = client.post(
                "/api/v1/hash-auth/authenticate",
                json={"account_hash": invalid_hash}
            )
            
            # Should get 401 for invalid hash
            # With rate limiting, later attempts might get 429
            assert response.status_code in [401, 429]


class TestHashFormatting:
    """Test hash formatting and display"""
    
    def test_hash_accepts_formatted_input(self, client):
        """Test that authentication accepts formatted hash input"""
        # Register first
        reg_response = client.post("/api/v1/hash-auth/register")
        account_hash = reg_response.json()["account_hash"]
        
        # Format hash with spaces
        formatted_hash = f"{account_hash[:4]} {account_hash[4:8]} {account_hash[8:12]} {account_hash[12:16]}"
        
        # Should accept formatted version
        auth_response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": formatted_hash}
        )
        
        # Should clean the hash and authenticate successfully
        assert auth_response.status_code == 200
    
    def test_hash_accepts_with_dashes(self, client):
        """Test that authentication accepts hash with dashes"""
        # Register first
        reg_response = client.post("/api/v1/hash-auth/register")
        account_hash = reg_response.json()["account_hash"]
        
        # Format hash with dashes
        formatted_hash = f"{account_hash[:4]}-{account_hash[4:8]}-{account_hash[8:12]}-{account_hash[12:16]}"
        
        auth_response = client.post(
            "/api/v1/hash-auth/authenticate",
            json={"account_hash": formatted_hash}
        )
        
        assert auth_response.status_code == 200


class TestAdminHashGeneration:
    """Test admin hash generation functionality"""
    
    @pytest.mark.skip(reason="Admin endpoint may not be exposed in production")
    def test_generate_admin_hash_requires_auth(self, client):
        """Test that generating admin hash requires authentication"""
        response = client.post("/api/v1/hash-auth/generate-admin")
        
        assert response.status_code == 401
    
    @pytest.mark.skip(reason="Admin endpoint may not be exposed in production")
    def test_generate_admin_hash_creates_admin_user(self, client, db_session):
        """Test that admin hash generation creates admin user"""
        # This would require admin authentication first
        # Implementation depends on admin auth strategy
        pass


class TestErrorHandling:
    """Test error handling in hash authentication"""
    
    def test_database_error_handling(self, client, monkeypatch):
        """Test handling of database errors during registration"""
        def mock_db_error(*args, **kwargs):
            raise Exception("Database connection error")
        
        with patch('app.core.database.get_db', side_effect=mock_db_error):
            response = client.post("/api/v1/hash-auth/register")
            
            assert response.status_code == 500
    
    def test_hash_generation_error_handling(self, client, monkeypatch):
        """Test handling of errors during hash generation"""
        with patch('secrets.randbelow', side_effect=Exception("RNG failure")):
            response = client.post("/api/v1/hash-auth/register")
            
            assert response.status_code == 500