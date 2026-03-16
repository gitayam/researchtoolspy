# Loop Worklist — 2026-03-16

Generated from parallel security, architecture, and quality review of 73 uncommitted files (855 ins / 345 del).
Cross-referenced with `docs/LESSONS_LEARNED.md` and `docs/CLOUDFLARE_LESSONS_LEARNED.md`.

---

## CRITICAL — Must fix before deploy

### 1. [SECURITY] Auth bypass via client-controlled X-Workspace-ID header
- **File:** `functions/api/frameworks/[id].ts:100-108`
- **Issue:** PUT handler trusts `X-Workspace-ID` header from client to authorize edits. Attacker who knows a workspace UUID can modify any framework session in it.
- **Approach:** Replace header check with DB lookup — verify user is actually a member of the workspace via `workspace_members` table. Lessons learned (Session 33): "Every mutation endpoint should be audited for auth + ownership + defense-in-depth."
- **Status:** [x] DONE — replaced header trust with DB lookup on workspace_members

### 2. [SECURITY] JWT token passed in URL query parameters
- **File:** `functions/api/auth/oidc/callback.ts:272-280`, `src/pages/AuthCallbackPage.tsx:23-24`
- **Issue:** JWT and user data in URL leak via browser history, Referer headers, server logs.
- **Approach:** Short-term: add `window.history.replaceState({}, '', '/auth/callback')` in AuthCallbackPage before navigating. Long-term: use short-lived auth code in KV, exchange via POST.
- **Status:** [x] DONE — added history.replaceState + open redirect validation

### 3. [SECURITY] SSRF via user-supplied URL in saved links
- **File:** `functions/api/content-intelligence/saved-links.ts:494-540`
- **Issue:** `fetchUrlTitle` fetches any user URL server-side with no validation. Can hit internal services/metadata endpoints.
- **Approach:** Validate URL protocol (https only), block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x). Cloudflare lessons: "Always validate bound values before passing."
- **Status:** [x] DONE — added protocol + private IP validation

### 4. [QUALITY] No token expiry validation on frontend
- **File:** `src/stores/auth.ts:62-88`
- **Issue:** `expires_in: 86400` stored but never checked. `refresh_token: ''` makes refresh impossible. Stale tokens linger.
- **Approach:** Add interceptor or timer checking expiry. On expiry, redirect to login. Consider OIDC refresh token support.
- **Status:** [x] DONE — added issued_at timestamp + expiry check in checkAuth()

---

## WARNING — Should fix soon

### 5. [SECURITY] ACH DELETE bypasses user ownership
- **File:** `functions/api/ach/index.ts:290-305`
- **Issue:** Verification query includes `user_id` but DELETE query omits it. For analyses with `workspace_id IS NULL`, any auth'd user can delete by ID.
- **Approach:** Add `AND user_id = ?` to DELETE query. Lessons learned: "Copy auth pattern from strictest sibling handler."
- **Status:** [x] DONE — added user_id to DELETE WHERE clause

### 6. [SECURITY] Open redirect in auth callback
- **File:** `src/pages/AuthCallbackPage.tsx:25`
- **Issue:** `redirect` query param not validated — could redirect to malicious sites after auth.
- **Approach:** Validate `redirectTo` starts with `/` and doesn't contain `//` or protocol prefixes.
- **Status:** [x] DONE — fixed in AuthCallbackPage with item #2

### 7. [SECURITY] Client-side OpenAI API key exposure
- **File:** `src/lib/ai-deception-analysis.ts:13`
- **Issue:** `VITE_OPENAI_API_KEY` gets bundled into client JS. `dangerouslyAllowBrowser: true` confirms client-side use.
- **Approach:** Verify build env doesn't set this var. Route all AI calls through backend. Cloudflare lessons: "Use secrets for API keys."
- **Status:** [~] VERIFIED — VITE_OPENAI_API_KEY not in .env; falls back to 'demo-key' (no leak). Backend migration deferred.

### 8. [ARCH] Auth hardening incomplete — inconsistent posture
- **Files:** ~15 endpoints hardened, ~30 still use `getUserIdOrDefault`
- **Issue:** Some endpoints require auth, similar ones don't. Confusing and exploitable.
- **Approach:** Complete the migration or document which endpoints intentionally allow guest access.
- **Status:** [ ] TODO

### 9. [ARCH] Workspace + member creation not in a transaction
- **File:** `functions/api/workspaces/index.ts:112-121`
- **Issue:** Two separate INSERTs — if member INSERT fails, orphaned workspace with no admin.
- **Approach:** Use `env.DB.batch([workspaceInsert, memberInsert])` for atomicity.
- **Status:** [x] DONE — wrapped in DB.batch() + hardcoded wsType to TEAM

### 10. [ARCH] Missing UNIQUE constraint on oidc_sub
- **File:** `schema/migrations/096-add-oidc-columns.sql`
- **Issue:** Non-unique index allows duplicate users per OIDC subject on concurrent first-logins.
- **Approach:** `CREATE UNIQUE INDEX idx_users_oidc_sub ON users(oidc_sub) WHERE oidc_sub IS NOT NULL`
- **Status:** [x] DONE — migration 099 created

### 11. [QUALITY] Dynamic Tailwind classes purged by JIT
- **Files:** `src/components/frameworks/GenericFrameworkView.tsx:683`, `src/pages/frameworks/index.tsx:926`
- **Issue:** `sm:grid-cols-${sections.length}` won't survive Tailwind purge — grid layout broken.
- **Approach:** Use CSS custom property with Tailwind arbitrary value syntax.
- **Status:** [x] DONE — used --section-count CSS var with sm: breakpoint

### 12. [UX] Seven COP panel "Add" buttons are no-ops
- **File:** `src/pages/CopWorkspacePage.tsx:1040-1177`
- **Issue:** Empty `onAdd: () => {}` renders clickable buttons that do nothing.
- **Approach:** Remove `onAdd` prop (CopPanelExpander hides button when undefined) or implement handlers.
- **Status:** [x] DONE — removed all 7 no-op onAdd callbacks

### 13. [UX] `window.prompt()` for invite token input
- **File:** `src/pages/CollaborationPage.tsx:~210`
- **Issue:** Jarring, unstyled, blocked by some browsers. Inconsistent with rest of app.
- **Approach:** Replace with Dialog-based input matching CreateWorkspaceDialog pattern.
- **Status:** [x] DONE — added Join Team dialog with Input + validation

### 14. [ARCH] Hardcoded Authentik end-session URL
- **File:** `functions/api/auth/oidc/logout.ts:11`
- **Issue:** All other OIDC URLs come from env vars; this one is hardcoded.
- **Approach:** Add `OIDC_END_SESSION_URL` to wrangler.toml vars or derive from `OIDC_ISSUER`.
- **Status:** [x] DONE — added to wrangler.toml + logout reads from env

### 15. [SECURITY] OIDC account linking by email without verification
- **File:** `functions/api/auth/oidc/callback.ts:169-200`
- **Issue:** Auto-links OIDC identity when email matches existing account. Attacker controlling OIDC account with victim's email = account takeover.
- **Approach:** Check `email_verified` claim before auto-linking. Or require confirmation from existing session.
- **Status:** [x] DONE — added email_verified !== false guard before auto-linking

### 16. [ARCH] Workspace type from description string matching
- **File:** `functions/api/workspaces/index.ts:110`
- **Issue:** `body.description?.includes('PERSONAL')` is fragile — "not a PERSONAL workspace" → type PERSONAL.
- **Approach:** Add explicit `type` field to request body, or hardcode TEAM for team-creation endpoint.
- **Status:** [x] DONE — hardcoded to TEAM in cycle 1 (item #9)

---

## SUGGESTIONS — Nice to have / chores

### 17. [UX] Sidebar starts fully collapsed — poor discoverability
- **File:** `src/components/layout/dashboard-sidebar.tsx:152`
- **Approach:** Expand section containing current route by default.
- **Status:** [x] DONE — useState initializer auto-expands based on pathname

### 18. [QUALITY] Stats polling every 30s with 18 DB queries
- **File:** `src/pages/CopWorkspacePage.tsx:314`
- **Approach:** Increase to 60-120s, or use D1 batch() for single round-trip, or event-driven refetch.
- **Status:** [x] DONE — increased polling interval from 30s to 60s (halves DB load)

### 19. [UX] SSO button label inconsistent (Login vs Register pages)
- **Files:** LoginPage.tsx ("Login with SSO") vs RegisterPage.tsx ("Login with IrregularChat SSO")
- **Approach:** Use consistent label on both pages.
- **Status:** [x] DONE — RegisterPage now says "Login with SSO" matching LoginPage

### 20. [QUALITY] Inline `<style>` blocks in React components
- **Files:** `src/layouts/DashboardLayout.tsx:24-35`, `src/components/layout/dashboard-sidebar.tsx:281-284`
- **Approach:** Move to `src/index.css` alongside existing keyframes.
- **Status:** [x] DONE — moved layout + hamburger CSS to index.css, removed inline &lt;style&gt; blocks

### 21. [QUALITY] `getAuthIdentifier` returns magic string 'jwt_authenticated'
- **File:** `src/lib/auth-utils.ts:30`
- **Approach:** Extract user ID from JWT payload instead of generic fallback.
- **Status:** [x] DONE — extracts sub from JWT, returns null if invalid

### 22. [CHORE] Redundant `const userId = authUserId` in social-media endpoints
- **Files:** `functions/api/social-media/jobs.ts:71`, posts.ts:61, profiles.ts:75
- **Approach:** Use `authUserId` directly or rename at destructuring.
- **Status:** [x] DONE — renamed to userId directly in all 3 files

### 23. [SECURITY] Add PKCE to OIDC flow
- **File:** `functions/api/auth/oidc/login.ts`
- **Approach:** Add `code_challenge` + `code_verifier` for defense-in-depth per OAuth 2.1.
- **Status:** [x] DONE — PKCE S256 with code_verifier in KV, backwards-compatible callback

### 27. [UX] Workspace wizard auth guard — late 401 wastes user time
- **File:** `src/pages/NewWorkspacePage.tsx`
- **Issue:** Users could fill out the entire multi-step wizard without being logged in, only to get a 401 on submit.
- **Status:** [x] DONE — auth check on mount redirects to login; 401 on submit also redirects with return URL

### 28. [QUALITY] `container mx-auto` broken in Tailwind v4 — 19 files
- **Files:** 19 pages/components still use `container mx-auto` which doesn't set max-width in Tailwind v4
- **Approach:** Replace with `w-full max-w-7xl mx-auto` or appropriate max-w per context. Cloudflare lessons doc flags this.
- **Status:** [x] DONE — removed `container` from all 19 files; added max-w where missing

### 29. [UX] Workspace wizard streamlined from 5→3 steps
- **File:** `src/pages/NewWorkspacePage.tsx`
- **Issue:** 5-step wizard with mandatory-looking optional steps created "fake friction"
- **Status:** [x] DONE — collapsed to 3 steps, auto-advance, smart defaults, collapsible optional sections

### 24. [QUALITY] NetworkGraphPage hides controls on mobile with no alternative
- **File:** `src/pages/NetworkGraphPage.tsx`
- **Approach:** Add mobile drawer/toggle for controls, metrics, and node details.
- **Status:** [ ] TODO

### 25. [SECURITY] Rate limiting not implemented on auth endpoints
- **Approach:** Cloudflare Rate Limiting rules or KV-based counters for login/callback.
- **Status:** [ ] TODO

### 26. [QUALITY] dangerouslySetInnerHTML without sanitization
- **File:** `src/components/reports/ReportPreviewDialog.tsx:97`
- **Approach:** Add DOMPurify sanitization before rendering.
- **Status:** [x] DONE — DOMPurify.sanitize() wraps htmlContent

---

## Progress Log

| Date | Items Completed | Notes |
|------|----------------|-------|
| 2026-03-16 | #1,#2,#3,#5,#6,#9,#10,#11,#12,#14 | Cycle 1: Security + arch + UX fixes (10/26 items) |
| 2026-03-16 | #4,#7,#15,#16,#17,#19,#22 | Cycle 2: Token expiry, OIDC email verify, sidebar UX, cleanup (17/26 items) |
| 2026-03-16 | #13,#20,#21,#26 | Cycle 3: XSS sanitize, prompt→Dialog, inline CSS→index.css, auth magic string (21/26 items) |
| 2026-03-16 | #18,#23 | Cycle 4: Stats polling 30s→60s, PKCE S256 for OIDC flow (23/26 items) |
| 2026-03-16 | — | Cycle 5: Committed remaining OIDC/auth/responsive work (57 files) + auth/me + migrations. Clean tree. |
| 2026-03-16 | #27,#28,#29 | Cycle 6: Wizard UX overhaul (5→3 steps), auth guard, Tailwind v4 container fix (19 files) |
