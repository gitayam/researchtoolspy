# TODOs and Stubs Audit
**Date:** October 8, 2025
**Status:** Comprehensive codebase scan for incomplete implementations

---

## Executive Summary

Found **30+ TODO/FIXME comments** and **multiple stub implementations** across the codebase. Most critical issues relate to:
1. **Authentication** - Hardcoded user IDs (`demo-user`, `userId = 1`)
2. **Workspace Management** - Hardcoded workspace IDs (`workspace_id: '1'`)
3. **API Keys** - Placeholder API keys for external services
4. **Error Tracking** - Missing Sentry/error tracking integration

---

## ✅ Recently Fixed (v2.5.x)

- ✅ **src/stores/auth.ts** - Replaced stub with full hash-based authentication (v2.5.0)
- ✅ **functions/api/actors.ts** - Added hash-based auth support (v2.5.1)
- ✅ **Multiple frontend components** - Migrated from `auth_token` to `omnicore_user_hash` (v2.5.1)

---

## 🔴 HIGH PRIORITY - Critical Stubs

### 1. ACH API Authentication (`demo-user` stubs)
**Files:**
- `functions/api/ach/index.ts` (lines 30, 112, 178, 258)
- `functions/api/ach/hypotheses.ts` (lines 25, 101, 165)
- `functions/api/ach/scores.ts` (lines 28, 163)
- `functions/api/ach/evidence.ts` (lines 23, 117)
- `functions/api/ach/[id]/share.ts` (line 20)
- `functions/api/ach/public/[token]/clone.ts` (line 14)

**Issue:** All ACH endpoints use `const userId = 'demo-user'` instead of real auth
**Impact:** Security vulnerability - anyone can access/modify any ACH analysis
**Solution Created:** New shared auth helper at `functions/api/_shared/auth-helpers.ts`

**Recommended Fix:**
```typescript
import { requireAuth } from '../_shared/auth-helpers'

// Replace:
const userId = 'demo-user' // TODO: Get from auth

// With:
const userId = await requireAuth(context.request, context.env)
```

---

### 2. Content Intelligence API - Hardcoded User IDs

**Files:**
- `functions/api/content-intelligence/analyze-url.ts` (line 73)
- `functions/api/content-intelligence/social-media-extract.ts` (line 203)
- `functions/api/content-intelligence/answer-question.ts` (line 108)
- `functions/api/content-intelligence/saved-links.ts` (lines 50, 158, 177, 293, 304, 353, 396)
- `functions/api/content-intelligence/social-extract.ts` (line 408)

**Issue:** Uses `userId = 1` or `user_id: 1` as placeholder
**Impact:** All content attributed to same user, no proper isolation
**Solution:** Use shared `getUserIdOrDefault()` helper

---

### 3. PDF Extractor - Missing API Keys

**File:** `functions/api/content-intelligence/pdf-extractor.ts`
**Lines:** 85, 102
**Issue:**
```typescript
'x-api-key': 'YOUR_PDF_CO_API_KEY' // TODO: Get from env
```

**Impact:** PDF extraction feature doesn't work (falls back to error)
**Solution:**
```typescript
'x-api-key': env.PDF_CO_API_KEY || ''
```

Add to `wrangler.toml`:
```toml
[vars]
PDF_CO_API_KEY = "your-actual-key"
```

---

### 4. Frameworks API - Hardcoded User/Workspace

**Files:**
- `functions/api/frameworks.ts` (lines 32, 77)
- `functions/api/frameworks/[id]/generate-entities.ts` (line 110)

**Issue:**
```typescript
const userId = 1 // Placeholder - should come from auth
const workspaceId = 'default' // TODO: Get from request body
```

**Impact:** Framework sessions not properly attributed to users
**Solution:** Use shared auth helpers

---

## 🟡 MEDIUM PRIORITY - Functional TODOs

### 5. Error Tracking Service

**File:** `src/components/ErrorBoundary.tsx`
**Line:** 42
**Issue:**
```typescript
// TODO: Send to error tracking service (Sentry, etc.)
```

**Recommendation:** Implement Sentry or similar error tracking
```typescript
if (import.meta.env.PROD) {
  Sentry.captureException(error, { contexts: { react: { errorInfo } } })
}
```

---

### 6. Workspace Selector TODOs

**Files:**
- `src/pages/entities/ActorsPage.tsx` (line 23)
- `src/contexts/WorkspaceContext.tsx` (line 27)
- `src/pages/ContentLibraryPage.tsx` (line 46)
- `src/pages/NetworkGraphPage.tsx` (line 93)

**Issue:**
```typescript
const [workspaceId, setWorkspaceId] = useState<number>(1) // TODO: Get from workspace selector
```

**Current Status:** Partial implementation via `localStorage.getItem('current_workspace_id')`
**Recommendation:** Complete workspace selector UI integration

---

### 7. AI Config Authentication

**File:** `functions/api/ai/config.ts`
**Lines:** 119, 164
**Issue:**
```typescript
// TODO: Add authentication check
```

**Impact:** AI configuration endpoints are publicly accessible
**Solution:** Add `requireAuth()` check

---

### 8. Starbursting Auth Headers

**File:** `functions/api/content-intelligence/starbursting.ts`
**Line:** 119
**Issue:**
```typescript
// TODO: Forward auth headers
```

**Impact:** Starbursting API calls don't include user auth
**Solution:** Forward Authorization header to backend calls

---

### 9. Screenshot API (Not Implemented)

**File:** `functions/api/content-intelligence/analyze-url.ts`
**Line:** 501
**Issue:**
```typescript
screenshot: `/api/content-intelligence/screenshot?url=${encoded}` // TODO: Implement
```

**Status:** Screenshot endpoint doesn't exist
**Recommendation:** Either implement or remove from response

---

### 10. Session Migration TODO

**File:** `functions/api/auth/migrate-session-content.ts`
**Line:** 43
**Issue:**
```typescript
const userId = 1 // Placeholder - should come from session lookup
```

**Status:** Migration endpoint uses hardcoded user ID

---

## 🟢 LOW PRIORITY - UI/UX TODOs

### 11. Export/Share Functionality

**File:** `src/pages/PublicFrameworkPage.tsx`
**Line:** 61
```typescript
// TODO: Implement export functionality
```

### 12. MOM Assessment Modals

**Files:**
- `src/components/entities/EventDetailView.tsx` (lines 446, 460, 464)
- `src/components/entities/ActorDetailView.tsx` (line 420)

**Issue:**
```typescript
// TODO: Open MOM assessment creation modal with event pre-selected
```

### 13. Batch Entity Name Loading

**File:** `src/components/entities/ActorDetailView.tsx`
**Line:** 74
```typescript
// TODO: Batch load entity names
```

**Current:** Loads entity names one by one
**Recommendation:** Implement batch loading for performance

### 14. Network Graph Entity Mapping

**File:** `NETWORK_INTEGRATION_PLAN.md`
**Issue:** Lines 143-165 in GenericFrameworkView.tsx have TODO for mapping COG items to network entities

### 15. Workspace Invite Implementation

**File:** `src/components/settings/WorkspaceManagement.tsx`
**Line:** 123
```typescript
// TODO: Implement API call to invite user by hash
```

### 16. Starbursting Launcher

**File:** `src/pages/tools/ContentIntelligencePage.tsx`
**Line:** 1524
```typescript
{/* TODO: Implement Starbursting launcher */}
```

### 17. AI Batch Generation

**File:** `src/hooks/useAI.ts`
**Line:** 308
```typescript
// TODO: Implement batch generation via API
```

---

## 📋 Implementation Plan

### Phase 1: Authentication Consolidation (IMMEDIATE)
**Priority: HIGH | Estimated: 2-3 hours**

1. Update all ACH API endpoints to use `requireAuth()` helper
2. Update Content Intelligence APIs to use `getUserIdOrDefault()`
3. Update Frameworks API to use auth helpers
4. Test all endpoints with hash-based authentication

**Files to Update:**
- `functions/api/ach/*.ts` (7 files)
- `functions/api/content-intelligence/*.ts` (6 files)
- `functions/api/frameworks.ts`
- `functions/api/auth/migrate-session-content.ts`

---

### Phase 2: API Keys & Configuration (MEDIUM)
**Priority: MEDIUM | Estimated: 1 hour**

1. Add PDF.co API key to environment variables
2. Add authentication to AI config endpoints
3. Forward auth headers in Starbursting API

**Files to Update:**
- `wrangler.toml` (add PDF_CO_API_KEY)
- `functions/api/ai/config.ts`
- `functions/api/content-intelligence/starbursting.ts`

---

### Phase 3: Workspace Management (LOW - Can Defer)
**Priority: LOW | Estimated: 4-6 hours**

1. Complete workspace selector UI
2. Implement workspace invite API
3. Update all hardcoded `workspace_id: '1'` to dynamic

**Files to Update:**
- Multiple components using workspace IDs
- Workspace invite backend API

---

### Phase 4: UI Enhancements (LOW - Can Defer)
**Priority: LOW | Estimated: Variable**

1. Implement export functionality for public frameworks
2. Create MOM assessment modals
3. Implement batch entity loading
4. Complete Starbursting launcher UI
5. Add error tracking (Sentry)

---

## 🎯 Quick Wins (Can Fix Now)

### 1. Remove Unused Screenshot Reference
**File:** `functions/api/content-intelligence/analyze-url.ts:501`
**Action:** Remove screenshot URL from response or implement endpoint

### 2. Add Authentication to AI Config
**File:** `functions/api/ai/config.ts`
**Action:** Add `requireAuth()` check (2 minutes)

### 3. Forward Auth Headers in Starbursting
**File:** `functions/api/content-intelligence/starbursting.ts:119`
**Action:** Add Authorization header forwarding (2 minutes)

---

## 📊 Statistics

| Category | Count | Priority |
|----------|-------|----------|
| Authentication TODOs | 18 | HIGH |
| API Configuration | 4 | MEDIUM |
| Workspace Management | 5 | MEDIUM |
| UI/UX Enhancements | 8 | LOW |
| **TOTAL** | **35** | Mixed |

---

## 🚀 Recommended Next Steps

1. **IMMEDIATE:** Fix ACH authentication (highest security risk)
2. **TODAY:** Consolidate all API authentication using shared helper
3. **THIS WEEK:** Add PDF API keys and AI config auth
4. **NEXT WEEK:** Complete workspace management features
5. **FUTURE:** UI enhancements and advanced features

---

## 📝 Notes

- All **authentication-related TODOs** should be fixed before public launch
- **API keys** should be added to environment variables (not committed to Git)
- **Workspace management** can be deferred if single-user mode is acceptable
- **UI TODOs** are enhancements, not blockers

---

**Last Updated:** October 8, 2025
**Audit By:** Claude Code
**Next Review:** After Phase 1 completion
