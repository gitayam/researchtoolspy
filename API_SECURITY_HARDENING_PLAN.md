# API Security Hardening Plan - Research Tools Platform

## Executive Summary

Following a comprehensive security audit, we've identified critical vulnerabilities in our API infrastructure that require immediate attention. This plan outlines step-by-step hardening measures while preserving all existing functionality.

## Critical Security Issues Identified

### 🔴 CRITICAL (Fix Immediately)
1. **Mock Authentication Bypass** - Production endpoints accept hardcoded credentials
2. **Open CORS Policy** - Allows requests from any cloudflare tunnel domain
3. **Persistent Secret Key Issues** - May cause session invalidation

### 🟠 HIGH (Fix Within 24 Hours)
4. **Unvalidated User Creation** - Hash auth creates accounts for any 16-digit number
5. **URL Injection Vulnerabilities** - Web scraping accepts arbitrary URLs
6. **Missing Authorization in Background Jobs** - Tasks continue without user context
7. **Disabled Security Middleware** - TrustedHost middleware commented out

### 🟡 MEDIUM (Fix Within 1 Week)
8. **Incomplete Input Validation** - File uploads and AI prompts need sanitization
9. **Information Disclosure** - Error messages may be too detailed
10. **Insufficient Credential Validation** - API key checks are minimal
11. **Resource Exhaustion** - No limits on job creation or execution

## Hardening Implementation Plan

### Phase 1: Critical Security Fixes (Priority 1)

#### 1.1 Remove Mock Authentication
**File**: `/api/app/api/v1/endpoints/auth.py`
- Remove hardcoded credentials ("admin/admin", "test/test")
- Implement proper database user lookup
- Add environment flag to disable mock auth in production

#### 1.2 Secure CORS Configuration
**File**: `/api/app/main.py`
- Replace wildcard CORS with explicit allowed origins
- Create environment-based CORS configuration
- Remove cloudflare tunnel wildcard exceptions

#### 1.3 Fix Secret Key Management
**File**: `/api/app/core/config.py`
- Ensure SECRET_KEY persistence across restarts
- Add validation for secret key strength
- Implement secret rotation capability

### Phase 2: High-Priority Security Enhancements

#### 2.1 Harden Hash Authentication
**File**: `/api/app/api/v1/endpoints/hash_auth.py`
- Add hash format validation beyond 16 digits
- Implement user creation rate limiting
- Add hash collision detection

#### 2.2 Secure Web Scraping Endpoints
**File**: `/api/app/api/v1/endpoints/tools/web_scraping.py`
- Implement URL domain allowlist
- Add URL scheme validation (https only)
- Prevent SSRF attacks with internal IP blocking

#### 2.3 Authorize Background Jobs
**Files**: Web scraping, social media endpoints
- Add user context to all background tasks
- Implement job ownership validation
- Add job result access controls

#### 2.4 Enable Security Middleware
**File**: `/api/app/main.py`
- Re-enable TrustedHost middleware
- Configure proper trusted hosts list
- Add security headers middleware

### Phase 3: Input Validation & Rate Limiting

#### 3.1 Enhanced Input Validation
- Add file type validation beyond extensions
- Implement content sanitization for AI prompts
- Add request size limits per endpoint

#### 3.2 Rate Limiting Implementation
- Create rate limiting middleware
- Set per-user and per-endpoint limits
- Add rate limit headers to responses

#### 3.3 Improve Error Handling
- Create secure error response system
- Remove sensitive data from error messages
- Add structured logging for security events

### Phase 4: Monitoring & Compliance

#### 4.1 Security Monitoring
- Implement security event logging
- Add failed authentication monitoring
- Create suspicious activity detection

#### 4.2 API Documentation Security
- Review exposed API documentation
- Add authentication to Swagger UI in production
- Remove sensitive endpoint information

## Implementation Approach

### Security-First Development
1. **Test-Driven Security**: Write security tests before implementing fixes
2. **Feature Preservation**: Ensure no functional regression during hardening
3. **Gradual Rollout**: Implement fixes incrementally with monitoring
4. **Backwards Compatibility**: Maintain API compatibility where possible

### Environment-Based Configuration
```python
# New security configuration structure
class SecuritySettings:
    ENABLE_MOCK_AUTH: bool = False  # Production: False
    ALLOWED_ORIGINS: List[str] = []  # Explicit whitelist
    RATE_LIMIT_ENABLED: bool = True
    MAX_REQUESTS_PER_MINUTE: int = 60
    REQUIRE_HTTPS: bool = True  # Production: True
    ENABLE_SECURITY_HEADERS: bool = True
```

### Database Migrations Required
- Add user validation tables
- Create audit logging tables  
- Add rate limiting tracking tables

## Testing Strategy

### Security Testing
1. **Authentication Tests**: Verify mock auth removal
2. **CORS Tests**: Confirm origin restrictions
3. **Input Validation Tests**: Test injection prevention
4. **Authorization Tests**: Verify job access controls
5. **Rate Limiting Tests**: Confirm quota enforcement

### Regression Testing  
1. **Functional Tests**: Ensure all features work
2. **Integration Tests**: Verify API interactions
3. **Performance Tests**: Check rate limiting impact
4. **User Journey Tests**: Validate complete workflows

## Deployment Strategy

### Environment Rollout
1. **Development**: Implement and test all changes
2. **Staging**: Full security validation
3. **Production**: Gradual rollout with monitoring

### Monitoring Points
- Authentication failure rates
- CORS rejection counts
- Rate limit trigger frequency
- Background job success rates
- Error response patterns

## Success Criteria

### Security Metrics
- ✅ Zero mock authentication bypasses
- ✅ CORS limited to approved origins only
- ✅ All background jobs properly authorized
- ✅ Input validation on all user inputs
- ✅ Rate limiting active and effective

### Functional Metrics
- ✅ All existing features working
- ✅ API response times within 10% of baseline
- ✅ Zero user experience regression
- ✅ Complete test coverage maintained

## Risk Mitigation

### Potential Issues
1. **Rate Limiting Too Strict**: Monitor and adjust limits
2. **CORS Breaking Integrations**: Maintain approved origins list
3. **Auth Changes Breaking Clients**: Gradual migration path
4. **Performance Impact**: Optimize security middleware

### Rollback Plan
- Feature flags for all security changes
- Database migration rollback scripts
- Previous configuration backup
- Quick deployment pipeline for fixes

## Timeline

- **Day 1**: Critical fixes (mock auth, CORS, secrets)
- **Day 2**: High-priority fixes (hash auth, URL validation)  
- **Week 1**: Medium-priority fixes (input validation, rate limiting)
- **Week 2**: Monitoring and compliance features
- **Week 3**: Security testing and validation
- **Week 4**: Production deployment

## Maintenance

### Ongoing Security
- Monthly security audit reviews
- Quarterly penetration testing
- Annual security architecture review
- Continuous dependency vulnerability scanning

This hardening plan ensures robust security while maintaining full functionality and providing a clear implementation roadmap.