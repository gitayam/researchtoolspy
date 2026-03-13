# COP Workspace Improvement Plan

**Created**: 2026-03-12
**Last Updated**: 2026-03-13 (session 16)

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
- [x] **P1: E2E tests outdated** — Fixed 20 failing tests (was 33/65, then 20/232 after playbook additions). Fixes: added page navigation for relative fetch URLs in cop-assets tests, fixed route glob patterns for query string URLs, resolved strict mode violations in cop-event-sidebar and cop-intake. Now 215/232 passing, 17 skipped, 0 failing.
- [x] **P1: Place/country autocomplete** — PlaceSearch component built with Nominatim geocoding, integrated into EntityCreateForm. Deployed and functional in production. Auto-fills name, type, lat/lng, country, region from search.
- [x] **P1: Workspace '1' fallback in 7 COP endpoints** — tasks.ts, playbooks.ts, hypotheses.ts, assets.ts, task-templates.ts (x2), markers.ts all fell back to workspace_id `'1'` if session lookup failed. Changed to fall back to `sessionId` (which equals workspace_id post-isolation). Prevents silent cross-workspace data leaks.

## In Progress

_No active items — all P0 and P1 tasks complete._

## Backlog — Priority Order

### P1 — High Priority (Functional Gaps)

- [x] **Error messages leak internals (remaining 190+)** — Fixed 108+ files: removed `details: error.message` from all endpoints, including `String(error)` and `technicalDetails` variants. All API errors now return generic messages while logging details server-side.
- [x] **Framework create missing auth headers** — `getUserFromRequest` now checks `X-User-Hash` header before `Authorization: Bearer`. Framework POST also reads `X-Workspace-ID` header for workspace scoping. COP sessions now properly resolve to the correct user when creating frameworks.
- [x] **Old /api/evidence verbose debug logging** — Removed 15+ excessive `console.log` lines that were logging full request headers and query details to production logs. Cleaned up error handler to single `console.error` line.
- [x] **Old /api/evidence endpoint data leak** — Confirmed the `evidence` table is empty (all data in `evidence_items` now). No active data leak. Endpoint kept for backward compatibility but contains no records.
- [x] **Test data in production** — Removed "Test Person 3" actor from workspace "1" via migration 082.

### P2 — Medium Priority (UX Improvements)

- [x] **Two-render pattern for responsive panels** — Replaced CSS `2xl:hidden` dual-render with `useMediaQuery` conditional rendering. Evidence and Activity panels now mount only once: in the main grid on <2xl screens, in the sidebar on 2xl+ screens. Eliminates double API calls.
- [x] **Panel overflow UX** — Already implemented: CopPanelExpander has fade gradient overlay at bottom of collapsed cards (line 284), `overflow-y-auto` on content area, and `overflow-hidden` on outer container.
- [x] **Evidence seeding from RFI answers** — RFI PUT handler now auto-creates an `evidence_item` when an answer is provided. Title prefixed with "RFI Answer:", description is the answer text, type is `rfi_answer`. Non-blocking (failure logged but doesn't break RFI update). Opt-out via `seed_evidence: false`.
- [x] **Platform field defaults + @handle persona creation** — CopGlobalCapture `@handle` now creates personas via API (was a no-op stub). Supports `@platform:handle` syntax (e.g., `@telegram:user123`). Defaults to twitter. Also fixed EntityEvidenceLinks fetching from old empty `/api/evidence` → now uses COP-scoped `/api/cop/{sessionId}/evidence`.
- [x] **RFI workflow enhancements** — Added assignment field (blur-to-save), close/reopen buttons, and status change support to expanded RFI view. Answer submission endpoint now auto-seeds evidence items. Both `/rfis` PUT and `/rfis/:rfiId/answers` POST create evidence.

### P3 — Low Priority (Tech Debt)

- [ ] **Bundle size** — CopWorkspacePage chunk is 249KB (57KB gzipped). Consider further code splitting
- [x] **D1 migration verification** — Verified all tables present in production including latest (cop_claims, cop_playbooks, cop_playbook_rules, cop_playbook_log). Migration 082 confirmed (test data removed). No d1_migrations tracking table — migrations applied via direct SQL.
- [x] **Retire old /api/evidence endpoint** — Last COP reference (EntityEvidenceLinks) migrated to `/api/cop/{sessionId}/evidence`. Old endpoint only referenced by non-COP dashboard pages (`EvidencePage`, `ACHWizard`, etc.) which use `/api/evidence-items` (different endpoint). Safe to remove `/api/evidence` when ready.

## Production State (2026-03-13 session 16)

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
