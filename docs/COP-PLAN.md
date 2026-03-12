# COP Workspace Improvement Plan

**Created**: 2026-03-12
**Last Updated**: 2026-03-12

## Completed

- [x] **P0: Questions tab ignoring key_questions** — CopQuestionsTab now shows user's questions from creation, with 5W1H expansion option
- [x] **P0: Timeline showing cross-session data** — CopTimelinePanel now fetches from `/api/cop/{sessionId}/activity` instead of global `/api/intelligence/timeline`
- [x] **P0: Analysis panel showing cross-session data** — CopAnalysisSummary now derives from `/api/cop/{sessionId}/hypotheses` instead of global intelligence endpoints
- [x] **P0: Framework fetch 401 auth mismatch** — `/api/frameworks/[id].ts` now supports X-User-Hash header auth (matching COP pattern)
- [x] **P0: Starbursting link 404** — Fixed link from `/dashboard/frameworks/:id` to `/dashboard/analysis-frameworks/starbursting/:id/view`
- [x] **P0: Default questions instead of user's** — `buildQuestions()` now seeds from `session.key_questions`, fills empty 5W1H categories with defaults
- [x] **P1: Hypotheses PUT missing session filter** — Added `AND cop_session_id = ?` to UPDATE WHERE clause (security fix)
- [x] **P1: Framework 71 bad data** — Updated DB with questions derived from actual session key_questions

## In Progress

- [ ] **P1: Claims section for COP workspace** — Add ability to run URLs/evidence through claim analysis from within COP
- [ ] **P1: E2E tests outdated** — 33 of 65 tests failing (timeouts from component restructuring). Need to update selectors for cop-event-sidebar, cop-wizard specs

## Backlog — Priority Order

### P1 — High Priority (Functional Gaps)

- [ ] **Personas link missing session filter** — `POST /api/cop/[id]/personas` (link action) doesn't verify persona IDs belong to current session
- [ ] **Framework create missing auth headers** — `POST /api/frameworks` may create under wrong user when called from COP (uses `getUserIdOrDefault`)
- [ ] **Error messages leak internals** — 44+ COP endpoints return `error.message` in 500 responses (lessons learned: never leak)
- [ ] **Activity POST silent 201 on DB failure** — Returns success even when DB insert fails (lessons learned: inner try/catch must return 500)

### P2 — Medium Priority (UX Improvements)

- [ ] **Two-render pattern for responsive panels** — Causes double API calls for dual-rendered components; lift data fetch to parent
- [ ] **Panel overflow UX** — Some collapsed panels use overflow-hidden with no visual cue (need fade gradient pattern)
- [ ] **Evidence seeding from RFI answers** — When RFIs are answered, auto-create evidence items so Evidence Feed reflects progress
- [ ] **Platform field defaults** — Batch-created personas default to 'other'; need audit/fix UI

### P3 — Low Priority (Tech Debt)

- [ ] **Bundle size** — CopWorkspacePage chunk is 234KB gzipped (53KB). Consider further code splitting
- [ ] **Untracked files** — `src/hooks/usePanelLayout.ts` and `.superpowers/` not committed
- [ ] **Lessons learned doc outdated** — Last updated 2026-03-09, needs today's session findings added
- [ ] **D1 migration verification** — Should verify all migrations applied to production with `SELECT sql FROM sqlite_master`

## Architecture Notes

- **Two-ID pattern**: Session ID (`cop-xxx`) vs workspace UUID — most COP endpoints need session->workspace lookup
- **Auth patterns**: COP uses `X-User-Hash` header; framework endpoints use `Authorization: Bearer`. Both now supported via `resolveUserId()`.
- **Data scoping**: COP-specific tables filter by `cop_session_id`; shared entity tables filter by `workspace_id`
