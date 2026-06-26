# COP Workspace — Investigation Findings & Fix Batch (2026-06-26)

**Trigger:** user report — `https://researchtools.net/api/cop/cop-cdebda63-a33/cot` "not working" and
"many aspects not working" on `https://researchtools.net/dashboard/cop/cop-cdebda63-a33`.
**Method:** `/team-investigate` — three parallel investigators (COT endpoint, dashboard feature-map,
tech-debt sweep) + live reproduction against prod + remote D1 queries. **Evidence is cited file:line;
headline claims spot-verified.** This doc is the detail behind the `COP-*` units in [`../ROADMAP.md`](../ROADMAP.md).

---

## 0. Headline (read this first)

1. **The COT endpoint is NOT broken — its launch path is.** `functions/api/cop/[id]/cot.ts` (+ `cot-serializer.ts`)
   is correct and the DB schema matches. The frontend opens it via `window.open('/api/cop/${id}/cot')`, a
   browser navigation that **cannot attach the `X-User-Hash` header**, so the request is unauthenticated →
   **401 for the owner, 403 for everyone else**. Reproduced live (no header → 401 `Authentication required`;
   16-char guest hash → 403 `Access denied`).
2. **"Many aspects not working" is mostly an EMPTY session, not broken code.** Session `cop-cdebda63-a33` has
   **0 records in every table** (entities/evidence/RFIs/hypotheses/timeline/tasks/claims/personas/relationships,
   verified via remote D1 `researchtoolspy-prod`), is **private** (`is_public=0`), owner **user 174**, with a
   valid `workspace_id`. Every data panel correctly renders its empty state → reads as "nothing works." **All
   40+ COP endpoints exist and are correctly wired — no 404/500s.** ✅ **Resolved 2026-06-26 (owner):** this is a
   **fresh/empty session — empty states are expected, NOT data loss.** D-A closed. The remaining work is the
   genuine stubs/bugs below (+ optional empty-state onboarding polish).
3. **Genuine stubs/bugs do exist** (below) — they were masked by the empty session but are real.

---

## 1. AUTO units (machine-safe, verifiable, reversible — loop-eligible)

Ordered by user-visible impact × dependency. Each is small enough to finish + verify in one loop turn.

### COP-1 · Fix COT export — fetch-with-auth + blob download  `P1`
- **Bug:** `window.open('/api/cop/${id}/cot', '_blank')` can't send `X-User-Hash` → 401/403.
- **Where:** `src/pages/CopWorkspacePage.tsx:708`, `src/pages/CopPage.tsx:315`.
- **Fix:** replace the `window.open` onClick with `fetch('/api/cop/${id}/cot', { headers: getCopAuthHeaders() })`
  (helper already in `src/lib/cop-auth.ts`), then `Blob` → `URL.createObjectURL` → click a temp `<a download>`.
  Toast on `!res.ok`.
- **Verify:** owner clicking "Export CoT/ATAK" downloads a valid `.cot.xml`; non-owner gets a toast, not a blank tab.
- **Done when:** export works for the owner in prod; smoke test asserts the handler returns `application/xml`
  for an authed request and 401 without.

### COP-2 · `/api/dataset` route mismatch — dataset feature is 404ing  `P1`
- **Bug:** frontend calls `fetch('/api/dataset')` (singular) but only `functions/api/datasets.ts` (plural) exists
  → the Datasets feature silently fails.
- **Where:** `src/components/datasets/DatasetSelector.tsx:45`, `src/pages/DatasetPage.tsx:31,72`.
- **Fix:** align the 3 callers to `/api/datasets` (preferred — single source) **or** add a thin
  `functions/api/dataset.ts` alias. Frontend-align is cleaner; confirm no other singular callers (`grep`).
- **Verify:** DatasetPage loads a list; DatasetSelector populates.

### COP-3 · Wire entity "Edit" button (currently a no-op)  `P1`
- **Bug:** `handleEdit` is `// Placeholder — edit flow is not yet implemented` → clicking Edit on any entity does nothing.
- **Where:** `src/components/cop/CopEntityDrawer.tsx:222`; button at `src/components/cop/EntityCard.tsx:472`.
- **Fix:** open an edit form prefilled from the entity and `PUT` to the existing entity endpoint
  (`/api/actors` / `/api/sources` / etc. — they already accept updates). Reuse the create form if one exists.
- **Verify:** edit an actor's name/description → persists after reload.
- **Note:** if a reusable edit form does not exist this may exceed one turn — if so, split into "minimal inline
  edit" first.

### COP-4 · Persist evidence↔persona link  `P1`
- **Bug:** `CopEvidencePersonaLinkDialog.tsx` finds/creates the persona but the **actual evidence↔persona link
  write is commented out** ("link might happen in backend"); `onLinked()` fires with nothing persisted.
- **Where:** `src/components/cop/CopEvidencePersonaLinkDialog.tsx:~105`.
- **Fix:** write the link via the relationships/persona-link endpoint (confirm which one persists
  evidence↔persona during the unit; `relationships.ts` or a persona link route).
- **Verify:** linking evidence to a persona survives reload.

### COP-5 · Wire the 3 unreachable buttons  `P2`
- **Bug:** playbook **Edit**/**View Log** and persona **Promote to Actor** buttons only render when their
  `on*` props are passed, but `CopWorkspacePage.tsx` renders the panels without them → buttons never appear.
  The backing endpoints (`playbooks/[pbId]/log.ts`, `rules.ts`) already exist.
- **Where:** `src/components/cop/CopPlaybookPanel.tsx:290`, `CopPersonaPanel.tsx:356`; render sites
  `CopWorkspacePage.tsx:1162,1063,1553`.
- **Fix:** pass the handlers from `CopWorkspacePage`.
- **Verify:** buttons appear and hit their endpoints.

### COP-6 · Persona edit/delete (create-only today)  `P2`
- **Bug:** `CopPersonaPanel.tsx` has only POST (`:147`) — no PUT/DELETE; personas can't be edited or removed.
- **Fix:** add PUT/DELETE to the persona endpoint + panel controls. (Confirm endpoint shape first.)
- **Verify:** edit + delete a persona persist.

### COP-7 · Surface error-swallowing in alerts.ts / scrape.ts  `P1`
- **Bug:** both return a bare `[]` on upstream failure — callers can't tell "no data" from "fetch failed."
- **Where:** `functions/api/cop/[id]/alerts.ts:70,79` (REDSIGHT), `functions/api/cop/[id]/scrape.ts:285,289` (Apify).
- **Fix:** on failure, `logEvent('warn', source, {reason})` to `event_logs` (matches v0.22.15) and return a
  distinguishable shape (`{ items: [], error: '<reason>' }`) so the UI can show a real error state.
- **Verify:** induced failure logs to `event_logs` and the response carries the error marker. Smoke test the helper.

### COP-8 · Header "Share" UX on private sessions  `P2`
- **Bug:** the Share button copies the current URL with no toast; the session is private (`is_public=0`) so a
  recipient hits 403 — silent dead-end.
- **Where:** `src/pages/CopWorkspacePage.tsx:583`.
- **Fix:** show a confirmation toast; if `is_public=0`, prompt to create a share token (existing public-share
  flow) or make the session public, instead of copying an inaccessible URL.
- **Verify:** clicking Share on a private session offers a working share path.

### COP-9 · Stop emitting the dead screenshot URL  `P2`
- **Bug:** `analyze-url.ts:710` returns `screenshot: /api/content-intelligence/screenshot?url=...` — that handler
  does not exist, so any consumer of the field gets a broken link.
- **Where:** `functions/api/content-intelligence/analyze-url.ts:710`.
- **Fix (AUTO slice):** omit/null the `screenshot` field until a real provider exists (don't ship a dead URL).
  Building a real screenshot service = **DECISION D-C** below.
- **Verify:** response no longer advertises a 404 URL.

### COP-10 · Doc fix — D1 database name  `P3`
- **Bug:** `CLAUDE.md`, `scripts/cop-api.sh`, and the memory note reference `researchtoolspy-db`; the real bound
  D1 is **`researchtoolspy-prod`** (`wrangler.toml:13`). Every documented `wrangler d1 execute researchtoolspy-db`
  command fails with "Couldn't find DB."
- **Fix:** sweep `researchtoolspy-db` → `researchtoolspy-prod` in docs + scripts. Trivial, no code path.
- **Verify:** `grep -rn researchtoolspy-db` returns only historical/changelog mentions.

### COP-11 · `/api/behaviors/search` endpoint  `P2`
- **Bug:** `BehaviorSearchDialog.tsx:48` has `// TODO: Create /api/behaviors/search endpoint`; the search box is non-functional.
- **Fix:** implement `functions/api/behaviors/search.ts` (filter behaviors by query, scoped to workspace) and wire the dialog.
- **Verify:** typing a query returns matching behaviors.

### COP-12 · Bounded console→event_logs conversion (COP handlers only)  `P2`
- **Context:** ~680 `console.*` calls across API handlers; **Pages Functions `console.*` is invisible in prod**
  (established lesson) so error logs vanish. Full migration is open-ended (→ DECISION D-D).
- **AUTO slice (this unit only):** convert the `console.error` catch-logs in the **~50 COP handlers** under
  `functions/api/cop/**` to `logEvent('error', source, {...})`. **Hard scope cap: COP handlers only**; do NOT
  sweep the whole API in one unit.
- **Verify:** COP handler errors appear via `GET /api/cron/event-logs`; `grep console.error functions/api/cop`
  trends to zero. Log what was left out.

---

## 2. DECISION units (need a human / maintainer call — loop must NOT auto-do)

- **D-A · Empty-session triage — ✅ RESOLVED 2026-06-26.** Owner confirms `cop-cdebda63-a33` is a fresh/empty
  session; empty panels are expected, not data loss. No P0. *Optional follow-up (not queued):* an empty-state
  onboarding pass so a new COP session invites first actions instead of reading as broken.
- **D-B · Stubbed data-import handlers.** `functions/api/settings/data/import.ts` workspace/frameworks/evidence
  imports are `TODO` stubs returning a success message. Real import needs data-shape + dedup + ownership
  decisions. Scope before building.
- **D-C · Real screenshot service.** Implementing `content-intelligence/screenshot` needs a provider (browser
  rendering / external API), cost, and abuse/rate-limit decisions. (COP-9 just stops the dead URL meanwhile.)
- **D-D · Full console→event_logs migration** beyond COP (~630 remaining calls). Effort/scope call — or accept
  the bounded COP slice (COP-12) and leave the rest documented.

**Pre-existing DECISION backlog (unchanged, from the prior loop STOP):** Deception AI server-side move ·
COM-B canon table version · collection retention window · `content_chunks` fate · callback strict-flip
(cross-system). See `../ROADMAP.md` "Now" + the loop-state file.

---

## 2b. Conventions confirmed while building COP-1 (use these in COP-2…COP-12)
- **Auth headers (client):** `getCopHeaders()` from `src/lib/cop-auth.ts` (NOT `getCopAuthHeaders`) — returns
  `X-User-Hash` + a Bearer token (`omnicore_tokens`) + `X-Workspace-ID`. Both COP pages already import it.
- **Toasts:** the codebase standard is `useToast()` from `@/components/ui/use-toast` (shadcn-style:
  `toast({ title, description, variant })`) — **not** `sonner`. `CopWorkspacePage.tsx`/`CopPage.tsx` now use it.
- **Testable pattern that passed CI:** extract a framework-free, dependency-injectable helper into `src/lib/`
  and unit-test it under `tests/e2e/smoke/*.spec.ts` tagged `@smoke` (the browser/server-dependent smoke specs
  are flaky without a dev server — pure-helper specs pass deterministically). Mirror `src/lib/cop-cot-export.ts`.

## 3. What was checked and is HEALTHY (don't re-investigate)
- All 40+ COP endpoints exist with correct HTTP methods; every panel's fetch target resolves to a real handler.
- The recent `workspace_id`-null 500/400 bug class does **not** affect this session (valid UUID workspace).
- COT handler + serializer + `cop_markers` schema are correct and complete.
- Session access control (401/403 gating) is correct — the COT 401/403 is *working auth*, not a hole.
- Entity-type uppercase CHECK-constraint usage in INSERTs is compliant (spot-checked).

## 4. Verification commands
```bash
# COT auth reproduction (what window.open sends):
curl -sS -i https://researchtools.net/api/cop/cop-cdebda63-a33/cot              # → 401
curl -sS -i -H "X-User-Hash: <16+char>" https://researchtools.net/api/cop/cop-cdebda63-a33/cot   # → 403 (private)
# Session emptiness (correct DB name):
npx wrangler d1 execute researchtoolspy-prod --remote --command \
  "SELECT (SELECT COUNT(*) FROM actors WHERE workspace_id=(SELECT workspace_id FROM cop_sessions WHERE id='cop-cdebda63-a33')) AS actors"
```
