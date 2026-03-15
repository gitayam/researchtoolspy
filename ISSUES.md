# ResearchTools.net — Issue Tracker

**Last updated:** 2026-03-15
**Current tag:** v0.16.3-auth-safety

---

## Fixed (v0.16.3)

### P1 — evidence.ts DELETE Used Wrong Variable for Ownership Check
- [x] `evidence.ts:233` — DELETE query used `userId` (from `getUserIdOrDefault`, guest fallback to user 1) instead of `authUserId` (from `getUserFromRequest`, strict auth)
- [x] Changed `.bind(evidenceId, userId)` → `.bind(evidenceId, authUserId)`
- **Root cause:** `userId` was defined at function scope (line 17) for GET requests; DELETE handler introduced `authUserId` on line 225 but reused the outer `userId` in the query

### P1 — comments.ts Fragile Type Coercion in Ownership Check
- [x] `comments.ts:419` (2 occurrences) — `existing.user_id === userId.toString()` used strict equality between potentially mismatched types (D1 may return INTEGER or TEXT)
- [x] Changed to `String(existing.user_id) === String(userId)` for safe comparison
- **Root cause:** D1 SQLite returns flexible types; strict `===` with `.toString()` on one side is fragile

### P1 — frameworks/[id].ts Fragile Ownership Comparison
- [x] `frameworks/[id].ts:97` — `existing.user_id === userId` without type coercion
- [x] Changed to `String(existing.user_id) === String(userId)`
- **Root cause:** Same D1 type coercion issue as comments.ts

---

## Fixed (v0.16.2)

### P2 — PDF Extractor Hardcoded Placeholder API Key
- [x] `content-intelligence/pdf-extractor.ts` had `'YOUR_PDF_CO_API_KEY'` hardcoded in 2 places — would always fail in production
- [x] Removed dead `require('pdf-parse')` / `Buffer` code that can never work in Cloudflare Workers
- [x] `extractPDFText()` and `extractPDFViaExternalService()` now accept `pdfCoApiKey` parameter
- [x] Returns clear error `"PDF extraction unavailable: PDF_CO_API_KEY not configured"` when env var missing
- [x] `analyze-url.ts` updated to pass `context.env.PDF_CO_API_KEY` and declare it in Env interface
- **Root cause:** utility module had no access to `context.env`; API key was hardcoded as a placeholder TODO

### P2 — 3 Endpoints Used gpt-4o Instead of gpt-4o-mini
- [x] `content-intelligence/pdf-extractor.ts:394` — `gpt-4o` → `gpt-4o-mini`
- [x] `research/generate-question.ts:186` — `gpt-4o` → `gpt-4o-mini`
- [x] `research/generate-plan.ts:324` — `gpt-4o` → `gpt-4o-mini`
- **Root cause:** these endpoints predated the project rule against gpt-4o; never audited

---

## Fixed (v0.16.1)

### P0 — Login Endpoint Returning 503 (JWT_SECRET Missing)
- [x] `hash-auth/authenticate` returned 503 "Authentication service unavailable" — `JWT_SECRET` was never set as a Cloudflare Pages secret
- [x] Generated and set `JWT_SECRET` via `wrangler pages secret put`
- [x] Login now returns JWT tokens correctly (200 with access_token)
- **Root cause:** JWT_SECRET was declared as `JWT_SECRET?: string` (optional) in the Env interface but never provisioned in Cloudflare Pages secrets. The endpoint hit the line 53 guard: `if (!env.JWT_SECRET) return 503`

### P2 — register.ts Missing CORS Headers
- [x] `hash-auth/register.ts` — 2 `Response.json()` calls had no CORS headers
- [x] Added import of `JSON_HEADERS` from shared `api-utils.ts`
- **Root cause:** Same `Response.json()` pattern as v0.15.2 settings endpoints

### P2 — HamiltonRulePage Hardcoded Workspace "1"
- [x] `src/pages/tools/HamiltonRulePage.tsx:153` — POST body sent `workspace_id: '1'` instead of user's active workspace
- [x] Added `useWorkspace()` hook, replaced hardcoded `'1'` with `currentWorkspaceId`
- **Root cause:** Page was built before WorkspaceContext existed, never migrated (same pattern as entity pages fixed in v0.13.2)

---

## Fixed (v0.16.0)

### P2 — Massive CORS Consolidation: 61 Files Migrated to Shared Constants
- [x] 7 intelligence endpoints — migrated from local corsHeaders to shared `JSON_HEADERS`
- [x] 6 ACH endpoints + 3 public ACH endpoints — migrated to shared `JSON_HEADERS`
- [x] 2 deception endpoints — migrated to shared `JSON_HEADERS`
- [x] 5 cross-table endpoints — migrated to shared `JSON_HEADERS`
- [x] 17 content-intelligence endpoints — migrated to shared `JSON_HEADERS`
- [x] 6 framework endpoints — migrated to shared `JSON_HEADERS`
- [x] 2 collection job endpoints — migrated to shared `JSON_HEADERS`
- [x] 3 tools endpoints — migrated to shared `JSON_HEADERS`
- [x] 2 AI endpoints — migrated to shared `JSON_HEADERS`
- [x] 2 invite endpoints — migrated to shared `JSON_HEADERS`
- [x] 2 actor sub-endpoints (search, credibility) — migrated to shared `JSON_HEADERS`
- [x] 1 comments endpoint — migrated to shared `JSON_HEADERS`
- [x] 1 evidence-tags/batch — migrated to shared `JSON_HEADERS`
- [x] 1 evidence/recommend — migrated to shared `JSON_HEADERS`
- [x] 1 health endpoint — migrated to shared `JSON_HEADERS`
- [x] `_shared/error-response.ts` — replaced local `DEFAULT_CORS` with imported `JSON_HEADERS`
- [x] Net: ~470 lines of duplicated CORS definitions removed across 61 files
- **Root cause:** endpoints were built independently with copy-pasted corsHeaders objects; the shared `_middleware.ts` already adds CORS headers to all responses, so inline definitions were redundant

### P2 — generate-entities.ts Hardcoded Workspace "1"
- [x] `frameworks/[id]/generate-entities.ts` — entities generated from COG frameworks always went to workspace "1" instead of the framework's own workspace
- [x] Now uses `framework.workspace_id`, with fallback to user's first workspace
- **Root cause:** endpoint predated workspace isolation; hardcoded `workspaceId = '1'` was a placeholder never updated

---

## Fixed (v0.15.2)

### P1 — 8 Settings/Auth Endpoints Had Zero CORS Headers on Response.json()
- [x] `settings/workspaces.ts` — 7 `Response.json()` calls had no CORS headers at all
- [x] `settings/workspaces/[id].ts` — 10 `Response.json()` calls had no CORS headers
- [x] `settings/user.ts` — 10 `Response.json()` calls had no CORS headers
- [x] `settings/data/export.ts` — 5 `Response.json()` calls had no CORS headers
- [x] `settings/data/import.ts` — 5 `Response.json()` calls had no CORS headers
- [x] `settings/data/workspace/[id].ts` — 4 `Response.json()` calls had no CORS headers
- [x] `settings/hash/backup.ts` — 2 `Response.json()` calls had no CORS headers
- [x] `hash-auth/authenticate.ts` — 6 `Response.json()` calls had no CORS headers
- [x] All 8 files now import and use `JSON_HEADERS` from shared `api-utils.ts`
- **Root cause:** `Response.json()` provides NO CORS headers by default — browsers completely block these responses in cross-origin contexts. Settings/auth endpoints were built using the convenience `Response.json()` API without explicit headers.

---

## Fixed (v0.15.1)

### P2 — 11 More Endpoints Had Incomplete CORS on Error Responses
- [x] `tools/extract.ts`, `tools/analyze-url.ts`, `tools/scrape-metadata.ts`, `tools/batch-process.ts`, `tools/rage-check.ts` — 27 inline error responses had only `Content-Type` + `Allow-Origin`, missing `Allow-Methods` and `Allow-Headers`
- [x] `collection/[jobId]/approve.ts`, `collection/start.ts` — local corsHeaders removed, 4 inline error responses fixed
- [x] `hamilton-rule/[id].ts`, `hamilton-rule/analyze.ts`, `equilibrium-analysis/[id].ts`, `equilibrium-analysis/analyze.ts` — migrated to shared `JSON_HEADERS`/`CORS_HEADERS`, inline 401 responses fixed
- [x] All 11 files now use shared `JSON_HEADERS` from `api-utils.ts`
- **Root cause:** error paths within endpoints used inline header objects that bypassed the endpoint's own corsHeaders constant

---

## Fixed (v0.15.0)

### P2 — content-library Endpoint Returned 500 (Missing Table Fallback)
- [x] `content-library.ts` crashed with 500 when `content_intelligence` table had missing columns or didn't exist
- [x] Added graceful fallback: returns empty `{ content: [], total: 0 }` on "no such table/column" errors
- [x] Migrated from local `corsHeaders` to shared `JSON_HEADERS`
- **Root cause:** catch block returned generic 500 instead of empty result for schema-related D1 errors

### P2 — Last 5 Local generateId() Definitions Removed
- [x] `comments.ts` — plain UUID → shared `generateId()`
- [x] `social-media.ts` — plain UUID → shared `generateId()`
- [x] `frameworks/[id]/generate-entities.ts` — plain UUID → shared `generateId()`
- [x] `hamilton-rule.ts` — prefixed `hr-` → shared `generatePrefixedId('hr')`
- [x] `equilibrium-analysis.ts` — prefixed `eq-` → shared `generatePrefixedId('eq')`
- [x] Zero local `generateId` definitions remain anywhere in `functions/api/`
- [x] `hamilton-rule.ts` and `equilibrium-analysis.ts` also migrated from local corsHeaders to shared `JSON_HEADERS`
- **Root cause:** these 5 files were missed in v0.14.1 (entity endpoints) and v0.14.8 (COP endpoints) sweeps

---

## Fixed (v0.14.9)

### P1 — 75 Endpoints Had Inconsistent CORS Headers (Auth Preflight Failures)
- [x] 75 endpoints were missing `X-User-Hash` in `Access-Control-Allow-Headers` — browser preflight rejected hash-based auth requests
- [x] Shared `CORS_HEADERS` in `api-utils.ts` updated to include `X-Workspace-ID`
- [x] 72 files migrated to use shared `CORS_HEADERS` / `JSON_HEADERS` from `api-utils.ts` (local definitions removed)
- [x] 4 COP public endpoints updated with consistent CORS headers (intentionally unauthenticated)
- [x] All `{ ...corsHeaders, 'Content-Type': 'application/json' }` spreads replaced with `JSON_HEADERS`
- [x] CORS preflight now returns correct `Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Hash, X-Workspace-ID` on all endpoints
- **Root cause:** endpoints were built independently with copy-pasted CORS definitions; many predated hash-based auth and never added `X-User-Hash`

### P2 — evidence.ts and datasets.ts Had Broken Sequential .bind() (500 Error)
- [x] `evidence.ts` and `datasets.ts` called `.bind()` in a loop (`stmt = stmt.bind(params[i])`) — D1 `.bind()` is NOT cumulative, each call replaces previous bindings
- [x] Both endpoints returned 500 on any filtered GET query (only last parameter was bound)
- [x] Fixed: replaced with `.bind(...params)` spread syntax
- **Root cause:** incorrect assumption that D1 `.bind()` appends parameters; it sets all parameters at once

---

## Fixed (v0.14.8)

### P2 — generateId() Deduplicated Across 21 COP Endpoints
- [x] Added shared `generatePrefixedId(prefix)` to `functions/api/_shared/api-utils.ts`
- [x] Migrated all 21 COP endpoint files from local `generateId()` to shared `generatePrefixedId(prefix)`
- [x] Each entity retains its unique prefix: `cop-`, `rfi-`, `clm-`, `tsk-`, `per-`, `ast-`, `tle-`, `pb-`, `cops-`, `alt-`, `etg-`, `dep-`, `ttpl-`, `poo-`, `mcl-`, `ifm-`, `pbr-`, `alog-`, `rfia-`, `sub-`
- [x] Zero local `generateId` definitions remain in `functions/api/cop/`
- [x] Build passes, production deployment verified
- **Root cause:** each COP endpoint copy-pasted its own `generateId()` wrapper with entity-specific prefix; no shared utility existed for prefixed IDs

---

## Fixed (v0.14.7)

### P2 — 7 Tools/Collection Endpoints Had Zero Auth (Quota Abuse Risk)
- [x] `tools/extract.ts` — POST had no auth (content extraction via external APIs)
- [x] `tools/analyze-url.ts` — POST had no auth (URL analysis consuming OpenAI quota)
- [x] `tools/scrape-metadata.ts` — POST had no auth (metadata scraping)
- [x] `tools/batch-process.ts` — POST had no auth (batch AI processing)
- [x] `tools/geoconfirmed.ts` — POST had no auth (GeoConfirmed crawler)
- [x] `collection/[jobId]/status.ts` — GET had no auth (job status readable by anyone)
- [x] `collection/[jobId]/results.ts` — GET had no auth (job results readable by anyone)
- [x] All 7 now enforce `getUserFromRequest` + 401 on unauthenticated requests
- **Root cause:** tools were built as standalone utilities without user context; collection endpoints assumed UUID job IDs provided sufficient obscurity

### P2 — Frontend Silent Fetch Failures in 7 Components
- [x] `CopSessionsTab.tsx` — added error state + console.error on fetch failure
- [x] `ToolsTab.tsx` — added error state + console.error on fetch failure
- [x] `WorkspaceStatsBar.tsx` — added error state + console.error on fetch failure
- [x] `EntitiesTab.tsx` — added error state + console.error on fetch failure
- [x] `FrameworksTab.tsx` — added error state + console.error on fetch failure
- [x] `TeamTab.tsx` — added error state + console.error on fetch failure (both members + invites)
- [x] `GuestModeContext.tsx` — added console.error on conversion API failure
- [x] All 7 now show inline error messages and log failures to console
- **Root cause:** components checked `if (response.ok)` but had no else branch — errors silently swallowed

---

## Fixed (v0.14.6)

### P0 — 9 COP Sub-resource Endpoints Missing Auth or Session Access
- [x] `playbooks/[pbId].ts` — GET had zero auth; PUT/DELETE had auth but no session access
- [x] `playbooks/[pbId]/log.ts` — GET had zero auth (execution logs fully public)
- [x] `assets/[assetId]/log.ts` — GET had zero auth (audit trail fully public)
- [x] `exports/[exportId]/download.ts` — GET had zero auth (export metadata fully public)
- [x] `rfis/[rfiId].ts` — PUT had auth but no session access
- [x] `scrape.ts` — POST/GET had auth but no session access
- [x] `tasks/[taskId]/reassign.ts` — POST had auth but no session access
- [x] `tasks/deploy-template.ts` — POST had auth but no session access
- [x] `evidence/batch.ts` — POST had auth but no session access
- [x] All 9 now enforce `getUserFromRequest` + `verifyCopSessionAccess` on all 13 handler entry points
- **Root cause:** deeply nested sub-resource endpoints (3-4 levels deep) built without session access checks, assuming parent route coverage

---

## Fixed (v0.14.5)

### P1 — 5 Non-COP Endpoints Had Zero Auth (Data Leakage)
- [x] `research/tasks/list.ts` — GET had no auth, exposed all research tasks to anyone
- [x] `deception/history.ts` — GET had no auth, exposed deception analysis history
- [x] `deception/aggregate.ts` — GET used `getUserIdOrDefault` (falls back to user 1), exposed sensitive risk dashboard to unauthenticated users
- [x] `evidence-tags/batch.ts` — POST had no auth, exposed COP evidence tags
- [x] `evidence/recommend.ts` — POST had no auth, exposed evidence recommendation engine
- [x] All 5 now enforce `getUserFromRequest` + 401 on unauthenticated requests
- **Root cause:** Non-COP endpoints built as internal tools or dashboard utilities, never had auth wired in. `getUserIdOrDefault` silently fell back to user 1 instead of rejecting.

---

## Fixed (v0.14.4)

### P0 — COP Sub-resource Endpoints Missing Session Access Checks
- [x] `assets/[assetId]/check-in.ts` — POST had `getUserFromRequest` but no `verifyCopSessionAccess`
- [x] `rfis/[rfiId]/answers.ts` — POST and PUT had `getUserFromRequest` but no `verifyCopSessionAccess`
- [x] `playbooks/[pbId]/rules.ts` — GET had zero auth; POST/PUT/DELETE had `getUserFromRequest` but no `verifyCopSessionAccess`
- [x] All 3 now enforce `getUserFromRequest` + `verifyCopSessionAccess` on all handlers
- **Root cause:** sub-resource endpoints (nested under session ID) assumed parent auth was sufficient, but each handler runs independently

### P1 — Research List Endpoints Had Zero Auth
- [x] `research/evidence/list.ts` — GET had no auth at all
- [x] `research/submissions/list.ts` — GET had no auth at all
- [x] Both now enforce `getUserFromRequest` (401 if unauthenticated)
- **Root cause:** research endpoints built as internal tools, never had auth wired in

---

## Fixed (v0.14.3)

### P0 — 7 More COP Endpoints Had Open GET + Missing Session Access on Mutations
- [x] `assets.ts` — GET returned all assets without auth; mutations had no session access
- [x] `evidence-tags.ts` — GET open; POST/DELETE had no session access
- [x] `task-dependencies.ts` — GET open; POST/DELETE had no session access
- [x] `task-templates.ts` — GET open; POST/PUT/DELETE had no session access
- [x] `poo-estimates.ts` — GET open; POST/PUT/DELETE had no session access
- [x] `submissions.ts` — GET open; PUT had no session access
- [x] `marker-changelog.ts` — GET open; POST had no session access
- [x] All 7 now enforce `getUserFromRequest` + `verifyCopSessionAccess` on all handlers
- [x] Verified: no auth → 401, non-owner → 403, all previously fixed endpoints unaffected
- **Root cause:** continuation of v0.14.2 — incremental COP endpoint development without auth audit

---

## Fixed (v0.14.2)

### P0 — 5 COP Endpoints Had Zero Auth on GET (Data Leakage)
- [x] `claims.ts`, `timeline.ts`, `cot.ts`, `events.ts`, `exports.ts` — all had zero auth on GET
- [x] Claims and timeline mutations also lacked session access verification
- [x] All 5 now enforce `getUserFromRequest` + `verifyCopSessionAccess`
- **Root cause:** COP endpoints built incrementally without auth, never audited as a group

---

## Fixed (v0.14.1)

### P2 — generateId() Duplicated 32 Times
- [x] Extracted shared `generateId()` to `functions/api/_shared/api-utils.ts`
- [x] Replaced local definitions in 6 entity endpoints: actors, sources, events, places, behaviors, relationships
- [x] Created `api-utils.ts` with shared `CORS_HEADERS`, `JSON_HEADERS`, and `optionsResponse()` for future consolidation
- [x] 26 remaining duplicates in COP endpoints — to be consolidated incrementally
- **Root cause:** same pattern as checkWorkspaceAccess — each endpoint copy-pasted its own `crypto.randomUUID()` wrapper

---

## Fixed (v0.14.0)

### P1 — checkWorkspaceAccess Duplicated 7 Times (Tech Debt → Bug Source)
- [x] Extracted shared `checkWorkspaceAccess()` to `functions/api/_shared/workspace-helpers.ts`
- [x] Removed 7 duplicated local definitions from: actors, sources, events, places, behaviors, relationships, credibility
- [x] Removed obsolete workspace "1" auto-create logic (no longer needed after migration 093)
- [x] ~350 lines of duplicated code eliminated
- [x] All 7 entity endpoints tested against COP workspace + default workspace → 200
- **Root cause:** entity endpoints were built independently and each copied the access function; when COP support was added, 2 of 7 copies were missed (v0.13.4 bug)

### P2 — Entity Endpoints Denied COP Workspace Access (v0.13.4)
- [x] `relationships.ts` and `credibility.ts` had their own `checkWorkspaceAccess` functions missing the COP session lookup
- [x] COP workspace IDs (`cop-*`) were falling through to the workspace table lookup and failing (no matching row)
- [x] Now resolved by shared utility (above)

---

## Fixed (v0.13.3)

### P1 — COP Sessions Shared Default Workspace (Data Bleeding)
- [x] 6 old COP sessions used `workspace_id = '1'` (shared default) — entities from different sessions were in the same namespace
- [x] Created migration `093-backfill-cop-workspaces.sql` — creates dedicated workspace for each old session and updates `cop_sessions.workspace_id = id`
- [x] All sessions now have isolated workspaces; new sessions already auto-create their own via session creation code
- [x] 16 orphaned actors remain in workspace "1" (created by user 1 across multiple sessions — cannot auto-reassign)
- **Root cause:** session creation code was added to auto-create workspaces, but existing sessions were never backfilled

### P3 — Library Vote Notifications Showed "Anonymous"
- [x] `library/vote.ts` hardcoded `'Anonymous'` in subscriber notifications
- [x] Now queries `full_name` and `username` from users table and uses actual display name

---

## Fixed (v0.13.2)

### P1 — Entity Pages Used Hardcoded Workspace ID
- [x] `ActorsPage.tsx`, `SourcesPage.tsx`, `EventsPage.tsx` all had `useState<number>(1)` — always queried workspace "1" regardless of active workspace
- [x] Replaced with `useWorkspace()` context hook — now uses the user's actual current workspace
- [x] Removed dead `setWorkspaceId` state and unnecessary `.toString()` calls
- **Root cause:** entity pages were built before `WorkspaceContext` existed and never migrated

### P1 — WorkspaceContext Auth Mismatch
- [x] `WorkspaceContext.tsx` used `Authorization: Bearer` with `omnicore_token` only — hash-based auth users (primary auth path) always fell through to hardcoded default workspace
- [x] Switched to `getCopHeaders()` which sends both `X-User-Hash` and `Authorization: Bearer`
- **Root cause:** context was written for JWT-only auth before hash-based auth became the primary path

### P1 — Stale ISSUES.md Entries
- [x] ACH endpoints listed as using `demo-user` — actually already fixed (uses `getUserFromRequest`)
- [x] Content Intelligence listed as `userId = 1` — already fixed (uses `getUserFromRequest`)
- [x] Frameworks listed as hardcoded user/workspace — already fixed (uses `getUserFromRequest`)
- [x] Starbursting listed as missing auth forwarding — already fixed (forwards `Authorization` header)

---

## Fixed (v0.13.1)

### P0 — COP Layer Endpoints Had Zero Auth Checks
- [x] 10 layer endpoints in `functions/api/cop/[id]/layers/` returned private session entity data to anyone who knew the session ID
- [x] Added `verifyCopLayerAccess` helper — public sessions open to all, private sessions require auth + owner/collaborator
- [x] All 10 layer endpoints now use `verifyCopLayerAccess` before returning data
- **Root cause:** layer endpoints were added as read-only GeoJSON feeds and auth was never wired in

---

## Fixed (v0.13.0)

### P0 — Production 403 Regression on Public COP Sessions
- [x] `verifyCopSessionAccess` didn't check `is_public` flag → all public sessions returned 403 for non-owner users
- [x] Fixed: added `{ readOnly: true }` option for GET handlers; public sessions now readable by any authenticated user
- [x] 12 COP GET endpoints updated

### P0 — Missing Auth Headers on Frontend COP Fetches
- [x] `CopRfiTab.tsx` initial GET fetch missing `getCopHeaders()` → 401 on page load
- [x] `CopEventSidebar.tsx` RFI count fetch missing `getCopHeaders()` → 401

### P1 — Workspace API Tech Debt
- [x] DELETE endpoints didn't cascade (orphaned data across 14 tables)
- [x] `settings/data/workspace/[id].ts` referenced wrong table names and dead columns
- [x] No duplicate member check on POST members
- [x] Entity search prefix-only LIKE, parseInt NaN safety, missing workspace_members row on creation
- [x] Legacy `is_default: id === '1'` check

---

## Open Issues

### P2 — Tech Debt: Remaining Duplication

- [x] ~~generateId() in 21 COP endpoints~~ — deduplicated to shared `generatePrefixedId()` in v0.14.8
- [x] ~~CORS headers inconsistent across 75 endpoints~~ — migrated to shared `CORS_HEADERS`/`JSON_HEADERS` in v0.14.9
- [x] ~~~295 inline error responses with incomplete CORS~~ — 61 more files migrated in v0.16.0 (down from ~120 to ~65 remaining, mostly COP endpoints + 7 cross-table sub-endpoints). **Note:** `_middleware.ts` adds CORS to ALL responses, so remaining inline CORS is purely cosmetic (P3)
- [ ] **~56 COP endpoint files + 7 cross-table sub-endpoints** still use local corsHeaders — cosmetic only (middleware covers CORS)
- [ ] **Dual API surface** — `/api/workspaces/` (team JWT/hash) and `/api/settings/workspaces` (personal `requireAuth`) should be consolidated

### P2 — Data Integrity

- [ ] **COP sessions `team_workspace_id` mostly NULL** — stats and cop-sessions workspace endpoints query by `team_workspace_id` but most sessions never had this set. Needs backfill migration or query change.
- [ ] **16 orphaned actors in workspace "1"** — created by user 1 across multiple COP sessions before workspace isolation. Cannot auto-reassign without manual review.

### P2 — Missing Features / Stubs

- [x] ~~PDF extraction broken (placeholder API key)~~ — fixed in v0.16.2, now reads from `env.PDF_CO_API_KEY`
- [ ] **PDF extraction needs `PDF_CO_API_KEY` secret** — set via `wrangler pages secret put PDF_CO_API_KEY` when ready to enable
- [ ] **Screenshot API referenced but not implemented** — `analyze-url.ts:698` returns URL to non-existent endpoint
- [ ] **No error tracking service** — `ErrorBoundary.tsx:42` has Sentry TODO
- [ ] **Data import stubs** — `settings/data/import.ts` has TODO stubs for workspace, frameworks, and evidence import

### P2 — Frontend Error Handling

- [x] ~~Silent fetch failures in collaboration tabs~~ — fixed in v0.14.7
- [x] ~~GuestModeContext silent failure~~ — fixed in v0.14.7

### P3 — UX / Polish

- [ ] **Export functionality not implemented** — `PublicFrameworkPage.tsx:65` shows alert("coming soon")
- [ ] **MOM assessment modals not wired** — `EventDetailView.tsx`, `ActorDetailView.tsx`
- [ ] **Starbursting launcher UI missing** — `ContentIntelligencePage.tsx`
- [x] ~~Library vote shows "Anonymous"~~ — fixed in v0.13.3

### P2 — Tools/Utility Endpoints Open (No Auth)

- [x] ~~5 tools endpoints open~~ — fixed in v0.14.7
- [x] ~~Collection job endpoints open~~ — fixed in v0.14.7

### P3 — AI Config (Intentional)

- [ ] **AI config GET endpoint has no auth** — `functions/api/ai/config.ts` is publicly readable. This is **intentional** — config is stripped of secrets (apiKey, org removed) and frontend needs it pre-login to show AI feature availability. PUT/POST mutations require auth.

---

## Notes

- **Entity tables lack FK constraints** on workspace_id → manual cascade required on workspace delete
- **D1 batch()** used for transactional cascade deletes (all-or-nothing)
- **All API endpoints now use real auth** — no more hardcoded user IDs anywhere in `functions/api/`
- **Shared utilities** in `functions/api/_shared/`: `workspace-helpers.ts` (access control), `api-utils.ts` (generateId, CORS), `auth-helpers.ts` (auth)
- Production logs accessible via `npx wrangler pages deployment tail <id> --project-name=researchtoolspy --format json`
