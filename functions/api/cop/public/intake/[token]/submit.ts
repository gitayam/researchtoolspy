/**
 * COP Public Submission API
 *
 * POST /api/cop/public/intake/:token/submit - Submit a public form entry (no auth)
 */
import { emitCopEvent } from '../../../../_shared/cop-events'
import { INGEST_SUBMISSION_RECEIVED, INGEST_SUBMISSION_BLOCKED, INGEST_SUBMISSION_RATE_LIMITED } from '../../../../_shared/cop-event-types'
import { generatePrefixedId, JSON_HEADERS } from '../../../../_shared/api-utils'
import {
  extractGeoFromRequest, isCountryAllowed, verifyPassword,
  hashSubmitterIP, hashFormData, checkSurveyResponseRateLimit,
} from '../../../../_shared/survey-drops'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = params.token as string

  try {
    const form = await env.DB.prepare(
      `SELECT id, cop_session_id, status, require_location, require_contact, form_schema,
              access_level, password_hash, allowed_countries, rate_limit_per_hour, expires_at
       FROM cop_intake_forms WHERE share_token = ?`
    ).bind(token).first() as any

    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (form.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This form is not currently accepting submissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Expiry check
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This form has expired' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Country gate
    const geo = extractGeoFromRequest(request)
    let allowedCountries: string[] = []
    try { allowedCountries = form.allowed_countries ? JSON.parse(form.allowed_countries) : [] } catch { /* */ }

    if (!isCountryAllowed(allowedCountries, geo.country)) {
      await emitCopEvent(env.DB, {
        copSessionId: form.cop_session_id,
        eventType: INGEST_SUBMISSION_BLOCKED,
        entityType: 'submission',
        entityId: '',
        payload: { reason: 'country_blocked', country: geo.country },
        createdBy: 0,
      }).catch(() => {})
      return new Response(JSON.stringify({
        error: 'This form is not available in your region',
        country_blocked: true,
      }), { status: 403, headers: JSON_HEADERS })
    }

    const body = await request.json() as any

    // Password check (for password-protected forms)
    if (form.access_level === 'password') {
      if (!body.password) {
        return new Response(JSON.stringify({ error: 'Password is required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!form.password_hash || !(await verifyPassword(body.password, form.password_hash))) {
        return new Response(JSON.stringify({ error: 'Incorrect password' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
    }

    // Internal forms cannot be submitted publicly
    if (form.access_level === 'internal') {
      return new Response(JSON.stringify({ error: 'This form requires authentication' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
    const ipHash = await hashSubmitterIP(clientIP, form.id)

    if (form.rate_limit_per_hour > 0) {
      const rateCheck = await checkSurveyResponseRateLimit(env.DB, form.id, ipHash, form.rate_limit_per_hour)
      if (!rateCheck.allowed) {
        await emitCopEvent(env.DB, {
          copSessionId: form.cop_session_id,
          eventType: INGEST_SUBMISSION_RATE_LIMITED,
          entityType: 'submission',
          entityId: '',
          payload: { ip_hash: ipHash.slice(0, 8) },
          createdBy: 0,
        }).catch(() => {})
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          retry_after_seconds: 3600,
        }), {
          status: 429,
          headers: { ...JSON_HEADERS, 'Retry-After': '3600' },
        })
      }
    }

    // Validate required location
    if (form.require_location === 1 && (body.lat == null || body.lon == null)) {
      return new Response(JSON.stringify({ error: 'Location is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Validate required contact
    if (form.require_contact === 1 && !body.submitter_contact?.trim()) {
      return new Response(JSON.stringify({ error: 'Contact information is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Validate required form fields
    let formSchema = []
    try { formSchema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { formSchema = [] }

    const formData = body.form_data || {}
    for (const field of formSchema) {
      if (field.required && !String(formData[field.name] ?? '').trim()) {
        return new Response(JSON.stringify({ error: `Required field "${field.name}" is missing` }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
    }

    // Content dedup
    const contentHash = await hashFormData(formData)
    const existing = await env.DB.prepare(
      'SELECT id FROM survey_responses WHERE survey_id = ? AND content_hash = ? LIMIT 1'
    ).bind(form.id, contentHash).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Duplicate submission detected',
        duplicate: true,
      }), { status: 409, headers: JSON_HEADERS })
    }

    const id = generatePrefixedId('sub')
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO survey_responses (
        id, survey_id, cop_session_id, form_data,
        submitter_name, submitter_contact, lat, lon,
        submitter_country, submitter_city, submitter_ip_hash, content_hash, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, form.id, form.cop_session_id,
      JSON.stringify(formData),
      body.submitter_name?.trim() || null,
      body.submitter_contact?.trim() || null,
      body.lat ?? geo.lat ?? null,
      body.lon ?? geo.lon ?? null,
      geo.country, geo.city, ipHash, contentHash, now
    ).run()

    // Increment submission count on both tables for backward compat
    await env.DB.prepare(
      'UPDATE cop_intake_forms SET submission_count = submission_count + 1 WHERE id = ?'
    ).bind(form.id).run()
    await env.DB.prepare(
      'UPDATE survey_drops SET submission_count = submission_count + 1 WHERE id = ?'
    ).bind(form.id).run()

    // Emit event
    await emitCopEvent(env.DB, {
      copSessionId: form.cop_session_id,
      eventType: INGEST_SUBMISSION_RECEIVED,
      entityType: 'submission',
      entityId: id,
      payload: {
        survey_id: form.id,
        submitter_name: body.submitter_name || null,
        submitter_country: geo.country,
        has_location: body.lat != null || geo.lat != null,
      },
      createdBy: 0,
    })

    return new Response(JSON.stringify({ id, message: 'Submission received. Thank you.' }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[COP Public Intake] Submit error:', error)
    return new Response(JSON.stringify({ error: 'Failed to submit' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
