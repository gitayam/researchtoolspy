# COP Workspace Issues Tracker

> Last updated: 2026-03-09
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

---

## 🔴 Critical Issues

### C1. Evidence Count = 0
**Endpoint:** `GET /api/cop/{id}/stats`
**Observed:** `evidence_count: 0` despite workspace having entity data
**Root cause (confirmed):** Data issue — evidence was created as entities (actors, sources) directly, not through the COP evidence endpoint.
**Resolution:** Not a code bug. Evidence must be created through `/api/cop/{id}/evidence`.

### C2. RFI Answers = 0 for "Answered" RFIs
**Root cause (confirmed):** Data issue — answers were set by updating RFI status directly (PUT), not through the answer submission flow. The `cop_rfi_answers` table has no rows.
**Resolution:** Not a code bug.

### C3. Mission Brief = null
**Endpoint:** `GET /api/cop/sessions/{id}`
**Observed:** `mission_brief: null` on active session
**Status:** UI now shows prominent amber "Set mission objective" prompt when null. Code fix was in migration 065 (column exists). This is a data/UX issue — needs to be set by the user.

---

## 🟡 Important Issues

### I1. Event Count = 0 (No Event Entities)
**Observed:** `event_count: 0` despite 28 `event_facts` in session JSON
**Likely cause:** `event_facts` stored as JSON array, not in `events` entity table
**Impact:** Event layer on COP map shows nothing; timeline is empty.

### I2. Blocker Count = 4
**Observed:** `blocker_count: 4` — 4 RFIs have `is_blocker = 1` and status != 'closed'
**Status:** Blocker strip now shows these with "Go to Blocker" navigation

### I3. Framework Count = 0
**Observed:** No framework sessions linked to this COP session/workspace
**Impact:** Intelligence synthesis panel has no framework data

---

## ⚪ Low Priority

### L1. API Documentation Gaps
**Status:** Partially addressed in `docs/COP-WORKSPACE-API.md` (964 lines)

### L2. E2E Test Coverage
**Status:** ALL PASSING — 101 pass / 0 fail / 1 skip (2026-03-09)
**Key fixes this round:**
- `networkidle` → `domcontentloaded` in workspace POM (was still using networkidle)
- Mode toggle buttons: added `data-testid="mode-progress"` / `data-testid="mode-monitor"` for mobile viewport compatibility
- Capture bar mock: added `/api/cop/:id/evidence` route (notes now post to COP-scoped endpoint)
- Scoped RFI badge assertions to avoid matching "Nodal & Critical Point Analysis"
- Viewport-conditional checks for `hidden sm:` elements (keyboard hint, template badge)
- Added tile request blocking to workspace spec mock function

---

## Investigation Priority Order

1. **I1** — Event entities needed for map/timeline (event_facts → events migration)
2. **I3** — Framework linkage for intelligence synthesis
3. **L1** — API docs for newer endpoints
