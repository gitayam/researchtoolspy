# ResearchTools.net — Issue Tracker

**Last updated:** 2026-03-15
**Current tag:** v0.17.6-auth-headers-fix

---

## Fixed (v0.17.6)

### P1 — 13 Frontend Components Used `credentials: 'include'` Instead of Auth Headers
- [x] 6 components had NO `getCopHeaders()` import: `PlaceLinker`, `ActorPicker`, `ActorLinker`, `EventLinker`, `SwotEvidenceLinker`, `ClaimsPage` — added import + replaced credentials with headers
- [x] 6 components HAD the import but still used `credentials: 'include'` on some fetches: `StarburstingEntityLinker`, `ClaimEvidenceLinker`, `ClaimEntityLinker`, `ClaimAnalysisDisplay`, `DeceptionForm`, `InvestigationPacketsPage` — replaced credentials with getCopHeaders()
- [x] 1 additional fix in `DeceptionClaimImporter.tsx` (from v0.17.5 search endpoint work)
- [x] ~19 fetch calls total fixed across 13 files
- **Root cause:** Components were built using `credentials: 'include'` (cookie-based auth) but the project uses `X-User-Hash` header-based auth. Without the header, endpoints using `getUserFromRequest` return 401, and endpoints using `getUserIdOrDefault` silently fall back to user 1 (wrong user context). The `getCopHeaders()` helper sends both `X-User-Hash` and `Authorization: Bearer` headers.

---

## Fixed (v0.17.5)

### P1 — content-intelligence/search Endpoint Missing (Frontend Returned HTML)
- [x] Created `functions/api/content-intelligence/search.ts` — new endpoint that `DeceptionClaimImporter.tsx` calls
- [x] `GET /api/content-intelligence/search?q=...&limit=...` searches `content_intelligence` table by title, url, or content
- [x] Returns `{ success: true, results: [{ id, title, url, claim_count, claims }] }` matching frontend's `SearchResult` interface
- [x] Includes claim_adjustments with deception analysis data when available
- [x] Auth required, `safeJsonParse` for claims column, POST returns 405
- **Root cause:** Frontend component `DeceptionClaimImporter.tsx:74` fetched `/api/content-intelligence/search` but no corresponding Cloudflare Pages Function file existed. Requests fell through to SPA HTML fallback (200 with `text/html`). The endpoint was never created — only the frontend code that called it.

### P3 — 13 Phantom API Routes Return SPA HTML (No Frontend Callers)
- [x] Verified 13 non-existent routes (`analyze-content`, `save-link`, `key-phrases`, `entities`, `sentiment`, `compare`, `fact-check`, `bias-check`, `summarize`, `pdf-extractor` (direct GET), `social-media/analyze`, `investigation-packets` (index), `research/submissions/submit`) return SPA HTML
- [x] Confirmed NONE are called by the frontend — they are phantom routes with no callers
- [x] No fix needed — these are not real endpoints, just URLs that don't map to any Pages Function file
- **Note:** The `pdf-extractor.ts` and `investigation-packets/` files exist but their direct GET paths don't match the test URLs (pdf-extractor is POST-only with proper 405, investigation-packets has `list.ts` and `create.ts` sub-routes)

---

## Fixed (v0.17.4)

### P2 — match-entities-to-actors Returned SPA HTML on POST (Missing Handler)
- [x] `content-intelligence/match-entities-to-actors.ts` — was a utility-only module (exported functions for internal use) with no HTTP request handlers
- [x] Frontend POSTs to this path but Cloudflare served SPA `index.html` fallback (200 HTML instead of JSON)
- [x] Added `onRequestPost` handler: validates auth, accepts `{ entities: [{ name, type }], workspace_id? }`, searches actors/places/events by exact name match, returns `{ [name]: { id, name } }` map
- [x] Added `onRequestGet` returning 405 JSON
- [x] All original utility exports (`matchClaimEntitiesToActors`, `matchMultipleClaimsEntities`, `createActorFromUnmatchedEntity`, `getMatchingStatistics`) preserved
- **Root cause:** File only contained exported utility functions for internal use by other endpoints (claim processing). No `onRequestPost`/`onRequestGet` was defined, so Cloudflare Pages fell through to SPA static asset serving. Same class of issue as the 81 POST-only endpoints fixed in v0.16.8.

---

## Fixed (v0.17.3)

### P2 — 28 More Unsafe JSON.parse Calls Across 12 Endpoint Files
- [x] `equilibrium-analysis.ts` — 7 raw parses on `data_source`, `variables`, `equilibrium_analysis`, `statistics`, `tags`, `time_series` → `safeJsonParse()`
- [x] `equilibrium-analysis/[id].ts` — 6 raw parses on same columns → `safeJsonParse()`
- [x] `hamilton-rule/[id].ts` — 5 raw parses on `actors`, `relationships`, `network_analysis`, `ai_analysis`, `tags` → `safeJsonParse()`
- [x] `content-intelligence/saved-links.ts` — 6 raw parses on `tags`, `analysis_entities`, `analysis_top_phrases` → `safeJsonParse()`
- [x] `content-intelligence/answer-question.ts` — 2 raw parses on `entities`, `source_excerpts` → `safeJsonParse()`
- [x] `content-intelligence/auto-extract-entities.ts` — 1 raw parse on `entities` → `safeJsonParse()`
- [x] `workspaces/[id]/frameworks.ts` — 1 raw parse on `tags` → `safeJsonParse()`
- [x] `evidence-citations.ts` — 1 raw parse on `dataset_source` → `safeJsonParse()`
- [x] `framework-evidence.ts` — 1 raw parse on `tags` → `safeJsonParse()`
- [x] `library/fork.ts` — 1 raw parse on `framework_data` → `safeJsonParse()`
- [x] `ach/from-content-intelligence.ts` — 3 raw parses on `entities`, `topics` → `safeJsonParse()`
- [x] `ach/public/index.ts` — 1 raw parse on `tags` → `safeJsonParse()`
- **Root cause:** Same as v0.17.2 — D1 text columns parsed with raw `JSON.parse()` that crashes on malformed data. Completing the sweep started in v0.17.2, now covering analysis, content-intelligence, ACH, library, and framework endpoints.

---

## Fixed (v0.17.2)

### P2 — 47 Unsafe JSON.parse Calls in Entity Endpoints Could Crash on Corrupt Data
- [x] Added shared `safeJsonParse(value, fallback)` helper to `_shared/api-utils.ts`
- [x] `actors.ts` — 19 `JSON.parse()` calls on `aliases`, `tags`, `deception_profile` D1 text columns → `safeJsonParse()` with `[]` or `null` fallback
- [x] `events.ts` — 11 `JSON.parse()` calls on `coordinates`, `tags`, `source`, `metadata`, `eve_assessment` → `safeJsonParse()`
- [x] `places.ts` — 7 `JSON.parse()` calls on `coordinates`, `aliases`, `deception_profile` → `safeJsonParse()`
- [x] `behaviors.ts` — 6 `JSON.parse()` calls on `indicators`, `aliases`, `deception_profile` → `safeJsonParse()`
- [x] `sources.ts` — 4 `JSON.parse()` calls on `moses_assessment` → `safeJsonParse()`
- [x] All 5 entity endpoints now gracefully handle corrupt JSON in any D1 text column — returns fallback value instead of crashing the entire response
- **Root cause:** Entity endpoints used raw `JSON.parse()` with ternary null-checks, but these don't protect against malformed JSON strings (e.g. `"[invalid"`, truncated data). One bad row in the database would crash the entire list/detail response with a 500. The shared `safeJsonParse` wrapper catches parse errors and returns the specified fallback.

---

## Fixed (v0.17.1)

### P1 — Workspace Tools Endpoint 500: 3 Wrong Column Names in SQL Queries
- [x] `workspaces/[id]/tools.ts` — `p.is_active` → `p.status` (cop_playbooks has `status`, not `is_active`)
- [x] `workspaces/[id]/tools.ts` — `t.task_type` → `t.template_type` (cop_task_templates has `template_type`)
- [x] `workspaces/[id]/tools.ts` — `f.is_public` → `f.status` (cop_intake_forms has `status`, not `is_public`)
- **Root cause:** Queries were written with assumed column names that didn't match the actual D1 schema. Previously masked because `team_workspace_id` was always NULL, so queries returned 0 rows and never evaluated the column references.

### P1 — Workspace Entities Endpoint 500: 3 Wrong Column Names in UNION Query
- [x] `workspaces/[id]/entities.ts` — `behaviors.type` → `behavior_type` (actual column name)
- [x] `workspaces/[id]/entities.ts` — `places.type` → `place_type` (actual column name)
- [x] `workspaces/[id]/entities.ts` — `events.type` → `event_type` (actual column name)
- [x] `workspaces/[id]/entities.ts` — `sources.category` → `source_type` (sources has no `category` column)
- **Root cause:** TABLE_META mapping assumed generic `type` column names, but entity tables use prefixed names (`behavior_type`, `place_type`, `event_type`). `sources` has no `category` column — the closest match is `source_type`.

### P2 — Workspace Endpoints Queried Only team_workspace_id (Most Are NULL)
- [x] `workspaces/[id]/cop-sessions.ts` — `WHERE team_workspace_id = ?` → `WHERE team_workspace_id = ? OR workspace_id = ?`
- [x] `workspaces/[id]/stats.ts` — same fix applied to all COP session queries (3 queries + complex tools count with 6 bind params)
- [x] `workspaces/[id]/tools.ts` — same fix applied to all 3 queries (playbooks, task templates, intake forms)
- **Root cause:** Most COP sessions have NULL `team_workspace_id` but valid `workspace_id`. Querying only by `team_workspace_id` returned 0 results for most sessions.

### P2 — 10 Workspace Endpoint Files Had Local jsonHeaders Instead of Shared JSON_HEADERS
- [x] Migrated 10 workspace files from local `const jsonHeaders = { 'Content-Type': 'application/json' }` to shared `JSON_HEADERS` import
- [x] Files: `workspaces/index.ts`, `workspaces/[id]/index.ts`, `workspaces/[id]/entities.ts`, `workspaces/[id]/frameworks.ts`, `workspaces/[id]/members.ts`, `workspaces/[id]/cop-sessions.ts`, `workspaces/[id]/stats.ts`, `workspaces/[id]/tools.ts`, `workspaces/[id]/invites/index.ts`, `workspaces/[id]/invites/[inviteId].ts`
- **Root cause:** Workspace endpoints predated the shared `api-utils.ts` module; each defined its own minimal JSON headers without CORS fields (redundant since `_middleware.ts` handles CORS globally, but inconsistent with the rest of the codebase).

---

## Fixed (v0.17.0)

### P2 — 60 Endpoint Files Had Redundant Local corsHeaders Definitions
- [x] 51 COP endpoint files — removed local `const corsHeaders = {...}` and replaced all usages with shared `JSON_HEADERS`
- [x] 7 cross-table endpoint files — same migration
- [x] 2 analysis endpoints (`hamilton-rule.ts`, `equilibrium-analysis.ts`) — removed `corsHeaders = JSON_HEADERS` alias
- [x] All 60 files now import `JSON_HEADERS` from `_shared/api-utils` instead of declaring their own headers
- [x] Only `_middleware.ts` retains its own corsHeaders (intentional — it's the global CORS handler)
- [x] ~600 lines of duplicated CORS definitions removed across 60 files
- **Root cause:** COP and cross-table endpoints were built before `_shared/api-utils.ts` existed, each copy-pasting their own corsHeaders constant. The global `_middleware.ts` already adds CORS to all responses, so these were purely redundant.

---

## Fixed (v0.16.9)

### P1 — 5 Unsafe JSON.parse Calls Could Crash Endpoints
- [x] `collection/[jobId]/status.ts:59` — `JSON.parse(job.categories)` on D1 data → safe IIFE with try/catch fallback to `[]`
- [x] `tools/extract-timeline.ts:92` — `JSON.parse(rawContent)` on AI response → try/catch, returns empty array on failure
- [x] `tools/extract-claims.ts:432` — `JSON.parse(rawContent)` on AI response → try/catch, returns `{ claims: [], summary: 'Failed...' }`
- [x] `tools/claim-match.ts:120` — `JSON.parse(rawContent)` on AI response → try/catch, returns 502 with error JSON
- [x] `tools/rage-check.ts:102` — `JSON.parse(jsonContent)` on AI response → try/catch, returns 502 with error JSON
- **Root cause:** AI responses can contain malformed JSON (markdown fences, truncated output, model refusal). D1 text columns can hold corrupted data. Both cause unhandled SyntaxError that crashes the entire endpoint.

### P1 — collaborators.ts Used Number() Instead of String() for Ownership Check
- [x] `cop/[id]/collaborators.ts:265-266` — `Number(session.created_by) === userId` → `String(session.created_by) === String(userId)`
- **Root cause:** `Number()` comparison fails when `userId` is a string; `String()` on both sides is the established safe pattern (see v0.16.5 sweep)

---

## Fixed (v0.16.8)

### P2 — 81 POST-Only Endpoints Returned SPA HTML on GET Requests
- [x] 81 endpoint files only exported `onRequestPost` — GET requests fell through to Cloudflare Pages SPA fallback, returning full HTML instead of JSON error
- [x] Added `onRequestGet` handler returning 405 JSON `{"error":"Method not allowed. Use POST."}` to all 81 files
- [x] 17 files also needed `JSON_HEADERS` import added from `_shared/api-utils`
- [x] Fixed incorrect import path in `frameworks/public/[token]/clone.ts` (`../../../../` → `../../../`)
- [x] Verified: all 13 sampled POST-only endpoints now return 405, all GET endpoints still return 200, POST still works
- **Root cause:** Cloudflare Pages Functions only handle HTTP methods they export handlers for — unhandled methods fall through to the static asset serving layer which returns `index.html`. This is a security concern (leaks SPA source to API probes) and confuses API consumers expecting JSON.
- **Categories fixed:** research (7), tools (9), AI (6), content-intelligence (12), COP sub-resources (8), claims (5), ACH (6), frameworks (4), collection (3), settings (3), auth (3), investigation-packets (2), others (13)

---

## Fixed (v0.16.7)

### P0 — evidence/recommend 500 — Runtime Scoping Bug (TDZ Error)
- [x] `evidence/recommend.ts` — POST returned 500 with "Cannot access 'keywordEvidence' before initialization"
- [x] Renamed all query result variables to unique names (`actorResult`, `entityTextResult`, `kwResult`, `tfResult`, `ctxResult`, `recentResult`) to avoid esbuild scope flattening
- [x] Replaced `.forEach()` callbacks with `for...of` loops (no closure scope issues)
- [x] Fixed SQL column names: `who` → `who_involved`, `what` → `what_happened`, `where_location` → `where_occurred`
- [x] Fixed response mapping to use correct D1 column names
- [x] Added error detail to 500 response for debuggability
- **Root cause:** Cloudflare Pages Functions bundler (esbuild) flattened block-scoped variables with identical names across sibling scopes, causing TDZ violations at runtime despite TypeScript passing locally

### P1 — Unsafe JSON.parse Across 5 Endpoint Files
- [x] `evidence.ts` — list endpoint: 11 unsafe `JSON.parse()` calls → safe `safeJ()` helper with try/catch fallback
- [x] `evidence/recommend.ts` — tags parse in response mapping → IIFE with try/catch
- [x] `investigations/[id].ts` — GET and PUT handlers: 5 unsafe `JSON.parse()` → module-level `sj()` helper
- [x] `investigations/index.ts` — list and create handlers: 4 unsafe `JSON.parse()` → module-level `sj()` helper
- [x] `investigations/from-research-question.ts` — 3 unsafe `JSON.parse()` → module-level `sj()` helper
- **Root cause:** Malformed JSON in D1 text columns (empty strings, truncated data) would crash entire endpoint with unhandled SyntaxError

---

## Fixed (v0.16.6)

### P0 — evidence/recommend 500 on Missing Input
- [x] `evidence/recommend.ts` — POST crashed with 500 TypeError when `context` field missing from request body (accessing `.entities` on `undefined`)
- [x] Added input validation: returns 400 with clear error when `context` object is missing
- [x] Fixed 2 silent empty catch blocks — now log via `console.warn` with `[Evidence Recommend]` prefix
- **Root cause:** No validation on required `context` field before destructuring; empty catches hid secondary errors

### P1 — hash/backup GET Returned SPA HTML (Missing Handler)
- [x] `settings/hash/backup.ts` — only had `onRequestPost`, GET fell through to SPA HTML with 200
- [x] Added `onRequestGet` handler returning 405 "Use POST to generate a hash backup file"
- **Root cause:** Endpoint was POST-only but no GET handler existed to reject non-POST requests

### P2 — COP Task DELETE Didn't Clean Subtask Dependencies
- [x] `cop/[id]/tasks.ts` — when deleting a parent task, subtask dependencies were orphaned
- [x] Now queries subtask IDs first, deletes their dependencies, then deletes parent dependencies, then subtasks, then parent
- **Root cause:** DELETE cascade only handled parent-level dependencies, not subtask-level

---

## Fixed (v0.16.5)

### P1 — 11 Remaining Type Coercion Bugs in Ownership Checks
- [x] `_shared/auth-helpers.ts` (2) — `session.created_by === userId` in COP session access helpers → `String()` on both sides
- [x] `_shared/workspace-helpers.ts` (3) — `workspace.owner_id === userId` in `checkWorkspaceAccess`, `canManageWorkspace`, `getWorkspaceMemberRole` → `String()` on both sides
- [x] `cop/[id]/intake-forms.ts` (1) — owner check → `String()` on both sides
- [x] `cop/[id]/collaborators.ts` (1) — owner check → `String()` on both sides
- [x] `workspaces/[id]/members.ts` (1) — owner check → `String()` on both sides
- [x] `workspaces/[id]/index.ts` (1) — owner check → `String()` on both sides
- [x] `evidence-eve.ts` (3) — workspace owner checks → `String()` on both sides
- [x] Grep confirms zero remaining unsafe `=== userId` / `=== owner_id` comparisons in functions/api/
- **Root cause:** D1 (SQLite) can return INTEGER columns as either JavaScript numbers or strings; strict `===` fails when types mismatch. Shared helpers were highest-impact — they protect all callers.

---

## Fixed (v0.16.4)

### P1 — Workspace Data Clear Missing 4 Tables
- [x] `settings/data/workspace/[id].ts` — DELETE didn't clear `comments`, `comment_mentions`, `comment_notifications`, or `content_intelligence` tables
- [x] Added all 4 tables to the deletion loop (ordered: children before parents)
- [x] Silent try/catch now logs via `console.warn` and surfaces errors in response body
- **Root cause:** Tables were added in later migrations but never included in the data clear endpoint

### P1 — Workspace DELETE Missing Cascade for 4 Tables
- [x] `settings/workspaces/[id].ts` — batch DELETE didn't include `comments`, `comment_mentions`, `comment_notifications`, or `content_intelligence`
- [x] Added all 4 to the D1 `batch()` cascade (before entity tables)
- **Root cause:** Same as above — tables added incrementally without updating the cascade handler

### P2 — Activity POST Accepted Any workspace_id Without Access Check
- [x] `activity.ts` — POST handler accepted any `workspace_id` without verifying the user had access
- [x] Added `checkWorkspaceAccess()` call with 403 on denied
- **Root cause:** Activity logging was built as a system utility, never had workspace scoping

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
- [x] ~~56 COP endpoint files + 7 cross-table sub-endpoints~~ — migrated to shared `JSON_HEADERS` in v0.17.0
- [ ] **Dual API surface** — `/api/workspaces/` (team JWT/hash) and `/api/settings/workspaces` (personal `requireAuth`) should be consolidated

### P2 — Data Integrity

- [x] ~~COP sessions `team_workspace_id` mostly NULL~~ — fixed in v0.17.1, all workspace queries now use `WHERE team_workspace_id = ? OR workspace_id = ?`
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

### P3 — POST-Only Endpoints (Resolved)

- [x] ~~81 POST-only endpoints returned SPA HTML on GET~~ — all now return 405 JSON (v0.16.8)

---

## Notes

- **Entity tables lack FK constraints** on workspace_id → manual cascade required on workspace delete
- **D1 batch()** used for transactional cascade deletes (all-or-nothing)
- **All API endpoints now use real auth** — no more hardcoded user IDs anywhere in `functions/api/`
- **All POST-only endpoints return 405 on GET** — no more SPA HTML leaking from API paths
- **Shared utilities** in `functions/api/_shared/`: `workspace-helpers.ts` (access control), `api-utils.ts` (generateId, CORS), `auth-helpers.ts` (auth)
- Production logs accessible via `npx wrangler pages deployment tail <id> --project-name=researchtoolspy --format json`
