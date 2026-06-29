/**
 * System A → reviewer-list response adapters (E-4b-1).
 *
 * The research-forms builder + public submit were modernized onto "System A"
 * (`survey_drops` + `survey_responses`), but the reviewer list endpoints still
 * read legacy "System B" (`submission_forms` + `form_submissions`) — which now
 * holds only abandoned test data, so submissions to NEW forms were invisible to
 * the reviewer. These pure mappers let the two reviewer list endpoints read
 * System A while emitting the EXACT shape `EvidenceSubmissionsPage.tsx` already
 * consumes, so the frontend needs no change.
 *
 * Kept free of D1 / Request / framework imports so the row→shape mapping is
 * unit-testable in pure Node (see tests/e2e/smoke/reviewer-systema-adapter.spec.ts).
 *
 * Privacy (E-1): `survey_responses` carries `submitter_ip_hash`; it MUST NEVER
 * appear in a reviewer-facing row. `adaptResponseToSubmissionRow` only ever
 * reads an allow-listed set of columns + the submitter-typed `form_data`, so the
 * IP hash cannot leak even if a caller SELECTs `*`.
 */

/** A `survey_drops` row as selected by the forms-list endpoint. */
export interface SurveyDropRow {
  id: string
  title: string | null
  description: string | null
  share_token: string | null
  status: string | null
  submission_count: number | null
  form_schema?: string | null
  created_at?: string | null
}

/**
 * The form shape `EvidenceSubmissionsPage.tsx` reads (`SubmissionForm`):
 * `id`, `hash_id`, `form_name`, `form_description`, `enabledFields`,
 * `is_active`, `submission_count`, `created_at`, `submissionUrl`.
 */
export interface ReviewerFormRow {
  id: string
  hash_id: string
  form_name: string
  form_description: string
  enabledFields: unknown[]
  is_active: number
  submission_count: number
  created_at: string | null
  submissionUrl: string
}

/** A `survey_responses` row (joined to its `survey_drops` parent) as selected. */
export interface SurveyResponseRow {
  id: string
  survey_id: string
  form_data: string | null
  submitter_name: string | null
  submitter_contact: string | null
  status: string | null
  rejection_reason?: string | null
  linked_evidence_id?: string | null
  created_at: string | null
  /** Parent survey columns (aliased in the JOIN). */
  form_name?: string | null
  share_token?: string | null
}

/**
 * The submission shape `EvidenceSubmissionsPage.tsx` reads (`Submission`):
 * `id`, `form_id`, `form_name`, `form_hash`, `source_url`, `archived_url`,
 * `content_type`, `content_description`, `loginRequired`, `keywords`,
 * `submitter_comments`, `submitter_name`, `submitter_contact`, `metadata`,
 * `status`, `submitted_at`. (Never `submitter_ip_hash`.)
 */
export interface ReviewerSubmissionRow {
  id: string
  form_id: string
  form_name: string
  form_hash: string
  source_url: string | null
  archived_url: string | null
  content_type: string | null
  content_description: string | null
  loginRequired: boolean
  keywords: unknown[]
  submitter_comments: string | null
  submitter_name: string | null
  submitter_contact: string | null
  metadata: Record<string, unknown> | null
  status: string
  evidence_id: string | null
  rejection_reason: string | null
  submitted_at: string | null
}

/** Parse a JSON string defensively, returning `fallback` on null/empty/invalid. */
function safeParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string' || val.length === 0) return fallback
  try {
    return JSON.parse(val) as T
  } catch {
    return fallback
  }
}

/**
 * Map a `survey_drops` row → the legacy reviewer form shape.
 *
 *  form_name        ← title
 *  form_description ← description
 *  is_active        ← (status === 'active') ? 1 : 0   (UI treats it as truthy/falsy)
 *  submission_count ← submission_count
 *  submissionUrl    ← `/survey/${share_token}`        (the public submit route)
 *  hash_id          ← share_token   (UI shows it as the form's shareable id)
 *  enabledFields    ← parsed `form_schema` (the UI only reads `.length`)
 */
export function adaptSurveyToFormRow(row: SurveyDropRow): ReviewerFormRow {
  const shareToken = row.share_token ?? ''
  return {
    id: row.id,
    hash_id: shareToken,
    form_name: row.title ?? '',
    form_description: row.description ?? '',
    enabledFields: safeParse<unknown[]>(row.form_schema, []),
    is_active: row.status === 'active' ? 1 : 0,
    submission_count: Number(row.submission_count ?? 0),
    created_at: row.created_at ?? null,
    submissionUrl: `/survey/${shareToken}`,
  }
}

/**
 * Field-name candidates to pull a "source URL" out of submitter `form_data`.
 * System-A field keys are slugified labels (see research-form-builder.ts), so a
 * "Source URL"→`source_url`, "Document URL"→`document_url`, etc. We try the most
 * specific names first, then fall back to the first url-ish value.
 */
const SOURCE_URL_KEYS = ['source_url', 'document_url', 'url', 'source_links', 'link']

/** Field-name candidates for a free-text description / narrative. */
const DESCRIPTION_KEYS = [
  'content_description',
  'description',
  'summary',
  'what_happened',
  'claim',
  'details',
  'notes',
]

/** First non-empty string value among `keys`, else the first url-looking value. */
function pickUrl(data: Record<string, unknown>): string | null {
  for (const key of SOURCE_URL_KEYS) {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  // Fallback: any value that looks like an http(s) URL.
  for (const v of Object.values(data)) {
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v
  }
  return null
}

/** First non-empty string value among the description candidate keys. */
function pickDescription(data: Record<string, unknown>): string | null {
  for (const key of DESCRIPTION_KEYS) {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

/**
 * Map a `survey_responses` row (+ joined parent) → the legacy reviewer
 * submission shape. The submitted answers live in `form_data` (JSON keyed by
 * slugified field names); we extract a source URL and a description from it.
 *
 * `submitted_at` ← created_at (System A has no separate submitted_at column).
 * `submitter_ip_hash` is NEVER read or emitted (E-1 privacy).
 */
export function adaptResponseToSubmissionRow(row: SurveyResponseRow): ReviewerSubmissionRow {
  const data = safeParse<Record<string, unknown>>(row.form_data, {})

  // Strip internal metadata fields (`_tags`, `_enriched_*`) before exposing the
  // raw answers as `metadata` for the UI's optional `metadata.title` read.
  const cleaned: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith('_')) cleaned[k] = v
  }

  return {
    id: row.id,
    form_id: row.survey_id,
    form_name: row.form_name ?? '',
    form_hash: row.share_token ?? '',
    source_url: pickUrl(data),
    archived_url: null,
    content_type: null,
    content_description: pickDescription(data),
    loginRequired: false,
    keywords: [],
    submitter_comments: null,
    submitter_name: row.submitter_name ?? null,
    submitter_contact: row.submitter_contact ?? null,
    metadata: Object.keys(cleaned).length > 0 ? cleaned : null,
    status: row.status ?? 'pending',
    evidence_id: row.linked_evidence_id ?? null,
    rejection_reason: row.rejection_reason ?? null,
    submitted_at: row.created_at ?? null,
  }
}
