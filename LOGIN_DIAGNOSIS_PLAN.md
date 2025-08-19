# Login Authentication Flow - Diagnosis and Fix Plan

## Issue Summary
Users report being "stuck at login unable to login" despite the hash-based authentication system appearing to be properly implemented.

## Phase 1: Systematic Diagnosis

### 1.1 Research → Plan → Implement Approach
Following CLAUDE.md guidelines - starting with thorough research before jumping to fixes.

### 1.2 Key Areas to Investigate

#### Frontend Authentication Flow
- [ ] Login page form submission
- [ ] Hash generation and validation
- [ ] API call to `/hash-auth/authenticate` endpoint
- [ ] Token storage and management
- [ ] Redirect logic after successful auth
- [ ] Auth store state management (Zustand)

#### Backend Authentication System
- [ ] Hash authentication endpoint functionality
- [ ] JWT token creation and signing
- [ ] Database user lookup/creation
- [ ] CORS configuration for API calls
- [ ] Request/response logging

#### Integration Points
- [ ] Frontend → Backend API communication
- [ ] Token persistence between sessions
- [ ] Protected route middleware
- [ ] Dashboard access after login

### 1.3 Lessons Learned Application
From Lessons_Learned.md - focus on:
- Hash authentication must create real JWT tokens, not mock strings
- Frontend must call actual backend auth endpoint
- CORS configuration for public/tunnel URLs
- Session state management in frontend

## Phase 2: Diagnostic Testing Plan

### 2.1 Frontend Testing
```bash
# 1. Check if frontend can reach backend
curl -X POST http://localhost:8000/api/v1/hash-auth/authenticate \
  -H "Content-Type: application/json" \
  -d '{"account_hash": "1234567890123456"}'

# 2. Check backend logs for auth attempts
docker logs researchtools_api

# 3. Test hash generation
# - Generate hash on registration
# - Use same hash for login
# - Verify hash format (16 digits)
```

### 2.2 Backend Testing
```python
# Test script to verify hash auth endpoint
import requests
import json

# Test with valid hash
response = requests.post(
    "http://localhost:8000/api/v1/hash-auth/authenticate",
    json={"account_hash": "1234567890123456"}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

### 2.3 Database Verification
```sql
-- Check if user records are created
SELECT * FROM users WHERE account_hash = '1234567890123456';

-- Check user creation during registration
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
```

### 2.4 Browser Network Analysis
- [ ] Open browser DevTools → Network tab
- [ ] Attempt login
- [ ] Check for failed API calls
- [ ] Verify request/response format
- [ ] Look for CORS errors in console

## Phase 3: Common Issues from Previous Experience

### 3.1 Mock vs Real Token Issue
**Symptom**: Login appears successful but dashboard redirects back to login
**Cause**: Frontend using mock tokens instead of real JWT tokens
**Fix**: Ensure frontend calls `/hash-auth/authenticate` endpoint

### 3.2 CORS Configuration
**Symptom**: Network errors during login API calls
**Cause**: Backend CORS not configured for frontend origin
**Fix**: Update CORS settings in main.py

### 3.3 Authentication Store Issues
**Symptom**: Authentication state not persisting
**Cause**: Zustand store not properly managing auth state
**Fix**: Verify auth store implementation

### 3.4 Hash Format Issues
**Symptom**: Authentication fails with valid-looking hash
**Cause**: Hash format doesn't match backend expectations
**Fix**: Ensure 16-digit decimal format

## Phase 4: Fix Implementation Strategy

### 4.1 Start with Backend Verification
1. Ensure hash-auth endpoint is working
2. Test with curl/Postman
3. Verify JWT token generation
4. Check database user creation

### 4.2 Frontend Integration
1. Verify API client configuration
2. Test auth service calls
3. Check token storage
4. Verify auth store state management

### 4.3 End-to-End Testing
1. Full registration → login flow
2. Dashboard access verification
3. Session persistence testing
4. Logout and re-login testing

## Phase 5: Testing Scenarios

### 5.1 New User Flow
- [ ] Register new account
- [ ] Note generated hash
- [ ] Login with hash
- [ ] Access dashboard
- [ ] Verify session persistence

### 5.2 Existing User Flow
- [ ] Use previously registered hash
- [ ] Login attempt
- [ ] Dashboard access
- [ ] Session handling

### 5.3 Error Scenarios
- [ ] Invalid hash format
- [ ] Non-existent hash
- [ ] Network connectivity issues
- [ ] Backend service down

## Phase 6: Debugging Tools and Commands

### 6.1 Backend Debugging
```bash
# Check API logs
docker logs -f researchtools_api

# Test database connection
docker exec -it researchtools_postgres psql -U postgres -d researchtools

# Check API health
curl http://localhost:8000/health
```

### 6.2 Frontend Debugging
```bash
# Start frontend with debug logging
cd frontend && npm run dev

# Check console errors in browser
# Use React DevTools for state inspection
```

### 6.3 Network Debugging
```bash
# Test API connectivity
curl -X OPTIONS http://localhost:8000/api/v1/hash-auth/authenticate

# Check for CORS preflight
curl -X POST http://localhost:8000/api/v1/hash-auth/authenticate \
  -H "Origin: http://localhost:6780" \
  -H "Content-Type: application/json"
```

## Success Criteria
- [ ] User can register and receive valid hash
- [ ] User can login with hash successfully
- [ ] Authentication redirects to dashboard
- [ ] Session persists on page refresh
- [ ] Logout works correctly
- [ ] No console errors during auth flow

## Documentation Updates
After fix is complete:
- [ ] Update Lessons_Learned.md with new insights
- [ ] Document any configuration changes
- [ ] Update README if auth flow changed

## Git Commit Strategy
Following CLAUDE.md guidelines:
- Small, focused commits for each fix
- Clear commit messages explaining the change
- Test each commit before proceeding
- Document any breaking changes

---

## Notes Section
(To be filled during diagnosis process)

### Current Findings:
- ✅ Backend hash-auth endpoint working correctly (returns valid JWT tokens)
- ✅ CORS configuration allows requests from localhost:6780
- ✅ Frontend code structure looks correct (auth store, API client, login page)
- 🔍 Need to test actual frontend login flow in browser
- 🔍 Potential issue: API client has hardcoded tunnel URL for trycloudflare.com detection

### Issues Identified:
1. **API Client URL Logic**: The frontend API client checks for trycloudflare.com hostnames and uses a hardcoded backend tunnel URL. When running locally, this should use localhost:8000.

2. **Potential Redirect Loop**: Dashboard layout calls `refreshUser()` after login, which makes an API call to `/auth/me`. If this fails or if the `getCurrentUser()` method has issues with real JWT tokens (vs mock tokens), it could cause authentication to fail.

3. **Mock Token Check**: The `getCurrentUser()` method in API client checks if the access token starts with 'mock_access_token' and returns mock data. For real JWT tokens from hash auth, this check might be causing issues.

### Testing Results:
- Backend auth endpoint: ✅ Working (returns valid JWT with role admin)
- CORS: ✅ Working (accepts requests from frontend origin)
- Frontend server: ✅ Running on localhost:6780

### Fixes Applied:
1. **Fixed API URL Resolution**: Removed confusing tunnel URL logic, now always uses localhost:8000 for local development
2. **Fixed getCurrentUser Method**: Removed mock token detection, always uses real API call to /auth/me
3. **Added Debug Logging**: Added comprehensive console logging to track the login flow
4. **Verified Backend Functionality**: Confirmed hash-auth endpoint and /auth/me endpoint work correctly

### Expected Working Flow:
1. User enters hash (e.g., "1234567890123456") 
2. Frontend calls POST /hash-auth/authenticate with cleaned hash
3. Backend returns valid JWT tokens
4. Frontend stores tokens in localStorage and updates auth store
5. User redirected to dashboard
6. Dashboard calls /auth/me to get user data
7. Auth state persists across page refreshes

### Testing Status:
- ✅ Backend hash-auth endpoint works
- ✅ Backend /auth/me endpoint works with JWT tokens
- ✅ CORS configured correctly
- ✅ Frontend compiles without errors  
- ✅ API URL resolution fixed
- 🔄 Ready for end-to-end testing
