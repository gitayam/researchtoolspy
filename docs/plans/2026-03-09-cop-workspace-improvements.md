# COP Workspace Improvements — DEF CON Case Study

> **Context**: Live investigation of a Reddit → Telegram → OnlyFans persona farm. Session: `cop-b0f96023-cdf`

## Completed Features

| # | Feature | Status | Commit |
|---|---------|--------|--------|
| - | Entity Drawer (5 types, CRUD, relationships) | DONE | `7742b1fe3` |
| - | Entities Quick-Access Panel (counts, type cards) | DONE | `f6ca2aa35` |
| - | Hypotheses CRUD endpoint + migration 064 | DONE | `78872acf5` |
| - | Mission Brief persistence (migration 065) | DONE | `78872acf5` |
| - | COP-scoped evidence endpoint | DONE | `78872acf5` |
| - | Session populated: 10 personas, 10 RFIs, 7 markers, 5 hypotheses | DONE | script |

## In Progress (Wave 2)

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | Geolocation Changelog | Marker changelog table + API + frontend popup | BUILDING (backend + frontend agents) |
| 2 | Task Board | cop_tasks table + Kanban component | BUILDING (backend + frontend agents) |
| 3 | Marker Confidence + Rationale | confidence/rationale columns on markers + UI | BUILDING (with #1) |
| 4 | Evidence-to-Hypothesis linking | Inline link form in hypothesis tab | DONE (CopHypothesisTab updated) |
| 5 | Image thumbnails in evidence feed | URL evidence renders with previews | TODO |
| 6 | Chat import / bulk ingest | Parse chat exports into evidence + personas | TODO |
| 7 | Persona-to-persona network view | Visual graph of persona aliases | TODO |
| 8 | Collaborator attribution | Show contributor names on evidence/RFIs | TODO |

## Feature Details

### 1. Geolocation Changelog (Migration 067)
- `cop_marker_changelog` table tracks: created, moved, confidence_changed, evidence_linked
- Each entry has old_value/new_value (JSON), rationale, created_by_name
- `cop_markers` gets `confidence` (TEXT: CONFIRMED→DOUBTFUL) and `rationale` columns
- Frontend: `CopMarkerChangelog.tsx` renders in marker popups

### 2. Task Board (Migration 066)
- `cop_tasks` table with status (todo/in_progress/done/blocked), priority, task_type
- Task types: pimeyes, geoguessr, forensic, osint, reverse_image, social_media, general
- Assignable to collaborators, linkable to personas/markers/hypotheses
- Frontend: `CopTaskBoard.tsx` — Kanban columns with inline create

### 3. Marker Confidence + Rationale
- Reuses confidence dots pattern (CONFIRMED→DOUBTFUL)
- Rationale field explains WHY a marker is placed
- Changes logged to changelog

### 4. Evidence-to-Hypothesis Linking (DONE)
- Inline "Link Evidence" form in expanded hypothesis cards
- Supporting vs contradicting toggle
- Confidence bar + slider on each hypothesis
- Status buttons: Active/Proven/Disproven/Archived

## Schema Changes

| Migration | Table | Change |
|-----------|-------|--------|
| 064 | cop_hypotheses, cop_hypothesis_evidence | NEW tables |
| 065 | cop_sessions | ADD mission_brief TEXT |
| 066 | cop_tasks | NEW table |
| 067 | cop_markers, cop_marker_changelog | ADD confidence/rationale, NEW changelog table |

## Files Modified This Session

### New Files
- `functions/api/cop/[id]/hypotheses.ts`
- `functions/api/cop/[id]/evidence.ts`
- `functions/api/cop/[id]/tasks.ts` (building)
- `functions/api/cop/[id]/marker-changelog.ts` (building)
- `src/components/cop/CopTaskBoard.tsx` (building)
- `src/components/cop/CopMarkerChangelog.tsx` (building)
- `schema/migrations/064-067`
- `scripts/setup-defcon-cop.sh`

### Modified Files
- `functions/api/cop/sessions/[id].ts` — added mission_brief to scalarFields
- `functions/api/cop/[id]/markers.ts` — adding confidence/rationale + changelog auto-create
- `src/components/cop/CopHypothesisTab.tsx` — evidence linking UI, confidence slider, status buttons
- `src/pages/CopWorkspacePage.tsx` — entities panel, task board panel (pending)
