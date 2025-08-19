// Test script to verify login flow
const testHash = "1234567890123456"

console.log("Testing login flow...")

// Test 1: Backend hash authentication directly
console.log("\n1. Testing backend hash auth endpoint directly...")
fetch('http://localhost:8000/api/v1/hash-auth/authenticate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ account_hash: testHash })
})
.then(response => response.json())
.then(data => {
  console.log('✅ Backend auth successful:', {
    hasAccessToken: !!data.access_token,
    tokenType: data.token_type,
    role: data.role,
    accountHash: data.account_hash
  })
})
.catch(error => {
  console.error('❌ Backend auth failed:', error.message)
})

// Test 2: CORS preflight
console.log("\n2. Testing CORS for frontend origin...")
fetch('http://localhost:8000/api/v1/hash-auth/authenticate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:6780'
  },
  body: JSON.stringify({ account_hash: testHash })
})
.then(response => {
  console.log('✅ CORS working, status:', response.status)
  return response.json()
})
.catch(error => {
  console.error('❌ CORS issue:', error.message)
})