/**
 * Public Survey Results — totals only
 *
 * GET /api/surveys/public/:token/results
 *
 * Decision 2026-10-23: "Totals public, responses owner-only". Anyone with an ordinary
 * survey's token gets its title, description, total, and for its choice and rating
 * fields how many of the latest 200 non-rejected responses picked each value the form
 * offers (a value it doesn't offer — free text sent in its place — is not counted).
 * Never an individual response, free text, location, country or tags. The form's
 * creator reads those through GET /api/surveys/:id/responses (also /export and
 * /analytics, all creator-only); a COP's collaborators through GET /api/cop/:id/submissions.
 *
 * Gates (as submit.ts):
 *   - an anonymous tip form (intent 'drop'), any form linked to a COP, and an internal
 *     form answer exactly as an unknown token does (404): a tip form's submissions are
 *     the team's to review, and its token travels on every share link of that COP;
 *   - an inactive or expired form is refused (403);
 *   - a password form needs its password in X-Form-Password (401 without or wrong), and
 *     its totals are never cached.
 */
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { verifyPassword } from '../../../_shared/survey-drops'

interface Env {
  DB: D1Database
}

interface SurveyRow {
  id: string
  title: string
  description: string | null
  submission_count: number
  form_schema: string | null
  status: string
  intent: string | null
  cop_session_id: string | null
  access_level: string | null
  password_hash: string | null
  expires_at: string | null
}

const RESPONSES_COUNTED = 200
const CHOICE_TYPES = new Set(['select', 'multiselect', 'likert'])

const notFound = () => new Response(JSON.stringify({ error: 'Survey not found' }), { status: 404, headers: JSON_HEADERS })
const refuse = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers: JSON_HEADERS })

interface CountedField {
  name: string
  label: string
  type: string
  /** The values of one answer that count (only ones the form offers). */
  values: (answer: unknown) => string[]
}

/** The fields whose answers can be totalled without showing anyone's own words. */
function countedFields(rawSchema: string | null): CountedField[] {
  let schema: unknown
  try { schema = JSON.parse(rawSchema || '[]') } catch { return [] }
  if (!Array.isArray(schema)) return []
  const out: CountedField[] = []
  for (const raw of schema) {
    if (!raw || typeof raw !== 'object') continue
    const f = raw as Record<string, unknown>
    if (typeof f.name !== 'string' || !f.name || typeof f.type !== 'string') continue
    const label = (typeof f.label === 'string' && f.label.trim() ? f.label.trim() : f.name).slice(0, 200)
    if (CHOICE_TYPES.has(f.type)) {
      const options = new Set(Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === 'string') : [])
      if (options.size === 0) continue // nothing to check answers against: could be anyone's text
      const multi = f.type === 'multiselect'
      out.push({
        name: f.name, label, type: f.type,
        values: (answer) => {
          const parts = Array.isArray(answer) ? answer.map(String) : multi ? String(answer ?? '').split(',') : [String(answer ?? '')]
          return [...new Set(parts.map((p) => p.trim()).filter((p) => options.has(p)))]
        },
      })
    } else if (f.type === 'rating') {
      const min = Number.isInteger(f.min) ? Number(f.min) : 0
      const max = Number.isInteger(f.max) ? Number(f.max) : 10
      out.push({
        name: f.name, label, type: f.type,
        values: (answer) => {
          const n = typeof answer === 'number' ? answer : /^\s*-?\d{1,3}\s*$/.test(String(answer ?? '')) ? Number(answer) : NaN
          return Number.isInteger(n) && n >= min && n <= max ? [String(n)] : []
        },
      })
    }
  }
  return out
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = String(params.token ?? '')

  try {
    const survey = await env.DB.prepare(
      `SELECT id, title, description, submission_count, form_schema, status, intent, cop_session_id,
              access_level, password_hash, expires_at
       FROM survey_drops WHERE share_token = ?`
    ).bind(token).first<SurveyRow>()

    // A tip form, a COP's form or an internal form looks exactly like an unknown token
    // (checked before anything else, so an inactive one doesn't answer differently).
    if (!survey || survey.intent === 'drop' || survey.cop_session_id || survey.access_level === 'internal') return notFound()
    if (survey.status !== 'active') return refuse(403, 'Survey is not active')
    if (survey.expires_at && new Date(survey.expires_at) < new Date()) return refuse(403, 'This form has expired')
    if (survey.access_level === 'password') {
      const password = request.headers.get('X-Form-Password')
      if (!password) return refuse(401, 'Password is required')
      if (!survey.password_hash || !(await verifyPassword(password, survey.password_hash))) return refuse(401, 'Incorrect password')
    }

    const fields = countedFields(survey.form_schema)
    const rows = await env.DB.prepare(
      `SELECT form_data FROM survey_responses
       WHERE survey_id = ? AND status != 'rejected'
       ORDER BY created_at DESC
       LIMIT ${RESPONSES_COUNTED}`
    ).bind(survey.id).all<{ form_data: string | null }>()

    const distributions: Record<string, Record<string, number>> = {}
    const responses = rows.results ?? []
    for (const row of responses) {
      let data: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(row.form_data || '{}')
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
      } catch { /* an unreadable row counts towards nothing */ }
      for (const field of fields) {
        for (const value of field.values(data[field.name])) {
          const dist = (distributions[field.name] ??= {})
          dist[value] = (dist[value] ?? 0) + 1
        }
      }
    }

    return new Response(JSON.stringify({
      title: survey.title,
      description: survey.description,
      total: Number(survey.submission_count) || 0,
      counted: responses.length,
      fields: fields.map(({ name, label, type }) => ({ name, label, type })),
      stats: { distributions },
    }), {
      headers: { ...JSON_HEADERS, 'Cache-Control': survey.access_level === 'password' ? 'no-store' : 'private, max-age=30' },
    })
  } catch (error) {
    console.error('[Survey Results] Error:', error instanceof Error ? error.message : 'unknown')
    return new Response(JSON.stringify({ error: 'Failed to load results' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
