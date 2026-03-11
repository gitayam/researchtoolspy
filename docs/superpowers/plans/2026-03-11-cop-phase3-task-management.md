# COP Phase 3: Task Management Full Suite — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing task board with dependencies, subtasks, task templates, auto-assignment, and SLA tracking — transforming it from a simple kanban into a structured workflow engine.

**Architecture:** Extend existing `cop_tasks` table with new columns. Add `cop_task_dependencies` and `cop_task_templates` tables. Auto-assignment reads collaborator skills from extended `cop_collaborators`. SLA breach detection via Cloudflare Cron Trigger (15min interval). All mutations emit events via Phase 1 event system.

**Tech Stack:** Cloudflare Workers, D1, Cron Triggers, TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 3)

**Depends on:** Phase 1 (Event System)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/072-add-task-deps-subtasks.sql` | Create | Alter cop_tasks + cop_task_dependencies |
| `schema/migrations/073-add-task-templates.sql` | Create | cop_task_templates table |
| `schema/migrations/074-add-collaborator-skills.sql` | Create | Alter cop_collaborators |
| `schema/migrations/075-add-task-sla.sql` | Create | Alter cop_tasks for SLA |
| `src/types/cop.ts` | Modify | Update CopTask, add dependency/template types |
| `functions/api/cop/[id]/tasks.ts` | Modify | Add dependency checks, subtask logic, SLA |
| `functions/api/cop/[id]/task-dependencies.ts` | Create | CRUD dependencies |
| `functions/api/cop/[id]/task-templates.ts` | Create | CRUD templates |
| `functions/api/cop/[id]/tasks/deploy-template.ts` | Create | Instantiate template |
| `functions/api/cop/[id]/tasks/[taskId]/reassign.ts` | Create | Manual reassign |
| `functions/api/_shared/auto-assign.ts` | Create | Auto-assignment algorithm |
| `functions/api/_shared/sla-check.ts` | Create | SLA breach detection (cron handler) |
| `src/components/cop/CopTaskBoard.tsx` | Modify | Add dep arrows, subtasks, SLA badges |
| `src/components/cop/CopTaskTemplateEditor.tsx` | Create | Template builder UI |
| `src/components/cop/CopCollaboratorSkills.tsx` | Create | Skill/availability editor |
| `tests/e2e/smoke/cop-task-deps.spec.ts` | Create | E2E tests |

---

## Chunk 1: Dependencies & Subtasks Schema + Backend

### Task 1: Create dependencies migration

**Files:**
- Create: `schema/migrations/072-add-task-deps-subtasks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 072: Add task dependencies and subtask support
-- Dependencies block task transitions. Subtasks roll up to parent.

ALTER TABLE cop_tasks ADD COLUMN parent_task_id TEXT;
ALTER TABLE cop_tasks ADD COLUMN depth INTEGER DEFAULT 0;
ALTER TABLE cop_tasks ADD COLUMN position INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS cop_task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (depends_on_task_id) REFERENCES cop_tasks(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_task_deps_task ON cop_task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_depends ON cop_task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_cop_task_deps_session ON cop_task_dependencies(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_tasks_parent ON cop_tasks(parent_task_id);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/072-add-task-deps-subtasks.sql
git commit -m "feat(cop): add task dependencies and subtask columns (072)"
```

---

### Task 2: Create task dependencies endpoint

**Files:**
- Create: `functions/api/cop/[id]/task-dependencies.ts`

- [ ] **Step 1: Write the endpoint**

GET lists dependencies for a session. POST creates a dependency (with circular detection). DELETE removes one.

```typescript
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `dep-${crypto.randomUUID().slice(0, 12)}`
}

/**
 * Detect circular dependencies by walking the dependency graph.
 * Returns true if adding taskId -> dependsOnId would create a cycle.
 */
async function wouldCreateCycle(
  db: D1Database,
  sessionId: string,
  taskId: string,
  dependsOnId: string
): Promise<boolean> {
  // BFS from dependsOnId — if we reach taskId, it's circular
  const visited = new Set<string>()
  const queue = [dependsOnId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === taskId) return true
    if (visited.has(current)) continue
    visited.add(current)

    const deps = await db.prepare(
      'SELECT depends_on_task_id FROM cop_task_dependencies WHERE task_id = ? AND cop_session_id = ?'
    ).bind(current, sessionId).all()

    for (const row of (deps.results || [])) {
      queue.push((row as any).depends_on_task_id)
    }
  }

  return false
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const results = await env.DB.prepare(
      'SELECT * FROM cop_task_dependencies WHERE cop_session_id = ? ORDER BY created_at ASC'
    ).bind(sessionId).all()

    return new Response(JSON.stringify({ dependencies: results.results || [] }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Deps] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list dependencies' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.task_id || !body.depends_on_task_id) {
      return new Response(JSON.stringify({ error: 'task_id and depends_on_task_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.task_id === body.depends_on_task_id) {
      return new Response(JSON.stringify({ error: 'Task cannot depend on itself' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Check for circular dependency
    const circular = await wouldCreateCycle(env.DB, sessionId, body.task_id, body.depends_on_task_id)
    if (circular) {
      return new Response(JSON.stringify({ error: 'Would create circular dependency' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()

    await env.DB.prepare(`
      INSERT INTO cop_task_dependencies (id, task_id, depends_on_task_id, cop_session_id)
      VALUES (?, ?, ?, ?)
    `).bind(id, body.task_id, body.depends_on_task_id, sessionId).run()

    return new Response(JSON.stringify({ id, message: 'Dependency created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Task Deps] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create dependency' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const body = await request.json() as any

    if (!body.id) {
      return new Response(JSON.stringify({ error: 'Dependency ID required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    await env.DB.prepare(
      'DELETE FROM cop_task_dependencies WHERE id = ? AND cop_session_id = ?'
    ).bind(body.id, sessionId).run()

    return new Response(JSON.stringify({ message: 'Dependency removed' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Task Deps] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete dependency' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/task-dependencies.ts
git commit -m "feat(cop): add task dependencies endpoint with circular detection"
```

---

### Task 3: Update tasks endpoint for dependency checks and subtasks

**Files:**
- Modify: `functions/api/cop/[id]/tasks.ts`

- [ ] **Step 1: Add dependency check to status transitions in PUT handler**

Before allowing transition to `in_progress`, check all dependencies are met:

```typescript
    // Block transition to in_progress if dependencies unmet
    if (body.status === 'in_progress' && existing.status !== 'in_progress') {
      const unmetDeps = await env.DB.prepare(`
        SELECT d.depends_on_task_id, t.title, t.status
        FROM cop_task_dependencies d
        JOIN cop_tasks t ON t.id = d.depends_on_task_id
        WHERE d.task_id = ? AND t.status != 'done'
      `).bind(body.id).all()

      if ((unmetDeps.results || []).length > 0) {
        const blocking = (unmetDeps.results as any[]).map(r => r.title).join(', ')
        return new Response(JSON.stringify({
          error: `Cannot start: blocked by unfinished dependencies: ${blocking}`,
        }), { status: 400, headers: corsHeaders })
      }
    }
```

- [ ] **Step 2: Add subtask completion rollup**

After a task is marked `done`, check if its parent should auto-complete:

```typescript
    // After status change to 'done', check parent subtask rollup
    if (body.status === 'done' && existing.parent_task_id) {
      const siblings = await env.DB.prepare(
        'SELECT status FROM cop_tasks WHERE parent_task_id = ? AND id != ?'
      ).bind(existing.parent_task_id, body.id).all()

      const allDone = (siblings.results || []).every((s: any) => s.status === 'done')
      if (allDone) {
        await env.DB.prepare(
          'UPDATE cop_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?'
        ).bind('done', new Date().toISOString(), new Date().toISOString(), existing.parent_task_id).run()

        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: TASK_COMPLETED,
          entityType: 'task',
          entityId: existing.parent_task_id,
          payload: { reason: 'all_subtasks_completed' },
          createdBy: userId,
        })
      }
    }
```

- [ ] **Step 3: Add unblock check after completion**

After a task completes, check dependents and emit `task.unblocked`:

```typescript
    // Check if completing this task unblocks others
    if (body.status === 'done') {
      const dependents = await env.DB.prepare(
        'SELECT DISTINCT task_id FROM cop_task_dependencies WHERE depends_on_task_id = ? AND cop_session_id = ?'
      ).bind(body.id, sessionId).all()

      for (const dep of (dependents.results || []) as any[]) {
        const remaining = await env.DB.prepare(`
          SELECT COUNT(*) as cnt FROM cop_task_dependencies d
          JOIN cop_tasks t ON t.id = d.depends_on_task_id
          WHERE d.task_id = ? AND t.status != 'done'
        `).bind(dep.task_id).first() as any

        if (remaining?.cnt === 0) {
          await emitCopEvent(env.DB, {
            copSessionId: sessionId,
            eventType: 'task.unblocked' as any,
            entityType: 'task',
            entityId: dep.task_id,
            payload: { unblocked_by: body.id },
            createdBy: userId,
          })
        }
      }
    }
```

- [ ] **Step 4: Support parent_task_id and position in POST handler**

Add `parent_task_id`, `depth`, `position` to the INSERT statement. Validate depth <= 2.

- [ ] **Step 5: Commit**

```bash
git add functions/api/cop/[id]/tasks.ts
git commit -m "feat(cop): add dependency checks, subtask rollup, and unblock logic to tasks"
```

---

## Chunk 2: Task Templates

### Task 4: Create task templates migration

**Files:**
- Create: `schema/migrations/073-add-task-templates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 073: Add COP task templates for reusable workflow blueprints

CREATE TABLE IF NOT EXISTS cop_task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT DEFAULT 'universal',
  tasks_json TEXT DEFAULT '[]',

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cop_task_templates_type ON cop_task_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_cop_task_templates_workspace ON cop_task_templates(workspace_id);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/073-add-task-templates.sql
git commit -m "feat(cop): add cop_task_templates table (073)"
```

---

### Task 5: Create task templates CRUD endpoint

**Files:**
- Create: `functions/api/cop/[id]/task-templates.ts`

- [ ] **Step 1: Write GET/POST endpoint**

Standard CRUD following existing patterns. GET lists templates for the workspace. POST creates a new template with `tasks_json` validation (check all refs are unique, depends_on refs exist).

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/task-templates.ts
git commit -m "feat(cop): add task templates CRUD endpoint"
```

---

### Task 6: Create template deployment endpoint

**Files:**
- Create: `functions/api/cop/[id]/tasks/deploy-template.ts`

- [ ] **Step 1: Write the endpoint**

Accepts `{ template_id }`. Reads the template's `tasks_json`. For each task definition:
1. Generate real task ID
2. Map `ref` → real ID
3. Create task row (with parent_task_id for subtasks)
4. Create dependency rows using ref→ID mapping
5. Emit `task.created` for each

```typescript
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'
import { emitCopEvent } from '../../../_shared/cop-events'
import { TASK_CREATED } from '../../../_shared/cop-event-types'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateTaskId(): string {
  return `tsk-${crypto.randomUUID().slice(0, 12)}`
}

function generateDepId(): string {
  return `dep-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any

    if (!body.template_id) {
      return new Response(JSON.stringify({ error: 'template_id required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const template = await env.DB.prepare(
      'SELECT * FROM cop_task_templates WHERE id = ?'
    ).bind(body.template_id).first() as any

    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    let taskDefs: any[] = []
    try { taskDefs = JSON.parse(template.tasks_json) } catch { taskDefs = [] }

    // Phase 1: Create all tasks and build ref→ID map
    const refToId: Record<string, string> = {}
    const createdIds: string[] = []

    for (let i = 0; i < taskDefs.length; i++) {
      const def = taskDefs[i]
      const taskId = generateTaskId()
      refToId[def.ref] = taskId
      createdIds.push(taskId)

      await env.DB.prepare(`
        INSERT INTO cop_tasks (id, cop_session_id, title, description, task_type, priority, position, depth, created_by, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        taskId, sessionId, def.title, def.description || null,
        def.task_type || 'general', def.priority || 'medium',
        i, 0, userId, session.workspace_id
      ).run()

      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: TASK_CREATED,
        entityType: 'task',
        entityId: taskId,
        payload: { title: def.title, source: 'template', template_id: body.template_id },
        createdBy: userId,
      })

      // Create subtasks
      if (def.subtasks) {
        for (let j = 0; j < def.subtasks.length; j++) {
          const sub = def.subtasks[j]
          const subId = generateTaskId()
          refToId[sub.ref] = subId
          createdIds.push(subId)

          await env.DB.prepare(`
            INSERT INTO cop_tasks (id, cop_session_id, title, task_type, priority, parent_task_id, depth, position, created_by, workspace_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            subId, sessionId, sub.title, sub.task_type || 'general',
            sub.priority || def.priority || 'medium',
            taskId, 1, j, userId, session.workspace_id
          ).run()
        }
      }
    }

    // Phase 2: Create dependency rows
    for (const def of taskDefs) {
      if (def.depends_on) {
        for (const depRef of def.depends_on) {
          const fromId = refToId[def.ref]
          const toId = refToId[depRef]
          if (fromId && toId) {
            const depId = generateDepId()
            await env.DB.prepare(`
              INSERT INTO cop_task_dependencies (id, task_id, depends_on_task_id, cop_session_id)
              VALUES (?, ?, ?, ?)
            `).bind(depId, fromId, toId, sessionId).run()
          }
        }
      }
    }

    return new Response(JSON.stringify({
      message: 'Template deployed',
      tasks_created: createdIds.length,
      task_ids: createdIds,
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Deploy Template] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to deploy template' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/tasks/deploy-template.ts
git commit -m "feat(cop): add template deployment endpoint with ref→ID resolution"
```

---

## Chunk 3: Auto-Assignment & SLA

### Task 7: Create collaborator skills migration

**Files:**
- Create: `schema/migrations/074-add-collaborator-skills.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 074: Add skills and availability to collaborators for auto-assignment

ALTER TABLE cop_collaborators ADD COLUMN skills TEXT DEFAULT '[]';
ALTER TABLE cop_collaborators ADD COLUMN max_concurrent INTEGER DEFAULT 5;
ALTER TABLE cop_collaborators ADD COLUMN timezone TEXT;
ALTER TABLE cop_collaborators ADD COLUMN availability TEXT DEFAULT 'available';
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/074-add-collaborator-skills.sql
git commit -m "feat(cop): add collaborator skills and availability columns (074)"
```

---

### Task 8: Create SLA migration

**Files:**
- Create: `schema/migrations/075-add-task-sla.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 075: Add SLA tracking to tasks

ALTER TABLE cop_tasks ADD COLUMN sla_hours INTEGER;
ALTER TABLE cop_tasks ADD COLUMN sla_started_at TEXT;
ALTER TABLE cop_tasks ADD COLUMN sla_breached INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cop_tasks_sla ON cop_tasks(sla_breached, sla_started_at);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/075-add-task-sla.sql
git commit -m "feat(cop): add SLA tracking columns to cop_tasks (075)"
```

---

### Task 9: Create auto-assignment helper

**Files:**
- Create: `functions/api/_shared/auto-assign.ts`

- [ ] **Step 1: Write the algorithm**

```typescript
import { emitCopEvent } from './cop-events'
import { TASK_ASSIGNED, TASK_UNASSIGNABLE } from './cop-event-types'

interface AssignmentResult {
  assigned: boolean
  assignee?: string
}

/**
 * Auto-assign a task to the least-loaded collaborator with matching skills.
 * Returns { assigned: true, assignee } or { assigned: false }.
 */
export async function autoAssignTask(
  db: D1Database,
  sessionId: string,
  taskId: string,
  taskType: string,
  userId: number
): Promise<AssignmentResult> {
  // Get eligible collaborators with matching skills
  const collabs = await db.prepare(`
    SELECT c.id, c.email, c.skills, c.max_concurrent, c.availability
    FROM cop_collaborators c
    WHERE c.cop_session_id = ? AND c.availability != 'offline'
  `).bind(sessionId).all()

  const eligible = (collabs.results || []).filter((c: any) => {
    let skills: string[] = []
    try { skills = JSON.parse(c.skills || '[]') } catch { skills = [] }
    return skills.includes(taskType) || skills.includes('general')
  })

  if (eligible.length === 0) {
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: TASK_UNASSIGNABLE,
      entityType: 'task',
      entityId: taskId,
      payload: { task_type: taskType, reason: 'no_eligible_collaborators' },
      createdBy: userId,
    })
    return { assigned: false }
  }

  // Count current open tasks per collaborator
  const loadPromises = eligible.map(async (c: any) => {
    const count = await db.prepare(
      "SELECT COUNT(*) as cnt FROM cop_tasks WHERE cop_session_id = ? AND assigned_to = ? AND status IN ('todo', 'in_progress')"
    ).bind(sessionId, c.email).first() as any
    return { ...c, current_load: count?.cnt || 0 }
  })

  const withLoad = await Promise.all(loadPromises)

  // Filter by max_concurrent and sort by load
  const available = withLoad
    .filter((c: any) => c.current_load < (c.max_concurrent || 5))
    .sort((a: any, b: any) => a.current_load - b.current_load)

  if (available.length === 0) {
    await emitCopEvent(db, {
      copSessionId: sessionId,
      eventType: TASK_UNASSIGNABLE,
      entityType: 'task',
      entityId: taskId,
      payload: { task_type: taskType, reason: 'all_at_capacity' },
      createdBy: userId,
    })
    return { assigned: false }
  }

  const assignee = available[0].email

  await db.prepare(
    'UPDATE cop_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?'
  ).bind(assignee, new Date().toISOString(), taskId).run()

  await emitCopEvent(db, {
    copSessionId: sessionId,
    eventType: TASK_ASSIGNED,
    entityType: 'task',
    entityId: taskId,
    payload: { assigned_to: assignee, strategy: 'least_loaded' },
    createdBy: userId,
  })

  return { assigned: true, assignee }
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/auto-assign.ts
git commit -m "feat(cop): add auto-assignment algorithm with least-loaded strategy"
```

---

### Task 10: Create SLA breach checker (Cron handler)

**Files:**
- Create: `functions/api/_shared/sla-check.ts`

- [ ] **Step 1: Write the cron handler**

```typescript
import { emitCopEvent } from './cop-events'
import { TASK_OVERDUE, RFI_OVERDUE } from './cop-event-types'

/**
 * Check for SLA breaches across all active COP sessions.
 * Called by Cloudflare Cron Trigger every 15 minutes.
 */
export async function checkSlaBreaches(db: D1Database): Promise<{ tasks_breached: number; rfis_breached: number }> {
  const now = new Date().toISOString()
  let tasksBreach = 0
  let rfisBreach = 0

  // Check tasks
  const overdueTasks = await db.prepare(`
    SELECT id, cop_session_id, title, assigned_to, sla_hours, sla_started_at
    FROM cop_tasks
    WHERE sla_breached = 0
      AND sla_started_at IS NOT NULL
      AND sla_hours IS NOT NULL
      AND status IN ('todo', 'in_progress')
      AND datetime(sla_started_at, '+' || sla_hours || ' hours') < datetime('now')
  `).all()

  for (const task of (overdueTasks.results || []) as any[]) {
    await db.prepare(
      'UPDATE cop_tasks SET sla_breached = 1, updated_at = ? WHERE id = ?'
    ).bind(now, task.id).run()

    await emitCopEvent(db, {
      copSessionId: task.cop_session_id,
      eventType: TASK_OVERDUE,
      entityType: 'task',
      entityId: task.id,
      payload: {
        title: task.title,
        assigned_to: task.assigned_to,
        sla_hours: task.sla_hours,
        started_at: task.sla_started_at,
      },
      createdBy: 0, // System
    })

    tasksBreach++
  }

  return { tasks_breached: tasksBreach, rfis_breached: rfisBreach }
}
```

Note: This needs to be wired into `wrangler.toml` as a cron trigger. Add:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

And create a `functions/_scheduled.ts` handler that calls `checkSlaBreaches`.

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/sla-check.ts
git commit -m "feat(cop): add SLA breach checker for cron trigger"
```

---

## Chunk 4: Frontend Updates

### Task 11: Update CopTaskBoard for dependencies and subtasks

**Files:**
- Modify: `src/components/cop/CopTaskBoard.tsx`

- [ ] **Step 1: Add dependency and subtask data fetching**

Add a new `useEffect` to fetch dependencies alongside tasks. Group tasks by parent_task_id for subtask rendering.

- [ ] **Step 2: Add SLA countdown badges**

For tasks with `sla_started_at` and `sla_hours`, compute remaining time and show a badge:
- Green: >50% time remaining
- Yellow: 10-50% remaining
- Red: <10% or breached

- [ ] **Step 3: Add subtask expansion**

Under each parent task card, show a collapsible subtask list with progress indicator ("3/5 done").

- [ ] **Step 4: Add dependency indicators**

Show a lock icon on tasks with unmet dependencies. Tooltip lists blocking tasks.

- [ ] **Step 5: Commit**

```bash
git add src/components/cop/CopTaskBoard.tsx
git commit -m "feat(cop): add dependency indicators, subtasks, and SLA badges to task board"
```

---

### Task 12: Create collaborator skills editor

**Files:**
- Create: `src/components/cop/CopCollaboratorSkills.tsx`

- [ ] **Step 1: Write the component**

Small dialog or panel that extends the existing invite dialog. Shows each collaborator with:
- Skill tag selector (multi-select from task types)
- Max concurrent slider
- Availability toggle (available/busy/offline)
- Timezone selector

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopCollaboratorSkills.tsx
git commit -m "feat(cop): add CopCollaboratorSkills editor component"
```

---

## Chunk 5: Tests

### Task 13: Write E2E tests

**Files:**
- Create: `tests/e2e/smoke/cop-task-deps.spec.ts`

- [ ] **Step 1: Write tests**

Cover:
- Dependency creation blocks status transition
- Completing a dependency unblocks dependent task
- Circular dependency rejected
- Template deployment creates correct task count
- Subtask completion rolls up to parent
- SLA badge displays for timed tasks

- [ ] **Step 2: Run tests and commit**

```bash
git add tests/e2e/smoke/cop-task-deps.spec.ts
git commit -m "test(cop): add E2E tests for task dependencies, templates, and SLA"
```

---

## Summary

| Task | What |
|---|---|
| 1 | Dependencies + subtasks migration (072) |
| 2 | Task dependencies CRUD endpoint |
| 3 | Dependency checks + subtask rollup in tasks.ts |
| 4 | Task templates migration (073) |
| 5 | Task templates CRUD endpoint |
| 6 | Template deployment endpoint |
| 7 | Collaborator skills migration (074) |
| 8 | SLA migration (075) |
| 9 | Auto-assignment algorithm |
| 10 | SLA breach cron checker |
| 11 | TaskBoard UI updates |
| 12 | Collaborator skills editor UI |
| 13 | E2E tests |
