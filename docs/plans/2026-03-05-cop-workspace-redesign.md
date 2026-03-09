# COP Workspace Redesign

**Date:** 2026-03-05
**Status:** Approved

## Problem

The Dashboard (`/dashboard`) and COP (`/dashboard/cop`) have significant overlap. The COP is too map-centric — a Common Operating Picture should graphically display all data and analysis as an investigation progresses, not just geographic data. Key visualizations (network graph, intelligence synthesis, timeline) exist as disconnected standalone pages. There's no unified workspace for researchers to see the full state of their investigation, identify gaps, and collaborate.

## Decision

Merge investigations and COP workspaces into a single concept. The COP becomes a multi-panel command center — a scrollable overview page with compact panels that each expand to full-screen for deep work. The map is just one panel among many (and optional).

## Architecture

### Page Structure

| Route | Purpose | Change |
|-------|---------|--------|
| `/dashboard` | Investigation hub — list, create, stats | Minor updates to link to workspaces |
| `/dashboard/cop` | Workspace list (rename from "Operating Pictures") | Relabel, minor styling |
| `/dashboard/cop/:id` | **Multi-panel workspace** | Major rewrite: map-only → command center |
| `/dashboard/intelligence` | Intelligence synthesis | **Removed** — absorbed into workspace Intel panel |
| `/dashboard/network` | Network graph | **Removed** — absorbed into workspace Graph panel |
| `/dashboard/investigations/:id` | Investigation detail | **Redirects** to linked COP workspace |

### Workspace Layout

**Header:** Back | Investigation title (editable) | Status | Template | Share | Invite | Mode toggle (Progress/Monitor) | Settings

**Mode: Investigation Progress (default)**

```
┌──────────────────────────────────────────────────────────────┐
│ KPI Strip: Evidence: 24 | Entities: 12 | Analyses: 5 |      │
│            Questions: 3 (open) | Gaps: 7                     │
├─────────────────────────────┬────────────────────────────────┤
│ Entity Relationship Graph   │ Timeline                       │
│ (mini force-directed graph) │ (horizontal event timeline)    │
│ [12 entities, 8 rels]       │ [24 items, Jan-Mar 2026]       │
│         [↗ Expand]          │         [↗ Expand]             │
├─────────────────────────────┬────────────────────────────────┤
│ Key Questions & Gaps        │ Analysis Summary               │
│ - Q1: Who funded X? [OPEN]  │ SWOT: 2 sessions               │
│ - Q2: Timeline of Y? [✓]   │ ACH: 1 session (3 hypotheses)  │
│ - Gap: No source for Z      │ Contradictions: 2 found        │
│         [↗ Expand]          │         [↗ Expand]             │
├──────────────────────────────────────────────────────────────┤
│ Evidence & Intel Feed                                        │
│ [chronological feed of all evidence, analyses, activity]     │
│         [↗ Expand]                                           │
├──────────────────────────────────────────────────────────────┤
│ Map (collapsed by default unless geo data exists)            │
│         [↗ Expand]                                           │
└──────────────────────────────────────────────────────────────┘
```

**Mode: Live Monitor** — Feed becomes primary (top), map moves up, questions persist as sidebar, other panels collapse to summary strip.

### Expand/Collapse Behavior

Each panel's expand button opens a full-screen drawer that slides up and covers the workspace. The drawer includes:
- Full toolbar for that visualization
- Close button returns to overview
- Data synced — changes in drawer reflect in overview immediately

### Panels

1. **Status KPI Strip** — reads existing entity/evidence/framework counts from investigation
2. **Entity Relationship Graph** — wraps existing `NetworkGraphCanvas` in compact container; full-screen expands to current NetworkGraphPage functionality
3. **Timeline** — new Recharts-based horizontal timeline of events, evidence, analyses
4. **Key Questions & Gaps** — reuses existing `CopQuestionsTab`; adds gap analysis (missing sources, unanswered questions, untested hypotheses)
5. **Analysis Summary** — adapts from IntelligenceSynthesisPage; shows framework results, convergence points, contradictions
6. **Evidence & Intel Feed** — chronological feed of all activity; URL analysis input; filterable by type
7. **Map** — reuses existing `CopMap`; optional, collapsed if no geo data

## Data Model Changes

### Additions to `cop_sessions`

```sql
ALTER TABLE cop_sessions ADD COLUMN panel_layout TEXT DEFAULT '{}';
ALTER TABLE cop_sessions ADD COLUMN workspace_mode TEXT DEFAULT 'progress';
ALTER TABLE cop_sessions ADD COLUMN investigation_id TEXT;
```

### New: `cop_collaborators`

```sql
CREATE TABLE cop_collaborators (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',  -- owner, editor, viewer
  invited_by INTEGER,
  invited_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT,
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
```

### New: `cop_activity`

```sql
CREATE TABLE cop_activity (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,  -- added_evidence, ran_analysis, answered_rfi, etc.
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Panel State Persistence

`panel_layout` JSON on `cop_sessions`:
```json
{
  "mode": "progress",
  "panels": {
    "graph": { "visible": true, "expanded": false, "position": [0, 1] },
    "timeline": { "visible": true, "expanded": false, "position": [1, 1] },
    "questions": { "visible": true, "expanded": false, "position": [0, 2] },
    "analysis": { "visible": true, "expanded": false, "position": [1, 2] },
    "feed": { "visible": true, "expanded": false, "position": [0, 3] },
    "map": { "visible": false, "expanded": false, "position": [0, 4] }
  }
}
```

## Collaboration Model

- **Roles:** owner (creator), editor (add/modify), viewer (read-only + submit RFIs)
- **Invite flow:** Share link or email invite; first person is auto-admin
- **Public mode:** Extend existing `cop_shares` with `allow_editing` flag
- **Activity feed:** All actions logged to `cop_activity` for audit trail and feed panel

## Implementation Phases

### Phase 1: Workspace Shell + Overview (Foundation)
- New `CopWorkspacePage` component
- Header bar with mode toggle, share, invite buttons
- Status KPI strip
- Panel grid layout with responsive CSS grid
- Mini-graph panel (wrap NetworkGraphCanvas)
- Key Questions panel (reuse CopQuestionsTab)
- DB migration: add `panel_layout`, `workspace_mode`, `investigation_id` to `cop_sessions`

### Phase 2: Panel Deep-Dives
- Full-screen expand/collapse drawer for each panel
- Timeline panel (new, Recharts-based)
- Analysis Summary panel (adapt from IntelligenceSynthesisPage)
- Evidence & Intel Feed panel (new)
- Map panel (reuse CopMap, now optional/collapsible)

### Phase 3: Collaboration
- `cop_collaborators` table + CRUD API
- Invite flow (link-based, email optional)
- `cop_activity` table + API
- Activity feed panel
- Permission middleware on COP endpoints

### Phase 4: Investigation Merge
- Auto-create COP workspace on investigation creation
- InvestigationDetailPage redirects to COP workspace
- Dashboard cards link to workspace
- Remove standalone IntelligenceSynthesisPage and NetworkGraphPage
- Data migration for existing investigations

### Phase 5: Live Monitor Mode
- Real-time feed panel with polling/SSE
- Layout switch for monitor mode
- External data source integration (ACLED, GDELT feeds)

## Components Affected

### New Components
- `CopWorkspacePage` — main workspace shell
- `CopStatusStrip` — KPI bar
- `CopPanelGrid` — responsive grid layout manager
- `CopPanelExpander` — full-screen drawer wrapper
- `CopMiniGraph` — compact network graph
- `CopTimelinePanel` — timeline visualization
- `CopAnalysisSummary` — framework results overview
- `CopEvidenceFeed` — chronological activity feed
- `CopInviteDialog` — collaboration invite UI
- `CopActivityFeed` — audit trail display

### Reused Components
- `NetworkGraphCanvas` (inside CopMiniGraph)
- `CopMap` (inside map panel)
- `CopQuestionsTab` (inside questions panel)
- `CopRfiTab` (inside questions panel expand)
- `CopLayerPanel` (inside map panel expand)

### Removed/Deprecated
- Current `CopPage` (replaced by CopWorkspacePage)
- `IntelligenceSynthesisPage` (absorbed into CopAnalysisSummary)
- `NetworkGraphPage` (absorbed into CopMiniGraph expand view)
- `InvestigationDetailPage` (redirects to workspace)
