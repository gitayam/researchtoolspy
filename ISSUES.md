# ResearchTools.net — Issue Tracker

**Last updated:** 2026-03-15
**Current tag:** v0.13.0-workspace-hardening

---

## Fixed (v0.13.0)

### P0 — Production 403 Regression on Public COP Sessions
- [x] `verifyCopSessionAccess` didn't check `is_public` flag → all public sessions returned 403 for non-owner users
- [x] Fixed: added `{ readOnly: true }` option for GET handlers; public sessions now readable by any authenticated user
- [x] 12 COP GET endpoints updated (rfis, stats, tasks, activity, playbooks, markers, evidence, hypotheses, intake-forms, personas, collaborators, alerts)
- **Root cause:** security hardening commits added ownership checks but missed the `is_public` escape hatch

### P0 — Missing Auth Headers on Frontend COP Fetches
- [x] `CopRfiTab.tsx` initial GET fetch missing `getCopHeaders()` → 401 on page load
- [x] `CopEventSidebar.tsx` RFI count fetch missing `getCopHeaders()` → 401

### P1 — Workspace API Tech Debt
- [x] DELETE endpoints didn't cascade (orphaned members, invites, entities, frameworks, evidence, relationships, ACH analyses)
- [x] `settings/data/workspace/[id].ts` referenced wrong table names (`frameworks` → `framework_sessions`, `evidence` → `evidence_items`)
- [x] Same endpoint used dead `workspaces.user_hash` column for ownership check (always 404)
- [x] No duplicate member check on POST `/api/workspaces/:id/members` (could double-insert)
- [x] Entity search used prefix-only LIKE (`search%` → `%search%`)
- [x] `parseInt` NaN safety missing on pagination params across 3 endpoints
- [x] Settings workspace creation didn't create `workspace_members` row (broke role checks)
- [x] Legacy `is_default: id === '1'` check (never true for UUID IDs)
- [x] Misleading DELETE comment on invites/index.ts

---

## Open Issues

### P1 — Security / Auth

- [ ] **ACH API endpoints use `demo-user` stub** — all ACH analysis endpoints use hardcoded `userId = 'demo-user'` instead of real auth. Any user can access/modify any ACH analysis. Files: `functions/api/ach/*.ts` (7 files)
- [ ] **Content Intelligence hardcoded `userId = 1`** — all content attributed to same user. Files: `functions/api/content-intelligence/*.ts` (6 files)
- [ ] **AI config endpoints have no auth** — `functions/api/ai/config.ts` is publicly accessible
- [ ] **Starbursting missing auth header forwarding** — `functions/api/content-intelligence/starbursting.ts:119`

### P2 — Data Integrity

- [ ] **Workspace member role on creation inconsistent** — unified workspace POST creates member as 'ADMIN', but `getWorkspaceMemberRole` returns 'OWNER' via `workspaces.owner_id`. Not a bug but semantically confusing.
- [ ] **COP sessions `team_workspace_id` mostly NULL** — stats and cop-sessions workspace endpoints query by `team_workspace_id` but most sessions never had this set. Needs backfill migration or query change.
- [ ] **Frameworks API hardcoded user/workspace** — `functions/api/frameworks.ts` uses `userId = 1` and `workspaceId = 'default'`

### P2 — Missing Features / Stubs

- [ ] **PDF extraction broken** — `functions/api/content-intelligence/pdf-extractor.ts` has placeholder API key `'YOUR_PDF_CO_API_KEY'`
- [ ] **Screenshot API referenced but not implemented** — `analyze-url.ts:501` returns URL to non-existent endpoint
- [ ] **Batch entity name loading** — `ActorDetailView.tsx:74` loads entity names one by one
- [ ] **No error tracking service** — `ErrorBoundary.tsx:42` has Sentry TODO

### P3 — UX / Polish

- [ ] **Export functionality not implemented** — `PublicFrameworkPage.tsx:61`
- [ ] **MOM assessment modals not wired** — `EventDetailView.tsx`, `ActorDetailView.tsx`
- [ ] **Starbursting launcher UI missing** — `ContentIntelligencePage.tsx:1524`
- [ ] **Workspace selector still uses hardcoded ID in some pages** — `ActorsPage.tsx:23`, `ContentLibraryPage.tsx:46`, `NetworkGraphPage.tsx:93`

---

## Notes

- **Dual API surface**: `/api/workspaces/` (team JWT/hash) and `/api/settings/workspaces` (personal `requireAuth`) — consider consolidating
- **Entity tables lack FK constraints** on workspace_id → manual cascade required on workspace delete
- **D1 batch()** used for transactional cascade deletes (all-or-nothing)
- Production logs accessible via `npx wrangler pages deployment tail <id> --project-name=researchtoolspy --format json`
