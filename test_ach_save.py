#!/usr/bin/env python3
"""Test script for ACH save functionality"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001/api/v1"
ACCOUNT_HASH = "1234567890123456"

def test_hash_auth():
    """Test hash authentication"""
    print("1. Testing hash authentication...")
    response = requests.post(
        f"{BASE_URL}/hash-auth/authenticate",
        json={"account_hash": ACCOUNT_HASH}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Authentication successful")
        print(f"   Token: {data['access_token'][:50]}...")
        print(f"   Role: {data['role']}")
        return data['access_token']
    else:
        print(f"❌ Authentication failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def test_frameworks_endpoint(token):
    """Test the frameworks POST endpoint"""
    print("\n2. Testing frameworks POST endpoint...")
    
    # Prepare ACH data
    ach_data = {
        "title": f"Test ACH Analysis - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "description": "Testing ACH save functionality",
        "framework_type": "ach",
        "data": {
            "hypotheses": [
                {"id": "h1", "text": "Test Hypothesis 1"},
                {"id": "h2", "text": "Test Hypothesis 2"}
            ],
            "evidence": [
                {"id": "e1", "text": "Test Evidence 1", "source": "Test Source"}
            ],
            "scores": {
                "h1": {"e1": 3},
                "h2": {"e1": -2}
            }
        }
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"   Sending data: {json.dumps(ach_data, indent=2)}")
    
    response = requests.post(
        f"{BASE_URL}/frameworks/",
        json=ach_data,
        headers=headers
    )
    
    print(f"\n   Response Status: {response.status_code}")
    print(f"   Response Headers: {dict(response.headers)}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Framework saved successfully")
        print(f"   ID: {data.get('id')}")
        print(f"   Response: {json.dumps(data, indent=2)}")
        return data
    else:
        print(f"❌ Save failed: {response.status_code}")
        print(f"   Response: {response.text}")
        
        # Try to get more error details
        try:
            error_data = response.json()
            print(f"   Error details: {json.dumps(error_data, indent=2)}")
        except:
            pass
        
        return None

def test_get_user_info(token):
    """Test getting current user info"""
    print("\n3. Testing user info endpoint...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ User info retrieved")
        print(f"   User: {json.dumps(data, indent=2)}")
        return data
    else:
        print(f"❌ User info failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return None

def test_framework_types():
    """Test if framework_type enum accepts 'ach'"""
    print("\n4. Checking framework types...")
    
    # Try to get the OpenAPI schema
    response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/openapi.json")
    if response.status_code == 200:
        schema = response.json()
        # Look for FrameworkType enum
        if 'components' in schema and 'schemas' in schema['components']:
            for name, definition in schema['components']['schemas'].items():
                if 'FrameworkType' in name:
                    print(f"   Found {name}: {definition}")
    else:
        print("   Could not retrieve OpenAPI schema")

def main():
    print("="*60)
    print("ACH Save Functionality Test")
    print("="*60)
    
    # Test authentication
    token = test_hash_auth()
    if not token:
        print("\n⚠️  Cannot proceed without authentication")
        return
    
    # Test user info
    test_get_user_info(token)
    
    # Test framework types
    test_framework_types()
    
    # Test saving ACH framework
    framework = test_frameworks_endpoint(token)
    
    print("\n" + "="*60)
    if framework:
        print("✅ All tests passed!")
    else:
        print("❌ Tests failed - check the errors above")
    print("="*60)

if __name__ == "__main__":
    main()