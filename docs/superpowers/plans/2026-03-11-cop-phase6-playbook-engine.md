# COP Phase 6: Playbook Automation Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rule-based automation engine that consumes events from Phase 1, evaluates conditions, and executes actions — enabling multi-stage pipelines like "ingest → auto-tag → create task → assign analyst."

**Architecture:** Three new tables (`cop_playbooks`, `cop_playbook_rules`, `cop_playbook_log`). A Cloudflare Cron Trigger polls `cop_events` every 60 seconds, evaluates active rules, executes actions, and logs results. Condition DSL supports field comparisons. Action system is extensible via a registry pattern. Mustache-style templates for dynamic values.

**Tech Stack:** Cloudflare Workers, D1, Cron Triggers, TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 6)

**Depends on:** Phase 1 (Event System), Phase 2 (Ingest), Phase 3 (Tasks), Phase 4 (Assets)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/078-add-cop-playbooks.sql` | Create | All 3 playbook tables |
| `src/types/cop.ts` | Modify | Playbook interfaces |
| `functions/api/_shared/playbook-engine/condition-evaluator.ts` | Create | Evaluate condition DSL |
| `functions/api/_shared/playbook-engine/action-executor.ts` | Create | Execute action registry |
| `functions/api/_shared/playbook-engine/template-resolver.ts` | Create | Mustache template resolution |
| `functions/api/_shared/playbook-engine/engine.ts` | Create | Main engine loop |
| `functions/api/_shared/playbook-engine/index.ts` | Create | Public API |
| `functions/api/cop/[id]/playbooks.ts` | Create | GET/POST playbooks |
| `functions/api/cop/[id]/playbooks/[pbId].ts` | Create | GET/PUT/DELETE single |
| `functions/api/cop/[id]/playbooks/[pbId]/rules.ts` | Create | CRUD rules |
| `functions/api/cop/[id]/playbooks/[pbId]/log.ts` | Create | GET execution log |
| `functions/api/cop/[id]/playbooks/[pbId]/test.ts` | Create | POST dry-run |
| `functions/_scheduled.ts` | Modify | Wire engine to cron |
| `src/components/cop/CopPlaybookPanel.tsx` | Create | Playbook list UI |
| `src/components/cop/CopPlaybookEditor.tsx` | Create | Rule builder UI |
| `src/components/cop/CopPlaybookLog.tsx` | Create | Execution history UI |
| `tests/e2e/smoke/cop-playbooks.spec.ts` | Create | E2E tests |

---

## Chunk 1: Schema + Types

### Task 1: Create playbook tables migration

**Files:**
- Create: `schema/migrations/078-add-cop-playbooks.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 078: Add COP playbook engine tables
-- Playbooks contain rules that react to cop_events.
-- Rules: when (event match) -> if (conditions) -> then (actions).

CREATE TABLE IF NOT EXISTS cop_playbooks (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',  -- 'active', 'paused', 'draft'
  source TEXT DEFAULT 'custom',  -- 'custom', 'template'
  template_id TEXT,
  execution_count INTEGER DEFAULT 0,
  last_triggered_at TEXT,
  last_processed_event_id TEXT,  -- Cursor for polling cop_events

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbooks_session ON cop_playbooks(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbooks_status ON cop_playbooks(status);

CREATE TABLE IF NOT EXISTS cop_playbook_rules (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  trigger_event TEXT NOT NULL,
  trigger_filter TEXT DEFAULT '{}',
  conditions TEXT DEFAULT '[]',
  actions TEXT DEFAULT '[]',
  cooldown_seconds INTEGER DEFAULT 0,
  last_fired_at TEXT,
  fire_count INTEGER DEFAULT 0,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_playbook ON cop_playbook_rules(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_rules_trigger ON cop_playbook_rules(trigger_event);

CREATE TABLE IF NOT EXISTS cop_playbook_log (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  playbook_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  trigger_event_id TEXT,
  actions_taken TEXT DEFAULT '[]',
  status TEXT DEFAULT 'success',  -- 'success', 'partial', 'failed'
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (rule_id) REFERENCES cop_playbook_rules(id),
  FOREIGN KEY (playbook_id) REFERENCES cop_playbooks(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_playbook ON cop_playbook_log(playbook_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_session ON cop_playbook_log(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_playbook_log_rule ON cop_playbook_log(rule_id);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/078-add-cop-playbooks.sql
git commit -m "feat(cop): add playbook engine tables (078)"
```

---

### Task 2: Add playbook types

**Files:**
- Modify: `src/types/cop.ts`

- [ ] **Step 1: Add interfaces**

```typescript
// -- COP Playbooks (Phase 6: Playbook Engine) --

export type PlaybookStatus = 'active' | 'paused' | 'draft'
export type PlaybookLogStatus = 'success' | 'partial' | 'failed'

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains' | 'exists'

export interface PlaybookCondition {
  field: string   // dot-path: payload.priority, session.open_rfi_count, time.hours_since_created
  op: ConditionOp
  value: unknown
}

export type PlaybookActionType =
  | 'create_task' | 'update_status' | 'assign_task'
  | 'create_evidence' | 'send_notification' | 'update_priority'
  | 'add_tag' | 'create_rfi' | 'reserve_asset' | 'run_pipeline'

export interface PlaybookAction {
  action: PlaybookActionType
  params: Record<string, unknown>
}

export interface PipelineStage {
  name: string
  action: PlaybookActionType
  params: Record<string, unknown>
}

export interface CopPlaybook {
  id: string
  cop_session_id: string
  name: string
  description: string | null
  status: PlaybookStatus
  source: 'custom' | 'template'
  template_id: string | null
  execution_count: number
  last_triggered_at: string | null
  last_processed_event_id: string | null
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopPlaybookRule {
  id: string
  playbook_id: string
  name: string
  position: number
  enabled: boolean
  trigger_event: string
  trigger_filter: Record<string, unknown>
  conditions: PlaybookCondition[]
  actions: PlaybookAction[]
  cooldown_seconds: number
  last_fired_at: string | null
  fire_count: number
  created_at: string
  updated_at: string
}

export interface CopPlaybookLogEntry {
  id: string
  rule_id: string
  playbook_id: string
  cop_session_id: string
  trigger_event_id: string | null
  actions_taken: PlaybookAction[]
  status: PlaybookLogStatus
  error_message: string | null
  duration_ms: number | null
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add playbook engine TypeScript interfaces"
```

---

## Chunk 2: Engine Core

### Task 3: Create condition evaluator

**Files:**
- Create: `functions/api/_shared/playbook-engine/condition-evaluator.ts`

- [ ] **Step 1: Write the evaluator**

```typescript
/**
 * Evaluate a condition against event data and session context.
 * Supports dot-path field access and comparison operators.
 */

interface ConditionContext {
  payload: Record<string, unknown>
  session?: Record<string, unknown>
  entity?: Record<string, unknown>
  time?: { hours_since_created: number }
}

interface Condition {
  field: string
  op: string
  value: unknown
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

function resolveField(context: ConditionContext, fieldPath: string): unknown {
  const [domain, ...rest] = fieldPath.split('.')
  const subPath = rest.join('.')

  switch (domain) {
    case 'payload': return getNestedValue(context.payload, subPath)
    case 'session': return context.session ? getNestedValue(context.session, subPath) : undefined
    case 'entity': return context.entity ? getNestedValue(context.entity, subPath) : undefined
    case 'time': return context.time ? getNestedValue(context.time as any, subPath) : undefined
    default: return getNestedValue(context.payload, fieldPath) // Default to payload
  }
}

export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  const actual = resolveField(context, condition.field)

  switch (condition.op) {
    case 'eq': return actual === condition.value
    case 'neq': return actual !== condition.value
    case 'gt': return Number(actual) > Number(condition.value)
    case 'lt': return Number(actual) < Number(condition.value)
    case 'gte': return Number(actual) >= Number(condition.value)
    case 'lte': return Number(actual) <= Number(condition.value)
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(actual)
    case 'contains': return typeof actual === 'string' && actual.includes(String(condition.value))
    case 'exists': return actual !== undefined && actual !== null
    default: return false
  }
}

export function evaluateAllConditions(conditions: Condition[], context: ConditionContext): boolean {
  if (conditions.length === 0) return true
  return conditions.every(c => evaluateCondition(c, context))
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/playbook-engine/condition-evaluator.ts
git commit -m "feat(cop): add playbook condition evaluator with dot-path resolution"
```

---

### Task 4: Create template resolver

**Files:**
- Create: `functions/api/_shared/playbook-engine/template-resolver.ts`

- [ ] **Step 1: Write mustache-style template resolver**

```typescript
/**
 * Resolve {{mustache}} templates in action params.
 * Supports: trigger.payload.*, trigger.entity_id, stage.<name>.*
 */

interface TemplateContext {
  trigger: {
    event_type: string
    entity_type: string
    entity_id: string | null
    payload: Record<string, unknown>
  }
  stage: Record<string, Record<string, unknown>>  // stage results keyed by name
}

export function resolveTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const trimmed = path.trim()
    const parts = trimmed.split('.')

    if (parts[0] === 'trigger') {
      if (parts[1] === 'payload') {
        return String(getNestedValue(context.trigger.payload, parts.slice(2).join('.')) ?? '')
      }
      return String((context.trigger as any)[parts[1]] ?? '')
    }

    if (parts[0] === 'stage') {
      const stageName = parts[1]
      const stageData = context.stage[stageName]
      if (!stageData) return ''
      return String(getNestedValue(stageData, parts.slice(2).join('.')) ?? '')
    }

    return ''
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function resolveParams(
  params: Record<string, unknown>,
  context: TemplateContext
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = resolveTemplate(value, context)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveParams(value as Record<string, unknown>, context)
    } else {
      resolved[key] = value
    }
  }
  return resolved
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/playbook-engine/template-resolver.ts
git commit -m "feat(cop): add mustache template resolver for playbook actions"
```

---

### Task 5: Create action executor

**Files:**
- Create: `functions/api/_shared/playbook-engine/action-executor.ts`

- [ ] **Step 1: Write the action registry and executor**

Each action type is a function that takes `(db, sessionId, params, userId)` and returns a result object. The executor dispatches by action type.

Actions implemented:
- `create_task` — INSERT into cop_tasks
- `update_status` — UPDATE entity status
- `assign_task` — Call auto-assign from Phase 3
- `create_evidence` — INSERT into evidence_items
- `send_notification` — INSERT into cop_activity (human-readable)
- `update_priority` — UPDATE entity priority
- `add_tag` — INSERT into cop_evidence_tags
- `create_rfi` — INSERT into cop_rfis
- `reserve_asset` — UPDATE cop_assets.assigned_to_task_id
- `run_pipeline` — Execute stages sequentially, collect results

- [ ] **Step 2: Commit**

```bash
git add functions/api/_shared/playbook-engine/action-executor.ts
git commit -m "feat(cop): add playbook action executor with 10 action types"
```

---

### Task 6: Create main engine loop

**Files:**
- Create: `functions/api/_shared/playbook-engine/engine.ts`
- Create: `functions/api/_shared/playbook-engine/index.ts`

- [ ] **Step 1: Write the engine**

```typescript
/**
 * Playbook Engine - Main Loop
 * Called by Cron Trigger every 60 seconds.
 * For each active playbook:
 *   1. Query cop_events after last_processed_event_id
 *   2. For each event, evaluate rules in position order
 *   3. Check cooldown, conditions
 *   4. Execute matching actions
 *   5. Log results
 *   6. Advance cursor
 */

import { evaluateAllConditions } from './condition-evaluator'
import { executeAction, executePipeline } from './action-executor'
import { resolveParams } from './template-resolver'

interface EngineResult {
  playbooks_processed: number
  events_processed: number
  rules_fired: number
  errors: number
}

export async function runPlaybookEngine(db: D1Database): Promise<EngineResult> {
  const result: EngineResult = { playbooks_processed: 0, events_processed: 0, rules_fired: 0, errors: 0 }

  // Get all active playbooks
  const playbooks = await db.prepare(
    "SELECT * FROM cop_playbooks WHERE status = 'active'"
  ).all()

  for (const playbook of (playbooks.results || []) as any[]) {
    result.playbooks_processed++

    // Get new events since last cursor
    let eventsQuery = 'SELECT * FROM cop_events WHERE cop_session_id = ?'
    const bindings: any[] = [playbook.cop_session_id]

    if (playbook.last_processed_event_id) {
      eventsQuery += ' AND id > ?'
      bindings.push(playbook.last_processed_event_id)
    }

    eventsQuery += ' ORDER BY id ASC LIMIT 100'

    const events = await db.prepare(eventsQuery).bind(...bindings).all()
    const eventRows = (events.results || []) as any[]

    if (eventRows.length === 0) continue

    // Get rules for this playbook
    const rules = await db.prepare(
      'SELECT * FROM cop_playbook_rules WHERE playbook_id = ? AND enabled = 1 ORDER BY position ASC'
    ).bind(playbook.id).all()

    const ruleRows = (rules.results || []) as any[]

    for (const event of eventRows) {
      result.events_processed++

      let payload: Record<string, unknown> = {}
      try { payload = JSON.parse(event.payload || '{}') } catch { payload = {} }

      for (const rule of ruleRows) {
        // Check trigger match
        if (rule.trigger_event !== event.event_type) continue

        // Check trigger filter
        let triggerFilter: Record<string, unknown> = {}
        try { triggerFilter = JSON.parse(rule.trigger_filter || '{}') } catch { triggerFilter = {} }

        // Check cooldown
        if (rule.cooldown_seconds > 0 && rule.last_fired_at) {
          const lastFired = new Date(rule.last_fired_at).getTime()
          const cooldownMs = rule.cooldown_seconds * 1000
          if (Date.now() - lastFired < cooldownMs) continue
        }

        // Evaluate conditions
        let conditions: any[] = []
        try { conditions = JSON.parse(rule.conditions || '[]') } catch { conditions = [] }

        const context = {
          payload,
          time: {
            hours_since_created: (Date.now() - new Date(event.created_at).getTime()) / 3600000,
          },
        }

        if (!evaluateAllConditions(conditions, context)) continue

        // Execute actions
        const startTime = Date.now()
        let actions: any[] = []
        try { actions = JSON.parse(rule.actions || '[]') } catch { actions = [] }

        const templateContext = {
          trigger: {
            event_type: event.event_type,
            entity_type: event.entity_type,
            entity_id: event.entity_id,
            payload,
          },
          stage: {} as Record<string, Record<string, unknown>>,
        }

        const actionResults: any[] = []
        let logStatus = 'success'
        let errorMessage: string | null = null

        try {
          for (const action of actions) {
            const resolvedParams = resolveParams(action.params || {}, templateContext)

            if (action.action === 'run_pipeline') {
              const pipelineResult = await executePipeline(
                db, playbook.cop_session_id, action.stages || [],
                templateContext, playbook.created_by
              )
              actionResults.push({ action: 'run_pipeline', result: pipelineResult })
            } else {
              const actionResult = await executeAction(
                db, playbook.cop_session_id,
                action.action, resolvedParams,
                playbook.created_by
              )
              actionResults.push({ action: action.action, result: actionResult })

              // Store result for template resolution in later actions
              if (action.name) {
                templateContext.stage[action.name] = actionResult as any
              }
            }
          }
        } catch (err) {
          logStatus = 'failed'
          errorMessage = err instanceof Error ? err.message : String(err)
          result.errors++
        }

        const durationMs = Date.now() - startTime

        // Log execution
        const logId = `plog-${crypto.randomUUID().slice(0, 12)}`
        await db.prepare(`
          INSERT INTO cop_playbook_log (id, rule_id, playbook_id, cop_session_id, trigger_event_id, actions_taken, status, error_message, duration_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          logId, rule.id, playbook.id, playbook.cop_session_id,
          event.id, JSON.stringify(actionResults),
          logStatus, errorMessage, durationMs
        ).run()

        // Update rule stats
        await db.prepare(
          'UPDATE cop_playbook_rules SET last_fired_at = ?, fire_count = fire_count + 1, updated_at = ? WHERE id = ?'
        ).bind(new Date().toISOString(), new Date().toISOString(), rule.id).run()

        result.rules_fired++
      }
    }

    // Advance cursor to last processed event
    const lastEventId = eventRows[eventRows.length - 1].id
    await db.prepare(
      'UPDATE cop_playbooks SET last_processed_event_id = ?, execution_count = execution_count + 1, last_triggered_at = ?, updated_at = ? WHERE id = ?'
    ).bind(lastEventId, new Date().toISOString(), new Date().toISOString(), playbook.id).run()
  }

  return result
}
```

- [ ] **Step 2: Create index.ts barrel export**

```typescript
export { runPlaybookEngine } from './engine'
export { evaluateCondition, evaluateAllConditions } from './condition-evaluator'
export { executeAction } from './action-executor'
export { resolveTemplate, resolveParams } from './template-resolver'
```

- [ ] **Step 3: Commit**

```bash
git add functions/api/_shared/playbook-engine/engine.ts functions/api/_shared/playbook-engine/index.ts
git commit -m "feat(cop): add playbook engine main loop with cursor-based event polling"
```

---

### Task 7: Wire engine to Cron Trigger

**Files:**
- Modify: `functions/_scheduled.ts` (create if doesn't exist)

- [ ] **Step 1: Add scheduled handler**

```typescript
import { runPlaybookEngine } from './api/_shared/playbook-engine'
import { checkSlaBreaches } from './api/_shared/sla-check'

export const onSchedule: PagesFunction<Env> = async (context) => {
  const { env } = context

  try {
    // Run playbook engine (every 60s)
    const engineResult = await runPlaybookEngine(env.DB)
    console.log('[Cron] Playbook engine:', JSON.stringify(engineResult))

    // Run SLA checker (also on this cron, every 15min is handled by wrangler.toml)
    const slaResult = await checkSlaBreaches(env.DB)
    console.log('[Cron] SLA check:', JSON.stringify(slaResult))
  } catch (error) {
    console.error('[Cron] Error:', error)
  }
}
```

- [ ] **Step 2: Update wrangler.toml**

Add cron trigger:

```toml
[triggers]
crons = ["* * * * *"]
```

- [ ] **Step 3: Commit**

```bash
git add functions/_scheduled.ts wrangler.toml
git commit -m "feat(cop): wire playbook engine and SLA checker to cron trigger"
```

---

## Chunk 3: API Endpoints

### Task 8: Create playbooks CRUD endpoint

**Files:**
- Create: `functions/api/cop/[id]/playbooks.ts`

- [ ] **Step 1: Write GET/POST endpoint**

Standard CRUD. GET lists playbooks for session with execution_count and last_triggered_at. POST creates with default status `draft`.

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/playbooks.ts
git commit -m "feat(cop): add playbooks GET/POST endpoint"
```

---

### Task 9: Create single playbook endpoint

**Files:**
- Create: `functions/api/cop/[id]/playbooks/[pbId].ts`

- [ ] **Step 1: Write GET/PUT/DELETE**

PUT supports status toggle (active/paused/draft), name, description. DELETE is hard delete (cascades to rules and log via application logic).

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/playbooks/[pbId].ts
git commit -m "feat(cop): add single playbook GET/PUT/DELETE endpoint"
```

---

### Task 10: Create rules CRUD endpoint

**Files:**
- Create: `functions/api/cop/[id]/playbooks/[pbId]/rules.ts`

- [ ] **Step 1: Write GET/POST/PUT/DELETE**

Parse JSON fields (trigger_filter, conditions, actions) on read. Validate action types against known registry. Position auto-increment on POST.

- [ ] **Step 2: Commit**

```bash
git add functions/api/cop/[id]/playbooks/[pbId]/rules.ts
git commit -m "feat(cop): add playbook rules CRUD endpoint"
```

---

### Task 11: Create execution log and dry-run endpoints

**Files:**
- Create: `functions/api/cop/[id]/playbooks/[pbId]/log.ts`
- Create: `functions/api/cop/[id]/playbooks/[pbId]/test.ts`

- [ ] **Step 1: Write log GET**

Paginated, ordered by created_at DESC. Parse actions_taken JSON.

- [ ] **Step 2: Write test POST (dry-run)**

Fetches recent events, evaluates rules against them without executing actions. Returns `{ would_fire: [...], would_skip: [...] }` with reasons.

- [ ] **Step 3: Commit**

```bash
git add functions/api/cop/[id]/playbooks/[pbId]/log.ts functions/api/cop/[id]/playbooks/[pbId]/test.ts
git commit -m "feat(cop): add playbook execution log and dry-run test endpoints"
```

---

## Chunk 4: Frontend

### Task 12: Create CopPlaybookPanel

**Files:**
- Create: `src/components/cop/CopPlaybookPanel.tsx`

- [ ] **Step 1: Write the component**

List of playbooks with:
- Active/paused/draft status badge with toggle button
- Execution count and last triggered timestamp
- Rule count summary
- "New Playbook" button
- Click to expand → shows rules inline

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopPlaybookPanel.tsx
git commit -m "feat(cop): add CopPlaybookPanel list component"
```

---

### Task 13: Create CopPlaybookEditor

**Files:**
- Create: `src/components/cop/CopPlaybookEditor.tsx`

- [ ] **Step 1: Write the component**

Visual rule builder:
- Event type dropdown (from taxonomy)
- Condition builder: field path input + operator dropdown + value input
- Action picker: action type dropdown + params form (dynamic per action type)
- Pipeline builder: drag-and-drop stage sequencer (for `run_pipeline` action)
- "Test" button that hits the dry-run endpoint
- Save button

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopPlaybookEditor.tsx
git commit -m "feat(cop): add CopPlaybookEditor visual rule builder"
```

---

### Task 14: Create CopPlaybookLog

**Files:**
- Create: `src/components/cop/CopPlaybookLog.tsx`

- [ ] **Step 1: Write the component**

Searchable execution history:
- Sortable table with rule name, event type, status badge, duration, timestamp
- Expandable rows showing actions_taken detail and error messages
- Filter by status (success/partial/failed)

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopPlaybookLog.tsx
git commit -m "feat(cop): add CopPlaybookLog execution history component"
```

---

## Chunk 5: Tests

### Task 15: E2E tests + migration

- [ ] **Step 1: Write tests**

Cover:
- Playbook CRUD
- Rule CRUD with condition/action validation
- Dry-run returns expected would_fire results
- Execution log shows entries after engine run
- Status toggle (active/paused) affects engine processing

- [ ] **Step 2: Apply migration and run**

```bash
npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/078-add-cop-playbooks.sql
npx playwright test tests/e2e/smoke/cop-playbooks.spec.ts --reporter=list
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/smoke/cop-playbooks.spec.ts
git commit -m "test(cop): add E2E tests for playbook engine"
```

---

## Summary

| Task | What |
|---|---|
| 1 | Playbook tables migration (078) |
| 2 | Playbook TypeScript types |
| 3 | Condition evaluator |
| 4 | Template resolver |
| 5 | Action executor |
| 6 | Main engine loop |
| 7 | Cron trigger wiring |
| 8 | Playbooks CRUD endpoint |
| 9 | Single playbook endpoint |
| 10 | Rules CRUD endpoint |
| 11 | Log + dry-run endpoints |
| 12 | CopPlaybookPanel UI |
| 13 | CopPlaybookEditor UI |
| 14 | CopPlaybookLog UI |
| 15 | E2E tests |
