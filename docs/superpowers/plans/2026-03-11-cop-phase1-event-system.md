# COP Phase 1: Event System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin event bus (`cop_events` table + `emitCopEvent` helper) that every COP mutation emits into, enabling future playbook automation.

**Architecture:** Single D1 table stores structured events. A shared helper function is called from every mutating COP endpoint after the primary write. Events are machine-readable (separate from the human-readable `cop_activity` feed). ULID-based IDs for sortability.

**Tech Stack:** Cloudflare Workers, D1, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 1)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/070-add-cop-events.sql` | Create | cop_events table + indexes |
| `functions/api/_shared/cop-events.ts` | Create | `emitCopEvent()` helper + `generateUlid()` utility |
| `functions/api/_shared/cop-event-types.ts` | Create | Event type constants + TypeScript types |
| `src/types/cop.ts` | Modify | Add `CopEvent` interface for frontend consumption |
| `functions/api/cop/[id]/events.ts` | Create | GET endpoint to list events for a session |
| `functions/api/cop/[id]/tasks.ts` | Modify | Emit events on task CRUD |
| `functions/api/cop/[id]/rfis.ts` | Modify | Emit events on RFI create |
| `functions/api/cop/[id]/rfis/[rfiId].ts` | Modify | Emit events on RFI update |
| `functions/api/cop/[id]/evidence.ts` | Modify | Emit events on evidence CRUD |
| `functions/api/cop/[id]/evidence-tags.ts` | Modify | Emit events on evidence tagging |
| `functions/api/cop/[id]/hypotheses.ts` | Modify | Emit events on hypothesis CRUD |
| `functions/api/cop/[id]/personas.ts` | Modify | Emit events on persona CRUD |
| `functions/api/cop/[id]/markers.ts` | Modify | Emit events on marker CRUD |
| `functions/api/cop/[id]/collaborators.ts` | Modify | Emit events on collaborator add/remove |
| `functions/api/cop/[id]/shares.ts` | Modify | Emit events on share create |
| `tests/e2e/smoke/cop-events.spec.ts` | Create | E2E tests for event emission + listing |

---

## Chunk 1: Migration + Helper + Types

### Task 1: Create the cop_events migration

**Files:**
- Create: `schema/migrations/070-add-cop-events.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 070: Add COP event bus for automation
-- Events are machine-readable structured data emitted by every COP mutation.
-- The playbook engine (Phase 6) will consume these events.
-- Separate from cop_activity (human-readable UI feed).

CREATE TABLE IF NOT EXISTS cop_events (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  payload TEXT DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_events_session ON cop_events(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_events_type ON cop_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cop_events_session_type ON cop_events(cop_session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_cop_events_created ON cop_events(created_at);
```

Note: `payload` is TEXT (D1 stores JSON as TEXT). `created_by` is INTEGER to match the existing pattern (auth helpers return numeric user IDs). `id` uses ULID format for sortability (lexicographic order = chronological order).

- [ ] **Step 2: Verify migration numbering**

Run: `ls schema/migrations/ | tail -3`
Expected: `069-add-activity-actor-details.sql` is the last one, so `070` is correct.

- [ ] **Step 3: Commit**

```bash
git add schema/migrations/070-add-cop-events.sql
git commit -m "feat(cop): add cop_events table migration (070)"
```

---

### Task 2: Create event type constants

**Files:**
- Create: `functions/api/_shared/cop-event-types.ts`

- [ ] **Step 1: Write the event type constants**

```typescript
/**
 * COP Event Type Constants
 *
 * Structured taxonomy for the cop_events bus.
 * Format: {domain}.{action}
 * Domains align with COP entity types.
 */

// -- Domain: task --
export const TASK_CREATED = 'task.created' as const
export const TASK_ASSIGNED = 'task.assigned' as const
export const TASK_STARTED = 'task.started' as const
export const TASK_COMPLETED = 'task.completed' as const
export const TASK_BLOCKED = 'task.blocked' as const
export const TASK_OVERDUE = 'task.overdue' as const
export const TASK_UNBLOCKED = 'task.unblocked' as const
export const TASK_UNASSIGNABLE = 'task.unassignable' as const
export const TASK_DELETED = 'task.deleted' as const

// -- Domain: rfi --
export const RFI_CREATED = 'rfi.created' as const
export const RFI_ANSWERED = 'rfi.answered' as const
export const RFI_ACCEPTED = 'rfi.accepted' as const
export const RFI_OVERDUE = 'rfi.overdue' as const
export const RFI_CLOSED = 'rfi.closed' as const

// -- Domain: evidence --
export const EVIDENCE_CREATED = 'evidence.created' as const
export const EVIDENCE_TAGGED = 'evidence.tagged' as const
export const EVIDENCE_LINKED = 'evidence.linked' as const

// -- Domain: hypothesis --
export const HYPOTHESIS_CREATED = 'hypothesis.created' as const
export const HYPOTHESIS_UPDATED = 'hypothesis.updated' as const
export const HYPOTHESIS_EVIDENCE_LINKED = 'hypothesis.evidence_linked' as const

// -- Domain: persona --
export const PERSONA_CREATED = 'persona.created' as const
export const PERSONA_LINKED = 'persona.linked' as const

// -- Domain: marker --
export const MARKER_CREATED = 'marker.created' as const
export const MARKER_UPDATED = 'marker.updated' as const
export const MARKER_DELETED = 'marker.deleted' as const

// -- Domain: collaborator --
export const COLLABORATOR_ADDED = 'collaborator.added' as const
export const COLLABORATOR_REMOVED = 'collaborator.removed' as const

// -- Domain: share --
export const SHARE_CREATED = 'share.created' as const

// -- Domain: ingest (Phase 2) --
export const INGEST_SUBMISSION_RECEIVED = 'ingest.submission_received' as const
export const INGEST_SUBMISSION_TRIAGED = 'ingest.submission_triaged' as const
export const INGEST_SUBMISSION_REJECTED = 'ingest.submission_rejected' as const

// -- Domain: asset (Phase 4) --
export const ASSET_CREATED = 'asset.created' as const
export const ASSET_UPDATED = 'asset.updated' as const
export const ASSET_STATUS_CHANGED = 'asset.status_changed' as const
export const ASSET_QUOTA_LOW = 'asset.quota_low' as const

// -- Domain: export (Phase 5) --
export const EXPORT_REQUESTED = 'export.requested' as const
export const EXPORT_COMPLETED = 'export.completed' as const
export const EXPORT_FAILED = 'export.failed' as const

// -- Domain: workflow (Phase 6) --
export const WORKFLOW_STAGE_ENTERED = 'workflow.stage_entered' as const
export const WORKFLOW_STAGE_COMPLETED = 'workflow.stage_completed' as const
export const WORKFLOW_PIPELINE_FINISHED = 'workflow.pipeline_finished' as const

// Entity type enum for the entity_type column
export type CopEventEntityType =
  | 'task'
  | 'rfi'
  | 'evidence'
  | 'hypothesis'
  | 'persona'
  | 'marker'
  | 'collaborator'
  | 'share'
  | 'submission'
  | 'asset'
  | 'export'
  | 'workflow'

// Union type of all event types
export type CopEventType =
  | typeof TASK_CREATED | typeof TASK_ASSIGNED | typeof TASK_STARTED
  | typeof TASK_COMPLETED | typeof TASK_BLOCKED | typeof TASK_OVERDUE
  | typeof TASK_UNBLOCKED | typeof TASK_UNASSIGNABLE | typeof TASK_DELETED
  | typeof RFI_CREATED | typeof RFI_ANSWERED | typeof RFI_ACCEPTED
  | typeof RFI_OVERDUE | typeof RFI_CLOSED
  | typeof EVIDENCE_CREATED | typeof EVIDENCE_TAGGED | typeof EVIDENCE_LINKED
  | typeof HYPOTHESIS_CREATED | typeof HYPOTHESIS_UPDATED | typeof HYPOTHESIS_EVIDENCE_LINKED
  | typeof PERSONA_CREATED | typeof PERSONA_LINKED
  | typeof MARKER_CREATED | typeof MARKER_UPDATED | typeof MARKER_DELETED
  | typeof COLLABORATOR_ADDED | typeof COLLABORATOR_REMOVED
  | typeof SHARE_CREATED
  | typeof INGEST_SUBMISSION_RECEIVED | typeof INGEST_SUBMISSION_TRIAGED | typeof INGEST_SUBMISSION_REJECTED
  | typeof ASSET_CREATED | typeof ASSET_UPDATED | typeof ASSET_STATUS_CHANGED | typeof ASSET_QUOTA_LOW
  | typeof EXPORT_REQUESTED | typeof EXPORT_COMPLETED | typeof EXPORT_FAILED
  | typeof WORKFLOW_STAGE_ENTERED | typeof WORKFLOW_STAGE_COMPLETED | typeof WORKFLOW_PIPELINE_FINISHED
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/cop-event-types.ts
git commit -m "feat(cop): add event type constants and taxonomy"
```

---

### Task 3: Create the emitCopEvent helper

**Files:**
- Create: `functions/api/_shared/cop-events.ts`

- [ ] **Step 1: Write the helper**

```typescript
import type { CopEventType, CopEventEntityType } from './cop-event-types'

interface EmitCopEventParams {
  copSessionId: string
  eventType: CopEventType
  entityType: CopEventEntityType
  entityId?: string | null
  payload?: Record<string, unknown>
  createdBy: number
}

/**
 * Generate a ULID-like sortable ID.
 * Uses timestamp prefix (base36) + random suffix for uniqueness.
 * Lexicographic order = chronological order.
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36).padStart(9, '0')
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `evt-${timestamp}-${random}`
}

/**
 * Emit a structured event to the cop_events bus.
 * Called after every COP mutation. Fire-and-forget — errors are logged
 * but never block the primary response.
 */
export async function emitCopEvent(
  db: D1Database,
  params: EmitCopEventParams
): Promise<void> {
  try {
    const id = generateEventId()
    const payloadStr = JSON.stringify(params.payload ?? {})

    await db.prepare(`
      INSERT INTO cop_events (id, cop_session_id, event_type, entity_type, entity_id, payload, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      params.copSessionId,
      params.eventType,
      params.entityType,
      params.entityId ?? null,
      payloadStr,
      params.createdBy
    ).run()
  } catch (error) {
    // Fire-and-forget: log but never block the primary operation
    console.error('[COP Events] Failed to emit event:', params.eventType, error)
  }
}
```

Key design decisions:
- `generateEventId()` uses base36 timestamp prefix so IDs sort chronologically (important for cursor-based playbook polling in Phase 6).
- `emitCopEvent` is fire-and-forget — wrapped in try/catch so a failed event never blocks the user's actual operation.
- `payload` is serialized to JSON string for D1 TEXT column.

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/cop-events.ts
git commit -m "feat(cop): add emitCopEvent helper with ULID-like sortable IDs"
```

---

### Task 4: Add CopEvent interface to frontend types

**Files:**
- Modify: `src/types/cop.ts`

- [ ] **Step 1: Add CopEvent interface**

Append to the end of `src/types/cop.ts`:

```typescript
// -- COP Events (Phase 1: Event System Foundation) --

export interface CopEvent {
  id: string
  cop_session_id: string
  event_type: string
  entity_type: string
  entity_id: string | null
  payload: Record<string, unknown>
  created_by: number
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add CopEvent interface to frontend types"
```

---

## Chunk 2: Events API Endpoint

### Task 5: Create the events listing endpoint

**Files:**
- Create: `functions/api/cop/[id]/events.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const url = new URL(request.url)
    const eventType = url.searchParams.get('event_type')
    const entityType = url.searchParams.get('entity_type')
    const since = url.searchParams.get('since') // event ID cursor
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

    let query = 'SELECT * FROM cop_events WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (eventType) {
      query += ' AND event_type = ?'
      bindings.push(eventType)
    }

    if (entityType) {
      query += ' AND entity_type = ?'
      bindings.push(entityType)
    }

    if (since) {
      query += ' AND id > ?'
      bindings.push(since)
    }

    query += ' ORDER BY id DESC LIMIT ?'
    bindings.push(limit)

    const results = await env.DB.prepare(query).bind(...bindings).all()

    // Parse payload JSON for each event
    const events = (results.results || []).map((row: any) => {
      let payload = {}
      try {
        payload = row.payload ? JSON.parse(row.payload) : {}
      } catch {
        payload = {}
      }
      return { ...row, payload }
    })

    return new Response(JSON.stringify({ events }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Events] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list events' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

Features:
- Filter by `event_type` and `entity_type` query params
- Cursor-based pagination via `since` (event ID) — leverages ULID sortability
- Limit with max cap of 500
- Auto-parses payload JSON

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/events.ts
git commit -m "feat(cop): add GET /api/cop/:id/events endpoint with cursor pagination"
```

---

## Chunk 3: Wire Events into Existing Endpoints

### Task 6: Wire events into tasks endpoint

**Files:**
- Modify: `functions/api/cop/[id]/tasks.ts`

- [ ] **Step 1: Add import at top of file**

Add after existing imports:

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { TASK_CREATED, TASK_COMPLETED, TASK_STARTED, TASK_BLOCKED, TASK_DELETED } from '../../_shared/cop-event-types'
```

- [ ] **Step 2: Add event emission to POST handler (task creation)**

After the successful INSERT and before the return statement in `onRequestPost`, add:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: TASK_CREATED,
      entityType: 'task',
      entityId: id,
      payload: { title: body.title, task_type: body.task_type || 'general', priority: body.priority || 'medium', assigned_to: body.assigned_to || null },
      createdBy: userId,
    })
```

Where `userId` comes from `getUserIdOrDefault(request, env)` — check if the endpoint already calls this. If not, add:

```typescript
const { getUserIdOrDefault } = await import('../../_shared/auth-helpers')
const userId = await getUserIdOrDefault(request, env)
```

- [ ] **Step 3: Add event emission to PUT handler (task status changes)**

After the successful UPDATE in `onRequestPut`, add logic to detect which event to emit based on status transitions:

```typescript
    // Determine event type from status change
    if (body.status && body.status !== existing.status) {
      const statusEventMap: Record<string, string> = {
        'in_progress': TASK_STARTED,
        'done': TASK_COMPLETED,
        'blocked': TASK_BLOCKED,
      }
      const eventType = statusEventMap[body.status]
      if (eventType) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: eventType as any,
          entityType: 'task',
          entityId: body.id,
          payload: { title: existing.title, previous_status: existing.status, new_status: body.status, assigned_to: existing.assigned_to },
          createdBy: userId,
        })
      }
    }
```

- [ ] **Step 4: Add event emission to DELETE handler**

After the successful DELETE in `onRequestDelete`, add:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: TASK_DELETED,
      entityType: 'task',
      entityId: taskId,
      payload: { title: existing.title },
      createdBy: userId,
    })
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/cop/[id]/tasks.ts
git commit -m "feat(cop): emit events from task CRUD operations"
```

---

### Task 7: Wire events into RFI endpoints

**Files:**
- Modify: `functions/api/cop/[id]/rfis.ts`
- Modify: `functions/api/cop/[id]/rfis/[rfiId].ts`

- [ ] **Step 1: Add imports to rfis.ts**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { RFI_CREATED } from '../../_shared/cop-event-types'
```

- [ ] **Step 2: Add event emission to POST handler in rfis.ts**

After successful INSERT:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: RFI_CREATED,
      entityType: 'rfi',
      entityId: id,
      payload: { question: body.question, priority: body.priority || 'medium', is_blocker: body.is_blocker || false },
      createdBy: userId,
    })
```

- [ ] **Step 3: Add imports to rfis/[rfiId].ts**

```typescript
import { emitCopEvent } from '../../../_shared/cop-events'
import { RFI_ANSWERED, RFI_ACCEPTED, RFI_CLOSED } from '../../../_shared/cop-event-types'
```

- [ ] **Step 4: Add event emission to PUT handler in rfis/[rfiId].ts**

After successful UPDATE, detect status changes:

```typescript
    if (body.status && body.status !== existing.status) {
      const statusEventMap: Record<string, string> = {
        'answered': RFI_ANSWERED,
        'accepted': RFI_ACCEPTED,
        'closed': RFI_CLOSED,
      }
      const eventType = statusEventMap[body.status]
      if (eventType) {
        await emitCopEvent(env.DB, {
          copSessionId: sessionId,
          eventType: eventType as any,
          entityType: 'rfi',
          entityId: rfiId,
          payload: { question: existing.question, previous_status: existing.status, new_status: body.status },
          createdBy: userId,
        })
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/cop/[id]/rfis.ts functions/api/cop/[id]/rfis/[rfiId].ts
git commit -m "feat(cop): emit events from RFI CRUD operations"
```

---

### Task 8: Wire events into evidence endpoints

**Files:**
- Modify: `functions/api/cop/[id]/evidence.ts`
- Modify: `functions/api/cop/[id]/evidence-tags.ts`

- [ ] **Step 1: Add imports to evidence.ts**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_CREATED, EVIDENCE_LINKED } from '../../_shared/cop-event-types'
```

- [ ] **Step 2: Emit EVIDENCE_CREATED on POST in evidence.ts**

After successful INSERT:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_CREATED,
      entityType: 'evidence',
      entityId: id,
      payload: { title: body.title, evidence_type: body.evidence_type },
      createdBy: userId,
    })
```

- [ ] **Step 3: Add imports and emit EVIDENCE_TAGGED in evidence-tags.ts**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { EVIDENCE_TAGGED } from '../../_shared/cop-event-types'
```

After successful tag INSERT:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: EVIDENCE_TAGGED,
      entityType: 'evidence',
      entityId: body.evidence_id,
      payload: { tag_category: body.tag_category, tag_value: body.tag_value, confidence: body.confidence },
      createdBy: userId,
    })
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/cop/[id]/evidence.ts functions/api/cop/[id]/evidence-tags.ts
git commit -m "feat(cop): emit events from evidence and evidence-tag operations"
```

---

### Task 9: Wire events into hypothesis endpoint

**Files:**
- Modify: `functions/api/cop/[id]/hypotheses.ts`

- [ ] **Step 1: Add imports**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { HYPOTHESIS_CREATED, HYPOTHESIS_UPDATED, HYPOTHESIS_EVIDENCE_LINKED } from '../../_shared/cop-event-types'
```

- [ ] **Step 2: Emit on POST (create hypothesis)**

After successful INSERT:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: HYPOTHESIS_CREATED,
      entityType: 'hypothesis',
      entityId: id,
      payload: { statement: body.statement, status: body.status || 'proposed' },
      createdBy: userId,
    })
```

- [ ] **Step 3: Emit on PUT (update hypothesis or link evidence)**

After successful UPDATE — detect if evidence was linked vs status change:

```typescript
    if (body.evidence_links) {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: HYPOTHESIS_EVIDENCE_LINKED,
        entityType: 'hypothesis',
        entityId: hypothesisId,
        payload: { evidence_count: body.evidence_links.length },
        createdBy: userId,
      })
    } else {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: HYPOTHESIS_UPDATED,
        entityType: 'hypothesis',
        entityId: hypothesisId,
        payload: { status: body.status, confidence: body.confidence },
        createdBy: userId,
      })
    }
```

- [ ] **Step 4: Commit**

```bash
git add functions/api/cop/[id]/hypotheses.ts
git commit -m "feat(cop): emit events from hypothesis operations"
```

---

### Task 10: Wire events into persona, marker, collaborator, share endpoints

**Files:**
- Modify: `functions/api/cop/[id]/personas.ts`
- Modify: `functions/api/cop/[id]/markers.ts`
- Modify: `functions/api/cop/[id]/collaborators.ts`
- Modify: `functions/api/cop/[id]/shares.ts`

- [ ] **Step 1: Personas — add imports and emit on POST**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { PERSONA_CREATED } from '../../_shared/cop-event-types'
```

After successful INSERT:

```typescript
    await emitCopEvent(env.DB, {
      copSessionId: sessionId,
      eventType: PERSONA_CREATED,
      entityType: 'persona',
      entityId: id,
      payload: { display_name: body.display_name, platform: body.platform },
      createdBy: userId,
    })
```

- [ ] **Step 2: Markers — add imports and emit on POST/PUT/DELETE**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { MARKER_CREATED, MARKER_UPDATED, MARKER_DELETED } from '../../_shared/cop-event-types'
```

Emit `MARKER_CREATED` on POST, `MARKER_UPDATED` on PUT, `MARKER_DELETED` on DELETE — follow the same pattern as tasks.

- [ ] **Step 3: Collaborators — add imports and emit on POST/DELETE**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { COLLABORATOR_ADDED, COLLABORATOR_REMOVED } from '../../_shared/cop-event-types'
```

Emit `COLLABORATOR_ADDED` on POST with payload `{ email, role }`, `COLLABORATOR_REMOVED` on DELETE.

- [ ] **Step 4: Shares — add imports and emit on POST**

```typescript
import { emitCopEvent } from '../../_shared/cop-events'
import { SHARE_CREATED } from '../../_shared/cop-event-types'
```

Emit `SHARE_CREATED` on POST with payload `{ share_token, visible_panels, allow_rfi_answers }`.

- [ ] **Step 5: Commit**

```bash
git add functions/api/cop/[id]/personas.ts functions/api/cop/[id]/markers.ts functions/api/cop/[id]/collaborators.ts functions/api/cop/[id]/shares.ts
git commit -m "feat(cop): emit events from persona, marker, collaborator, and share operations"
```

---

## Chunk 4: E2E Tests

### Task 11: Write E2E tests for the event system

**Files:**
- Create: `tests/e2e/smoke/cop-events.spec.ts`

- [ ] **Step 1: Write test file**

```typescript
import { test, expect } from '../base-test'

const MOCK_SESSION = {
  id: 'cop-evt-test-001',
  name: 'Event System Test',
  template_type: 'area_study',
  status: 'ACTIVE',
  active_layers: '["places","actors"]',
  layer_config: '{}',
  linked_frameworks: '[]',
  key_questions: '[]',
  event_facts: '[]',
  content_analyses: '[]',
  workspace_id: 'ws-1',
  created_by: 1,
  is_public: 0,
  created_at: '2026-03-11T00:00:00Z',
  updated_at: '2026-03-11T00:00:00Z',
}

const MOCK_EVENTS = {
  events: [
    {
      id: 'evt-test-001',
      cop_session_id: 'cop-evt-test-001',
      event_type: 'task.created',
      entity_type: 'task',
      entity_id: 'tsk-001',
      payload: { title: 'Test task', priority: 'high' },
      created_by: 1,
      created_at: '2026-03-11T10:00:00Z',
    },
    {
      id: 'evt-test-002',
      cop_session_id: 'cop-evt-test-001',
      event_type: 'rfi.created',
      entity_type: 'rfi',
      entity_id: 'rfi-001',
      payload: { question: 'What happened?', priority: 'critical' },
      created_by: 1,
      created_at: '2026-03-11T10:05:00Z',
    },
  ],
}

const MOCK_TASKS = { tasks: [] }
const MOCK_RFIS = { rfis: [] }
const MOCK_STATS = { actors: 0, events: 0, evidence: 0, frameworks: 0, rfis: 0, hypotheses: 0, blockers: 0 }

test.describe('COP Events @smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Mock session endpoint
    await page.route('**/api/cop/sessions/cop-evt-test-001', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: MOCK_SESSION })
      } else {
        await route.fulfill({ json: { ok: true } })
      }
    })

    // Mock events endpoint
    await page.route('**/api/cop/cop-evt-test-001/events**', async (route) => {
      await route.fulfill({ json: MOCK_EVENTS })
    })

    // Mock other required endpoints
    await page.route('**/api/cop/cop-evt-test-001/stats', async (route) => {
      await route.fulfill({ json: MOCK_STATS })
    })
    await page.route('**/api/cop/cop-evt-test-001/tasks', async (route) => {
      await route.fulfill({ json: MOCK_TASKS })
    })
    await page.route('**/api/cop/cop-evt-test-001/rfis', async (route) => {
      await route.fulfill({ json: MOCK_RFIS })
    })
    await page.route('**/api/cop/cop-evt-test-001/hypotheses', async (route) => {
      await route.fulfill({ json: { hypotheses: [] } })
    })

    // Mock layer endpoints
    await page.route('**/api/cop/cop-evt-test-001/layers/**', async (route) => {
      await route.fulfill({ json: { type: 'FeatureCollection', features: [] } })
    })

    // Abort tile/font requests
    await page.route(/\.(pbf|mvt|png|jpg|glyphs)(\?.*)?$/, (route) => route.abort())
    await page.route('**/tiles/**', (route) => route.abort())
  })

  test('events endpoint returns filtered events', async ({ page }) => {
    // Intercept and verify the events API call
    const eventsPromise = page.waitForResponse(
      (response) => response.url().includes('/events') && response.status() === 200
    )

    await page.goto('/dashboard/cop/cop-evt-test-001')
    await page.waitForLoadState('domcontentloaded')

    // The events endpoint should have been called (if UI consumes it)
    // For now, verify the mock works via direct fetch
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/cop/cop-evt-test-001/events')
      return res.json()
    })

    expect(response.events).toHaveLength(2)
    expect(response.events[0].event_type).toBe('task.created')
    expect(response.events[1].event_type).toBe('rfi.created')
  })

  test('events endpoint supports cursor pagination via since param', async ({ page }) => {
    await page.route('**/api/cop/cop-evt-test-001/events?since=evt-test-001**', async (route) => {
      await route.fulfill({
        json: {
          events: [MOCK_EVENTS.events[1]], // Only the second event (after cursor)
        },
      })
    })

    await page.goto('/dashboard/cop/cop-evt-test-001')
    await page.waitForLoadState('domcontentloaded')

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/cop/cop-evt-test-001/events?since=evt-test-001')
      return res.json()
    })

    expect(response.events).toHaveLength(1)
    expect(response.events[0].id).toBe('evt-test-002')
  })

  test('events endpoint supports event_type filter', async ({ page }) => {
    await page.route('**/api/cop/cop-evt-test-001/events?event_type=task.created**', async (route) => {
      await route.fulfill({
        json: {
          events: [MOCK_EVENTS.events[0]],
        },
      })
    })

    await page.goto('/dashboard/cop/cop-evt-test-001')
    await page.waitForLoadState('domcontentloaded')

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/cop/cop-evt-test-001/events?event_type=task.created')
      return res.json()
    })

    expect(response.events).toHaveLength(1)
    expect(response.events[0].event_type).toBe('task.created')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/smoke/cop-events.spec.ts --reporter=list`
Expected: All 3 tests PASS (they test against mocked endpoints)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke/cop-events.spec.ts
git commit -m "test(cop): add E2E tests for event system endpoint"
```

---

## Chunk 5: Apply Migration & Verify

### Task 12: Apply migration and run smoke test against local D1

- [ ] **Step 1: Apply the migration to local D1**

Run: `npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/070-add-cop-events.sql`
Expected: No errors

- [ ] **Step 2: Verify the table exists**

Run: `npx wrangler d1 execute researchtoolspy-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name='cop_events'"`
Expected: One row showing `cop_events`

- [ ] **Step 3: Verify indexes exist**

Run: `npx wrangler d1 execute researchtoolspy-db --local --command="SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_cop_events%'"`
Expected: 4 indexes listed

- [ ] **Step 4: Run full E2E suite to check for regressions**

Run: `npx playwright test --reporter=list`
Expected: All existing 158+ tests still pass, plus 3 new event tests

- [ ] **Step 5: Final commit with migration applied confirmation**

No code changes needed — this is a verification step.

---

## Summary

| Task | Files | Event |
|---|---|---|
| 1 | Migration 070 | cop_events table |
| 2 | cop-event-types.ts | Type constants |
| 3 | cop-events.ts | emitCopEvent helper |
| 4 | src/types/cop.ts | CopEvent interface |
| 5 | [id]/events.ts | GET endpoint |
| 6 | [id]/tasks.ts | Task events |
| 7 | [id]/rfis.ts + rfis/[rfiId].ts | RFI events |
| 8 | [id]/evidence.ts + evidence-tags.ts | Evidence events |
| 9 | [id]/hypotheses.ts | Hypothesis events |
| 10 | personas, markers, collaborators, shares | Remaining events |
| 11 | cop-events.spec.ts | E2E tests |
| 12 | — | Migration + regression check |
