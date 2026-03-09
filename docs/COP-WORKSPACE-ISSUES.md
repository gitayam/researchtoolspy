# COP Workspace Issues Tracker

> Last updated: 2026-03-09 (cycle 11)
> Source: Live production data audit against `cop-b0f96023-cdf` / workspace `6fde45ce-ae4b-4ff0-97c6-d2773a6ff108`

## Status Legend
- 🔴 Critical — blocks core workflow
- 🟡 Important — degrades experience
- 🟢 Fixed — resolved and deployed
- ⚪ Low — cosmetic or non-blocking

---

## 🟢 Fixed Issues

### F1. Dark/Light Mode Color Inconsistencies
**Commit:** `9dee1997f`
- `confidenceColor()` in CopHypothesisTab lacked `dark:` variants
- Empty state icons used `text-gray-600` (too dark in dark mode, low contrast in light)
- CopRfiTab, CopTaskBoard empty states had same issue
- **Fix:** Added dual-mode color classes (`text-gray-400 dark:text-gray-500`)

### F2. CopPanelExpander Content Clipping
**Commit:** `9dee1997f`
- Collapsed panels used `overflow-hidden` with no visual cue
- Users couldn't tell content continued below fold
- **Fix:** Changed to `overflow-y-auto`, added fade gradient at bottom, added `cursor-pointer` to buttons

### F3. D1_TYPE_ERROR on Quick Capture (notes)
**Root cause:** CopGlobalCaptureBar posted notes to `/api/evidence` (global table) which expected `body.type`. The bar sent `evidence_type: 'digital'` instead, leaving `body.type` as `undefined`. D1 rejects undefined in `.bind()`.
- **Fix:** Route notes through COP-scoped endpoint `/api/cop/:id/evidence` which handles field mapping correctly
- Also fixed: Capture bar was entirely dark-mode hardcoded — added dual `dark:` classes for all colors

### F4. CopGlobalCaptureBar Light Mode
- All colors were hardcoded dark: `bg-gray-900/80`, `bg-gray-800/50`, `text-gray-100`
- In light mode this rendered as a dark band clashing with white theme
- **Fix:** Dual-mode classes: `bg-white/90 dark:bg-gray-900/80`, `bg-gray-50 dark:bg-gray-800/50`, etc.

### F5. CopEventTab Dark-Only Inputs
- "Time" and "New fact" inputs had `bg-gray-800`, `text-gray-200` without light mode variants
- Event description and fact list text used `text-gray-200`/`text-gray-300` (invisible on white)
- **Fix:** Added dual-mode classes throughout CopEventTab

### F6. Status Strip KPIs Missing Labels
- KPI badges showed only icon + number — newcomers couldn't tell what "14" means
- Mission brief empty state was too subtle (just gray italic text)
- **Fix:** Added labels visible on `lg:` screens, made empty mission brief prominent with amber dashed border

### F7. Blocker "Resolve" Button UX
- "Resolve" button was confusing — users expected it to resolve the blocker inline
- **Fix:** Changed to "Go to Blocker" which scrolls to the RFI panel for context

### F8. Stale Blocker Flags on Answered RFIs
**Observed:** `blocker_count: 4` but 3 of the 4 blockers had `status=answered`
- Bus RFI (`rfi-65c4ebcd-5b9`), skyline RFI (`rfi-fa971391-fc5`), van/bus RFI (`rfi-92d049de-02f`)
- Stats query counts `is_blocker=1 AND status!='closed'` — answered RFIs still counted
- **Fix:** Cleared `is_blocker` via PUT `/api/cop/:id/rfis` for the 3 answered RFIs
- **Result:** `blocker_count: 4 → 1` (only legitimate open blocker remains)

### F9. E2E Evidence Feed Header Locator Clash
- `getByText('Evidence', { exact: true }).first()` matched KPI label `<span class="hidden lg:inline">Evidence</span>` before the panel header
- On mobile viewport, the KPI label is `hidden`, so the locator resolved to a hidden element
- **Fix:** Changed POM locator to `getByText('Evidence & Intel Feed', { exact: true })` — unique to the panel header

### F10. Evidence Endpoint 500 — Missing `workspace_id` Column
**Endpoint:** `GET /api/cop/{id}/evidence`
**Error:** `D1_ERROR: no such column: workspace_id at offset 42: SQLITE_ERROR`
**Root cause:** Migration 005 added `workspace_id` to `evidence_items` via `ALTER TABLE`, but this migration was never applied to production D1. The COP evidence endpoint queries `WHERE workspace_id = ?`.
**Fix:** Ran `ALTER TABLE evidence_items ADD COLUMN workspace_id TEXT` directly on production D1.

### F11. Evidence POST 500 — SQLITE_MISMATCH + NOT NULL Constraint
**Endpoint:** `POST /api/cop/{id}/evidence`
**Error 1:** `D1_ERROR: datatype mismatch: SQLITE_MISMATCH`
**Root cause:** Code generated TEXT id (`evi-xxxx`) for `id INTEGER PRIMARY KEY AUTOINCREMENT` column.
**Error 2:** `D1_ERROR: NOT NULL constraint failed: evidence_items.credibility: SQLITE_CONSTRAINT`
**Root cause:** `credibility` and `reliability` columns are `NOT NULL` but INSERT omitted them.
**Fix:** Removed TEXT id (let AUTOINCREMENT handle), added `credibility`/`reliability` with sensible defaults (`unverified`/`unknown`). Capture bar now works.

### F12. Personas Panel Too Small + Wrong Semantics
**Observed:** Panel was 1/3 width in 3-col grid, cramming 13 cards. Name "Personas" conflicted with team sock puppet meaning.
**Fix:** Renamed to "Actors" (research targets), moved to full-width row, added `xl:grid-cols-4` card grid. E2E updated with `getByRole('heading')` to avoid locator clash with entity panel buttons.

### F13. Auto-Extract Toast Not Wired
**Observed:** Handle regex extraction worked in CopEvidenceFeed but no user notification was shown.
**Fix:** Wired `useToast` hook — fires `"N handle(s) detected"` toast when auto-extract finds handles.

### F14. Map Marker Backlinks Not Implemented (4C)
**Observed:** Marker popups showed only name/type/description. `source_type`/`source_id` linking existed but popup had no interactive backlink.
**Fix:** Added "View Evidence" / "View Hypothesis" button in popup. Wired `onMarkerOpenInFeed` callback to scroll to evidence feed.

### F15. CopPanelExpander `hidden` ReferenceError
**Commit:** `ad141b3c2`
**Observed:** Linter removed `const [hidden, setHidden] = useState(defaultHidden)` because `setHidden` was unused. But `hidden` was still referenced on line 68, causing `ReferenceError: hidden is not defined` crash on page load.
**Fix:** Changed to `const [hidden] = useState(defaultHidden)` — destructure without setter keeps linter happy.

### F16. Map Buried at Bottom of Progress Layout
**Commit:** `ad141b3c2`
**Observed:** Map panel was at the bottom of 8+ panels in Progress mode, hidden behind a "Show Map Panel" click. Users had to scroll past all panels to reach geospatial context.
**Fix:** Moved map to Row 0.5 (right after Entities), defaulted `showMap` to `true`, removed "Show Map Panel" button. Mini-map at 200px (`compact` height).

### F17. No Task Board in Monitor Mode
**Commit:** `ad141b3c2`
**Observed:** Monitor mode only showed Evidence Feed, Map, Questions/Hypotheses, and Actors — no task board. Users had to switch to Progress mode to manage tasks.
**Fix:** Added compact (200px) task board panel to Monitor mode layout.

### F18. Framework Count Query Wrong Table
**Root cause:** Stats endpoint queried `framework_sessions WHERE user_id = ?` (global user count) instead of reading `linked_frameworks` JSON array from `cop_sessions`.
**Fix:** Changed to `JSON_ARRAY_LENGTH(linked_frameworks)` on the COP session itself. Also removed unused `created_by` from SELECT.

### F20. Dark Mode Cycle 11 — Capture Bar + Evidence Feed
**Files:** CopGlobalCaptureBar.tsx, CopEvidenceFeed.tsx
- Routing hint had same color for light/dark (`gray-500`/`gray-500`)
- Cmd+Enter hint used `dark:text-gray-600` (too dark on dark bg)
- Gallery overlay text was `text-gray-200` (fine on dark gradient but inconsistent)
- Loader spinner and entity overflow badge missing dark variants
**Fix:** Applied 6 targeted color fixes across both files

### F19. Batch Evidence Endpoint
**Feature:** Added `POST /api/cop/:id/evidence/batch` for bulk evidence import (up to 100 items).
**Uses:** `env.DB.batch()` for atomic D1 insert, parameterized queries, auto-increment IDs.

---

## 🔴 Critical Issues

### C1. Evidence Count = 0 — RESOLVED
**Was:** `evidence_count: 0` despite workspace having entity data
**Root cause:** Evidence was created as entities (actors, sources) directly, not through COP evidence endpoint. Endpoint was also returning 500 (F10, F11).
**Resolution:** F10 + F11 fixes deployed. Capture bar now creates evidence. `evidence_count: 1` confirmed.

### C2. RFI Answers = 0 for "Answered" RFIs
**Root cause (confirmed):** Data issue — answers were set by updating RFI status directly (PUT), not through the answer submission flow. The `cop_rfi_answers` table has no rows.
**Resolution:** Not a code bug.

### C3. Mission Brief = null — RESOLVED
**Was:** `mission_brief: null` on active session
**Fix:** Set via `wrangler d1 execute --remote`: "Geolocate and map the distributed persona farm operating across Reddit, Telegram, and OnlyFans..."
**Status:** Mission brief now visible in status strip for all collaborators

---

## 🟡 Important Issues

### I1. Event Count = 0 — RESOLVED
**Was:** `event_count: 0` despite 32 `event_facts` in session JSON
**Fix:** Created 32 events via POST `/api/events` from the session's event_facts array
**Now:** `event_count: 32`, `entity_count: 46` (was 14)
**Status:** Moved to operational — map event layer and timeline now populated

### I2. Blocker Count — RESOLVED
**Was:** `blocker_count: 4` — 3 answered RFIs had stale `is_blocker=1`
**Now:** `blocker_count: 1` — only the legitimately open AI authenticity RFI remains
**Status:** Moved to Fixed (F8)

### I3. Framework Count = 0 — PARTIALLY FIXED
**Observed:** `framework_count: 0` in stats endpoint
**Root cause (confirmed):** Stats query was `SELECT COUNT(*) FROM framework_sessions WHERE user_id = ?` — counting ALL user frameworks globally instead of reading the `linked_frameworks` JSON array from the COP session.
**Fix:** Changed to `SELECT COALESCE(JSON_ARRAY_LENGTH(linked_frameworks), 0) as cnt FROM cop_sessions WHERE id = ?`
**Remaining:** The `linked_frameworks` array on session `cop-b0f96023-cdf` is empty (`[]`). Need to link actual framework sessions to it via PUT.

---

## ⚪ Low Priority

### L1. API Documentation Gaps
**Status:** Partially addressed in `docs/COP-WORKSPACE-API.md` (964 lines)

### L2. E2E Test Coverage
**Status:** ALL PASSING — 158 pass / 0 fail / 16 skip (2026-03-09 cycle 11)
**Key fixes this round:**
- `networkidle` → `domcontentloaded` in workspace POM (was still using networkidle)
- Mode toggle buttons: added `data-testid="mode-progress"` / `data-testid="mode-monitor"` for mobile viewport compatibility
- Capture bar mock: added `/api/cop/:id/evidence` route (notes now post to COP-scoped endpoint)
- Scoped RFI badge assertions to avoid matching "Nodal & Critical Point Analysis"
- Viewport-conditional checks for `hidden sm:` elements (keyboard hint, template badge)
- Added tile request blocking to workspace spec mock function
- Fixed evidence feed header locator clash with KPI label (F9)
- Actors panel: `getByRole('heading', { level: 3 })` to avoid entity button clash (F12)
- Add Actor button: `.first()` to prefer panel button over entity drawer button

---

## Investigation Priority Order

1. ~~**I1** — Event entities~~ DONE — 32 events created
2. ~~**I3** — Framework count query fix~~ DONE (F18) — `linked_frameworks` still empty, needs data
3. ~~**New** — Evidence creation through COP workflow~~ DONE (F11) — capture bar works
4. ~~**New** — hypothesis_count missing from stats~~ DONE — added to API + KPI strip
5. ~~**New** — 4B Auto-geocode prompt~~ DONE — toast fires on location detection
6. ~~**New** — Dark/light mode audit~~ DONE — 8 files fixed across cycles 4-6
7. ~~**New** — Persona platform data quality~~ DONE — 10/13 fixed from `other` to correct platforms
8. ~~**New** — Evidence seeding from RFI research~~ DONE — 9 items, evidence_count: 1→10
9. ~~**New** — Duplicate Bariloche marker~~ DONE — separated CENTRO from SKI-CATEDRAL
10. **L1** — API docs for newer endpoints
11. ~~**New** — Auto-sync event_facts → events table on session update~~ DONE — append-only sync in session PUT
12. ~~**New** — UI/UX Phase 1 (Panel Consistency)~~ DONE — CopPanelExpander unified
13. ~~**New** — UI/UX Phase 3 (Map Promotion)~~ DONE — map at top, mini-map 200px
14. ~~**New** — UI/UX Phase 5 (Three-Column Layout)~~ DONE — 1440px+ evidence sidebar
15. ~~**New** — Task board in Monitor mode~~ DONE — compact 200px task board
16. ~~**New** — CopPanelExpander hidden state crash~~ DONE (F15)
17. ~~**New** — UI/UX Phase 6 (Accessibility Polish)~~ DONE — ARIA, reduced motion, focus, Escape
18. ~~**New** — Batch evidence endpoint~~ DONE (F19) — POST /api/cop/:id/evidence/batch
19. **New** — COP responsive layout (dvh, mobile sidebar toggle, error boundaries)
20. **New** — Link framework sessions to COP `linked_frameworks` array
