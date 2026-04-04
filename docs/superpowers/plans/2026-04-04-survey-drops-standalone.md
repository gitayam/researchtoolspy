# Survey Drops Standalone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Survey Drops system that works independently of COP, with optional COP integration, replacing the existing `cop_intake_forms` / `cop_submissions` tables.

**Architecture:** New `survey_drops` + `survey_responses` tables with their own API under `/api/surveys/`. Data migrated from old COP intake tables. Frontend gets a dedicated `/dashboard/surveys` list page and `/dashboard/surveys/:id` detail page. Existing public intake endpoints repointed. COP integration via optional `cop_session_id` FK and push-to-COP action.

**Tech Stack:** Cloudflare Workers (Pages Functions), D1 (SQLite), React + TypeScript, Tailwind CSS. Reuses existing `survey-drops.ts` shared helpers (PBKDF2, rate limiting, geo-gating).

**Spec:** `docs/superpowers/specs/2026-04-04-survey-drops-standalone-design.md`

---

## Task 1: Database Migration + TypeScript Types

**Files:**
- Create: `schema/migrations/101-survey-drops-standalone.sql`
- Modify: `src/types/cop.ts` (add `SurveyDrop` and `SurveyResponse` interfaces)

- [ ] **Step 1: Write the migration SQL**

Create `schema/migrations/101-survey-drops-standalone.sql`:

```sql
-- Migration 101: Standalone Survey Drops system
-- Creates survey_drops + survey_responses tables, migrates data from cop_intake_forms + cop_submissions

-- ── New tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS survey_drops (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',
  share_token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  access_level TEXT DEFAULT 'public',
  password_hash TEXT,
  allowed_countries TEXT DEFAULT '[]',
  rate_limit_per_hour INTEGER DEFAULT 0,
  custom_slug TEXT,
  expires_at TEXT,
  theme_color TEXT,
  logo_url TEXT,
  success_message TEXT,
  redirect_url TEXT,
  auto_tag_category TEXT,
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  cop_session_id TEXT,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_by INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_token ON survey_drops(share_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_drops_slug ON survey_drops(custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_drops_creator ON survey_drops(created_by);
CREATE INDEX IF NOT EXISTS idx_survey_drops_status ON survey_drops(status);
CREATE INDEX IF NOT EXISTS idx_survey_drops_cop ON survey_drops(cop_session_id) WHERE cop_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  form_data TEXT DEFAULT '{}',
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  submitter_country TEXT,
  submitter_city TEXT,
  submitter_ip_hash TEXT,
  content_hash TEXT,
  status TEXT DEFAULT 'pending',
  triaged_by INTEGER,
  rejection_reason TEXT,
  cop_session_id TEXT,
  linked_evidence_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (survey_id) REFERENCES survey_drops(id),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status ON survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rate ON survey_responses(survey_id, submitter_ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_dedup ON survey_responses(survey_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_survey_responses_cop ON survey_responses(cop_session_id) WHERE cop_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_country ON survey_responses(submitter_country);

-- ── Migrate existing data ────────────────────────────────────

INSERT OR IGNORE INTO survey_drops (
  id, title, description, form_schema, share_token, status,
  access_level, password_hash, allowed_countries, rate_limit_per_hour,
  custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
  auto_tag_category, require_location, require_contact, submission_count,
  cop_session_id, workspace_id, created_by, created_at, updated_at
)
SELECT
  id, title, description, form_schema, share_token, status,
  COALESCE(access_level, 'public'), password_hash,
  COALESCE(allowed_countries, '[]'), COALESCE(rate_limit_per_hour, 0),
  custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
  auto_tag_category, require_location, require_contact, submission_count,
  cop_session_id, workspace_id, created_by, created_at, updated_at
FROM cop_intake_forms;

INSERT OR IGNORE INTO survey_responses (
  id, survey_id, form_data, submitter_name, submitter_contact,
  lat, lon, submitter_country, submitter_city, submitter_ip_hash, content_hash,
  status, triaged_by, rejection_reason, cop_session_id,
  linked_evidence_id, created_at, updated_at
)
SELECT
  id, intake_form_id, form_data, submitter_name, submitter_contact,
  lat, lon, submitter_country, submitter_city, submitter_ip_hash, content_hash,
  status, triaged_by, rejection_reason, cop_session_id,
  linked_evidence_id, created_at, updated_at
FROM cop_submissions;
```

- [ ] **Step 2: Add TypeScript types**

In `src/types/cop.ts`, after the existing `CopSubmission` interface, add:

```typescript
// -- Survey Drops (Standalone) --

export interface SurveyDrop {
  id: string
  title: string
  description: string | null
  form_schema: IntakeFormField[]
  share_token: string
  status: IntakeFormStatus
  access_level: IntakeAccessLevel
  allowed_countries: string[]
  rate_limit_per_hour: number
  custom_slug: string | null
  expires_at: string | null
  theme_color: string | null
  logo_url: string | null
  success_message: string | null
  redirect_url: string | null
  auto_tag_category: string | null
  require_location: number
  require_contact: number
  submission_count: number
  cop_session_id: string | null
  workspace_id: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface SurveyResponse {
  id: string
  survey_id: string
  form_data: Record<string, unknown>
  submitter_name: string | null
  submitter_contact: string | null
  lat: number | null
  lon: number | null
  submitter_country: string | null
  submitter_city: string | null
  content_hash: string | null
  status: SubmissionStatus
  triaged_by: number | null
  rejection_reason: string | null
  cop_session_id: string | null
  linked_evidence_id: string | null
  created_at: string
  updated_at: string | null
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add schema/migrations/101-survey-drops-standalone.sql src/types/cop.ts
git commit -m "feat(surveys): add standalone survey_drops schema + types (migration 101)"
```

---

## Task 2: Core Survey API (CRUD + Responses)

**Files:**
- Create: `functions/api/surveys/index.ts` (GET list, POST create)
- Create: `functions/api/surveys/[id].ts` (GET detail, PUT update, DELETE archive)
- Create: `functions/api/surveys/[id]/responses.ts` (GET list, PUT triage)

- [ ] **Step 1: Create survey list + create endpoint**

Create `functions/api/surveys/index.ts`:

```typescript
/**
 * Surveys API — List + Create
 *
 * GET  /api/surveys       — List surveys for authenticated user
 * POST /api/surveys       — Create a new survey
 */
import { getUserFromRequest } from '../_shared/auth-helpers'
import { generatePrefixedId, JSON_HEADERS } from '../_shared/api-utils'
import { hashPassword, isValidAccessLevel, isValidSlug } from '../_shared/survey-drops'

interface Env {
  DB: D1Database
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM survey_drops WHERE created_by = ?'
    const binds: any[] = [userId]

    if (status) {
      query += ' AND status = ?'
      binds.push(status)
    }

    query += ' ORDER BY created_at DESC LIMIT 200'

    const results = await env.DB.prepare(query).bind(...binds).all()

    const surveys = (results.results || []).map((row: any) => ({
      ...row,
      form_schema: safeJsonParse(row.form_schema, []),
      allowed_countries: safeJsonParse(row.allowed_countries, []),
    }))

    return new Response(JSON.stringify({ surveys }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list surveys' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const body = await request.json() as any

    if (!body.title?.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const accessLevel = body.access_level || 'public'
    if (!isValidAccessLevel(accessLevel)) {
      return new Response(JSON.stringify({ error: 'access_level must be public, password, or internal' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    let passwordHash: string | null = null
    if (accessLevel === 'password') {
      if (!body.password) {
        return new Response(JSON.stringify({ error: 'Password required for password-protected surveys' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      passwordHash = await hashPassword(body.password)
    }

    if (body.custom_slug) {
      if (!isValidSlug(body.custom_slug)) {
        return new Response(JSON.stringify({ error: 'Slug must be 3-50 lowercase alphanumeric characters with hyphens' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      const slugExists = await env.DB.prepare(
        'SELECT id FROM survey_drops WHERE custom_slug = ?'
      ).bind(body.custom_slug).first()
      if (slugExists) {
        return new Response(JSON.stringify({ error: 'This slug is already in use' }), {
          status: 409, headers: JSON_HEADERS,
        })
      }
    }

    let allowedCountries = '[]'
    if (body.allowed_countries && Array.isArray(body.allowed_countries)) {
      allowedCountries = JSON.stringify(body.allowed_countries.map((c: string) => String(c).toUpperCase()))
    }

    const id = generatePrefixedId('srv')
    const shareToken = generateToken()
    const formSchema = JSON.stringify(body.form_schema || [])

    await env.DB.prepare(`
      INSERT INTO survey_drops (
        id, title, description, form_schema, share_token, status,
        access_level, password_hash, allowed_countries, rate_limit_per_hour,
        custom_slug, expires_at, theme_color, logo_url, success_message, redirect_url,
        auto_tag_category, require_location, require_contact,
        cop_session_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.title.trim(), body.description?.trim() || null,
      formSchema, shareToken, body.status || 'draft',
      accessLevel, passwordHash, allowedCountries,
      body.rate_limit_per_hour ?? 0,
      body.custom_slug || null,
      body.expires_at || null,
      body.theme_color || null,
      body.logo_url || null,
      body.success_message || null,
      body.redirect_url || null,
      body.auto_tag_category || null,
      body.require_location ? 1 : 0,
      body.require_contact ? 1 : 0,
      body.cop_session_id || null,
      userId
    ).run()

    return new Response(JSON.stringify({
      id, share_token: shareToken,
      custom_slug: body.custom_slug || null,
      message: 'Survey created',
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

function safeJsonParse(val: string | null, fallback: any): any {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}
```

- [ ] **Step 2: Create survey detail endpoint**

Create `functions/api/surveys/[id].ts`:

```typescript
/**
 * Survey Detail API
 *
 * GET    /api/surveys/:id  — Get survey detail
 * PUT    /api/surveys/:id  — Update survey
 * DELETE /api/surveys/:id  — Archive survey (set status=closed)
 */
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { hashPassword, isValidAccessLevel, isValidSlug } from '../../_shared/survey-drops'

interface Env {
  DB: D1Database
}

function safeJsonParse(val: string | null, fallback: any): any {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

async function verifySurveyOwnership(db: D1Database, surveyId: string, userId: number): Promise<any | null> {
  const survey = await db.prepare(
    'SELECT * FROM survey_drops WHERE id = ?'
  ).bind(surveyId).first()
  if (!survey) return null
  if (Number(survey.created_by) !== userId) return null
  return survey
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await verifySurveyOwnership(env.DB, surveyId, userId)
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...survey,
      form_schema: safeJsonParse(survey.form_schema, []),
      allowed_countries: safeJsonParse(survey.allowed_countries, []),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Get error:', error)
    return new Response(JSON.stringify({ error: 'Failed to get survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await verifySurveyOwnership(env.DB, surveyId, userId)
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const updates: string[] = []
    const binds: any[] = []

    const scalarFields = [
      'title', 'description', 'status', 'auto_tag_category',
      'custom_slug', 'expires_at', 'theme_color', 'logo_url',
      'success_message', 'redirect_url', 'cop_session_id',
    ]

    for (const field of scalarFields) {
      if (body[field] !== undefined) {
        if (field === 'custom_slug' && body[field]) {
          if (!isValidSlug(body[field])) {
            return new Response(JSON.stringify({ error: 'Invalid slug format' }), {
              status: 400, headers: JSON_HEADERS,
            })
          }
        }
        updates.push(`${field} = ?`)
        binds.push(body[field])
      }
    }

    if (body.access_level !== undefined) {
      if (!isValidAccessLevel(body.access_level)) {
        return new Response(JSON.stringify({ error: 'Invalid access_level' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      updates.push('access_level = ?')
      binds.push(body.access_level)
    }

    if (body.password !== undefined) {
      const hash = await hashPassword(body.password)
      updates.push('password_hash = ?')
      binds.push(hash)
    }

    if (body.form_schema !== undefined) {
      updates.push('form_schema = ?')
      binds.push(JSON.stringify(body.form_schema))
    }

    if (body.allowed_countries !== undefined) {
      updates.push('allowed_countries = ?')
      binds.push(JSON.stringify(
        Array.isArray(body.allowed_countries)
          ? body.allowed_countries.map((c: string) => String(c).toUpperCase())
          : []
      ))
    }

    if (body.require_location !== undefined) {
      updates.push('require_location = ?')
      binds.push(body.require_location ? 1 : 0)
    }
    if (body.require_contact !== undefined) {
      updates.push('require_contact = ?')
      binds.push(body.require_contact ? 1 : 0)
    }
    if (body.rate_limit_per_hour !== undefined) {
      updates.push('rate_limit_per_hour = ?')
      binds.push(body.rate_limit_per_hour)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    updates.push("updated_at = datetime('now')")
    binds.push(surveyId)

    await env.DB.prepare(
      `UPDATE survey_drops SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds).run()

    return new Response(JSON.stringify({ message: 'Survey updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await verifySurveyOwnership(env.DB, surveyId, userId)
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare(
      "UPDATE survey_drops SET status = 'closed', updated_at = datetime('now') WHERE id = ?"
    ).bind(surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey archived' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to archive survey' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
```

- [ ] **Step 3: Create responses endpoint**

Create `functions/api/surveys/[id]/responses.ts`:

```typescript
/**
 * Survey Responses API
 *
 * GET /api/surveys/:id/responses — List responses (with ?status= filter)
 * PUT /api/surveys/:id/responses — Triage single or batch
 */
import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    // Verify ownership
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM survey_responses WHERE survey_id = ?'
    const binds: any[] = [surveyId]
    if (status) {
      query += ' AND status = ?'
      binds.push(status)
    }
    query += ' ORDER BY created_at DESC LIMIT 500'

    const results = await env.DB.prepare(query).bind(...binds).all()
    const responses = (results.results || []).map((row: any) => ({
      ...row,
      form_data: row.form_data ? JSON.parse(row.form_data) : {},
    }))

    return new Response(JSON.stringify({ responses }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Responses] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list responses' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const validStatuses = ['accepted', 'rejected', 'pending']
    if (!body.status || !validStatuses.includes(body.status)) {
      return new Response(JSON.stringify({ error: 'status must be accepted, rejected, or pending' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const now = new Date().toISOString()

    // Batch triage
    if (body.ids && Array.isArray(body.ids)) {
      const stmts = body.ids.map((id: string) =>
        env.DB.prepare(
          'UPDATE survey_responses SET status = ?, triaged_by = ?, rejection_reason = ?, updated_at = ? WHERE id = ? AND survey_id = ?'
        ).bind(body.status, userId, body.rejection_reason || null, now, id, surveyId)
      )
      await env.DB.batch(stmts)
      return new Response(JSON.stringify({ message: `${body.ids.length} responses triaged` }), { headers: JSON_HEADERS })
    }

    // Single triage
    if (!body.id) {
      return new Response(JSON.stringify({ error: 'id or ids required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare(
      'UPDATE survey_responses SET status = ?, triaged_by = ?, rejection_reason = ?, updated_at = ? WHERE id = ? AND survey_id = ?'
    ).bind(body.status, userId, body.rejection_reason || null, now, body.id, surveyId).run()

    return new Response(JSON.stringify({ message: 'Response triaged' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Responses] Triage error:', error)
    return new Response(JSON.stringify({ error: 'Failed to triage response' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add functions/api/surveys/
git commit -m "feat(surveys): add core CRUD + responses API endpoints"
```

---

## Task 3: Public Survey Endpoints

**Files:**
- Create: `functions/api/surveys/public/[token].ts`
- Create: `functions/api/surveys/public/[token]/submit.ts`
- Create: `functions/api/surveys/public/[token]/verify-password.ts`
- Create: `functions/api/surveys/public/by-slug/[slug].ts`

These are largely ports of the existing `cop/public/intake/` endpoints but targeting `survey_drops` / `survey_responses` tables instead of the old COP tables. They reuse the same `survey-drops.ts` shared helpers.

- [ ] **Step 1: Create public form schema endpoint**

Create `functions/api/surveys/public/[token].ts` — same logic as `functions/api/cop/public/intake/[token].ts` but queries `survey_drops` instead of `cop_intake_forms`. Copy the existing file and change:
- Table name: `cop_intake_forms` → `survey_drops`
- Import path adjustments for deeper nesting (`../../../_shared/` → `../../../_shared/`)

The function body is identical: expiry check, country gate, password gate, internal gate, return schema.

- [ ] **Step 2: Create public submit endpoint**

Create `functions/api/surveys/public/[token]/submit.ts` — same logic as `functions/api/cop/public/intake/[token]/submit.ts` but:
- Queries `survey_drops` instead of `cop_intake_forms`
- Inserts into `survey_responses` instead of `cop_submissions`
- Uses `survey_id` column instead of `intake_form_id`
- If `survey_drops.cop_session_id` is set, auto-sets `cop_session_id` on the response
- Emits `INGEST_SUBMISSION_RECEIVED` event only if `cop_session_id` is set

- [ ] **Step 3: Create password verify endpoint**

Create `functions/api/surveys/public/[token]/verify-password.ts` — same as existing, queries `survey_drops`.

- [ ] **Step 4: Create slug resolver**

Create `functions/api/surveys/public/by-slug/[slug].ts` — same as existing, queries `survey_drops`. Does NOT return `share_token` (per review fix).

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add functions/api/surveys/public/
git commit -m "feat(surveys): add public endpoints (submit, password, slug)"
```

---

## Task 4: COP Integration Bridge

**Files:**
- Create: `functions/api/surveys/[id]/link-cop.ts`
- Create: `functions/api/surveys/[id]/responses/[rid]/push-to-cop.ts`
- Modify: `src/components/cop/CopSubmissionInbox.tsx`

- [ ] **Step 1: Create link-cop endpoint**

Create `functions/api/surveys/[id]/link-cop.ts`:

```typescript
/**
 * Survey ↔ COP Link
 *
 * POST   /api/surveys/:id/link-cop   — Link survey to COP session
 * DELETE /api/surveys/:id/link-cop   — Unlink survey from COP
 */
import { getUserFromRequest, verifyCopSessionAccess } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    if (!body.cop_session_id) {
      return new Response(JSON.stringify({ error: 'cop_session_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Verify COP session access
    const wsId = await verifyCopSessionAccess(env.DB, body.cop_session_id, userId)
    if (!wsId) {
      return new Response(JSON.stringify({ error: 'COP session access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Link survey
    await env.DB.prepare(
      "UPDATE survey_drops SET cop_session_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(body.cop_session_id, surveyId).run()

    // Backfill existing responses
    await env.DB.prepare(
      'UPDATE survey_responses SET cop_session_id = ? WHERE survey_id = ? AND cop_session_id IS NULL'
    ).bind(body.cop_session_id, surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey linked to COP session' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Link COP error:', error)
    return new Response(JSON.stringify({ error: 'Failed to link' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await env.DB.prepare(
      'SELECT id FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first()
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    await env.DB.prepare(
      "UPDATE survey_drops SET cop_session_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(surveyId).run()

    return new Response(JSON.stringify({ message: 'Survey unlinked from COP' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Unlink COP error:', error)
    return new Response(JSON.stringify({ error: 'Failed to unlink' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
```

- [ ] **Step 2: Create push-to-cop endpoint**

Create `functions/api/surveys/[id]/responses/[rid]/push-to-cop.ts`:

```typescript
/**
 * Push Survey Response → COP Evidence
 *
 * POST /api/surveys/:id/responses/:rid/push-to-cop
 * Body: { cop_session_id }
 */
import { getUserFromRequest, verifyCopSessionAccess } from '../../../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../../../_shared/api-utils'
import { emitCopEvent } from '../../../../../_shared/cop-events'
import { EVIDENCE_CREATED } from '../../../../../_shared/cop-event-types'
import { createTimelineEntry } from '../../../../../_shared/timeline-helper'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const responseId = params.rid as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    // Verify survey ownership
    const survey = await env.DB.prepare(
      'SELECT id, title FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; title: string }>()
    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Get response
    const response = await env.DB.prepare(
      'SELECT * FROM survey_responses WHERE id = ? AND survey_id = ?'
    ).bind(responseId, surveyId).first<any>()
    if (!response) {
      return new Response(JSON.stringify({ error: 'Response not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (response.linked_evidence_id) {
      return new Response(JSON.stringify({ error: 'Response already pushed to COP' }), {
        status: 409, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const copSessionId = body.cop_session_id || survey.cop_session_id
    if (!copSessionId) {
      return new Response(JSON.stringify({ error: 'cop_session_id is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Verify COP access
    const wsId = await verifyCopSessionAccess(env.DB, copSessionId, userId)
    if (!wsId) {
      return new Response(JSON.stringify({ error: 'COP session access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Format form data as content
    const formData = response.form_data ? JSON.parse(response.form_data) : {}
    const contentLines = Object.entries(formData).map(([k, v]) => `${k}: ${v}`).join('\n')
    const title = `Survey: ${survey.title} — ${response.submitter_name || 'Anonymous'}`
    const now = new Date().toISOString()

    // Create evidence item
    const result = await env.DB.prepare(`
      INSERT INTO evidence_items (
        title, description, evidence_type, confidence_level,
        credibility, reliability, status, workspace_id, created_by, created_at, updated_at
      ) VALUES (?, ?, 'observation', 'medium', 'unverified', 'unknown', 'completed', ?, ?, ?, ?)
    `).bind(title, contentLines, wsId, userId, now, now).run()

    const evidenceId = String(result.meta?.last_row_id ?? 0)

    // Update response
    await env.DB.prepare(
      'UPDATE survey_responses SET linked_evidence_id = ?, cop_session_id = ?, updated_at = ? WHERE id = ?'
    ).bind(evidenceId, copSessionId, now, responseId).run()

    // Emit COP event + timeline
    await emitCopEvent(env.DB, {
      copSessionId,
      eventType: EVIDENCE_CREATED,
      entityType: 'evidence',
      entityId: evidenceId,
      payload: { title, source: 'survey_push', survey_id: surveyId },
      createdBy: userId,
    })

    try {
      await createTimelineEntry(env.DB, copSessionId, wsId, userId, {
        title: `Survey response promoted: ${title.substring(0, 160)}`,
        category: 'event',
        importance: 'normal',
        source_type: 'system',
        entity_type: 'evidence',
        entity_id: evidenceId,
        action: 'created',
      })
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({
      message: 'Response pushed to COP',
      evidence_id: evidenceId,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Surveys] Push to COP error:', error)
    return new Response(JSON.stringify({ error: 'Failed to push to COP' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
```

- [ ] **Step 3: Update CopSubmissionInbox to query survey_responses**

In `src/components/cop/CopSubmissionInbox.tsx`, change the fetch URL from:
```
/api/cop/${sessionId}/submissions${params}
```
to:
```
/api/surveys?cop_session_id=${sessionId}
```

Actually, the inbox needs to query responses for a specific COP session. Add a new query param to the responses endpoint, OR create a lightweight proxy. Simplest: the inbox fetches from a dedicated endpoint.

Add to `functions/api/surveys/[id]/responses.ts` GET handler: support `?cop_session_id=` query param that returns responses linked to that COP session across all surveys. But this is on the surveys route which needs a survey ID.

Better approach: modify `CopSubmissionInbox` to:
1. First fetch surveys linked to this COP session: `GET /api/surveys?cop_session_id=X`
2. Then for each survey, fetch responses

Even simpler: add a direct D1 query endpoint at `functions/api/cop/[id]/submissions.ts` that queries `survey_responses` instead of `cop_submissions`. Since this file already exists, just change the table name.

In `functions/api/cop/[id]/submissions.ts`, replace all references to `cop_submissions` with `survey_responses`, and `intake_form_id` with `survey_id`.

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add functions/api/surveys/[id]/link-cop.ts functions/api/surveys/[id]/responses/ functions/api/cop/[id]/submissions.ts src/components/cop/CopSubmissionInbox.tsx
git commit -m "feat(surveys): add COP integration bridge (link, push-to-cop, inbox)"
```

---

## Task 5: Frontend — Survey List + Detail Pages

**Files:**
- Create: `src/pages/SurveyListPage.tsx`
- Create: `src/pages/SurveyDetailPage.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Create SurveyListPage**

Create `src/pages/SurveyListPage.tsx` — a card grid page with:
- Header: "Survey Drops" title + "Create Survey" button
- Filter tabs: All | Active | Draft | Closed
- Card grid: each card shows title, status badge, submission count, share link (copy button), date
- Click card → navigate to `/dashboard/surveys/:id`
- Create button opens inline form: title input + "Create" button → POST `/api/surveys` with `status: 'draft'` → navigate to detail page
- Auth via `getCopHeaders()` (same auth helper)

Uses existing UI components: `Button` from `@/components/ui/button`, layout patterns from CopListPage.

- [ ] **Step 2: Create SurveyDetailPage**

Create `src/pages/SurveyDetailPage.tsx` — three-tab detail page:
- URL: `/dashboard/surveys/:id`
- Fetches survey via `GET /api/surveys/:id`
- **Builder tab**: Renders `CopIntakeFormBuilder` with `sessionId` prop replaced by direct API calls to `/api/surveys/:id` PUT
- **Responses tab**: Inline response inbox (fetch from `/api/surveys/:id/responses`, triage buttons, expand to see data, "Push to COP" button)
- **Settings tab**: Access control, country picker, rate limit, slug, expiry, branding, COP link dropdown

The Builder tab needs `CopIntakeFormBuilder` to be updated to accept a `surveyId` prop instead of requiring `sessionId`. The simplest approach: pass `surveyId` and have the builder POST/PUT to `/api/surveys` or `/api/surveys/:id` instead of `/api/cop/:sessionId/intake-forms`.

Modify `CopIntakeFormBuilder` to accept either `sessionId` (COP mode) or `surveyId` (standalone mode) and route API calls accordingly.

- [ ] **Step 3: Add routes**

In `src/routes/index.tsx`, add lazy imports and routes:

```typescript
const SurveyListPage = lazy(() => import('@/pages/SurveyListPage'))
const SurveyDetailPage = lazy(() => import('@/pages/SurveyDetailPage'))

// In the routes array, inside the dashboard section:
{ path: 'surveys', element: <LazyPage Component={SurveyListPage} /> },
{ path: 'surveys/:id', element: <LazyPage Component={SurveyDetailPage} /> },
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/SurveyListPage.tsx src/pages/SurveyDetailPage.tsx src/routes/index.tsx
git commit -m "feat(surveys): add SurveyListPage + SurveyDetailPage with routes"
```

---

## Task 6: Repoint Existing Components + Landing Page

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/components/cop/CopGlobalCaptureBar.tsx`
- Modify: `src/components/cop/CopGlobalCapture.tsx`
- Modify: `src/components/cop/PublicIntakeForm.tsx`
- Modify: `src/pages/PublicIntakePage.tsx`

- [ ] **Step 1: Update landing page keyword routing**

In `src/pages/LandingPage.tsx`, the existing `detectFramework` patterns for `survey` and `form` already route to `/dashboard/cop`. Change to `/dashboard/surveys`:

```typescript
{ pattern: /^survey(s)?(\s+drop)?$/i, route: '/dashboard/surveys', name: 'Survey Drops' },
{ pattern: /^(intake\s+)?form(s)?$/i, route: '/dashboard/surveys', name: 'Intake Forms' },
```

- [ ] **Step 2: Update capture bars**

In `CopGlobalCaptureBar.tsx`, change the survey creation endpoint from:
```typescript
endpoint = `/api/cop/${sessionId}/intake-forms`
```
to:
```typescript
endpoint = '/api/surveys'
body = { title: surveyTitle, status: 'active', cop_session_id: sessionId }
```

This creates a standalone survey that's auto-linked to the current COP session.

Same change in `CopGlobalCapture.tsx`.

- [ ] **Step 3: Update public form endpoints**

In `PublicIntakeForm.tsx`, change fetch URLs from:
```
/api/cop/public/intake/${token}
/api/cop/public/intake/${token}/submit
/api/cop/public/intake/${token}/verify-password
```
to:
```
/api/surveys/public/${token}
/api/surveys/public/${token}/submit
/api/surveys/public/${token}/verify-password
```

In `PublicIntakePage.tsx`, change slug resolver from:
```
/api/cop/public/intake/by-slug/${param}
```
to:
```
/api/surveys/public/by-slug/${param}
```

- [ ] **Step 4: Verify typecheck + E2E tests**

Run: `npx tsc --noEmit`
Run: `npx playwright test tests/e2e/smoke/ --reporter=line`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/components/cop/CopGlobalCaptureBar.tsx src/components/cop/CopGlobalCapture.tsx src/components/cop/PublicIntakeForm.tsx src/pages/PublicIntakePage.tsx
git commit -m "feat(surveys): repoint all components to standalone survey API"
```

---

## Deployment

After all tasks complete:

- [ ] **Step 1: Apply migration 101 to production D1**

```bash
npx wrangler d1 execute researchtoolspy-prod --remote --file=schema/migrations/101-survey-drops-standalone.sql
```

- [ ] **Step 2: Deploy**

```bash
./deploy.sh --skip-migrate
```

- [ ] **Step 3: Verify**

```bash
curl -s https://researchtoolspy.pages.dev/api/health
npx wrangler d1 execute researchtoolspy-prod --remote --command "SELECT COUNT(*) FROM survey_drops"
npx wrangler d1 execute researchtoolspy-prod --remote --command "SELECT COUNT(*) FROM survey_responses"
```
