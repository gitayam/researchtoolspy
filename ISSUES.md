# ResearchTools.net — Issue Tracker

**Last updated:** 2026-03-15
**Current tag:** v0.14.1-shared-utils

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

- [ ] **generateId() still in 26 COP endpoints** — shared `api-utils.ts` created but only entity endpoints migrated so far
- [ ] **CORS headers duplicated ~219 files** — shared `CORS_HEADERS` and `JSON_HEADERS` created in `api-utils.ts` but not yet adopted
- [ ] **Dual API surface** — `/api/workspaces/` (team JWT/hash) and `/api/settings/workspaces` (personal `requireAuth`) should be consolidated

### P2 — Data Integrity

- [ ] **COP sessions `team_workspace_id` mostly NULL** — stats and cop-sessions workspace endpoints query by `team_workspace_id` but most sessions never had this set. Needs backfill migration or query change.
- [ ] **16 orphaned actors in workspace "1"** — created by user 1 across multiple COP sessions before workspace isolation. Cannot auto-reassign without manual review.

### P2 — Missing Features / Stubs

- [ ] **PDF extraction broken** — `functions/api/content-intelligence/pdf-extractor.ts` has placeholder API key `'YOUR_PDF_CO_API_KEY'`
- [ ] **Screenshot API referenced but not implemented** — `analyze-url.ts:698` returns URL to non-existent endpoint
- [ ] **No error tracking service** — `ErrorBoundary.tsx:42` has Sentry TODO
- [ ] **Data import stubs** — `settings/data/import.ts` has TODO stubs for workspace, frameworks, and evidence import

### P2 — Frontend Error Handling

- [ ] **Silent fetch failures in collaboration tabs** — `CopSessionsTab.tsx`, `ToolsTab.tsx`, `WorkspaceStatsBar.tsx`, `EntitiesTab.tsx`, `FrameworksTab.tsx`, `TeamTab.tsx` all check `if (response.ok)` but do nothing on failure — errors silently swallowed
- [ ] **GuestModeContext silent failure** — `GuestModeContext.tsx:101` swallows non-OK response on conversion API call

### P3 — UX / Polish

- [ ] **Export functionality not implemented** — `PublicFrameworkPage.tsx:65` shows alert("coming soon")
- [ ] **MOM assessment modals not wired** — `EventDetailView.tsx`, `ActorDetailView.tsx`
- [ ] **Starbursting launcher UI missing** — `ContentIntelligencePage.tsx`
- [x] ~~Library vote shows "Anonymous"~~ — fixed in v0.13.3

### P3 — AI Config (Intentional)

- [ ] **AI config GET endpoint has no auth** — `functions/api/ai/config.ts` is publicly readable. This is **intentional** — config is stripped of secrets (apiKey, org removed) and frontend needs it pre-login to show AI feature availability. PUT/POST mutations require auth.

---

## Notes

- **Entity tables lack FK constraints** on workspace_id → manual cascade required on workspace delete
- **D1 batch()** used for transactional cascade deletes (all-or-nothing)
- **All API endpoints now use real auth** — no more hardcoded user IDs anywhere in `functions/api/`
- **Shared utilities** in `functions/api/_shared/`: `workspace-helpers.ts` (access control), `api-utils.ts` (generateId, CORS), `auth-helpers.ts` (auth)
- Production logs accessible via `npx wrangler pages deployment tail <id> --project-name=researchtoolspy --format json`
