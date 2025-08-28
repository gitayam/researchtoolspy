# Critical Issues Diagnosis & Fix Plan

## Executive Summary

Based on comprehensive codebase analysis, I've identified several critical issues affecting the ResearchTools platform functionality. This document outlines the problems, root causes, and systematic fix plan.

## 🚨 Critical Issues Identified

### 1. Missing Framework Routes (404 Errors)
**Impact**: High - Users cannot access specific analysis frameworks
**Status**: Immediate fix required

**Issues**:
- `/analysis-frameworks/causeway` → 404 (missing directory structure)
- `/analysis-frameworks/behavioral` → 404 (naming mismatch - exists as `/behavior`)

### 2. Backend API Service Not Running
**Impact**: Critical - No API functionality available
**Status**: Immediate fix required

**Issues**:
- FastAPI backend service stopped
- Frontend making calls to unresponsive backend
- "Create Team" and "Add Evidence" buttons fail silently

### 3. Missing API Endpoints
**Impact**: High - Core functionality appears broken to users
**Status**: Backend development required

**Missing Endpoints**:
- Collaboration/Team Management API
- General Evidence Management API
- Cross-framework evidence sharing

### 4. Frontend-Backend Feature Mismatch
**Impact**: Medium - UI promises functionality that doesn't exist
**Status**: Requires backend implementation

**Mismatches**:
- Collaboration page exists but no team management API
- Evidence page exists but no evidence management API
- Framework-specific evidence only works for ACH

## 🔧 Systematic Fix Plan

### Phase 1: Immediate Fixes (Priority 1)

#### 1.1 Start Backend API Service
```bash
cd /Users/admin/Documents/Git/researchtoolspy/api
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 1.2 Fix Missing Framework Routes
- Create `/analysis-frameworks/causeway/` directory structure
- Fix behavioral naming consistency (rename or update links)
- Ensure all framework routes match sidebar navigation

#### 1.3 Verify API Connectivity
- Test backend health endpoint
- Confirm CORS configuration
- Validate authentication flow

### Phase 2: Backend API Development (Priority 2)

#### 2.1 Implement Collaboration API
**Files to create**:
- `/api/app/api/v1/endpoints/collaboration.py`
- `/api/app/models/team.py`
- `/api/app/schemas/team.py`

**Endpoints needed**:
```python
POST   /api/v1/teams                 # Create team
GET    /api/v1/teams                 # List user teams
GET    /api/v1/teams/{id}            # Get team details
PUT    /api/v1/teams/{id}            # Update team
DELETE /api/v1/teams/{id}            # Delete team
POST   /api/v1/teams/{id}/members    # Add team member
DELETE /api/v1/teams/{id}/members/{user_id}  # Remove member
GET    /api/v1/collaborators         # Search users for collaboration
```

#### 2.2 Implement Evidence Management API
**Files to create**:
- `/api/app/api/v1/endpoints/evidence.py`
- `/api/app/models/evidence.py`
- `/api/app/schemas/evidence.py`

**Endpoints needed**:
```python
POST   /api/v1/evidence              # Add evidence
GET    /api/v1/evidence              # List evidence
GET    /api/v1/evidence/{id}         # Get evidence details
PUT    /api/v1/evidence/{id}         # Update evidence
DELETE /api/v1/evidence/{id}         # Delete evidence
POST   /api/v1/evidence/{id}/evaluate  # SATS evaluation
```

#### 2.3 Database Schema Updates
**New models required**:
```python
# Team model
class Team(Base):
    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID  # FK to User
    members: relationship to TeamMember
    frameworks: relationship to shared frameworks

# Evidence model  
class Evidence(Base):
    id: UUID
    title: str
    content: str
    source: Optional[str]
    credibility_score: Optional[int]
    created_by: UUID  # FK to User
    team_id: Optional[UUID]  # FK to Team
    sats_evaluation: JSON
```

### Phase 3: Frontend Integration (Priority 3)

#### 3.1 Update API Client
**File**: `/frontend/src/lib/api.ts`
- Add team management functions
- Add evidence management functions
- Add proper error handling

#### 3.2 Connect Collaboration Page
**File**: `/frontend/src/app/collaboration/page.tsx`
- Replace mock data with API calls
- Implement team creation workflow
- Add member management functionality

#### 3.3 Connect Evidence Page
**File**: `/frontend/src/app/evidence/page.tsx`
- Implement evidence listing from API
- Connect "Add Evidence" button to API
- Add SATS evaluation integration

### Phase 4: Testing & Validation (Priority 4)

#### 4.1 End-to-End Testing
- Test all framework route navigation
- Verify team creation and management
- Test evidence management workflow
- Validate authentication across all features

#### 4.2 Error Handling
- Add proper error boundaries
- Implement API error display
- Add loading states for all API calls

## 🎯 Implementation Timeline

### Day 1: Critical Fixes
- [x] Research and diagnosis ✅
- [ ] Start backend API service
- [ ] Fix missing framework routes
- [ ] Test basic API connectivity

### Day 2: Backend Development
- [ ] Implement collaboration API endpoints
- [ ] Implement evidence management API
- [ ] Update database schema
- [ ] Test API endpoints

### Day 3: Frontend Integration
- [ ] Update API client
- [ ] Connect collaboration features
- [ ] Connect evidence management
- [ ] Add error handling

### Day 4: Testing & Polish
- [ ] End-to-end testing
- [ ] Fix any remaining issues
- [ ] Documentation updates
- [ ] Performance optimization

## 📋 Success Criteria

### Frontend Routes
- [ ] All sidebar links navigate successfully (no 404s)
- [ ] Causeway framework accessible
- [ ] Behavioral/behavior naming consistent

### API Functionality
- [ ] Backend service running and accessible
- [ ] All framework CRUD operations work
- [ ] Team creation and management functional
- [ ] Evidence management functional

### User Experience
- [ ] "Create Team" button works
- [ ] "Add Evidence" button works
- [ ] No broken links or dead ends
- [ ] Proper error messages for failures

## 🔍 Testing Commands

```bash
# Backend Health Check
curl http://localhost:8000/api/v1/health/

# Frontend Access
curl http://localhost:6780

# Test Framework Routes
open http://localhost:6780/analysis-frameworks/causeway
open http://localhost:6780/analysis-frameworks/behavioral

# Test API Documentation
open http://localhost:8000/api/v1/docs
```

## 🚀 Next Steps

1. **Immediate**: Start with Phase 1 fixes to restore basic functionality
2. **Short-term**: Implement missing API endpoints for teams and evidence
3. **Medium-term**: Complete frontend integration and testing
4. **Long-term**: Add advanced collaboration features and evidence sharing

This plan follows the security-first development practices from CLAUDE.md and ensures systematic resolution of all identified issues.