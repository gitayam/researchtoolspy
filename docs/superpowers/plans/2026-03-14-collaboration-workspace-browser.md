# Collaboration Workspace Browser Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the collaboration page from a workspace admin tool into a tabbed team workspace browser showing entities, COP sessions, frameworks, tools, and team management.

**Architecture:** Enhance the existing `CollaborationPage.tsx` with a tab bar and extract content into 6 new components under `src/components/collaboration/`. Five new API endpoints under `functions/api/workspaces/[id]/` serve workspace-scoped data. One D1 migration adds `team_workspace_id` to `cop_sessions`.

**Tech Stack:** React + shadcn/ui + Tailwind (frontend), Cloudflare Pages Functions + D1 (backend), TypeScript throughout.

**Spec:** `docs/superpowers/specs/2026-03-14-collaboration-workspace-browser-design.md`

---

## Chunk 1: Schema Migration + Backend Foundation

### Task 1: Database Migration

**Files:**
- Create: `schema/migrations/091-add-cop-team-workspace.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 091-add-cop-team-workspace.sql
-- Adds team_workspace_id to cop_sessions for collaboration workspace browser.
-- Existing sessions will have team_workspace_id = NULL.
-- They must be assigned via COP session settings or a backfill migration.

ALTER TABLE cop_sessions ADD COLUMN team_workspace_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cop_sessions_team_workspace ON cop_sessions(team_workspace_id);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat schema/migrations/091-add-cop-team-workspace.sql`
Expected: The SQL file contents shown above.

- [ ] **Step 3: Commit**

```bash
git add schema/migrations/091-add-cop-team-workspace.sql
git commit -m "feat(schema): add team_workspace_id to cop_sessions (migration 091)"
```

---

### Task 2: Workspace Auth Helper — `getWorkspaceMemberRole`

**Files:**
- Modify: `functions/api/_shared/workspace-helpers.ts`

The existing `canManageWorkspace()` returns a boolean. We need a function that returns the user's effective role so the frontend can gate UI elements.

- [ ] **Step 1: Write the helper function**

Add to the end of `functions/api/_shared/workspace-helpers.ts`:

```typescript
/**
 * Get effective role for a user in a workspace.
 * Returns 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | null.
 * Owner always gets 'OWNER' even if not in workspace_members.
 */
export async function getWorkspaceMemberRole(
  db: D1Database,
  workspaceId: string,
  userId: number
): Promise<'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | null> {
  const workspace = await db.prepare(
    `SELECT owner_id FROM workspaces WHERE id = ?`
  ).bind(workspaceId).first()
  if (!workspace) return null
  if (workspace.owner_id === userId) return 'OWNER'

  const member = await db.prepare(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
  ).bind(workspaceId, userId).first() as { role: string } | null
  return (member?.role as 'ADMIN' | 'EDITOR' | 'VIEWER') || null
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/workspace-helpers.ts
git commit -m "feat(auth): add getWorkspaceMemberRole helper for collaboration browser"
```

---

### Task 3: Update `GET /api/workspaces` to include `current_user_role`

**Files:**
- Modify: `functions/api/workspaces/index.ts` (lines 42-80, the `onRequestGet` handler)

- [ ] **Step 1: Add import**

Add to existing imports at top of file:

```typescript
import { getWorkspaceMemberRole } from '../_shared/workspace-helpers'
```

- [ ] **Step 2: Update the parseWorkspace function to include role**

Replace the existing `parseWorkspace` and response block (lines 64-73) with:

```typescript
    const ownedParsed = ownedWorkspaces.map((w: any) => ({
      ...w,
      is_public: Boolean(w.is_public),
      allow_cloning: Boolean(w.allow_cloning),
      current_user_role: 'OWNER' as const,
    }))

    const memberParsed = memberWorkspaces.map((w: any) => ({
      ...w,
      is_public: Boolean(w.is_public),
      allow_cloning: Boolean(w.allow_cloning),
      current_user_role: (w.role || 'VIEWER') as string,
    }))

    return new Response(JSON.stringify({
      owned: ownedParsed,
      member: memberParsed,
    }), { headers: jsonHeaders })
```

Note: `memberWorkspaces` already JOINs `wm.role` (line 58), so the role is available on each row. Owned workspaces are always 'OWNER'.

- [ ] **Step 3: Also filter out COP auto-created workspaces**

Update the owned workspaces query (line 53-55) to exclude COP auto-created workspaces:

```sql
SELECT * FROM workspaces WHERE owner_id = ? AND id NOT LIKE 'cop-%' ORDER BY created_at DESC
```

Update the member workspaces query (lines 57-62) similarly:

```sql
SELECT w.*, wm.role FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = ? AND w.owner_id != ? AND w.id NOT LIKE 'cop-%'
ORDER BY w.created_at DESC
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/workspaces/index.ts
git commit -m "feat(workspaces): add current_user_role to workspace list, filter COP workspaces"
```

---

### Task 4: `GET /api/workspaces/:id/stats` endpoint

**Files:**
- Create: `functions/api/workspaces/[id]/stats.ts`

- [ ] **Step 1: Create the stats endpoint**

```typescript
/**
 * Workspace Stats API
 *
 * GET /api/workspaces/:id/stats — Aggregate counts for the stats bar
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    // Entity counts
    const [actors, sources, events, places, behaviors] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as c FROM actors WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM sources WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM events WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM places WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM behaviors WHERE workspace_id = ?').bind(workspaceId).first(),
    ])

    const actorCount = (actors?.c as number) || 0
    const sourceCount = (sources?.c as number) || 0
    const eventCount = (events?.c as number) || 0
    const placeCount = (places?.c as number) || 0
    const behaviorCount = (behaviors?.c as number) || 0

    // COP sessions, frameworks, members
    const [copSessions, frameworks, members] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as c FROM cop_sessions WHERE team_workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM framework_sessions WHERE workspace_id = ?').bind(workspaceId).first(),
      env.DB.prepare('SELECT COUNT(*) as c FROM workspace_members WHERE workspace_id = ?').bind(workspaceId).first(),
    ])

    // Tools count (playbooks + task templates + intake forms across linked COP sessions)
    const toolsResult = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM cop_playbooks WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?)) +
        (SELECT COUNT(DISTINCT t.id) FROM cop_task_templates t JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id WHERE cs.team_workspace_id = ?) +
        (SELECT COUNT(*) FROM cop_intake_forms WHERE cop_session_id IN (SELECT id FROM cop_sessions WHERE team_workspace_id = ?))
        as total
    `).bind(workspaceId, workspaceId, workspaceId).first()

    return new Response(JSON.stringify({
      entities: actorCount + sourceCount + eventCount + placeCount + behaviorCount,
      entity_breakdown: {
        actors: actorCount,
        sources: sourceCount,
        events: eventCount,
        places: placeCount,
        behaviors: behaviorCount,
      },
      cop_sessions: (copSessions?.c as number) || 0,
      frameworks: (frameworks?.c as number) || 0,
      tools: (toolsResult?.total as number) || 0,
      members: (members?.c as number) || 0,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace stats] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/workspaces/[id]/stats.ts
git commit -m "feat(api): add GET /api/workspaces/:id/stats endpoint"
```

---

### Task 5: `GET /api/workspaces/:id/entities` endpoint

**Files:**
- Create: `functions/api/workspaces/[id]/entities.ts`

- [ ] **Step 1: Create the entities endpoint**

```typescript
/**
 * Workspace Entities API
 *
 * GET /api/workspaces/:id/entities — List all entity types in workspace
 * Supports ?type=, ?search=, ?limit=, ?offset=
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const ENTITY_TABLES = ['actors', 'sources', 'events', 'places', 'behaviors'] as const
type EntityTable = typeof ENTITY_TABLES[number]

// Map singular type param (from frontend) to plural table name
const TYPE_TO_TABLE: Record<string, EntityTable> = {
  actor: 'actors', source: 'sources', event: 'events',
  place: 'places', behavior: 'behaviors',
}

// Each table has different columns for "type" and "category"
const TABLE_META: Record<EntityTable, { typeCol: string; categoryCol: string }> = {
  actors:    { typeCol: 'type',        categoryCol: 'category' },
  sources:   { typeCol: 'type',        categoryCol: 'category' },
  events:    { typeCol: 'type',        categoryCol: 'significance' },
  places:    { typeCol: 'type',        categoryCol: 'strategic_importance' },
  behaviors: { typeCol: 'type',        categoryCol: 'sophistication' },
}

function buildEntityQuery(
  table: EntityType,
  workspaceId: string,
  search: string | null,
): { sql: string; binds: any[] } {
  const meta = TABLE_META[table]
  // Singular form for entity_type label (strip trailing 's')
  const entityType = table.slice(0, -1)

  let where = `WHERE workspace_id = ?`
  const binds: any[] = [workspaceId]

  if (search) {
    where += ` AND name LIKE ?`
    binds.push(`${search}%`)
  }

  const sql = `SELECT CAST(id AS TEXT) as id, name, '${entityType}' as entity_type, ${meta.typeCol} as type, ${meta.categoryCol} as category, created_by, created_at, workspace_id FROM ${table} ${where}`
  return { sql, binds }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const typeFilter = url.searchParams.get('type') || null
    const search = url.searchParams.get('search') || null
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // If type filter is set, resolve singular name to plural table name
    const resolvedTable = typeFilter ? TYPE_TO_TABLE[typeFilter] : null
    const tables = resolvedTable
      ? [resolvedTable]
      : [...ENTITY_TABLES]

    // Build UNION ALL query
    const parts: string[] = []
    const allBinds: any[] = []

    for (const table of tables) {
      const { sql, binds } = buildEntityQuery(table, workspaceId, search)
      parts.push(sql)
      allBinds.push(...binds)
    }

    const unionSql = parts.join(' UNION ALL ')

    // Get total count
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM (${unionSql})`
    ).bind(...allBinds).first()

    // Get paginated results
    const dataResult = await env.DB.prepare(
      `SELECT * FROM (${unionSql}) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...allBinds, limit, offset).all()

    return new Response(JSON.stringify({
      entities: dataResult.results,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace entities] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch entities' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/workspaces/[id]/entities.ts
git commit -m "feat(api): add GET /api/workspaces/:id/entities endpoint with UNION ALL + pagination"
```

---

### Task 6: `GET /api/workspaces/:id/cop-sessions` endpoint

**Files:**
- Create: `functions/api/workspaces/[id]/cop-sessions.ts`

- [ ] **Step 1: Create the cop-sessions endpoint**

```typescript
/**
 * Workspace COP Sessions API
 *
 * GET /api/workspaces/:id/cop-sessions — List COP sessions linked to this team workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM cop_sessions WHERE team_workspace_id = ?'
    ).bind(workspaceId).first()

    const { results } = await env.DB.prepare(`
      SELECT
        cs.id, cs.name, cs.template_type, cs.status,
        cs.time_window_start, cs.time_window_end,
        cs.created_at,
        (SELECT COUNT(*) FROM cop_collaborators WHERE cop_session_id = cs.id) as collaborator_count,
        (SELECT COUNT(*) FROM cop_markers WHERE cop_session_id = cs.id) as marker_count,
        (SELECT COUNT(*) FROM evidence_items WHERE workspace_id = cs.workspace_id) as evidence_count
      FROM cop_sessions cs
      WHERE cs.team_workspace_id = ?
      ORDER BY cs.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(workspaceId, limit, offset).all()

    return new Response(JSON.stringify({
      sessions: results,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace cop-sessions] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch COP sessions' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/workspaces/[id]/cop-sessions.ts
git commit -m "feat(api): add GET /api/workspaces/:id/cop-sessions endpoint"
```

---

### Task 7: `GET /api/workspaces/:id/frameworks` endpoint

**Files:**
- Create: `functions/api/workspaces/[id]/frameworks.ts`

- [ ] **Step 1: Create the frameworks endpoint**

```typescript
/**
 * Workspace Frameworks API
 *
 * GET /api/workspaces/:id/frameworks — List framework sessions in workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const typeFilter = url.searchParams.get('type') || null
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let whereClause = 'WHERE fs.workspace_id = ?'
    const binds: any[] = [workspaceId]

    if (typeFilter) {
      whereClause += ' AND fs.framework_type = ?'
      binds.push(typeFilter)
    }

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM framework_sessions fs ${whereClause}`
    ).bind(...binds).first()

    const { results } = await env.DB.prepare(`
      SELECT
        fs.id, fs.title, fs.framework_type, fs.status, fs.tags,
        fs.created_at, fs.updated_at,
        u.username as created_by_username
      FROM framework_sessions fs
      LEFT JOIN users u ON fs.user_id = u.id
      ${whereClause}
      ORDER BY fs.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all()

    // Parse tags JSON
    const frameworks = results.map((row: any) => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }))

    return new Response(JSON.stringify({
      frameworks,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace frameworks] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch frameworks' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/workspaces/[id]/frameworks.ts
git commit -m "feat(api): add GET /api/workspaces/:id/frameworks endpoint"
```

---

### Task 8: `GET /api/workspaces/:id/tools` endpoint

**Files:**
- Create: `functions/api/workspaces/[id]/tools.ts`

- [ ] **Step 1: Create the tools endpoint**

```typescript
/**
 * Workspace Tools API
 *
 * GET /api/workspaces/:id/tools — COP templates (playbooks, task templates, intake forms)
 * across all COP sessions linked to this team workspace
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    // Playbooks — scoped by cop_session_id
    const { results: playbooks } = await env.DB.prepare(`
      SELECT p.id, p.name, p.description, p.is_active, p.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_playbooks p
      JOIN cop_sessions cs ON p.cop_session_id = cs.id
      WHERE cs.team_workspace_id = ?
      ORDER BY p.created_at DESC
    `).bind(workspaceId).all()

    // Task templates — scoped by workspace_id (per-session entity workspace), not cop_session_id
    // Use DISTINCT to prevent row multiplication when multiple cop sessions share a workspace
    const { results: taskTemplates } = await env.DB.prepare(`
      SELECT DISTINCT t.id, t.name, t.description, t.task_type, t.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_task_templates t
      JOIN cop_sessions cs ON cs.workspace_id = t.workspace_id
      WHERE cs.team_workspace_id = ?
      ORDER BY t.created_at DESC
    `).bind(workspaceId).all()

    // Intake forms — scoped by cop_session_id
    const { results: intakeForms } = await env.DB.prepare(`
      SELECT f.id, f.title as name, f.description, f.is_public, f.created_at,
             cs.id as cop_session_id, cs.name as cop_session_name
      FROM cop_intake_forms f
      JOIN cop_sessions cs ON f.cop_session_id = cs.id
      WHERE cs.team_workspace_id = ?
      ORDER BY f.created_at DESC
    `).bind(workspaceId).all()

    return new Response(JSON.stringify({
      playbooks,
      task_templates: taskTemplates,
      intake_forms: intakeForms,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace tools] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch tools' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/workspaces/[id]/tools.ts
git commit -m "feat(api): add GET /api/workspaces/:id/tools endpoint"
```

---

### Task 9: Update `POST /api/cop/sessions` to accept `team_workspace_id`

**Files:**
- Modify: `functions/api/cop/sessions.ts` (lines 133-173, the INSERT statement)

- [ ] **Step 1: Add `team_workspace_id` to the INSERT**

In `functions/api/cop/sessions.ts`, find the INSERT statement (line 133). Add `team_workspace_id` to both the column list and VALUES:

Replace the INSERT block (lines 133-173):

```typescript
    await env.DB.prepare(`
      INSERT INTO cop_sessions (
        id, name, description, template_type, status,
        bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
        center_lat, center_lon, zoom_level,
        time_window_start, time_window_end, rolling_hours,
        active_layers, layer_config, linked_frameworks, key_questions,
        event_type, event_description, event_facts, content_analyses,
        workspace_id, created_by, is_public,
        team_workspace_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.name,
      body.description || null,
      body.template_type || 'custom',
      body.status || 'ACTIVE',
      body.bbox_min_lat ?? null,
      body.bbox_min_lon ?? null,
      body.bbox_max_lat ?? null,
      body.bbox_max_lon ?? null,
      body.center_lat ?? null,
      body.center_lon ?? null,
      body.zoom_level ?? 6,
      body.time_window_start || null,
      body.time_window_end || null,
      body.rolling_hours ?? null,
      body.active_layers ? JSON.stringify(body.active_layers) : '[]',
      body.layer_config ? JSON.stringify(body.layer_config) : '{}',
      body.linked_frameworks ? JSON.stringify(body.linked_frameworks) : '[]',
      body.key_questions ? JSON.stringify(body.key_questions) : '[]',
      body.event_type || null,
      body.event_description || null,
      body.event_facts ? JSON.stringify(body.event_facts) : '[]',
      body.content_analyses ? JSON.stringify(body.content_analyses) : '[]',
      workspaceId,
      userId,
      body.is_public ? 1 : 0,
      body.team_workspace_id || null,
      now,
      now
    ).run()
```

Note: The `?` count increases from 28 to 29. Count carefully.

- [ ] **Step 2: Also update the response to include `team_workspace_id`**

Update the response (line 175) to include the new field:

```typescript
    return new Response(JSON.stringify({
      id,
      workspace_id: workspaceId,
      team_workspace_id: body.team_workspace_id || null,
      message: 'COP session created',
    }), {
      status: 201,
      headers: corsHeaders
    })
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/cop/sessions.ts
git commit -m "feat(cop): accept team_workspace_id in POST /api/cop/sessions"
```

---

## Chunk 2: Frontend — Page Shell + Stats Bar + Team Tab

### Task 10: Create `TeamTab.tsx` — Extract existing members/invites UI

**Files:**
- Create: `src/components/collaboration/TeamTab.tsx`

This is a direct extraction of the existing members + invites sections from `CollaborationPage.tsx` (lines 380-621). The component receives `workspaceId` and `userRole` as props and manages its own data fetching.

- [ ] **Step 1: Create the TeamTab component**

```typescript
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Share2, Copy, Trash2, Clock, Shield, Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { getCopHeaders } from '@/lib/cop-auth'
import type { WorkspaceInvite, CreateWorkspaceInviteRequest, WorkspaceMemberWithNickname } from '@/types/workspace-invites'

interface TeamTabProps {
  workspaceId: string
  userRole: string
}

export function TeamTab({ workspaceId, userRole }: TeamTabProps) {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [members, setMembers] = useState<WorkspaceMemberWithNickname[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateWorkspaceInviteRequest>({
    default_role: 'VIEWER',
    max_uses: null,
    expires_in_hours: null,
    label: null
  })

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN'

  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = { ...getCopHeaders() }
    const authToken = localStorage.getItem('auth_token')
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    return headers
  }

  useEffect(() => {
    fetchMembers()
    fetchInvites()
  }, [workspaceId])

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    }
  }

  const fetchInvites = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        headers: getAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setInvites(data.invites || [])
      }
    } catch (error) {
      console.error('Failed to fetch invites:', error)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!response.ok) throw new Error('Failed to create invite')
      const invite = await response.json()
      toast({ title: t('pages.collaboration.inviteCreated'), description: t('pages.collaboration.inviteCreatedDesc') })
      await navigator.clipboard.writeText(invite.invite_url)
      toast({ title: t('pages.collaboration.linkCopied'), description: t('pages.collaboration.linkCopiedDesc') })
      setIsCreateDialogOpen(false)
      setCreateForm({ default_role: 'VIEWER', max_uses: null, expires_in_hours: null, label: null })
      fetchInvites()
    } catch (error) {
      toast({
        title: t('pages.collaboration.error'),
        description: error instanceof Error ? error.message : t('pages.collaboration.failedToCreateInvite'),
        variant: 'destructive'
      })
    }
  }

  const handleCopyInvite = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      toast({ title: t('pages.collaboration.linkCopied'), description: t('pages.collaboration.linkCopiedDesc') })
    } catch {
      toast({ title: t('pages.collaboration.error'), description: t('pages.collaboration.failedToCopyLink'), variant: 'destructive' })
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to revoke invite')
      toast({ title: t('pages.collaboration.inviteRevoked'), description: t('pages.collaboration.inviteRevokedDesc') })
      fetchInvites()
    } catch (error) {
      toast({
        title: t('pages.collaboration.error'),
        description: error instanceof Error ? error.message : t('pages.collaboration.failedToRevokeInvite'),
        variant: 'destructive'
      })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      case 'EDITOR': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase()
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return t('pages.collaboration.neverExpires', 'Never expires')
    const diffMs = new Date(expiresAt).getTime() - Date.now()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    if (diffMs <= 0) return t('pages.collaboration.expired', 'Expired')
    if (diffDays > 1) return t('pages.collaboration.expiresInDays', { count: diffDays, defaultValue: `Expires in ${diffDays} days` })
    if (diffHours > 1) return t('pages.collaboration.expiresInHours', { count: diffHours, defaultValue: `Expires in ${diffHours} hours` })
    return t('pages.collaboration.expiresSoon', 'Expires soon')
  }

  return (
    <div className="space-y-6">
      {/* Invite Links */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pages.collaboration.inviteLinks')}</CardTitle>
              <CardDescription>{t('pages.collaboration.inviteLinksDesc')}</CardDescription>
            </div>
            {canManage && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />{t('pages.collaboration.newInvite')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('pages.collaboration.createInviteLink')}</DialogTitle>
                    <DialogDescription>{t('pages.collaboration.createInviteLinkDesc')}</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateInvite} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.role')}</Label>
                      <Select value={createForm.default_role} onValueChange={(value: any) => setCreateForm({ ...createForm, default_role: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">{t('pages.collaboration.viewer')}</SelectItem>
                          <SelectItem value="EDITOR">{t('pages.collaboration.editor')}</SelectItem>
                          <SelectItem value="ADMIN">{t('pages.collaboration.admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.labelOptional')}</Label>
                      <Input placeholder={t('pages.collaboration.labelPlaceholder')} value={createForm.label || ''} onChange={(e) => setCreateForm({ ...createForm, label: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.expiresIn')}</Label>
                      <Select value={createForm.expires_in_hours?.toString() || 'never'} onValueChange={(value) => setCreateForm({ ...createForm, expires_in_hours: value === 'never' ? null : parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">{t('pages.collaboration.neverExpires')}</SelectItem>
                          <SelectItem value="24">{t('pages.collaboration.hours24')}</SelectItem>
                          <SelectItem value="168">{t('pages.collaboration.days7')}</SelectItem>
                          <SelectItem value="720">{t('pages.collaboration.days30')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.collaboration.maxUses')}</Label>
                      <Select value={createForm.max_uses?.toString() || 'unlimited'} onValueChange={(value) => setCreateForm({ ...createForm, max_uses: value === 'unlimited' ? null : parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unlimited">{t('pages.collaboration.unlimited')}</SelectItem>
                          <SelectItem value="1">{t('pages.collaboration.use1')}</SelectItem>
                          <SelectItem value="5">{t('pages.collaboration.uses5')}</SelectItem>
                          <SelectItem value="10">{t('pages.collaboration.uses10')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">{t('pages.collaboration.createCopyLink')}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="text-center py-8">
              <Share2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.noInvites')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {invite.label && <span className="font-medium text-gray-900 dark:text-white">{invite.label}</span>}
                        <Badge className={getRoleColor(invite.default_role)}>{invite.default_role}</Badge>
                        {!invite.is_active && <Badge variant="destructive">Revoked</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">{invite.invite_token}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatExpiry(invite.expires_at)}</span>
                        <span>{invite.current_uses}/{invite.max_uses || '∞'} uses</span>
                        {invite.created_by && <span>Created by {invite.created_by.nickname}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyInvite(invite.invite_url)} disabled={!invite.is_active}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(invite.invite_url, '_blank')} disabled={!invite.is_active}><ExternalLink className="h-4 w-4" /></Button>
                      {canManage && <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(invite.id)} disabled={!invite.is_active}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pages.collaboration.teamMembers')} ({members.length})</CardTitle>
          <CardDescription>{t('pages.collaboration.teamMembersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.noMembers')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <Avatar><AvatarFallback>{getInitials(member.nickname || member.username || 'U')}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.nickname || member.username || 'Unknown'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Joined {new Date(member.joined_at).toLocaleDateString()}{member.joined_via_invite_id && ' via invite'}</p>
                    </div>
                  </div>
                  <Badge className={getRoleColor(member.role)}>{member.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">{t('pages.collaboration.secureCollaboration')}</h3>
              <p className="text-sm text-blue-800 dark:text-blue-300">{t('pages.collaboration.securityInfo')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/TeamTab.tsx
git commit -m "feat(ui): extract TeamTab component from CollaborationPage"
```

---

### Task 11: Create `WorkspaceStatsBar.tsx`

**Files:**
- Create: `src/components/collaboration/WorkspaceStatsBar.tsx`

- [ ] **Step 1: Create the stats bar component**

```typescript
import { useState, useEffect } from 'react'
import { Users, Database, Radio, FlaskConical, Wrench } from 'lucide-react'
import { getCopHeaders } from '@/lib/cop-auth'

type TabId = 'entities' | 'cops' | 'frameworks' | 'tools' | 'team'

interface WorkspaceStatsBarProps {
  workspaceId: string
  onTabClick: (tab: TabId) => void
}

interface Stats {
  entities: number
  cop_sessions: number
  frameworks: number
  tools: number
  members: number
}

export function WorkspaceStatsBar({ workspaceId, onTabClick }: WorkspaceStatsBarProps) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetchStats()
  }, [workspaceId])

  const fetchStats = async () => {
    try {
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch(`/api/workspaces/${workspaceId}/stats`, { headers })
      if (response.ok) {
        setStats(await response.json())
      }
    } catch (error) {
      console.error('Failed to fetch workspace stats:', error)
    }
  }

  if (!stats) return null

  const pills: { id: TabId; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'entities', label: 'Entities', count: stats.entities, icon: <Database className="h-3.5 w-3.5" /> },
    { id: 'cops', label: 'COPs', count: stats.cop_sessions, icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'frameworks', label: 'Frameworks', count: stats.frameworks, icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: 'tools', label: 'Tools', count: stats.tools, icon: <Wrench className="h-3.5 w-3.5" /> },
    { id: 'team', label: 'Members', count: stats.members, icon: <Users className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill) => (
        <button
          key={pill.id}
          onClick={() => onTabClick(pill.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {pill.icon}
          <span>{pill.count}</span>
          <span>{pill.label}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/WorkspaceStatsBar.tsx
git commit -m "feat(ui): add WorkspaceStatsBar component with clickable stat pills"
```

---

### Task 12: Rewrite `CollaborationPage.tsx` — Tab shell with workspace selector

**Files:**
- Modify: `src/pages/CollaborationPage.tsx`

This replaces the existing page with the new tabbed layout. The existing member/invite code is now in `TeamTab.tsx`.

- [ ] **Step 1: Rewrite the page**

```typescript
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Database, Radio, FlaskConical, Wrench } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog'
import { WorkspaceStatsBar } from '@/components/collaboration/WorkspaceStatsBar'
import { TeamTab } from '@/components/collaboration/TeamTab'
import { EntitiesTab } from '@/components/collaboration/EntitiesTab'
import { CopSessionsTab } from '@/components/collaboration/CopSessionsTab'
import { FrameworksTab } from '@/components/collaboration/FrameworksTab'
import { ToolsTab } from '@/components/collaboration/ToolsTab'
import { generateAccountHash } from '@/lib/hash-auth'
import { getCopHeaders } from '@/lib/cop-auth'

type TabId = 'entities' | 'cops' | 'frameworks' | 'tools' | 'team'

interface Workspace {
  id: string
  name: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  owner_id: number
  current_user_role: string
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'entities', label: 'Entities', icon: <Database className="h-4 w-4" /> },
  { id: 'cops', label: 'COP Sessions', icon: <Radio className="h-4 w-4" /> },
  { id: 'frameworks', label: 'Frameworks', icon: <FlaskConical className="h-4 w-4" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="h-4 w-4" /> },
  { id: 'team', label: 'Team', icon: <Users className="h-4 w-4" /> },
]

export function CollaborationPage() {
  const { t } = useTranslation()
  const { toast } = useToast()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('entities')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureUserHash()
    fetchWorkspaces()
  }, [])

  const ensureUserHash = () => {
    let userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash || userHash === 'guest') {
      userHash = generateAccountHash()
      localStorage.setItem('omnicore_user_hash', userHash)
      localStorage.setItem('omnicore_authenticated', 'true')
      toast({
        title: t('pages.collaboration.accountCreated'),
        description: t('pages.collaboration.accountCreatedDesc'),
      })
    }
    return userHash
  }

  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = { ...getCopHeaders() }
    const authToken = localStorage.getItem('auth_token')
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`
    return headers
  }

  const fetchWorkspaces = async () => {
    try {
      setError(null)
      const response = await fetch('/api/workspaces', { headers: getAuthHeaders() })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        setError(errData.error || `Failed to load workspaces (${response.status})`)
        return
      }
      const data = await response.json()
      const allWorkspaces = [...(data.owned || []), ...(data.member || [])]
      setWorkspaces(allWorkspaces)
      // Auto-select first TEAM workspace
      const teamWorkspace = allWorkspaces.find((w: Workspace) => w.type === 'TEAM')
      if (teamWorkspace) {
        setSelectedWorkspace(teamWorkspace)
      } else if (allWorkspaces.length > 0) {
        setSelectedWorkspace(allWorkspaces[0])
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
      setError('Network error — could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.loading')}</p></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-red-600 dark:text-red-400">{error}</p></div>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Could not load workspaces</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button onClick={fetchWorkspaces} className="px-4 py-2 rounded border text-sm">Retry</button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.createWorkspace')}</p></div>
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('pages.collaboration.noWorkspaces')}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('pages.collaboration.noWorkspacesDesc')}</p>
            <CreateWorkspaceDialog onWorkspaceCreated={fetchWorkspaces} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const userRole = selectedWorkspace?.current_user_role || 'VIEWER'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('pages.collaboration.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('pages.collaboration.subtitle')}</p>
        </div>
      </div>

      {/* Workspace Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pages.collaboration.selectWorkspace')}</CardTitle>
              <CardDescription>{t('pages.collaboration.selectWorkspaceDesc')}</CardDescription>
            </div>
            <CreateWorkspaceDialog onWorkspaceCreated={fetchWorkspaces} />
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedWorkspace?.id || ''}
            onValueChange={(id) => setSelectedWorkspace(workspaces.find(w => w.id === id) || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('pages.collaboration.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center gap-2">
                    <span>{workspace.name}</span>
                    <Badge variant="outline" className="text-xs">{workspace.type}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedWorkspace && (
        <>
          {/* Stats Bar */}
          <WorkspaceStatsBar workspaceId={selectedWorkspace.id} onTabClick={setActiveTab} />

          {/* Tab Bar */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-0 -mb-px">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'entities' && <EntitiesTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'cops' && <CopSessionsTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'frameworks' && <FrameworksTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'tools' && <ToolsTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
          {activeTab === 'team' && <TeamTab workspaceId={selectedWorkspace.id} userRole={userRole} />}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CollaborationPage.tsx
git commit -m "feat(ui): rewrite CollaborationPage with tabbed workspace browser"
```

---

## Chunk 3: Frontend — Content Tab Components

### Task 13: Create `EntitiesTab.tsx`

**Files:**
- Create: `src/components/collaboration/EntitiesTab.tsx`

- [ ] **Step 1: Create the entities tab component**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getCopHeaders } from '@/lib/cop-auth'

interface EntitiesTabProps {
  workspaceId: string
  userRole: string
}

interface Entity {
  id: string
  entity_type: string
  name: string
  type: string
  category: string
  created_by: number
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  actor: 'border-l-blue-500',
  source: 'border-l-green-500',
  event: 'border-l-red-500',
  place: 'border-l-amber-500',
  behavior: 'border-l-purple-500',
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  actor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  source: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  event: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  place: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  behavior: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

const ENTITY_TYPES = ['actor', 'source', 'event', 'place', 'behavior'] as const

export function EntitiesTab({ workspaceId, userRole }: EntitiesTabProps) {
  const navigate = useNavigate()
  const [entities, setEntities] = useState<Entity[]>([])
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const canCreate = userRole !== 'VIEWER'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    fetchEntities()
  }, [workspaceId, typeFilter, search])

  const fetchEntities = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const params = new URLSearchParams()
      if (typeFilter) params.set('type', typeFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')

      const response = await fetch(`/api/workspaces/${workspaceId}/entities?${params}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setEntities(data.entities)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Failed to fetch entities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEntityClick = (entity: Entity) => {
    // Navigate to entity detail page based on type
    const typeRoutes: Record<string, string> = {
      actor: '/dashboard/entities/actors',
      source: '/dashboard/entities/sources',
      event: '/dashboard/entities/events',
      place: '/dashboard/entities/places',
      behavior: '/dashboard/entities/behaviors',
    }
    const route = typeRoutes[entity.entity_type]
    if (route) navigate(`${route}/${entity.id}?workspace_id=${workspaceId}`)
  }

  const handleNewEntity = (type: string) => {
    const typeRoutes: Record<string, string> = {
      actor: '/dashboard/entities/actors/new',
      source: '/dashboard/entities/sources/new',
      event: '/dashboard/entities/events/new',
      place: '/dashboard/entities/places/new',
      behavior: '/dashboard/entities/behaviors/new',
    }
    const route = typeRoutes[type]
    if (route) navigate(`${route}?workspace_id=${workspaceId}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter chips + Search + Create */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !typeFilter ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All{!typeFilter ? ` (${total})` : ''}
        </button>
        {ENTITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              typeFilter === type ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {type}s{typeFilter === type ? ` (${total})` : ''}
          </button>
        ))}

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search entities..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Entity</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ENTITY_TYPES.map((type) => (
                <DropdownMenuItem key={type} onClick={() => handleNewEntity(type)} className="capitalize">
                  {type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Entity Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading entities...</div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No entities in this workspace yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entities.map((entity) => (
            <button
              key={`${entity.entity_type}-${entity.id}`}
              onClick={() => handleEntityClick(entity)}
              className={`text-left p-4 rounded-lg border border-l-4 ${TYPE_COLORS[entity.entity_type] || 'border-l-gray-500'} bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
            >
              <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{entity.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`text-xs ${TYPE_BADGE_COLORS[entity.entity_type] || ''}`}>
                  {entity.type}
                </Badge>
                <span className="text-xs text-gray-500 capitalize">{entity.entity_type}</span>
              </div>
              {entity.category && (
                <div className="text-xs text-gray-500 mt-1">{entity.category}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/EntitiesTab.tsx
git commit -m "feat(ui): add EntitiesTab with type filter chips and card grid"
```

---

### Task 14: Create `CopSessionsTab.tsx`

**Files:**
- Create: `src/components/collaboration/CopSessionsTab.tsx`

- [ ] **Step 1: Create the COP sessions tab component**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Radio, Users, MapPin, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCopHeaders } from '@/lib/cop-auth'

interface CopSessionsTabProps {
  workspaceId: string
  userRole: string
}

interface CopSession {
  id: string
  name: string
  template_type: string
  status: string
  collaborator_count: number
  marker_count: number
  evidence_count: number
  time_window_start: string | null
  time_window_end: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

export function CopSessionsTab({ workspaceId, userRole }: CopSessionsTabProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<CopSession[]>([])
  const [loading, setLoading] = useState(true)

  const canCreate = userRole !== 'VIEWER'

  useEffect(() => {
    fetchSessions()
  }, [workspaceId])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch(`/api/workspaces/${workspaceId}/cop-sessions?limit=50`, { headers })
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
      }
    } catch (error) {
      console.error('Failed to fetch COP sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeWindow = (start: string | null, end: string | null) => {
    if (!start && !end) return null
    const s = start ? new Date(start).toLocaleDateString() : '?'
    const e = end ? new Date(end).toLocaleDateString() : 'ongoing'
    return `${s} — ${e}`
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/dashboard/cop?team_workspace_id=${workspaceId}`)}>
            <Plus className="h-4 w-4 mr-2" />New COP
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading COP sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Radio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No COP sessions are linked to this workspace yet.</p>
          <p className="text-sm text-gray-500 mt-1">Create a new COP or assign existing sessions from COP settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => navigate(`/dashboard/cop/${session.id}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 dark:text-white truncate flex-1">{session.name}</div>
                <Badge className={`ml-2 text-xs ${STATUS_COLORS[session.status] || ''}`}>{session.status}</Badge>
              </div>
              <Badge variant="outline" className="text-xs mb-3">{session.template_type}</Badge>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.collaborator_count}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.marker_count}</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{session.evidence_count}</span>
              </div>
              {formatTimeWindow(session.time_window_start, session.time_window_end) && (
                <div className="text-xs text-gray-500 mt-2">{formatTimeWindow(session.time_window_start, session.time_window_end)}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/CopSessionsTab.tsx
git commit -m "feat(ui): add CopSessionsTab with session cards and status badges"
```

---

### Task 15: Create `FrameworksTab.tsx`

**Files:**
- Create: `src/components/collaboration/FrameworksTab.tsx`

- [ ] **Step 1: Create the frameworks tab component**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCopHeaders } from '@/lib/cop-auth'

interface FrameworksTabProps {
  workspaceId: string
  userRole: string
}

interface Framework {
  id: number
  title: string
  framework_type: string
  status: string
  tags: string[]
  created_by_username: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
}

const FRAMEWORK_TYPES = ['ach', 'swot', 'pmesii', 'mom-pop', 'moses', 'cog'] as const

export function FrameworksTab({ workspaceId, userRole }: FrameworksTabProps) {
  const navigate = useNavigate()
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const canCreate = userRole !== 'VIEWER'

  useEffect(() => {
    fetchFrameworks()
  }, [workspaceId, typeFilter])

  const fetchFrameworks = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter) params.set('type', typeFilter)

      const response = await fetch(`/api/workspaces/${workspaceId}/frameworks?${params}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setFrameworks(data.frameworks)
      }
    } catch (error) {
      console.error('Failed to fetch frameworks:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !typeFilter ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {FRAMEWORK_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium uppercase transition-colors ${
              typeFilter === type ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {type}
          </button>
        ))}

        <div className="flex-1" />

        {canCreate && (
          <Button onClick={() => navigate(`/dashboard/frameworks/new?workspace_id=${workspaceId}`)}>
            <Plus className="h-4 w-4 mr-2" />New Framework
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading frameworks...</div>
      ) : frameworks.length === 0 ? (
        <div className="text-center py-12">
          <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No frameworks in this workspace yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {frameworks.map((fw) => (
            <button
              key={fw.id}
              onClick={() => navigate(`/dashboard/frameworks/${fw.id}?workspace_id=${workspaceId}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-gray-900 dark:text-white truncate flex-1">{fw.title}</div>
                <Badge className={`ml-2 text-xs ${STATUS_COLORS[fw.status] || ''}`}>{fw.status}</Badge>
              </div>
              <Badge variant="outline" className="text-xs uppercase mb-2">{fw.framework_type}</Badge>
              {fw.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {fw.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400">{tag}</span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {fw.created_by_username && <span>By {fw.created_by_username} · </span>}
                Updated {new Date(fw.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/FrameworksTab.tsx
git commit -m "feat(ui): add FrameworksTab with type filter chips"
```

---

### Task 16: Create `ToolsTab.tsx`

**Files:**
- Create: `src/components/collaboration/ToolsTab.tsx`

- [ ] **Step 1: Create the tools tab component**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Play, FileText, ListChecks, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCopHeaders } from '@/lib/cop-auth'

interface ToolsTabProps {
  workspaceId: string
  userRole: string
}

interface CopTemplate {
  id: string
  name: string
  description?: string
  cop_session_id: string
  cop_session_name: string
  created_at: string
}

// Hardcoded analysis tools — these are built into the app
const ANALYSIS_TOOLS = [
  { id: 'cross-table', name: 'Cross-Table Analysis', description: 'Compare entities across multiple dimensions', icon: '📊', route: '/dashboard/cross-table' },
  { id: 'ach', name: 'ACH (Analysis of Competing Hypotheses)', description: 'Evaluate hypotheses against evidence', icon: '🔬', route: '/dashboard/frameworks/new' },
  { id: 'swot', name: 'SWOT Analysis', description: 'Strengths, weaknesses, opportunities, threats', icon: '📋', route: '/dashboard/frameworks/new' },
  { id: 'pmesii', name: 'PMESII-PT', description: 'Political, military, economic, social, information, infrastructure', icon: '🌐', route: '/dashboard/frameworks/new' },
  { id: 'mom-pop', name: 'MOM-POP Assessment', description: 'Motive, opportunity, means — profile, operation, posture', icon: '🎯', route: '/dashboard/entities/actors' },
  { id: 'moses', name: 'MOSES Evaluation', description: 'Source vulnerability and reliability assessment', icon: '📡', route: '/dashboard/entities/sources' },
  { id: 'cog', name: 'COG Analysis', description: 'Center of gravity analysis', icon: '⚖️', route: '/dashboard/frameworks/new' },
]

export function ToolsTab({ workspaceId, userRole }: ToolsTabProps) {
  const navigate = useNavigate()
  const [playbooks, setPlaybooks] = useState<CopTemplate[]>([])
  const [taskTemplates, setTaskTemplates] = useState<CopTemplate[]>([])
  const [intakeForms, setIntakeForms] = useState<CopTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTools()
  }, [workspaceId])

  const fetchTools = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = { ...getCopHeaders() }
      const authToken = localStorage.getItem('auth_token')
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch(`/api/workspaces/${workspaceId}/tools`, { headers })
      if (response.ok) {
        const data = await response.json()
        setPlaybooks(data.playbooks || [])
        setTaskTemplates(data.task_templates || [])
        setIntakeForms(data.intake_forms || [])
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasTemplates = playbooks.length > 0 || taskTemplates.length > 0 || intakeForms.length > 0

  return (
    <div className="space-y-8">
      {/* Analysis Tools */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ANALYSIS_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => navigate(`${tool.route}?workspace_id=${workspaceId}`)}
              className="text-left p-4 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{tool.icon}</span>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{tool.name}</div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* COP Templates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">COP Templates</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading templates...</div>
        ) : !hasTemplates ? (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No COP templates in this workspace yet.</p>
            <p className="text-sm text-gray-500 mt-1">Create playbooks, task templates, or intake forms in a COP session.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {playbooks.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4" />Playbooks ({playbooks.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {playbooks.map((pb) => (
                    <button key={pb.id} onClick={() => navigate(`/dashboard/cop/${pb.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{pb.name}</div>
                      <div className="text-xs text-gray-500">From: {pb.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
            {taskTemplates.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" />Task Templates ({taskTemplates.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {taskTemplates.map((tt) => (
                    <button key={tt.id} onClick={() => navigate(`/dashboard/cop/${tt.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{tt.name}</div>
                      <div className="text-xs text-gray-500">From: {tt.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
            {intakeForms.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />Intake Forms ({intakeForms.length})</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {intakeForms.map((form) => (
                    <button key={form.id} onClick={() => navigate(`/dashboard/cop/${form.cop_session_id}`)} className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="font-medium text-sm">{form.name}</div>
                      <div className="text-xs text-gray-500">From: {form.cop_session_name}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/collaboration/ToolsTab.tsx
git commit -m "feat(ui): add ToolsTab with analysis launchers and COP templates"
```

---

## Chunk 4: Integration + Smoke Test

### Task 17: Verify build compiles

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run Vite build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 3: Fix any import/type errors**

If build fails, fix the specific errors (missing imports, type mismatches) and commit fixes.

---

### Task 18: Apply migration to local D1

- [ ] **Step 1: Apply migration**

Run: `npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/091-add-cop-team-workspace.sql`
Expected: Migration applied successfully

- [ ] **Step 2: Verify column exists**

Run: `npx wrangler d1 execute researchtoolspy-db --local --command="PRAGMA table_info(cop_sessions)" | grep team_workspace`
Expected: Shows `team_workspace_id` column

---

### Task 19: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `npx vite` (in one terminal)

- [ ] **Step 2: Navigate to `/dashboard/collaboration`**

Expected: Page loads with workspace selector, no errors in console.

- [ ] **Step 3: Select a workspace**

Expected: Stats bar appears with counts. Tab bar shows 5 tabs. Entities tab is active by default.

- [ ] **Step 4: Click through each tab**

Expected: Each tab renders its content or an empty state. No console errors.

- [ ] **Step 5: Verify Team tab**

Expected: Members and invites display exactly as before (extracted from old page).

---

### Task 20: Final commit — mark spec as implemented

- [ ] **Step 1: Update spec status**

In `docs/superpowers/specs/2026-03-14-collaboration-workspace-browser-design.md`, change:
```
**Status:** Draft
```
to:
```
**Status:** Implemented
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-03-14-collaboration-workspace-browser-design.md
git commit -m "docs: mark collaboration workspace browser spec as implemented"
```
