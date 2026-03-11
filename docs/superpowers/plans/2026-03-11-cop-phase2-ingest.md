# COP Phase 2: Crowdsource / Ingest — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add web-based intake forms (tiplines) that let external contributors submit structured reports into a COP session, with an analyst triage queue to accept/reject/promote submissions to evidence or tasks.

**Architecture:** Two new tables (`cop_intake_forms`, `cop_submissions`). Intake forms are JSON-schema-driven (like Ushahidi surveys). Public submission URL uses share-token pattern. Triage promotes submissions to existing evidence/task systems. File uploads to R2.

**Tech Stack:** Cloudflare Workers, D1, R2, TypeScript, React

**Spec:** `docs/superpowers/specs/2026-03-11-cop-enhancement-design.md` (Phase 2)

**Depends on:** Phase 1 (Event System) — imports `emitCopEvent` + event type constants

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `schema/migrations/071-add-cop-intake.sql` | Create | cop_intake_forms + cop_submissions tables |
| `src/types/cop.ts` | Modify | Add intake form + submission interfaces |
| `functions/api/cop/[id]/intake-forms.ts` | Create | GET/POST intake forms |
| `functions/api/cop/[id]/intake-forms/[formId].ts` | Create | GET/PUT single form |
| `functions/api/cop/[id]/submissions.ts` | Create | GET list, PUT triage |
| `functions/api/cop/public/intake/[token].ts` | Create | GET form schema (public) |
| `functions/api/cop/public/intake/[token]/submit.ts` | Create | POST submission (public) |
| `src/components/cop/CopIntakeFormBuilder.tsx` | Create | Form field editor UI |
| `src/components/cop/CopSubmissionInbox.tsx` | Create | Triage queue UI |
| `src/components/cop/PublicIntakeForm.tsx` | Create | Public submission page |
| `src/pages/PublicIntakePage.tsx` | Create | Route wrapper for public form |
| `tests/e2e/smoke/cop-intake.spec.ts` | Create | E2E tests |

---

## Chunk 1: Migration + Types

### Task 1: Create the intake migration

**Files:**
- Create: `schema/migrations/071-add-cop-intake.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 071: Add COP intake forms and submissions for crowdsource ingestion
-- Intake forms are JSON-schema-driven structured submission URLs.
-- Submissions flow through a triage queue before promotion to evidence/tasks.

CREATE TABLE IF NOT EXISTS cop_intake_forms (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',  -- 'draft', 'active', 'closed'
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,

  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_session ON cop_intake_forms(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_token ON cop_intake_forms(share_token);
CREATE INDEX IF NOT EXISTS idx_cop_intake_forms_status ON cop_intake_forms(status);

CREATE TABLE IF NOT EXISTS cop_submissions (
  id TEXT PRIMARY KEY,
  intake_form_id TEXT NOT NULL,
  cop_session_id TEXT NOT NULL,
  form_data TEXT DEFAULT '{}',
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  status TEXT DEFAULT 'pending',  -- 'pending', 'triaged', 'accepted', 'rejected'
  triaged_by INTEGER,
  rejection_reason TEXT,
  linked_evidence_id TEXT,
  linked_task_id TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (intake_form_id) REFERENCES cop_intake_forms(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_submissions_form ON cop_submissions(intake_form_id);
CREATE INDEX IF NOT EXISTS idx_cop_submissions_session ON cop_submissions(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_submissions_status ON cop_submissions(status);
```

- [ ] **Step 2: Commit**

```bash
git add schema/migrations/071-add-cop-intake.sql
git commit -m "feat(cop): add cop_intake_forms and cop_submissions tables (071)"
```

---

### Task 2: Add TypeScript interfaces

**Files:**
- Modify: `src/types/cop.ts`

- [ ] **Step 1: Add interfaces**

Append to `src/types/cop.ts`:

```typescript
// -- COP Intake Forms & Submissions (Phase 2: Crowdsource/Ingest) --

export type IntakeFormFieldType = 'text' | 'textarea' | 'number' | 'datetime' | 'select' | 'multiselect' | 'file' | 'checkbox'

export interface IntakeFormField {
  name: string
  type: IntakeFormFieldType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]  // For select/multiselect
  accept?: string     // For file (e.g., "image/*")
}

export type IntakeFormStatus = 'draft' | 'active' | 'closed'
export type SubmissionStatus = 'pending' | 'triaged' | 'accepted' | 'rejected'

export interface CopIntakeForm {
  id: string
  cop_session_id: string
  title: string
  description: string | null
  form_schema: IntakeFormField[]
  share_token: string
  status: IntakeFormStatus
  auto_tag_category: string | null
  require_location: number
  require_contact: number
  submission_count: number
  created_by: number
  workspace_id: string
  created_at: string
  updated_at: string
}

export interface CopSubmission {
  id: string
  intake_form_id: string
  cop_session_id: string
  form_data: Record<string, unknown>
  submitter_name: string | null
  submitter_contact: string | null
  lat: number | null
  lon: number | null
  status: SubmissionStatus
  triaged_by: number | null
  rejection_reason: string | null
  linked_evidence_id: string | null
  linked_task_id: string | null
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/cop.ts
git commit -m "feat(cop): add IntakeForm and Submission types"
```

---

## Chunk 2: Backend API — Authenticated Endpoints

### Task 3: Create intake forms CRUD endpoint

**Files:**
- Create: `functions/api/cop/[id]/intake-forms.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { INGEST_SUBMISSION_RECEIVED } from '../../_shared/cop-event-types'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

function generateId(): string {
  return `ifm-${crypto.randomUUID().slice(0, 12)}`
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string

  try {
    const results = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE cop_session_id = ? ORDER BY created_at DESC'
    ).bind(sessionId).all()

    const forms = (results.results || []).map((row: any) => {
      let form_schema = []
      try { form_schema = row.form_schema ? JSON.parse(row.form_schema) : [] } catch { form_schema = [] }
      return { ...row, form_schema }
    })

    return new Response(JSON.stringify({ intake_forms: forms }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Intake Forms] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list intake forms' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Look up workspace_id from session
    const session = await env.DB.prepare(
      'SELECT workspace_id FROM cop_sessions WHERE id = ?'
    ).bind(sessionId).first() as any

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const id = generateId()
    const shareToken = generateToken()
    const formSchema = JSON.stringify(body.form_schema || [])

    await env.DB.prepare(`
      INSERT INTO cop_intake_forms (id, cop_session_id, title, description, form_schema, share_token, status, auto_tag_category, require_location, require_contact, created_by, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, body.title.trim(), body.description?.trim() || null,
      formSchema, shareToken, body.status || 'draft',
      body.auto_tag_category || null,
      body.require_location ? 1 : 0,
      body.require_contact ? 1 : 0,
      userId, session.workspace_id
    ).run()

    return new Response(JSON.stringify({ id, share_token: shareToken, message: 'Intake form created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Intake Forms] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create intake form' }), {
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
git add functions/api/cop/[id]/intake-forms.ts
git commit -m "feat(cop): add intake forms GET/POST endpoint"
```

---

### Task 4: Create single intake form endpoint

**Files:**
- Create: `functions/api/cop/[id]/intake-forms/[formId].ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const sessionId = params.id as string
  const formId = params.formId as string

  try {
    const form = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?'
    ).bind(formId, sessionId).first() as any

    if (!form) {
      return new Response(JSON.stringify({ error: 'Intake form not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    let form_schema = []
    try { form_schema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { form_schema = [] }

    return new Response(JSON.stringify({ ...form, form_schema }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Intake Form] Get error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get intake form' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const formId = params.formId as string

  try {
    const body = await request.json() as any

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_intake_forms WHERE id = ? AND cop_session_id = ?'
    ).bind(formId, sessionId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Intake form not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    if (body.title !== undefined) { updates.push('title = ?'); bindings.push(body.title.trim()) }
    if (body.description !== undefined) { updates.push('description = ?'); bindings.push(body.description?.trim() || null) }
    if (body.form_schema !== undefined) { updates.push('form_schema = ?'); bindings.push(JSON.stringify(body.form_schema)) }
    if (body.status !== undefined) {
      const VALID = ['draft', 'active', 'closed']
      if (VALID.includes(body.status)) { updates.push('status = ?'); bindings.push(body.status) }
    }
    if (body.auto_tag_category !== undefined) { updates.push('auto_tag_category = ?'); bindings.push(body.auto_tag_category) }
    if (body.require_location !== undefined) { updates.push('require_location = ?'); bindings.push(body.require_location ? 1 : 0) }
    if (body.require_contact !== undefined) { updates.push('require_contact = ?'); bindings.push(body.require_contact ? 1 : 0) }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ message: 'No changes' }), { headers: corsHeaders })
    }

    updates.push('updated_at = ?')
    bindings.push(new Date().toISOString())
    bindings.push(formId, sessionId)

    await env.DB.prepare(
      `UPDATE cop_intake_forms SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    return new Response(JSON.stringify({ id: formId, message: 'Intake form updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Intake Form] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update intake form' }), {
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
git add functions/api/cop/[id]/intake-forms/[formId].ts
git commit -m "feat(cop): add intake form GET/PUT single endpoint"
```

---

### Task 5: Create submissions listing and triage endpoint

**Files:**
- Create: `functions/api/cop/[id]/submissions.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { getUserIdOrDefault } from '../../_shared/auth-helpers'
import { emitCopEvent } from '../../_shared/cop-events'
import { INGEST_SUBMISSION_TRIAGED, INGEST_SUBMISSION_REJECTED } from '../../_shared/cop-event-types'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const formId = url.searchParams.get('form_id')

    let query = 'SELECT * FROM cop_submissions WHERE cop_session_id = ?'
    const bindings: any[] = [sessionId]

    if (status) { query += ' AND status = ?'; bindings.push(status) }
    if (formId) { query += ' AND intake_form_id = ?'; bindings.push(formId) }

    query += ' ORDER BY created_at DESC LIMIT 200'

    const results = await env.DB.prepare(query).bind(...bindings).all()

    const submissions = (results.results || []).map((row: any) => {
      let form_data = {}
      try { form_data = row.form_data ? JSON.parse(row.form_data) : {} } catch { form_data = {} }
      return { ...row, form_data }
    })

    return new Response(JSON.stringify({ submissions }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Submissions] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list submissions' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string
  const userId = await getUserIdOrDefault(request, env)

  try {
    const body = await request.json() as any
    const subId = body.id

    if (!subId) {
      return new Response(JSON.stringify({ error: 'Submission ID required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM cop_submissions WHERE id = ? AND cop_session_id = ?'
    ).bind(subId, sessionId).first() as any

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Submission not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const updates: string[] = []
    const bindings: any[] = []

    const VALID_STATUSES = ['pending', 'triaged', 'accepted', 'rejected']
    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.push('status = ?'); bindings.push(body.status)
      updates.push('triaged_by = ?'); bindings.push(userId)
    }
    if (body.rejection_reason !== undefined) {
      updates.push('rejection_reason = ?'); bindings.push(body.rejection_reason)
    }
    if (body.linked_evidence_id !== undefined) {
      updates.push('linked_evidence_id = ?'); bindings.push(body.linked_evidence_id)
    }
    if (body.linked_task_id !== undefined) {
      updates.push('linked_task_id = ?'); bindings.push(body.linked_task_id)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ message: 'No changes' }), { headers: corsHeaders })
    }

    bindings.push(subId, sessionId)

    await env.DB.prepare(
      `UPDATE cop_submissions SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    // Emit event based on triage decision
    if (body.status === 'accepted' || body.status === 'triaged') {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: INGEST_SUBMISSION_TRIAGED,
        entityType: 'submission',
        entityId: subId,
        payload: {
          status: body.status,
          linked_evidence_id: body.linked_evidence_id || null,
          linked_task_id: body.linked_task_id || null,
        },
        createdBy: userId,
      })
    } else if (body.status === 'rejected') {
      await emitCopEvent(env.DB, {
        copSessionId: sessionId,
        eventType: INGEST_SUBMISSION_REJECTED,
        entityType: 'submission',
        entityId: subId,
        payload: { rejection_reason: body.rejection_reason || null },
        createdBy: userId,
      })
    }

    return new Response(JSON.stringify({ id: subId, message: 'Submission updated' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Submissions] Triage error:', error)
    return new Response(JSON.stringify({ error: 'Failed to triage submission' }), {
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
git add functions/api/cop/[id]/submissions.ts
git commit -m "feat(cop): add submissions listing and triage endpoint"
```

---

## Chunk 3: Public Submission Endpoints

### Task 6: Create public form schema endpoint

**Files:**
- Create: `functions/api/cop/public/intake/[token].ts`

- [ ] **Step 1: Write the endpoint**

```typescript
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params.token as string

  try {
    const form = await env.DB.prepare(
      'SELECT id, title, description, form_schema, require_location, require_contact, status FROM cop_intake_forms WHERE share_token = ?'
    ).bind(token).first() as any

    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (form.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This form is not currently accepting submissions' }), {
        status: 403, headers: corsHeaders,
      })
    }

    let form_schema = []
    try { form_schema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { form_schema = [] }

    return new Response(JSON.stringify({
      title: form.title,
      description: form.description,
      form_schema,
      require_location: form.require_location === 1,
      require_contact: form.require_contact === 1,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Public Intake] Form fetch error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load form' }), {
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
git add functions/api/cop/public/intake/[token].ts
git commit -m "feat(cop): add public intake form schema endpoint"
```

---

### Task 7: Create public submission endpoint

**Files:**
- Create: `functions/api/cop/public/intake/[token]/submit.ts`

- [ ] **Step 1: Write the endpoint**

```typescript
import { emitCopEvent } from '../../../../_shared/cop-events'
import { INGEST_SUBMISSION_RECEIVED } from '../../../../_shared/cop-event-types'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function generateId(): string {
  return `sub-${crypto.randomUUID().slice(0, 12)}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = params.token as string

  try {
    const form = await env.DB.prepare(
      'SELECT id, cop_session_id, status, require_location, require_contact, form_schema FROM cop_intake_forms WHERE share_token = ?'
    ).bind(token).first() as any

    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    if (form.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This form is not currently accepting submissions' }), {
        status: 403, headers: corsHeaders,
      })
    }

    const body = await request.json() as any

    // Validate required location
    if (form.require_location === 1 && (body.lat == null || body.lon == null)) {
      return new Response(JSON.stringify({ error: 'Location is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Validate required contact
    if (form.require_contact === 1 && !body.submitter_contact?.trim()) {
      return new Response(JSON.stringify({ error: 'Contact information is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Validate required form fields
    let formSchema = []
    try { formSchema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { formSchema = [] }

    const formData = body.form_data || {}
    for (const field of formSchema) {
      if (field.required && !formData[field.name]?.toString().trim()) {
        return new Response(JSON.stringify({ error: `${field.label} is required` }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    const id = generateId()

    await env.DB.prepare(`
      INSERT INTO cop_submissions (id, intake_form_id, cop_session_id, form_data, submitter_name, submitter_contact, lat, lon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, form.id, form.cop_session_id,
      JSON.stringify(formData),
      body.submitter_name?.trim() || null,
      body.submitter_contact?.trim() || null,
      body.lat ?? null, body.lon ?? null
    ).run()

    // Increment submission count
    await env.DB.prepare(
      'UPDATE cop_intake_forms SET submission_count = submission_count + 1 WHERE id = ?'
    ).bind(form.id).run()

    // Emit event
    await emitCopEvent(env.DB, {
      copSessionId: form.cop_session_id,
      eventType: INGEST_SUBMISSION_RECEIVED,
      entityType: 'submission',
      entityId: id,
      payload: {
        intake_form_id: form.id,
        submitter_name: body.submitter_name || null,
        has_location: body.lat != null,
      },
      createdBy: 0, // Anonymous public submission
    })

    return new Response(JSON.stringify({ id, message: 'Submission received. Thank you.' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP Public Intake] Submit error:', error)
    return new Response(JSON.stringify({ error: 'Failed to submit' }), {
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
git add functions/api/cop/public/intake/[token]/submit.ts
git commit -m "feat(cop): add public submission endpoint with validation"
```

---

## Chunk 4: Frontend Components

### Task 8: Create the submission inbox (triage queue)

**Files:**
- Create: `src/components/cop/CopSubmissionInbox.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useState, useCallback, useEffect, useRef } from 'react'
import { getCopHeaders } from '../../lib/cop-auth'
import { Inbox, Check, X, FileText, MapPin, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { CopSubmission } from '../../types/cop'

interface CopSubmissionInboxProps {
  sessionId: string
  expanded: boolean
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  triaged: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accepted: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function CopSubmissionInbox({ sessionId, expanded }: CopSubmissionInboxProps) {
  const [submissions, setSubmissions] = useState<CopSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetchSubmissions = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = filter ? `?status=${filter}` : ''
      const res = await fetch(`/api/cop/${sessionId}/submissions${params}`, {
        headers: getCopHeaders(),
        signal,
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSubmissions(data.submissions ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [sessionId, filter])

  useEffect(() => {
    const controller = new AbortController()
    fetchSubmissions(controller.signal)
    intervalRef.current = setInterval(() => fetchSubmissions(controller.signal), 30000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchSubmissions])

  const handleTriage = useCallback(async (subId: string, status: 'accepted' | 'rejected', rejectionReason?: string) => {
    try {
      const res = await fetch(`/api/cop/${sessionId}/submissions`, {
        method: 'PUT',
        headers: getCopHeaders(),
        body: JSON.stringify({ id: subId, status, rejection_reason: rejectionReason || null }),
      })
      if (!res.ok) throw new Error('Failed to triage')
      await fetchSubmissions()
    } catch {
      // Silent fail
    }
  }, [sessionId, fetchSubmissions])

  if (!expanded) {
    const pendingCount = submissions.filter(s => s.status === 'pending').length
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {pendingCount > 0 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              {pendingCount} pending
            </span>
          )}
          <span className="text-[9px] text-muted-foreground">{submissions.length} total</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800">
        {['pending', 'accepted', 'rejected', ''].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Submissions list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
        ) : submissions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No submissions</div>
        ) : (
          submissions.map(sub => (
            <div key={sub.id} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
              <button
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                      {sub.status}
                    </span>
                    <span className="text-xs truncate">{sub.submitter_name || 'Anonymous'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sub.lat != null && <MapPin className="h-3 w-3 text-muted-foreground" />}
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                    {expandedId === sub.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </div>
              </button>

              {expandedId === sub.id && (
                <div className="px-3 pb-3 space-y-2">
                  {/* Form data */}
                  <div className="bg-muted/30 rounded p-2 text-xs space-y-1">
                    {Object.entries(sub.form_data).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="font-medium text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Contact info */}
                  {sub.submitter_contact && (
                    <div className="text-[10px] text-muted-foreground">
                      Contact: {sub.submitter_contact}
                    </div>
                  )}

                  {/* Triage actions */}
                  {sub.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTriage(sub.id, 'accepted')}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                      <button
                        onClick={() => handleTriage(sub.id, 'rejected')}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopSubmissionInbox.tsx
git commit -m "feat(cop): add CopSubmissionInbox triage queue component"
```

---

### Task 9: Create the intake form builder

**Files:**
- Create: `src/components/cop/CopIntakeFormBuilder.tsx`

- [ ] **Step 1: Write the component**

This is a form field editor where analysts define what fields the public submission form will have. Key features:
- Add/remove/reorder fields
- Field type selector (text, textarea, number, datetime, select, file, checkbox)
- Required toggle per field
- Options editor for select fields
- Preview mode
- Save to API

```typescript
import { useState, useCallback } from 'react'
import { getCopHeaders } from '../../lib/cop-auth'
import { Plus, Trash2, GripVertical, Eye, Save } from 'lucide-react'
import type { IntakeFormField, IntakeFormFieldType } from '../../types/cop'

interface CopIntakeFormBuilderProps {
  sessionId: string
  formId?: string  // If editing existing
  initialTitle?: string
  initialDescription?: string
  initialFields?: IntakeFormField[]
  onSaved?: (formId: string, shareToken: string) => void
}

const FIELD_TYPES: { value: IntakeFormFieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'datetime', label: 'Date/Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'file', label: 'File Upload' },
  { value: 'checkbox', label: 'Checkbox' },
]

export default function CopIntakeFormBuilder({
  sessionId, formId, initialTitle, initialDescription, initialFields, onSaved,
}: CopIntakeFormBuilderProps) {
  const [title, setTitle] = useState(initialTitle || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [fields, setFields] = useState<IntakeFormField[]>(initialFields || [])
  const [requireLocation, setRequireLocation] = useState(false)
  const [requireContact, setRequireContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const addField = useCallback(() => {
    setFields(prev => [...prev, {
      name: `field_${prev.length + 1}`,
      type: 'text',
      label: '',
      required: false,
    }])
  }, [])

  const removeField = useCallback((index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateField = useCallback((index: number, updates: Partial<IntakeFormField>) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f))
  }, [])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        form_schema: fields,
        require_location: requireLocation,
        require_contact: requireContact,
        status: 'draft',
      }

      const url = formId
        ? `/api/cop/${sessionId}/intake-forms/${formId}`
        : `/api/cop/${sessionId}/intake-forms`
      const method = formId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: getCopHeaders(),
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      onSaved?.(data.id, data.share_token)
    } catch {
      // Silent fail
    } finally {
      setSaving(false)
    }
  }, [title, description, fields, requireLocation, requireContact, sessionId, formId, onSaved])

  return (
    <div className="space-y-4 p-4">
      {/* Title & Description */}
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Form title (e.g., 'Submit a Tip')"
          className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Instructions for submitters..."
          rows={2}
          className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background resize-none"
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={requireLocation} onChange={e => setRequireLocation(e.target.checked)} />
          Require location
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={requireContact} onChange={e => setRequireContact(e.target.checked)} />
          Require contact info
        </label>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider">Form Fields</h4>
          <button
            onClick={addField}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Field
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={index} className="flex items-start gap-2 p-2 rounded border border-slate-200 dark:border-slate-700 bg-muted/20">
            <GripVertical className="h-4 w-4 text-muted-foreground mt-2 cursor-grab shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={e => updateField(index, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="Field label"
                  className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(index, { type: e.target.value as IntakeFormFieldType })}
                  className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-background"
                >
                  {FIELD_TYPES.map(ft => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[10px]">
                  <input
                    type="checkbox"
                    checked={field.required || false}
                    onChange={e => updateField(index, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>

              {/* Options editor for select types */}
              {(field.type === 'select' || field.type === 'multiselect') && (
                <input
                  type="text"
                  value={(field.options || []).join(', ')}
                  onChange={e => updateField(index, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="Options (comma-separated)"
                  className="w-full px-2 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}
            </div>
            <button
              onClick={() => removeField(index)}
              className="p-1 text-red-400 hover:text-red-300 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Form'}
        </button>
        <button
          onClick={() => setPreview(!preview)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-muted transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          {preview ? 'Hide Preview' : 'Preview'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/CopIntakeFormBuilder.tsx
git commit -m "feat(cop): add CopIntakeFormBuilder form field editor"
```

---

### Task 10: Create the public intake form page

**Files:**
- Create: `src/components/cop/PublicIntakeForm.tsx`

- [ ] **Step 1: Write the component**

Public-facing submission form that renders from the form_schema JSON. Clean, minimal design. No auth required.

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Send, CheckCircle2, AlertCircle, MapPin } from 'lucide-react'
import type { IntakeFormField } from '../../types/cop'

interface PublicIntakeFormProps {
  token: string
}

export default function PublicIntakeForm({ token }: PublicIntakeFormProps) {
  const [formMeta, setFormMeta] = useState<{
    title: string; description: string | null
    form_schema: IntakeFormField[]
    require_location: boolean; require_contact: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [submitterName, setSubmitterName] = useState('')
  const [submitterContact, setSubmitterContact] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/cop/public/intake/${token}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Form closed' : 'Form not found')
        return res.json()
      })
      .then(data => { setFormMeta(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [token])

  const requestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLon(pos.coords.longitude) },
      () => { /* User denied or unavailable */ }
    )
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formMeta) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/cop/public/intake/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_data: formData,
          submitter_name: submitterName || null,
          submitter_contact: submitterContact || null,
          lat, lon,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }, [formMeta, formData, submitterName, submitterContact, lat, lon, token])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="text-sm text-muted-foreground">Loading...</span></div>
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    </div>
  )
  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-2">
        <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
        <p className="text-sm font-medium">Submission received. Thank you.</p>
      </div>
    </div>
  )
  if (!formMeta) return null

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold">{formMeta.title}</h1>
          {formMeta.description && <p className="text-sm text-muted-foreground mt-1">{formMeta.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dynamic form fields */}
          {formMeta.form_schema.map(field => (
            <div key={field.name} className="space-y-1">
              <label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>

              {field.type === 'text' && (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background resize-none"
                />
              )}

              {field.type === 'number' && (
                <input
                  type="number"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'datetime' && (
                <input
                  type="datetime-local"
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                />
              )}

              {field.type === 'select' && (
                <select
                  required={field.required}
                  value={formData[field.name] || ''}
                  onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
                >
                  <option value="">Select...</option>
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData[field.name] === 'true'}
                    onChange={e => setFormData(prev => ({ ...prev, [field.name]: String(e.target.checked) }))}
                  />
                  <span className="text-sm">{field.placeholder || field.label}</span>
                </label>
              )}
            </div>
          ))}

          {/* Name (always optional) */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Your name (optional)</label>
            <input
              type="text"
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
            />
          </div>

          {/* Contact */}
          {formMeta.require_contact && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Contact (email or phone) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={submitterContact}
                onChange={e => setSubmitterContact(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-700 bg-background"
              />
            </div>
          )}

          {/* Location */}
          {formMeta.require_location && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Location <span className="text-red-400">*</span>
              </label>
              {lat != null ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {lat.toFixed(4)}, {lon?.toFixed(4)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 hover:bg-muted transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" /> Share my location
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cop/PublicIntakeForm.tsx
git commit -m "feat(cop): add PublicIntakeForm public submission component"
```

---

### Task 11: Add route for public intake page

**Files:**
- Create: `src/pages/PublicIntakePage.tsx`
- Modify: Router file (check `src/App.tsx` or equivalent for route definitions)

- [ ] **Step 1: Create the page wrapper**

```typescript
import { useParams } from 'react-router-dom'
import PublicIntakeForm from '../components/cop/PublicIntakeForm'

export default function PublicIntakePage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return <div className="p-4 text-center text-sm text-red-400">Invalid link</div>
  return <PublicIntakeForm token={token} />
}
```

- [ ] **Step 2: Add route to router**

Add to the routes array (find the existing `/public/cop/:token` route for reference):

```typescript
{ path: '/public/intake/:token', element: <PublicIntakePage /> }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/PublicIntakePage.tsx
# Also git add the router file if modified
git commit -m "feat(cop): add public intake page route"
```

---

## Chunk 5: E2E Tests + Migration

### Task 12: Write E2E tests

**Files:**
- Create: `tests/e2e/smoke/cop-intake.spec.ts`

- [ ] **Step 1: Write tests covering form creation, submission, and triage**

Follow the existing test patterns with mock routes. Cover:
- Public form renders fields from schema
- Required field validation
- Submission creates a pending entry
- Triage accept/reject updates status
- Closed form shows error message

- [ ] **Step 2: Apply migration locally**

Run: `npx wrangler d1 execute researchtoolspy-db --local --file=schema/migrations/071-add-cop-intake.sql`

- [ ] **Step 3: Run tests**

Run: `npx playwright test tests/e2e/smoke/cop-intake.spec.ts --reporter=list`

- [ ] **Step 4: Run full suite for regressions**

Run: `npx playwright test --reporter=list`

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/smoke/cop-intake.spec.ts
git commit -m "test(cop): add E2E tests for intake forms and submissions"
```

---

## Summary

| Task | Files | What |
|---|---|---|
| 1 | Migration 071 | intake_forms + submissions tables |
| 2 | src/types/cop.ts | TypeScript interfaces |
| 3 | intake-forms.ts | GET/POST forms endpoint |
| 4 | intake-forms/[formId].ts | GET/PUT single form |
| 5 | submissions.ts | GET/PUT triage endpoint |
| 6 | public/intake/[token].ts | Public form schema |
| 7 | public/intake/[token]/submit.ts | Public submission |
| 8 | CopSubmissionInbox.tsx | Triage queue UI |
| 9 | CopIntakeFormBuilder.tsx | Form editor UI |
| 10 | PublicIntakeForm.tsx | Public submission UI |
| 11 | PublicIntakePage.tsx + router | Route wiring |
| 12 | cop-intake.spec.ts | E2E tests |
