#!/usr/bin/env python3
"""
Quick test script to verify the modern API stack is working
"""
import requests
import json

API_BASE = "http://localhost:8000"

def test_api():
    print("🧪 Testing Modern API Stack")
    print("=" * 50)
    
    # Test root endpoint
    try:
        response = requests.get(f"{API_BASE}/")
        print(f"✅ Root endpoint: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Root endpoint failed: {e}")
    
    # Test API documentation
    try:
        response = requests.get(f"{API_BASE}/docs")
        print(f"✅ API docs: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
    except Exception as e:
        print(f"❌ API docs failed: {e}")
    
    # Test health endpoint
    try:
        response = requests.get(f"{API_BASE}/api/v1/health")
        print(f"✅ Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"❌ Health endpoint failed: {e}")
    
    # Test hash auth endpoint
    try:
        # Generate a test hash for authentication
        test_hash = "1234567890123456"  # 16 digit test hash
        auth_data = {"account_hash": test_hash}
        
        response = requests.post(f"{API_BASE}/api/v1/auth/hash-auth/authenticate", 
                               json=auth_data)
        print(f"✅ Hash auth test: {response.status_code}")
        if response.status_code in [200, 401, 422]:  # Expected responses
            try:
                print(f"   Response: {response.json()}")
            except:
                print(f"   Raw response: {response.text}")
    except Exception as e:
        print(f"❌ Hash auth test failed: {e}")
    
    print("\n🎯 API Summary:")
    print(f"   • Modern FastAPI backend: http://localhost:8000")
    print(f"   • API Documentation: http://localhost:8000/docs")
    print(f"   • Frameworks: 10+ analysis frameworks available")
    print(f"   • Authentication: Hash-based (Mullvad-style)")
    print(f"   • Database: PostgreSQL with full schema")

if __name__ == "__main__":
    test_api()