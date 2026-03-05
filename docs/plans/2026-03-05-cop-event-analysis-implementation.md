# COP Event Analysis Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `event_analysis` template to the COP system that transforms the sidebar into a tabbed analytical workspace with event details, content intelligence, RFI threads, and starbursting questions — plus configurable public sharing.

**Architecture:** Extend the existing COP template system. New `event_analysis` template adds a tabbed sidebar (Event, Intel, RFI, Questions, Layers) to CopPage. Three new DB tables (cop_rfis, cop_rfi_answers, cop_shares) plus 4 new columns on cop_sessions. New API endpoints for RFIs and sharing. New public view page.

**Tech Stack:** React + TypeScript frontend, Cloudflare Pages Functions (Hono-style) backend, D1 (SQLite), MapLibre GL, Tailwind CSS v4, lucide-react icons, existing shadcn/ui components (Badge, Button, Dialog, Tabs, Input, Textarea, Select, ScrollArea, Tooltip).

---

## Task 1: Database Migration

**Files:**
- Create: `schema/migrations/058-cop-event-analysis.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: COP Event Analysis support
-- Date: 2026-03-05
-- Description: Adds event fields to cop_sessions, creates RFI and share tables

-- Event fields on cop_sessions
ALTER TABLE cop_sessions ADD COLUMN event_type TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_description TEXT;
ALTER TABLE cop_sessions ADD COLUMN event_facts TEXT DEFAULT '[]';
ALTER TABLE cop_sessions ADD COLUMN content_analyses TEXT DEFAULT '[]';

-- RFI (Request for Information) table
CREATE TABLE IF NOT EXISTS cop_rfis (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    created_by INTEGER NOT NULL DEFAULT 1,
    assigned_to INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_session ON cop_rfis(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_rfis_status ON cop_rfis(status);

-- RFI answers
CREATE TABLE IF NOT EXISTS cop_rfi_answers (
    id TEXT PRIMARY KEY,
    rfi_id TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    source_url TEXT,
    source_description TEXT,
    is_accepted INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    responder_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (rfi_id) REFERENCES cop_rfis(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_rfi_answers_rfi ON cop_rfi_answers(rfi_id);

-- COP share links
CREATE TABLE IF NOT EXISTS cop_shares (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    visible_panels TEXT NOT NULL DEFAULT '["map","event"]',
    allow_rfi_answers INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    view_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_cop_shares_token ON cop_shares(share_token);
```

**Step 2: Apply migration locally**

Run: `npx wrangler d1 execute researchtoolspy --local --file schema/migrations/058-cop-event-analysis.sql`
Expected: Success

**Step 3: Commit**

```bash
git add schema/migrations/058-cop-event-analysis.sql
git commit -m "feat(cop): add event analysis migration (RFIs, shares, event fields)"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `src/types/cop.ts`

**Step 1: Add event_analysis to CopTemplateType**

In `src/types/cop.ts`, add `EVENT_ANALYSIS: 'event_analysis'` to the `CopTemplateType` const object (after line 8, before `} as const`).

**Step 2: Add event fields to CopSession interface**

After the `key_questions: string[]` line (line 52), add:

```typescript
  // Event analysis fields (only populated when template_type === 'event_analysis')
  event_type: string | null
  event_description: string | null
  event_facts: EventFact[]
  content_analyses: string[]
```

**Step 3: Add new interfaces at the end of file**

After the `CopWizardOutput` interface, add:

```typescript
export interface EventFact {
  time: string
  text: string
  source_url?: string
}

export const CopEventType = {
  NATURAL_DISASTER: 'natural_disaster',
  MASS_CASUALTY: 'mass_casualty',
  ELECTION: 'election',
  PROTEST: 'protest',
  MILITARY: 'military',
  SPORTS: 'sports',
  CYBER: 'cyber',
  PUBLIC_HEALTH: 'public_health',
  OTHER: 'other',
} as const

export type CopEventType = typeof CopEventType[keyof typeof CopEventType]

export const EVENT_TYPE_LABELS: Record<CopEventType, string> = {
  natural_disaster: 'Natural Disaster',
  mass_casualty: 'Mass Casualty',
  election: 'Election / Political',
  protest: 'Protest / Civil Unrest',
  military: 'Military / Conflict',
  sports: 'Sports Event',
  cyber: 'Cyber Incident',
  public_health: 'Public Health',
  other: 'Other',
}

export const CopRfiStatus = {
  OPEN: 'open',
  ANSWERED: 'answered',
  ACCEPTED: 'accepted',
  CLOSED: 'closed',
} as const

export type CopRfiStatus = typeof CopRfiStatus[keyof typeof CopRfiStatus]

export const CopRfiPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const

export type CopRfiPriority = typeof CopRfiPriority[keyof typeof CopRfiPriority]

export interface CopRfi {
  id: string
  cop_session_id: string
  question: string
  priority: CopRfiPriority
  status: CopRfiStatus
  created_by: number
  assigned_to: number | null
  created_at: string
  updated_at: string
  answers?: CopRfiAnswer[]
}

export interface CopRfiAnswer {
  id: string
  rfi_id: string
  answer_text: string
  source_url: string | null
  source_description: string | null
  is_accepted: number
  created_by: number
  responder_name: string | null
  created_at: string
}

export interface CopShare {
  id: string
  cop_session_id: string
  share_token: string
  visible_panels: string[]
  allow_rfi_answers: number
  created_by: number
  created_at: string
  view_count: number
}

export type CopSidebarTab = 'event' | 'intel' | 'rfi' | 'questions' | 'layers'
```

**Step 4: Update CopWizardInput to include event fields**

Add to the `CopWizardInput` interface:

```typescript
  // Event analysis fields (optional, only used for event_analysis template)
  eventType?: CopEventType
  eventDescription?: string
  initialUrls?: string[]
```

**Step 5: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add event analysis types (RFI, share, event fields)"
```

---

## Task 3: Update Layer Catalog for event_analysis

**Files:**
- Modify: `src/components/cop/CopLayerCatalog.ts`

**Step 1: Add `event_analysis` to defaultFor arrays**

For each layer, add `'event_analysis'` to the `defaultFor` array where appropriate:

- `places`: add `'event_analysis'` (already has all others)
- `events`: add `'event_analysis'`
- `actors`: add `'event_analysis'`
- `relationships`: add `'event_analysis'`
- `acled`: add `'event_analysis'`
- `gdelt`: add `'event_analysis'`
- `cop-markers`: add `'event_analysis'`

This gives event_analysis all entity layers + external feeds + tactical markers by default.

**Step 2: Commit**

```bash
git add src/components/cop/CopLayerCatalog.ts
git commit -m "feat(cop): add event_analysis to default layer assignments"
```

---

## Task 4: Backend — Update Session API for Event Fields

**Files:**
- Modify: `functions/api/cop/sessions.ts` (POST handler)
- Modify: `functions/api/cop/sessions/[id].ts` (GET/PUT handlers)

**Step 1: Update POST handler in `sessions.ts`**

In the INSERT statement, add the 4 new event columns (`event_type`, `event_description`, `event_facts`, `content_analyses`) to both the column list and the VALUES placeholders. Add corresponding `.bind()` values:

```typescript
body.event_type || null,
body.event_description || null,
body.event_facts ? JSON.stringify(body.event_facts) : '[]',
body.content_analyses ? JSON.stringify(body.content_analyses) : '[]',
```

**Step 2: Update `parseJsonFields` in `sessions/[id].ts`**

Add `'event_facts'` and `'content_analyses'` to the `jsonFields` array in both files:

```typescript
const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions', 'event_facts', 'content_analyses'] as const
```

**Step 3: Update PUT handler for scalar event fields**

In `sessions/[id].ts`, add `'event_type'` and `'event_description'` to the `scalarFields` array.

**Step 4: Commit**

```bash
git add functions/api/cop/sessions.ts functions/api/cop/sessions/\[id\].ts
git commit -m "feat(cop): support event analysis fields in session CRUD"
```

---

## Task 5: Backend — RFI API Endpoints

**Files:**
- Create: `functions/api/cop/[id]/rfis.ts`
- Create: `functions/api/cop/[id]/rfis/[rfiId].ts`
- Create: `functions/api/cop/[id]/rfis/[rfiId]/answers.ts`

**Step 1: Create `rfis.ts` (GET list + POST create)**

```typescript
/**
 * COP RFI API - List and Create
 *
 * GET  /api/cop/:id/rfis - List RFIs for session (with answers)
 * POST /api/cop/:id/rfis - Create new RFI
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `rfi-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const rfis = await env.DB.prepare(`
      SELECT * FROM cop_rfis WHERE cop_session_id = ? ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
        END,
        created_at DESC
    `).bind(sessionId).all()

    // Fetch answers for each RFI
    const rfiIds = rfis.results.map((r: any) => r.id)
    let answers: any[] = []
    if (rfiIds.length > 0) {
      const placeholders = rfiIds.map(() => '?').join(',')
      const answerResults = await env.DB.prepare(`
        SELECT * FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC
      `).bind(...rfiIds).all()
      answers = answerResults.results
    }

    // Group answers by rfi_id
    const answersByRfi: Record<string, any[]> = {}
    for (const a of answers) {
      const rfiId = (a as any).rfi_id
      if (!answersByRfi[rfiId]) answersByRfi[rfiId] = []
      answersByRfi[rfiId].push(a)
    }

    const enriched = rfis.results.map((r: any) => ({
      ...r,
      answers: answersByRfi[r.id] || [],
    }))

    return new Response(JSON.stringify({ rfis: enriched }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list RFIs',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()
    const priority = ['critical', 'high', 'medium', 'low'].includes(body.priority) ? body.priority : 'medium'

    await env.DB.prepare(`
      INSERT INTO cop_rfis (id, cop_session_id, question, priority, status, created_by, assigned_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).bind(id, sessionId, body.question.trim(), priority, userId, body.assigned_to ?? null, now, now).run()

    return new Response(JSON.stringify({ id, message: 'RFI created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create RFI',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Create `rfis/[rfiId].ts` (PUT update RFI)**

```typescript
/**
 * COP RFI Single Item API
 *
 * PUT /api/cop/:id/rfis/:rfiId - Update RFI (status, priority)
 */
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (body.status && ['open', 'answered', 'accepted', 'closed'].includes(body.status)) {
      updates.push('status = ?')
      values.push(body.status)
    }
    if (body.priority && ['critical', 'high', 'medium', 'low'].includes(body.priority)) {
      updates.push('priority = ?')
      values.push(body.priority)
    }
    if (body.assigned_to !== undefined) {
      updates.push('assigned_to = ?')
      values.push(body.assigned_to)
    }

    values.push(rfiId)

    await env.DB.prepare(`
      UPDATE cop_rfis SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run()

    return new Response(JSON.stringify({ message: 'RFI updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update RFI',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 3: Create `rfis/[rfiId]/answers.ts` (POST answer + PUT accept)**

```typescript
/**
 * COP RFI Answers API
 *
 * POST /api/cop/:id/rfis/:rfiId/answers - Submit answer
 * PUT  /api/cop/:id/rfis/:rfiId/answers - Accept/reject answer (body: { answer_id, is_accepted })
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `rfia-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, created_by, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      body.source_url || null, body.source_description || null,
      userId, body.responder_name || null, now
    ).run()

    // Update RFI status to 'answered' if currently 'open'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND status = 'open'
    `).bind(now, rfiId).run()

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP RFI Answers API] Submit error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const rfiId = params.rfiId as string

  try {
    const body = await request.json() as any
    const now = new Date().toISOString()

    if (!body.answer_id) {
      return new Response(JSON.stringify({ error: 'answer_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const isAccepted = body.is_accepted ? 1 : 0

    // Clear other accepted answers first if accepting
    if (isAccepted) {
      await env.DB.prepare(`
        UPDATE cop_rfi_answers SET is_accepted = 0 WHERE rfi_id = ?
      `).bind(rfiId).run()
    }

    // Set this answer
    await env.DB.prepare(`
      UPDATE cop_rfi_answers SET is_accepted = ? WHERE id = ? AND rfi_id = ?
    `).bind(isAccepted, body.answer_id, rfiId).run()

    // Update RFI status
    const newStatus = isAccepted ? 'accepted' : 'answered'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = ?, updated_at = ? WHERE id = ?
    `).bind(newStatus, now, rfiId).run()

    return new Response(JSON.stringify({ message: 'Answer updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP RFI Answers API] Accept error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update answer',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 4: Commit**

```bash
git add functions/api/cop/\[id\]/rfis.ts functions/api/cop/\[id\]/rfis/\[rfiId\].ts functions/api/cop/\[id\]/rfis/\[rfiId\]/answers.ts
git commit -m "feat(cop): add RFI CRUD API endpoints"
```

---

## Task 6: Backend — Share API Endpoints

**Files:**
- Create: `functions/api/cop/[id]/shares.ts`
- Create: `functions/api/cop/public/[token].ts`
- Create: `functions/api/cop/public/[token]/rfis/[rfiId]/answers.ts`

**Step 1: Create `shares.ts` (POST create share link)**

```typescript
/**
 * COP Share API
 *
 * POST /api/cop/:id/shares - Create share link with panel config
 * GET  /api/cop/:id/shares - List existing share links
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `cops-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    const body = await request.json() as any

    const id = generateId()
    const token = crypto.randomUUID()
    const now = new Date().toISOString()

    const validPanels = ['map', 'event', 'claims', 'rfi', 'questions', 'network']
    const visiblePanels = Array.isArray(body.visible_panels)
      ? body.visible_panels.filter((p: string) => validPanels.includes(p))
      : ['map', 'event']

    // Always include map
    if (!visiblePanels.includes('map')) visiblePanels.unshift('map')

    await env.DB.prepare(`
      INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, allow_rfi_answers, created_by, created_at, view_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      id, sessionId, token,
      JSON.stringify(visiblePanels),
      body.allow_rfi_answers ? 1 : 0,
      userId, now
    ).run()

    return new Response(JSON.stringify({
      id,
      share_token: token,
      url: `/public/cop/${token}`,
      message: 'Share link created',
    }), { status: 201, headers: corsHeaders })
  } catch (error) {
    console.error('[COP Share API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create share link',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const results = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE cop_session_id = ? ORDER BY created_at DESC
    `).bind(sessionId).all()

    const shares = results.results.map((r: any) => ({
      ...r,
      visible_panels: JSON.parse(r.visible_panels || '["map"]'),
    }))

    return new Response(JSON.stringify({ shares }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Share API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list share links',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 2: Create `public/[token].ts` (GET shared session data)**

```typescript
/**
 * COP Public Share API
 *
 * GET /api/cop/public/:token - Get shared session data (filtered by visible_panels)
 */
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const jsonFields = ['active_layers', 'layer_config', 'linked_frameworks', 'key_questions', 'event_facts', 'content_analyses'] as const

function parseJsonFields(row: any): any {
  const parsed = { ...row }
  for (const field of jsonFields) {
    if (parsed[field]) {
      try { parsed[field] = JSON.parse(parsed[field]) } catch { parsed[field] = [] }
    } else {
      parsed[field] = field === 'layer_config' ? {} : []
    }
  }
  return parsed
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params.token as string

  try {
    // Find share record
    const share = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE share_token = ?
    `).bind(token).first() as any

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link not found or expired' }), {
        status: 404, headers: corsHeaders,
      })
    }

    // Increment view count
    await env.DB.prepare(`
      UPDATE cop_shares SET view_count = view_count + 1 WHERE id = ?
    `).bind(share.id).run()

    // Fetch session
    const session = await env.DB.prepare(`
      SELECT * FROM cop_sessions WHERE id = ?
    `).bind(share.cop_session_id).first()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const parsed = parseJsonFields(session)
    const visiblePanels = JSON.parse(share.visible_panels || '["map"]')

    // Build response based on visible panels
    const response: any = {
      session: parsed,
      visible_panels: visiblePanels,
      allow_rfi_answers: share.allow_rfi_answers === 1,
    }

    // Include RFIs if rfi panel is visible
    if (visiblePanels.includes('rfi')) {
      const rfis = await env.DB.prepare(`
        SELECT * FROM cop_rfis WHERE cop_session_id = ? ORDER BY
          CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
          created_at DESC
      `).bind(share.cop_session_id).all()

      const rfiIds = rfis.results.map((r: any) => r.id)
      let answers: any[] = []
      if (rfiIds.length > 0) {
        const placeholders = rfiIds.map(() => '?').join(',')
        const answerResults = await env.DB.prepare(
          `SELECT * FROM cop_rfi_answers WHERE rfi_id IN (${placeholders}) ORDER BY created_at ASC`
        ).bind(...rfiIds).all()
        answers = answerResults.results
      }

      const answersByRfi: Record<string, any[]> = {}
      for (const a of answers) {
        const rfiId = (a as any).rfi_id
        if (!answersByRfi[rfiId]) answersByRfi[rfiId] = []
        answersByRfi[rfiId].push(a)
      }

      response.rfis = rfis.results.map((r: any) => ({
        ...r,
        answers: answersByRfi[r.id] || [],
      }))
    }

    return new Response(JSON.stringify(response), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Public API] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load shared COP',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 3: Create `public/[token]/rfis/[rfiId]/answers.ts` (POST answer on public view)**

```typescript
/**
 * COP Public RFI Answer API
 *
 * POST /api/cop/public/:token/rfis/:rfiId/answers - Submit answer from public view
 */
import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function generateId(): string {
  return `rfia-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const token = params.token as string
  const rfiId = params.rfiId as string

  try {
    // Verify share exists and allows RFI answers
    const share = await env.DB.prepare(`
      SELECT * FROM cop_shares WHERE share_token = ? AND allow_rfi_answers = 1
    `).bind(token).first()

    if (!share) {
      return new Response(JSON.stringify({ error: 'Share not found or RFI answers not allowed' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const body = await request.json() as any

    if (!body.answer_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Answer text is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const id = generateId()
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_rfi_answers (id, rfi_id, answer_text, source_url, source_description, is_accepted, created_by, responder_name, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `).bind(
      id, rfiId, body.answer_text.trim(),
      body.source_url || null, body.source_description || null,
      body.responder_name || 'Anonymous', now
    ).run()

    // Update RFI status to 'answered' if currently 'open'
    await env.DB.prepare(`
      UPDATE cop_rfis SET status = 'answered', updated_at = ? WHERE id = ? AND status = 'open'
    `).bind(now, rfiId).run()

    return new Response(JSON.stringify({ id, message: 'Answer submitted' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Public RFI API] Submit error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to submit answer',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
```

**Step 4: Commit**

```bash
git add functions/api/cop/\[id\]/shares.ts functions/api/cop/public/\[token\].ts functions/api/cop/public/\[token\]/rfis/\[rfiId\]/answers.ts
git commit -m "feat(cop): add share link and public COP API endpoints"
```

---

## Task 7: Frontend — Wizard Event Details Step

**Files:**
- Modify: `src/components/cop/CopWizard.tsx`

**Step 1: Add Event Analysis template to TEMPLATES array**

Add after `crisis_response` entry (before `custom`):

```typescript
{
  type: 'event_analysis',
  icon: Search,
  label: 'Event Analysis',
  description: 'Analyze an event with full intel toolkit',
  timeHint: 'Event-driven',
},
```

Import `Search` from lucide-react at the top.

**Step 2: Add event state variables**

After `const [newQuestion, setNewQuestion] = useState('')`, add:

```typescript
const [eventType, setEventType] = useState<string>('')
const [eventDescription, setEventDescription] = useState('')
const [initialUrls, setInitialUrls] = useState('')
```

**Step 3: Update STEP_LABELS and STEP_ICONS for dynamic steps**

The step count changes when event_analysis is selected. Replace the fixed arrays with computed ones:

```typescript
const isEventAnalysis = selectedTemplate === 'event_analysis'
const STEP_LABELS = isEventAnalysis
  ? ['Purpose', 'Event Details', 'Location', 'Time Window', 'Key Questions']
  : ['Purpose', 'Location', 'Time Window', 'Key Questions']
const STEP_ICONS = isEventAnalysis
  ? [Target, Search, MapPin, Clock, HelpCircle]
  : [Target, MapPin, Clock, HelpCircle]
const totalSteps = STEP_LABELS.length
```

Move these from module-level into the component body. Import `Search` from lucide-react.

**Step 4: Create renderEventDetailsStep function**

```typescript
function renderEventDetailsStep() {
  const eventTypes = [
    { value: 'natural_disaster', label: 'Natural Disaster' },
    { value: 'mass_casualty', label: 'Mass Casualty' },
    { value: 'election', label: 'Election / Political' },
    { value: 'protest', label: 'Protest / Civil Unrest' },
    { value: 'military', label: 'Military / Conflict' },
    { value: 'sports', label: 'Sports Event' },
    { value: 'cyber', label: 'Cyber Incident' },
    { value: 'public_health', label: 'Public Health' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Describe the event</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about the event you want to analyze.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Select event type...</option>
            {eventTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Description</label>
          <textarea
            value={eventDescription}
            onChange={e => setEventDescription(e.target.value)}
            placeholder="Brief description of the event (2-3 sentences)..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Initial URLs <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={initialUrls}
            onChange={e => setInitialUrls(e.target.value)}
            placeholder="Paste news links, one per line..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            These will be analyzed automatically when the COP is created.
          </p>
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Update step rendering, canProceed, and navigation logic**

The `renderStep`, `canProceed`, `handleNext`, and `handleCreate` functions need to account for the dynamic step count. When event_analysis is selected, step 1 = Event Details, step 2 = Location, step 3 = Time Window, step 4 = Key Questions. Otherwise, original mapping.

Update `canProceed`:
- For event_analysis step 1: `eventType !== ''` is required
- Shift location/time/questions validation by +1

Update `handleCreate` to include event fields in the POST body:
```typescript
event_type: isEventAnalysis ? eventType : undefined,
event_description: isEventAnalysis ? eventDescription : undefined,
initial_urls: isEventAnalysis ? initialUrls.split('\n').filter(u => u.trim()) : undefined,
```

Update step navigation: `step < totalSteps - 1` for Next button, `step === totalSteps - 1` for Create button.

**Step 6: Update progress bar to use dynamic STEP_LABELS**

Replace the `PROGRESS_COLORS` array to have 5 colors:
```typescript
const PROGRESS_COLORS = ['bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500']
```

**Step 7: Commit**

```bash
git add src/components/cop/CopWizard.tsx
git commit -m "feat(cop): add Event Analysis wizard step with event type, description, and URL seeding"
```

---

## Task 8: Frontend — CopEventSidebar (Tabbed Sidebar Container)

**Files:**
- Create: `src/components/cop/CopEventSidebar.tsx`

This is the tabbed sidebar container that replaces CopLayerPanel when the template is `event_analysis`. It renders icon tabs on the left strip and the active tab's content in the panel area.

**Key implementation details:**
- Uses the existing CopLayerPanel as the content for the "layers" tab
- Dark theme matching existing sidebar (`bg-gray-900`)
- Icon tabs: ClipboardList (Event), Link (Intel), HelpCircle (RFI), Star (Questions), Layers (Layers)
- Wider: `w-72` (288px) vs the normal `w-56`
- Active tab highlighted with left border accent
- Tab content scrollable with `overflow-y-auto`
- Badge counts on RFI tab (open count) and Questions tab (unanswered %)

**Props:**
```typescript
interface CopEventSidebarProps {
  session: CopSession
  activeLayers: string[]
  onToggleLayer: (layerId: string) => void
  layerCounts?: Record<string, number>
  onSessionUpdate: (updates: Partial<CopSession>) => void
}
```

**Step 1: Create the component file**

The component manages which tab is active, fetches RFI data, and renders the appropriate tab content. Each tab (Event, Intel, RFI, Questions) will be implemented as separate components in subsequent tasks. For now, create the shell with Layers tab working and placeholder divs for the others.

**Step 2: Commit**

```bash
git add src/components/cop/CopEventSidebar.tsx
git commit -m "feat(cop): add CopEventSidebar tabbed container component"
```

---

## Task 9: Frontend — CopEventTab

**Files:**
- Create: `src/components/cop/CopEventTab.tsx`

Displays event type badge, description, key facts timeline, and summary counts (claims, entities).

**Key implementation:**
- Event type badge color-coded (red for mass_casualty, green for natural_disaster, etc.)
- Description text area
- "Key Facts" section with add form (timestamp + text) and list
- Facts stored in session.event_facts JSON array, saved via PUT `/api/cop/sessions/:id`
- "View Claims" and "View Network" links at bottom

**Step 1: Create the component**

**Step 2: Commit**

```bash
git add src/components/cop/CopEventTab.tsx
git commit -m "feat(cop): add CopEventTab with facts timeline"
```

---

## Task 10: Frontend — CopIntelTab

**Files:**
- Create: `src/components/cop/CopIntelTab.tsx`

Content intelligence integration tab. URL input + analyze button, list of analyzed content.

**Key implementation:**
- URL input with "Analyze" button
- Calls POST `/api/content-intelligence/analyze-url` with the URL
- Shows processing status (spinner)
- List of completed analyses showing: title, entity count, claims count
- "View" button links to content analysis page
- "Add entities to COP" button (future: promotes extracted entities to entity tables)
- Analyzed content IDs stored in `session.content_analyses`

**Step 1: Create the component**

**Step 2: Commit**

```bash
git add src/components/cop/CopIntelTab.tsx
git commit -m "feat(cop): add CopIntelTab for content intelligence integration"
```

---

## Task 11: Frontend — CopRfiTab

**Files:**
- Create: `src/components/cop/CopRfiTab.tsx`

Threaded RFI Q&A board.

**Key implementation:**
- Badge count in tab shows open RFIs
- "New RFI" button opens inline form (question + priority dropdown)
- RFI list sorted by priority then date
- Each RFI shows: question, priority badge, status badge, answer count
- Click to expand: shows threaded answers
- Each answer shows: text, source link (clickable), author, timestamp
- "Accept" button on each answer (marks it, updates status)
- POST/GET from `/api/cop/:id/rfis` and answer endpoints
- Polls every 30s for new answers

**Step 1: Create the component**

**Step 2: Commit**

```bash
git add src/components/cop/CopRfiTab.tsx
git commit -m "feat(cop): add CopRfiTab threaded Q&A board"
```

---

## Task 12: Frontend — CopQuestionsTab

**Files:**
- Create: `src/components/cop/CopQuestionsTab.tsx`

Starbursting integration showing 5W1H question categories with completion tracking.

**Key implementation:**
- If session has `linked_frameworks` with a starbursting session, fetch its data
- Shows 6 categories (Who, What, When, Where, Why, How) as collapsible sections
- Each category shows question count and completion %
- Click to expand: lists individual questions with answered/unanswered state
- "Open full starbursting view" link opens the framework page in new tab
- If no starbursting session linked, show "Generate Questions" button that creates one

**Step 1: Create the component**

**Step 2: Commit**

```bash
git add src/components/cop/CopQuestionsTab.tsx
git commit -m "feat(cop): add CopQuestionsTab starbursting integration"
```

---

## Task 13: Frontend — Wire CopPage to Use Event Sidebar

**Files:**
- Modify: `src/pages/CopPage.tsx`

**Step 1: Import CopEventSidebar**

```typescript
import CopEventSidebar from '@/components/cop/CopEventSidebar'
```

**Step 2: Add template label for event_analysis**

In `TEMPLATE_LABELS`, add: `event_analysis: 'Event Analysis'`

**Step 3: Conditional sidebar rendering**

Replace the `<CopLayerPanel ... />` in the body section with:

```typescript
{session.template_type === 'event_analysis' ? (
  <CopEventSidebar
    session={session}
    activeLayers={activeLayers}
    onToggleLayer={handleToggleLayer}
    layerCounts={layerCounts}
    onSessionUpdate={handleSessionUpdate}
  />
) : (
  <CopLayerPanel
    activeLayers={activeLayers}
    onToggleLayer={handleToggleLayer}
    layerCounts={layerCounts}
  />
)}
```

**Step 4: Add handleSessionUpdate callback**

```typescript
const handleSessionUpdate = useCallback(async (updates: Partial<CopSession>) => {
  if (!id) return
  try {
    await fetch(`/api/cop/sessions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    })
    setSession(prev => prev ? { ...prev, ...updates } : prev)
  } catch (err) {
    console.error('Failed to update session:', err)
  }
}, [id])
```

**Step 5: Update KPI footer for event_analysis**

Add RFI count to footer when event_analysis template.

**Step 6: Commit**

```bash
git add src/pages/CopPage.tsx
git commit -m "feat(cop): wire CopPage to render event sidebar for event_analysis sessions"
```

---

## Task 14: Frontend — CopShareDialog

**Files:**
- Create: `src/components/cop/CopShareDialog.tsx`

**Key implementation:**
- Uses existing Dialog component from `@/components/ui/dialog`
- Checkbox list: Map + Layers (always on, disabled), Event Briefing, Claims, RFI Portal, Starbursting Questions, Network Graph
- Toggle: "Allow RFI answers from viewers"
- "Generate Link" button calls POST `/api/cop/:id/shares`
- Shows generated link with copy button
- Shows existing share links with view counts

**Step 1: Create the component**

**Step 2: Wire into CopPage header**

Replace the current `handleShare` (clipboard copy) with opening the CopShareDialog when template is event_analysis. Keep simple clipboard copy for other templates.

**Step 3: Commit**

```bash
git add src/components/cop/CopShareDialog.tsx src/pages/CopPage.tsx
git commit -m "feat(cop): add configurable share dialog with panel selection"
```

---

## Task 15: Frontend — PublicCopPage

**Files:**
- Create: `src/pages/PublicCopPage.tsx`
- Modify: `src/routes/index.tsx` (add route)

**Key implementation:**
- Route: `/public/cop/:token`
- Fetches GET `/api/cop/public/:token`
- Renders COP map (read-only, no layer toggles)
- Conditionally renders panels based on `visible_panels` from API response
- If `allow_rfi_answers`, shows RFI tab with answer submission form
- Clean, public-facing layout (no dashboard sidebar)
- Auto-refresh interval for map data

**Step 1: Create PublicCopPage component**

**Step 2: Add route in `src/routes/index.tsx`**

After the existing public routes (around line 157), add:

```typescript
{
  path: '/public/cop/:token',
  element: <LazyPage Component={PublicCopPage} />,
},
```

And at the top with other lazy imports:

```typescript
const PublicCopPage = lazy(() => import('@/pages/PublicCopPage'))
```

**Step 3: Commit**

```bash
git add src/pages/PublicCopPage.tsx src/routes/index.tsx
git commit -m "feat(cop): add PublicCopPage for shared read-only COP views"
```

---

## Task 16: Final Integration & Polish

**Files:**
- Various minor tweaks

**Step 1: Update `parseJsonFields` everywhere**

Ensure all places that parse cop_sessions include `event_facts` and `content_analyses` in their JSON field lists. Check: `sessions.ts`, `sessions/[id].ts`, `public/[token].ts`.

**Step 2: Apply migration to remote D1 (if deploying)**

Run: `npx wrangler d1 execute researchtoolspy --remote --file schema/migrations/058-cop-event-analysis.sql`

**Step 3: Smoke test the full flow**

1. Create a new COP session with "Event Analysis" template
2. Fill in event type + description + location
3. Verify sidebar shows all 5 tabs
4. Add a key fact in Event tab
5. Paste a URL in Intel tab and verify analysis triggers
6. Create an RFI and submit an answer
7. Open share dialog, select panels, generate link
8. Open public link in incognito and verify read-only view
9. Submit an RFI answer from public view

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(cop): complete event analysis mode with RFIs, sharing, and public view"
```
