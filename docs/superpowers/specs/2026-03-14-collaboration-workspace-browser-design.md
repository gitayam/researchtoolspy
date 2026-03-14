# Collaboration Workspace Browser

**Date:** 2026-03-14
**Status:** Draft
**Route:** `/dashboard/collaboration`

## Overview

Redesign the existing collaboration page from a workspace admin tool (members + invites) into a **team workspace browser** — a tabbed interface where team members can see and navigate to all shared content: entities, COP sessions, frameworks, and tools. The collaboration page becomes the team hub; all create/edit/delete happens on the existing dedicated pages.

## Goals

1. Give team members a single place to see everything in a shared workspace
2. Navigate to existing entity/COP/framework pages for CRUD — no duplicated edit UIs
3. Surface reusable COP tools (playbooks, task templates, intake forms) at the workspace level
4. Preserve existing member management and invite functionality (moved to Team tab)

## Non-Goals

- Inline editing of entities/COPs/frameworks from the collaboration page
- Sub-routes or URL-addressable tabs (client-side tab state only)
- Sidebar workspace navigation (keep existing dropdown)
- Real-time collaboration / live presence indicators
- Tab position preserved across navigation (users return to Entities tab after navigating away and back — accepted tradeoff of client-side tab state)

## Page Structure

Three vertical zones:

### 1. Workspace Selector (existing)

- Dropdown to pick workspace (owned + member workspaces)
- "Create Workspace" button
- Filter out COP auto-created workspaces: exclude workspaces where `id` starts with `cop-` or add `type IN ('TEAM', 'PUBLIC')` filter. Only show workspaces intended for team collaboration.

### 2. Stats Bar (new)

Horizontal row of clickable stat pills between selector and tabs:

```
[24 Entities] [3 COPs] [8 Frameworks] [5 Tools] [6 Members]
```

- Each pill clickable — jumps to corresponding tab
- Data from `GET /api/workspaces/:id/stats`

### 3. Tabbed Content (new)

Five tabs: **Entities** | **COP Sessions** | **Frameworks** | **Tools** | **Team**

Tab state managed via `useState` in `CollaborationPage`. No URL routing for tabs.

---

## Tab Specifications

### Entities Tab

Displays all entities (actors, sources, events, places, behaviors) in the workspace.

**UI Elements:**
- Filter chip bar: `All (24)` | `Actors (8)` | `Sources (6)` | `Events (3)` | `Places (4)` | `Behaviors (3)`
- Search input next to chips
- `+ New Entity` button → type selector dropdown → navigates to existing create page with `?workspace_id=` param
- Card grid (3 cols desktop, 2 tablet, 1 mobile):
  - Color-coded left border by type (blue=Actor, green=Source, amber=Place, red=Event, purple=Behavior)
  - Entity name, type badge, category/subtype
  - Created by + date
  - Click → navigates to existing entity detail page

**Data:** `GET /api/workspaces/:id/entities?type=&search=&limit=50&offset=0`

### COP Sessions Tab

Displays COP sessions associated with the workspace.

**UI Elements:**
- `+ New COP` button → navigates to `/dashboard/cop` with `?team_workspace_id=` param (distinct from `workspace_id` which controls entity isolation)
- Session cards:
  - Name, template type badge (quick_brief, event_monitor, area_study, etc.)
  - Status badge: DRAFT (gray), ACTIVE (green), ARCHIVED (amber)
  - Collaborator count, time window (from `time_window_start`/`time_window_end`)
  - Click → navigates to `/dashboard/cop/:id`

**Data:** `GET /api/workspaces/:id/cop-sessions?limit=50&offset=0`

**Note:** Entity count per session is expensive (5 COUNT subqueries per session). Defer to the stats endpoint or compute lazily on card hover in a future iteration.

### Frameworks Tab

Displays framework sessions in the workspace.

**UI Elements:**
- `+ New Framework` button → navigates to framework creation with workspace context
- Filter chips by framework type: `All` | `ACH` | `SWOT` | `PMESII` | etc.
- Framework cards:
  - Title, framework type badge, status (draft / in_progress / completed / archived)
  - Tag pills
  - Created by, last updated
  - Click → navigates to existing framework editor

**Data:** `GET /api/workspaces/:id/frameworks?type=&limit=50&offset=0`

### Tools Tab

Two sections — analysis launchers and reusable COP templates.

**Analysis Tools (hardcoded):**
- Card grid of built-in analysis capabilities:
  - Cross-tables, MOM-POP, MOSES, ACH, SWOT, PMESII, COG analysis
  - Each card: tool name, icon, description, "Launch" button
  - Launch → navigates to relevant page pre-scoped to workspace

**COP Templates (from database):**
- Reusable artifacts shared across COP sessions in the workspace:
  - Playbooks, task templates, intake forms
  - Card: name, type badge, description, source COP session
  - Click → navigates to the COP session containing the template

**Data:** Analysis tools are hardcoded. COP templates from `GET /api/workspaces/:id/tools`

### Team Tab

Existing member management and invite functionality, extracted from current page.

**UI Elements (no changes to existing):**
- Team Members card — avatar list with roles, join dates
- Invite Links card — active invites with copy/revoke, "New Invite" dialog
- Security Info card — blue info banner

**Data:** Existing `GET /api/workspaces/:id/members` and `GET /api/workspaces/:id/invites`

---

## Schema Changes

### New column on `cop_sessions`

```sql
ALTER TABLE cop_sessions ADD COLUMN team_workspace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cop_sessions_team_workspace ON cop_sessions(team_workspace_id);
-- NOTE: Existing sessions will have team_workspace_id = NULL.
-- They must be manually assigned via the COP session settings UI or a backfill migration.
```

**Purpose:** Links a COP session to a team workspace while preserving its own isolated entity workspace. The existing `workspace_id` remains the per-session entity isolation boundary. `team_workspace_id` is the team workspace the session belongs to for the collaboration browser.

**Migration:** New migration file `schema/migrations/091-add-cop-team-workspace.sql`

**Backfill note:** Existing COP sessions will have `team_workspace_id = NULL` and won't appear in the workspace browser. The COP Sessions tab should show a distinct empty state: "No COP sessions are linked to this workspace yet. Create a new COP or assign existing sessions from COP settings." A future COP session settings UI should allow assigning `team_workspace_id`.

**COP creation update:** `POST /api/cop/sessions` must be updated to accept and persist `team_workspace_id` from the request body. The frontend passes this when creating a COP from the collaboration page.

---

## New API Endpoints

All endpoints require authentication and verify workspace membership.

### `GET /api/workspaces/:id/stats`

Returns aggregate counts for the stats bar.

**Response:**
```json
{
  "entities": 24,
  "entity_breakdown": {
    "actors": 8,
    "sources": 6,
    "events": 3,
    "places": 4,
    "behaviors": 3
  },
  "cop_sessions": 3,
  "frameworks": 8,
  "tools": 5,
  "members": 6
}
```

**Implementation:** COUNT queries on actors, sources, events, places, behaviors (WHERE workspace_id), cop_sessions (WHERE team_workspace_id), framework_sessions (WHERE workspace_id), workspace_members (WHERE workspace_id). Tools count uses the chain query pattern:

```sql
-- Tools count (sum of playbooks + task templates + intake forms across linked COP sessions)
SELECT COUNT(*) FROM cop_playbooks WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?)
UNION ALL
SELECT COUNT(*) FROM cop_task_templates t JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id WHERE cs.team_workspace_id = ?
UNION ALL
SELECT COUNT(*) FROM cop_intake_forms WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?)
```

### `GET /api/workspaces/:id/entities`

Returns all entity types in the workspace, unified into a single list.

**Query params:**
- `type` — filter by entity type: `actor`, `source`, `event`, `place`, `behavior`
- `search` — prefix match on `name` field (`name LIKE 'term%'`). Full-text search is a future enhancement.
- `limit` — max results, default 50, max 200
- `offset` — pagination offset, default 0

**Response:**
```json
{
  "entities": [
    {
      "id": "uuid",
      "entity_type": "actor",
      "name": "Viktor Petrov",
      "type": "PERSON",
      "category": "Intelligence",
      "created_by": 1,
      "created_at": "2026-03-10T...",
      "workspace_id": "ws-123"
    }
  ],
  "total": 24,
  "limit": 50,
  "offset": 0
}
```

**Implementation:** UNION ALL across actors, sources, events, places, behaviors with a discriminator column. ORDER BY created_at DESC. LIMIT/OFFSET applied to the outer query. When `type` filter is set, only query the single matching table (skip UNION).

### `GET /api/workspaces/:id/cop-sessions`

Returns COP sessions linked to this team workspace.

**Response:**
```json
{
  "sessions": [
    {
      "id": "cop-abc",
      "name": "Crisis Monitor",
      "template_type": "event_monitor",
      "status": "ACTIVE",
      "collaborator_count": 3,
      "marker_count": 12,
      "evidence_count": 8,
      "time_window_start": "2026-03-01T00:00:00Z",
      "time_window_end": "2026-03-14T00:00:00Z",
      "created_at": "2026-03-08T..."
    }
  ]
}
```

**Implementation:** Query `cop_sessions WHERE team_workspace_id = ?` with LEFT JOIN counts on cop_collaborators, cop_markers, evidence_items.

### `GET /api/workspaces/:id/frameworks`

Returns framework sessions in the workspace.

**Query params:**
- `type` — filter by framework_type

**Response:**
```json
{
  "frameworks": [
    {
      "id": 1,
      "title": "ACH: Maritime Smuggling",
      "framework_type": "ach",
      "status": "in_progress",
      "tags": ["maritime", "smuggling"],
      "created_by_username": "analyst1",
      "created_at": "2026-03-09T...",
      "updated_at": "2026-03-12T..."
    }
  ]
}
```

**Implementation:** Query `framework_sessions WHERE workspace_id = ?` with `LEFT JOIN users u ON fs.user_id = u.id` for `created_by_username`. Supports `limit` (default 50) and `offset` (default 0).

### `GET /api/workspaces/:id/tools`

Returns COP templates (playbooks, task templates, intake forms) across all COP sessions in the workspace.

**Response:**
```json
{
  "playbooks": [
    {
      "id": 1,
      "name": "Auto-assign OSINT tasks",
      "cop_session_id": "cop-abc",
      "cop_session_name": "Crisis Monitor",
      "created_at": "2026-03-10T..."
    }
  ],
  "task_templates": [...],
  "intake_forms": [...]
}
```

**Implementation:** COP templates are scoped by `workspace_id` (the per-session entity workspace), not `cop_session_id`. Query via JOIN through `cop_sessions`:

```sql
-- Task templates (cop_task_templates has workspace_id, not cop_session_id)
SELECT t.*, cs.name as cop_session_name, cs.id as cop_session_id
FROM cop_task_templates t
JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id
WHERE cs.team_workspace_id = ?

-- Same pattern for cop_playbooks and cop_intake_forms
```

---

## New Frontend Components

All placed in `src/components/collaboration/`.

| Component | Props | Purpose |
|---|---|---|
| `WorkspaceStatsBar.tsx` | `workspaceId, onTabClick` | Clickable stat pills, fetches counts |
| `EntitiesTab.tsx` | `workspaceId, userRole` | Entity list with type filter chips + search |
| `CopSessionsTab.tsx` | `workspaceId, userRole` | COP session cards with status/counts |
| `FrameworksTab.tsx` | `workspaceId, userRole` | Framework list with type filters |
| `ToolsTab.tsx` | `workspaceId, userRole` | Analysis launchers + COP templates |
| `TeamTab.tsx` | `workspaceId, userRole` | Extracted existing members/invites UI |

### CollaborationPage.tsx Changes

- Keep workspace selector at top
- Add `WorkspaceStatsBar` below selector
- Add tab bar with 5 tabs
- Render active tab component
- Extract existing member/invite code into `TeamTab.tsx`
- Tab state: `useState<'entities' | 'cops' | 'frameworks' | 'tools' | 'team'>('entities')`

---

## Navigation Integration

When navigating from collaboration page to entity/COP/framework pages, pass workspace context:

- **Entity create/detail:** `?workspace_id=<id>` query param
- **COP create:** `?team_workspace_id=<id>` — distinct from `workspace_id` (entity isolation). The COP creation flow persists this as `team_workspace_id` on the new session.
- **Framework create:** `?workspace_id=<id>` — set `workspace_id` on the framework session

Existing pages should read this param and scope their operations accordingly. Back navigation returns to the collaboration page.

---

## Auth & Access Control

- All new endpoints verify workspace membership via `workspace_members` table
- Role enforcement: VIEWER can read all tabs. EDITOR can create/navigate to create flows. ADMIN can manage team + invites (Team tab).
- Existing `getUserFromRequest()` auth pattern for all endpoints
- 403 if user is not a workspace member
- Workspace owner (`owner_id` on `workspaces` table) always has ADMIN-equivalent access, even if not in `workspace_members`

**Frontend role awareness:** The workspace selector response (`GET /api/workspaces`) should include `current_user_role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'` for each workspace. The `CollaborationPage` passes this to tab components, which conditionally render create/edit buttons based on role. VIEWERs see content but no mutation buttons.

---

## File Locations

**API (Cloudflare Pages Functions):**
- `functions/api/workspaces/[id]/stats.ts`
- `functions/api/workspaces/[id]/entities.ts`
- `functions/api/workspaces/[id]/cop-sessions.ts`
- `functions/api/workspaces/[id]/frameworks.ts`
- `functions/api/workspaces/[id]/tools.ts`

**Frontend:**
- `src/components/collaboration/WorkspaceStatsBar.tsx`
- `src/components/collaboration/EntitiesTab.tsx`
- `src/components/collaboration/CopSessionsTab.tsx`
- `src/components/collaboration/FrameworksTab.tsx`
- `src/components/collaboration/ToolsTab.tsx`
- `src/components/collaboration/TeamTab.tsx`
- `src/pages/CollaborationPage.tsx` (modified)

**Schema:**
- `schema/migrations/091-add-cop-team-workspace.sql`
