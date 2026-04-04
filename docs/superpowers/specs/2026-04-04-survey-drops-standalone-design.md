# Survey Drops — Standalone System Design

**Date**: 2026-04-04
**Status**: Approved
**Replaces**: COP-coupled intake system (`cop_intake_forms` + `cop_submissions`)

## Overview

Survey Drops is a standalone crowdsourced data collection system. Users create structured forms, share them via unique URLs, and triage responses in a dedicated dashboard. Surveys can optionally link to COP sessions for intelligence workflow integration, but work independently by default.

## Data Model

### `survey_drops` table

Standalone survey definitions. Replaces `cop_intake_forms`.

```sql
CREATE TABLE IF NOT EXISTS survey_drops (
  id TEXT PRIMARY KEY,                          -- srv-{uuid12}
  title TEXT NOT NULL,
  description TEXT,
  form_schema TEXT DEFAULT '[]',                -- JSON array of IntakeFormField
  share_token TEXT UNIQUE NOT NULL,             -- UUID hex, public access token
  status TEXT DEFAULT 'draft',                  -- draft | active | closed
  access_level TEXT DEFAULT 'public',           -- public | password | internal
  password_hash TEXT,                           -- PBKDF2 salt:hash format
  allowed_countries TEXT DEFAULT '[]',           -- JSON array of ISO 3166-1 alpha-2 codes
  rate_limit_per_hour INTEGER DEFAULT 0,        -- 0 = unlimited
  custom_slug TEXT,                             -- vanity URL slug, partial unique index
  expires_at TEXT,                              -- ISO datetime (UTC)
  theme_color TEXT,                             -- hex color for branding
  logo_url TEXT,                                -- brand logo for public form
  success_message TEXT,                         -- shown after submission
  redirect_url TEXT,                            -- redirect after submission (future)
  auto_tag_category TEXT,                       -- auto-tag on submissions
  require_location INTEGER DEFAULT 0,
  require_contact INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,

  -- Optional COP link (nullable = standalone by default)
  cop_session_id TEXT,                          -- FK to cop_sessions(id), nullable
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
```

### `survey_responses` table

Submission records. Replaces `cop_submissions`.

```sql
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,                          -- srs-{uuid12}
  survey_id TEXT NOT NULL,                      -- FK to survey_drops(id)
  form_data TEXT DEFAULT '{}',                  -- JSON of field name → value
  submitter_name TEXT,
  submitter_contact TEXT,
  lat REAL,
  lon REAL,
  submitter_country TEXT,                       -- from CF-IPCountry
  submitter_city TEXT,                          -- from request.cf.city
  submitter_ip_hash TEXT,                       -- SHA-256(IP + survey_id) for rate limiting
  content_hash TEXT,                            -- SHA-256(sorted form_data) for dedup
  status TEXT DEFAULT 'pending',                -- pending | accepted | rejected
  triaged_by INTEGER,
  rejection_reason TEXT,

  -- Optional COP link (set when survey is linked or response is pushed)
  cop_session_id TEXT,
  linked_evidence_id TEXT,                      -- set when promoted to COP evidence

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
```

### Field types

Reuses existing `IntakeFormFieldType` and `IntakeFormField` from `src/types/cop.ts`:

```typescript
type IntakeFormFieldType = 'text' | 'textarea' | 'number' | 'datetime' | 'select' | 'multiselect' | 'file' | 'checkbox'

interface IntakeFormField {
  name: string
  type: IntakeFormFieldType
  label: string
  required?: boolean
  placeholder?: string
  options?: string[]
  accept?: string
}
```

## Routes

| Route | Page Component | Purpose |
|-------|---------------|---------|
| `/dashboard/surveys` | `SurveyListPage` | Card grid of user's surveys, "Create Survey" button |
| `/dashboard/surveys/:id` | `SurveyDetailPage` | Tabs: Builder, Responses, Settings |
| `/survey/:slugOrToken` | `PublicIntakePage` (existing, updated) | Public submission form |
| `/public/intake/:token` | `PublicIntakePage` | Backward compat, same component |

Landing page: typing `survey`, `surveys`, `form`, `forms`, or `intake form` in the search bar navigates to `/dashboard/surveys`.

## API Endpoints

### Authenticated (survey management)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/surveys` | List surveys for authenticated user |
| `POST` | `/api/surveys` | Create a new survey |
| `GET` | `/api/surveys/:id` | Get survey detail + settings |
| `PUT` | `/api/surveys/:id` | Update survey (title, schema, settings, status) |
| `DELETE` | `/api/surveys/:id` | Archive (soft delete via status='closed') |
| `GET` | `/api/surveys/:id/responses` | List responses with `?status=` filter |
| `PUT` | `/api/surveys/:id/responses` | Triage: `{ id, status, rejection_reason }` or batch `{ ids, status }` |
| `POST` | `/api/surveys/:id/responses/:rid/push-to-cop` | Push single response → COP evidence |
| `POST` | `/api/surveys/:id/link-cop` | Link survey to COP session `{ cop_session_id }` |
| `DELETE` | `/api/surveys/:id/link-cop` | Unlink survey from COP |

### Public (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/surveys/public/:token` | Get form schema (with access/geo/expiry checks) |
| `POST` | `/api/surveys/public/:token/submit` | Submit response (with password/geo/rate/dedup checks) |
| `POST` | `/api/surveys/public/:token/verify-password` | Password verification |
| `GET` | `/api/surveys/public/by-slug/:slug` | Resolve slug to form schema |

### Auth pattern

Authenticated endpoints use `getUserFromRequest()` + ownership check (`created_by = userId`). No workspace access check needed since surveys are user-owned, not workspace-scoped (unless linked to COP, in which case COP collaborators also get access).

### Response format

All endpoints return `{ ...data }` on success, `{ error: string }` on failure. Consistent with existing COP API patterns. Status codes: 200 (ok), 201 (created), 400 (validation), 401 (auth), 403 (access/geo/password), 404 (not found), 409 (duplicate), 429 (rate limit).

## COP Integration Bridge

### Linking a survey to a COP session

`POST /api/surveys/:id/link-cop` with `{ cop_session_id }`:
1. Verify user owns the survey AND has access to the COP session (`verifyCopSessionAccess`)
2. Set `survey_drops.cop_session_id`
3. Backfill existing pending responses: `UPDATE survey_responses SET cop_session_id = ? WHERE survey_id = ? AND cop_session_id IS NULL`
4. New responses auto-inherit `cop_session_id` from the survey on insert

### Pushing a single response to COP

`POST /api/surveys/:id/responses/:rid/push-to-cop` with `{ cop_session_id }`:
1. Verify user owns survey and has COP session access
2. Create `evidence_items` row: title from survey title + submitter, content from formatted form_data, `source_type = 'observation'`, `credibility = 'unverified'`, workspace scoped to COP session
3. Set `survey_responses.linked_evidence_id` and `survey_responses.cop_session_id`
4. Emit `EVIDENCE_CREATED` event
5. Create timeline entry in COP

### Unlinking

`DELETE /api/surveys/:id/link-cop`:
1. Null out `survey_drops.cop_session_id`
2. Existing responses keep their `cop_session_id` (don't orphan already-pushed evidence)
3. New responses no longer auto-link

### COP Inbox panel update

`CopSubmissionInbox` queries `survey_responses WHERE cop_session_id = ?` instead of `cop_submissions WHERE cop_session_id = ?`. Same UI, different table.

## Migration Strategy

Migration 101 creates the new tables and migrates data from the old system.

```sql
-- 1. Create new tables
-- (survey_drops and survey_responses as defined above)

-- 2. Migrate existing intake forms
INSERT INTO survey_drops (
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

-- 3. Migrate existing submissions
INSERT INTO survey_responses (
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

Old tables (`cop_intake_forms`, `cop_submissions`) are left in place but no longer queried. They can be dropped in a future cleanup migration.

## Frontend Components

### `SurveyListPage` (`src/pages/SurveyListPage.tsx`)

- Card grid showing surveys with: title, status badge, submission count, share link, created date
- "Create Survey" button opens inline form (title + description, creates in draft status)
- Filter tabs: All | Active | Draft | Closed
- Each card links to `/dashboard/surveys/:id`

### `SurveyDetailPage` (`src/pages/SurveyDetailPage.tsx`)

Three tabs:

**Builder tab**: Reuses `CopIntakeFormBuilder` component (renamed/adapted) for editing form schema. Shows live preview of the public form.

**Responses tab**: Table/inbox of responses with status filters (pending/accepted/rejected/all), triage buttons (accept/reject), expand to see form data, country badge, "Push to COP" button on each row. Supports batch select + triage.

**Settings tab**: Access control (public/password/internal), country restrictions, rate limiting, custom slug, expiry, branding (theme color, logo, success message), COP linking (dropdown to select/unlink COP session).

### Updated components

- `CopSubmissionInbox`: Query `survey_responses WHERE cop_session_id = ?` instead of old table
- `CopGlobalCaptureBar`: `survey:` prefix creates via `/api/surveys` (not COP intake endpoint)
- `CopGlobalCapture`: Same update
- `PublicIntakeForm`: Public endpoints repointed to `/api/surveys/public/`
- `PublicIntakePage`: Same component, works with both routes
- `LandingPage`: `survey`/`form` keywords → `/dashboard/surveys`

## Shared Utilities

Reuse `functions/api/_shared/survey-drops.ts` (PBKDF2 hashing, rate limiting, geo extraction, country gating, slug validation). No changes needed — these are already table-agnostic.

## File Summary

### New files

| File | Purpose |
|------|---------|
| `schema/migrations/101-survey-drops-standalone.sql` | New tables + data migration |
| `functions/api/surveys/index.ts` | GET (list) + POST (create) |
| `functions/api/surveys/[id].ts` | GET + PUT + DELETE |
| `functions/api/surveys/[id]/responses.ts` | GET (list) + PUT (triage) |
| `functions/api/surveys/[id]/responses/[rid]/push-to-cop.ts` | POST push to COP |
| `functions/api/surveys/[id]/link-cop.ts` | POST link + DELETE unlink |
| `functions/api/surveys/public/[token].ts` | GET form schema |
| `functions/api/surveys/public/[token]/submit.ts` | POST submit |
| `functions/api/surveys/public/[token]/verify-password.ts` | POST password check |
| `functions/api/surveys/public/by-slug/[slug].ts` | GET slug resolver |
| `src/pages/SurveyListPage.tsx` | Survey list/grid page |
| `src/pages/SurveyDetailPage.tsx` | Survey detail with tabs |

### Modified files

| File | Changes |
|------|---------|
| `src/routes/index.tsx` | Add `/dashboard/surveys` and `/dashboard/surveys/:id` routes |
| `src/pages/LandingPage.tsx` | Update keyword routing to `/dashboard/surveys` |
| `src/components/cop/CopSubmissionInbox.tsx` | Query `survey_responses` instead of `cop_submissions` |
| `src/components/cop/CopGlobalCaptureBar.tsx` | `survey:` creates via `/api/surveys` |
| `src/components/cop/CopGlobalCapture.tsx` | Same |
| `src/components/cop/PublicIntakeForm.tsx` | Repoint to `/api/surveys/public/` |
| `src/pages/PublicIntakePage.tsx` | Repoint slug resolver to `/api/surveys/public/by-slug/` |
| `src/types/cop.ts` | Add `SurveyDrop` and `SurveyResponse` interfaces |

### Reused as-is

| File | Purpose |
|------|---------|
| `functions/api/_shared/survey-drops.ts` | PBKDF2, rate limiting, geo, country gating |
| `functions/api/_shared/cop-events.ts` | Event emission for COP push |
| `functions/api/_shared/cop-event-types.ts` | Event type constants |
| `functions/api/_shared/api-utils.ts` | `generatePrefixedId`, `JSON_HEADERS` |
| `functions/api/_shared/auth-helpers.ts` | `getUserFromRequest`, `verifyCopSessionAccess` |
