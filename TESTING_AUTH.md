# Authentication Testing Guide

This document describes the comprehensive test suite for the authentication persistence functionality in the ResearchTools platform.

## Test Coverage

### Frontend Tests

#### 1. AuthGuard Component Tests (`frontend/src/components/auth/__tests__/auth-guard.test.tsx`)
- **Purpose**: Verify proper authentication state initialization and synchronization
- **Key Tests**:
  - Initialization and fallback rendering
  - Token and auth state synchronization
  - SSR safety and error handling
  - Multiple children and nested component rendering

#### 2. Auth Store Tests (`frontend/src/stores/__tests__/auth.test.ts`)
- **Purpose**: Test Zustand auth store functionality
- **Key Tests**:
  - Login with hash authentication
  - Logout and state clearing
  - User refresh and token validation
  - Error handling and loading states
  - State persistence to localStorage

#### 3. API Client Tests (`frontend/src/lib/__tests__/api.test.ts`)
- **Purpose**: Test API client initialization and token management
- **Key Tests**:
  - Client initialization with tokens
  - Hash authentication flow
  - Token refresh and interceptors
  - Error handling for various scenarios
  - SSR safety and singleton pattern

#### 4. E2E Auth Persistence Tests (`frontend/src/__tests__/e2e/auth-persistence.test.tsx`)
- **Purpose**: End-to-end testing of auth persistence across navigation
- **Key Tests**:
  - Login flow and persistence
  - Framework navigation with auth
  - Logout and cleanup
  - Page refresh handling
  - Token expiry scenarios
  - Concurrent access (multiple tabs)

### Backend Tests

#### Hash Authentication Tests (`api/tests/test_hash_auth.py`)
- **Purpose**: Test Mullvad-style hash authentication
- **Key Tests**:
  - Hash registration and uniqueness
  - Authentication with valid/invalid hashes
  - Timing attack protection
  - Token validation
  - Privacy features (no personal data)
  - Rate limiting
  - Hash formatting acceptance

## Running Tests

### Quick Test Commands

```bash
# Frontend tests only
cd frontend
npm test                           # Run all tests
npm run test:watch                 # Watch mode for development
npm run test:coverage              # With coverage report
npm run test:auth                  # Auth-specific tests only

# Backend tests only
cd api
pytest tests/test_hash_auth.py -v  # Hash auth tests
pytest tests/ -k "auth" --cov      # All auth tests with coverage

# Run all auth tests
./run_auth_tests.sh                # Interactive test runner
```

### Using the Test Runner Script

The `run_auth_tests.sh` script provides an interactive menu:

```bash
./run_auth_tests.sh

# Options:
# 1) Frontend tests only
# 2) Backend tests only  
# 3) Integration tests only
# 4) All tests
# 5) Quick auth check (fast subset for CI)
```

### Installing Test Dependencies

```bash
# Frontend
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @types/jest jest-environment-jsdom identity-obj-proxy

# Backend
cd api
pip install pytest pytest-cov pytest-asyncio
```

## Test Configuration Files

### Frontend
- `frontend/jest.config.js` - Jest configuration
- `frontend/jest.setup.js` - Test environment setup
- `frontend/package.json` - Test scripts

### Backend
- `api/tests/conftest.py` - Pytest configuration
- `api/pyproject.toml` - Test dependencies

## Coverage Reports

After running tests with coverage:

- **Frontend**: Open `frontend/coverage/lcov-report/index.html`
- **Backend**: Open `api/htmlcov/index.html`

## Key Test Scenarios

### 1. User Login and Navigation
```typescript
// Test: User logs in and navigates to framework pages
1. User enters hash on login page
2. Auth tokens stored in localStorage
3. User navigates to /frameworks/swot
4. Auth state persists, user remains logged in
5. User refreshes page
6. Auth state restored from localStorage
```

### 2. Token Synchronization
```typescript
// Test: API client and auth store stay synchronized
1. Tokens exist in localStorage
2. AuthGuard component initializes
3. Checks for token/store mismatch
4. Refreshes user if needed
5. Clears auth if tokens invalid
```

### 3. SSR/Client Hydration
```typescript
// Test: Handles server-side rendering properly
1. Server renders without localStorage
2. Client hydrates with AuthGuard
3. AuthGuard waits for client-side
4. Restores auth from localStorage
5. Renders authenticated content
```

## Common Test Patterns

### Testing with AuthGuard
```typescript
render(
  <AuthGuard>
    <YourComponent />
  </AuthGuard>
)
```

### Setting up authenticated state
```typescript
const setupAuthenticatedState = () => {
  const tokens = { /* token data */ }
  const authState = { /* auth state */ }
  
  localStorage.setItem('omnicore_tokens', JSON.stringify(tokens))
  localStorage.setItem('omnicore_auth', JSON.stringify(authState))
}
```

### Mocking API responses
```typescript
;(apiClient.loginWithHash as jest.Mock).mockResolvedValue({
  user: mockUser,
  tokens: mockTokens
})
```

## Debugging Failed Tests

### Frontend
```bash
# Run specific test file with verbose output
npm test -- --verbose auth-guard.test.tsx

# Debug with Node inspector
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### Backend
```bash
# Run with detailed output
pytest tests/test_hash_auth.py -vv -s

# Run specific test class/method
pytest tests/test_hash_auth.py::TestHashAuthentication::test_authenticate_with_valid_hash
```

## CI/CD Integration

For continuous integration, use the quick check:

```bash
# GitHub Actions / CI pipeline
./run_auth_tests.sh << EOF
5
EOF
```

Or directly:
```bash
# Frontend quick check
cd frontend && npm test -- --testNamePattern="should persist|should maintain"

# Backend quick check  
cd api && pytest tests/test_hash_auth.py::TestHashAuthentication -v
```

## Troubleshooting

### Common Issues

1. **localStorage not defined**
   - Ensure jest.setup.js is loaded
   - Check jest.config.js setupFilesAfterEnv

2. **Module not found errors**
   - Check moduleNameMapper in jest.config.js
   - Verify path aliases match tsconfig.json

3. **Timeout errors**
   - Increase timeout in jest.config.js
   - Use waitFor with longer timeout

4. **SSR-related failures**
   - Mock window/document properly
   - Check for typeof window checks

## Best Practices

1. **Always test both success and failure paths**
2. **Mock external dependencies** (API calls, localStorage)
3. **Use descriptive test names** that explain the scenario
4. **Keep tests isolated** - each test should be independent
5. **Test edge cases** (expired tokens, network errors, etc.)
6. **Maintain test coverage above 80%** for critical auth code

## Adding New Tests

When adding authentication features:

1. Write unit tests for individual functions
2. Write integration tests for API endpoints
3. Write E2E tests for user flows
4. Update this documentation

## Related Documentation

- [Lessons_Learned.md](./Lessons_Learned.md) - Authentication persistence lessons
- [CLAUDE.md](./CLAUDE.md) - Development standards and practices
- [frontend/docs/bookmark-authentication.md](./frontend/docs/bookmark-authentication.md) - Auth implementation details