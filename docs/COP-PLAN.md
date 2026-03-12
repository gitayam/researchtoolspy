# COP Workspace Improvement Plan

**Created**: 2026-03-12
**Last Updated**: 2026-03-12 (session 8)

## Completed

- [x] **P0: Questions tab ignoring key_questions** — CopQuestionsTab now shows user's questions from creation, with 5W1H expansion option
- [x] **P0: Timeline showing cross-session data** — CopTimelinePanel now fetches from `/api/cop/{sessionId}/activity` instead of global `/api/intelligence/timeline`
- [x] **P0: Analysis panel showing cross-session data** — CopAnalysisSummary now derives from `/api/cop/{sessionId}/hypotheses` instead of global intelligence endpoints
- [x] **P0: Framework fetch 401 auth mismatch** — `/api/frameworks/[id].ts` now supports X-User-Hash header auth (matching COP pattern)
- [x] **P0: Starbursting link 404** — Fixed link from `/dashboard/frameworks/:id` to `/dashboard/analysis-frameworks/starbursting/:id/view`
- [x] **P0: Default questions instead of user's** — `buildQuestions()` now seeds from `session.key_questions`, fills empty 5W1H categories with defaults
- [x] **P1: Hypotheses PUT missing session filter** — Added `AND cop_session_id = ?` to UPDATE WHERE clause (security fix)
- [x] **P1: Framework 71 bad data** — Updated DB with questions derived from actual session key_questions
- [x] **P1: Claims panel for COP workspace** — CopClaimsPanel extracts claims from URLs via `/api/tools/extract-claims`
- [x] **P1: Claims persistence** — Claims now persist to `cop_claims` table (migration 081). Full CRUD API at `/api/cop/:id/claims`. Verify/dispute workflow with promote-to-evidence. Stats endpoint includes claim_count/verified_claim_count.
- [x] **P1: Context-aware 5W1H questions** — `buildQuestions()` now fetches evidence, actors, activity to generate contextual questions instead of generic defaults
- [x] **P0: Panel grid crash** — Added null-safety guards for `row[0]?.id` and `panelCfg?.width` in panel row rendering
- [x] **P1: Starburst data parsing** — `fetchStarburst` now handles both flat `entries` and categorized `who/what/when/...` formats
- [x] **P0: Evidence feed wrong endpoint** — CopEvidenceFeed now fetches from `/api/cop/{sessionId}/evidence` (evidence_items table) instead of global `/api/evidence` (evidence table)
- [x] **P0: Quick Capture routing to wrong table** — CopGlobalCapture notes now POST to `/api/cop/{sessionId}/evidence` (scoped) instead of `/api/evidence` (global)
- [x] **P0: URL analyses not persisted** — Both CopEvidenceFeed and CopGlobalCapture now persist URL analysis results to evidence_items via `/api/cop/{sessionId}/evidence`
- [x] **P1: 5W1H questions to RFI conversion** — Each unanswered question now has a "Create RFI" button that converts it into a trackable RFI
- [x] **P1: Error messages leak internals (critical)** — Fixed 8 endpoints that exposed stack traces: evidence.ts, ach/evidence.ts, social-media-extract.ts, analyze-url.ts, claims/analyze/[id].ts, acled.ts, gdelt.ts, actors.ts. Also fixed activity.ts error leak.
- [x] **P0: COP sessions share workspace_id "1"** — Auto-create dedicated workspace per COP session on creation. Migrated existing Iran sessions to own workspaces (`cop-0b2c7e49-cf9`, `cop-2b1e9887-34c`). Entities now properly scoped per session.
- [x] **P0: Session list empty after workspace fix** — GET `/api/cop/sessions` defaulted to `workspace_id = '1'` filter. After sessions got dedicated workspaces, no sessions matched. Fixed to query by `created_by` when no workspace header provided.
- [x] **P0: Session updates silently failing (mission_brief, etc.)** — PUT/DELETE `/api/cop/sessions/:id` had `WHERE workspace_id = ?` defaulting to `'1'`. After workspace isolation, no rows matched so all updates were no-ops. Fixed by removing redundant workspace_id from WHERE clause (session ID is already unique PK).
- [x] **P0: 4 sessions sharing workspace f5478f35** — Migrated cop-acccd999-110, cop-a76d9b77-980, cop-77893f12-485, cop-5b827fff-15d to dedicated workspaces via migration 080. Evidence items also migrated. All 6 sessions now have own workspaces.
- [x] **P3: Lessons learned doc outdated** — Added 2026-03-12 session with workspace isolation, WHERE clause, and optimistic UI lessons.
- [x] **P0: Map console errors (Can't find variable: Ne)** — esbuild's class property helper (`Ne`) was inaccessible inside maplibre-gl's Web Worker Blob. Fixed by upgrading build target from `es2020` to `es2022` (native class fields, no helper needed).
- [x] **P1: Personas link missing session filter** — `POST /api/cop/[id]/personas?action=link` now verifies both persona IDs belong to the current session before creating link. Also fixed persona creation using hardcoded `workspace_id: '1'` — now looks up session's actual workspace.

## In Progress

- [ ] **P1: Place/country autocomplete** — PlaceSearch component built with Nominatim geocoding, integrated into EntityCreateForm. Needs testing on production.
- [ ] **P1: E2E tests outdated** — 33 of 65 tests failing (timeouts from component restructuring). Need to update selectors for cop-event-sidebar, cop-wizard specs

## Backlog — Priority Order

### P1 — High Priority (Functional Gaps)

- [x] **Error messages leak internals (remaining 190+)** — Fixed 108 files: removed `details: error.message` from 90 endpoints, replaced `error: error.message` with generic messages in 14 endpoints, removed `technicalDetails` leak from scrape-url.ts. All API errors now return generic messages while logging details server-side.
- [ ] **Framework create missing auth headers** — `POST /api/frameworks` may create under wrong user when called from COP (uses `getUserIdOrDefault`)
- [ ] **Old /api/evidence endpoint has no workspace_id filter** — Returns ALL evidence globally; unused by COP now but still a data leak risk for dashboard views
- [ ] **Test data in production** — "Test Person 3" actor with generic description polluting workspace "1"

### P2 — Medium Priority (UX Improvements)

- [ ] **Two-render pattern for responsive panels** — Causes double API calls for dual-rendered components; lift data fetch to parent
- [ ] **Panel overflow UX** — Some collapsed panels use overflow-hidden with no visual cue (need fade gradient pattern)
- [ ] **Evidence seeding from RFI answers** — When RFIs are answered, auto-create evidence items so Evidence Feed reflects progress
- [ ] **Platform field defaults** — Batch-created personas default to 'other'; need audit/fix UI
- [ ] **RFI workflow enhancements** — Assignment, answer submission, and integration with frameworks from the RFI tab

### P3 — Low Priority (Tech Debt)

- [ ] **Bundle size** — CopWorkspacePage chunk is 249KB (57KB gzipped). Consider further code splitting
- [ ] **D1 migration verification** — Should verify all migrations applied to production with `SELECT sql FROM sqlite_master`
- [ ] **Retire old /api/evidence endpoint** — Once dashboard views are migrated to workspace-scoped evidence, remove the unscoped endpoint

## Production State (2026-03-12 session 6)

| Session | ID | Workspace | Evidence | Entities | Frameworks |
|---------|-----|-----------|----------|----------|------------|
| Loss of U.S. KC-135 | cop-acccd999-110 | cop-acccd999-110 | 2 | 0 | 1 |
| Iran Attacks | cop-77893f12-485 | cop-77893f12-485 | 0 | 0 | 0 |
| Quick Brief - iran | cop-2b1e9887-34c | cop-2b1e9887-34c | 0 | 0 | 0 |
| Event Monitor - Iran | cop-0b2c7e49-cf9 | cop-0b2c7e49-cf9 | 0 | 0 | 0 |
| debug test | cop-a76d9b77-980 | cop-a76d9b77-980 | 0 | 0 | 0 |
| test workspace | cop-5b827fff-15d | cop-5b827fff-15d | 0 | 0 | 0 |

All 6 sessions now have dedicated workspaces. Session updates (mission_brief, etc.) now persist correctly.

## Architecture Notes

- **Two-ID pattern**: Session ID (`cop-xxx`) vs workspace UUID — most COP endpoints need session->workspace lookup
- **Auth patterns**: COP uses `X-User-Hash` header; framework endpoints use `Authorization: Bearer`. Both now supported via `resolveUserId()`.
- **Data scoping**: COP-specific tables filter by `cop_session_id`; shared entity tables filter by `workspace_id`
- **Two evidence tables**: `evidence` (old, global, no workspace filter) vs `evidence_items` (COP-scoped, filtered by workspace_id). COP components now use `evidence_items` exclusively via `/api/cop/{sessionId}/evidence`.
- **Workspace isolation (FIXED)**: COP session creation now auto-creates a dedicated workspace using the session ID. Existing sessions migrated via 079-cop-session-workspaces.sql. The `checkWorkspaceAccess()` in entity endpoints grants owner full access automatically.
