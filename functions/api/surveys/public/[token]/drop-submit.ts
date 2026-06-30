/**
 * Drop Spot Anonymous Submission API
 *
 * POST /api/surveys/public/:token/drop-submit
 *
 * Privacy guarantee (E-11 / D-E4): this endpoint NEVER reads CF-Connecting-IP,
 * X-Forwarded-For, User-Agent, or any header that could identify the submitter.
 * No IP hash is computed or stored. No rate-limiting by IP.
 *
 * Anti-abuse: Turnstile (fail-open) when TURNSTILE_SECRET is set.
 * When unset: no gate at all — reviewer triages manually.
 */
import { generatePrefixedId, JSON_HEADERS } from '../../../_shared/api-utils'
import { hashFormData } from '../../../_shared/survey-drops'
import { emitCopEvent } from '../../../_shared/cop-events'
import { INGEST_SUBMISSION_RECEIVED } from '../../../_shared/cop-event-types'

interface Env {
  DB: D1Database
  TURNSTILE_SECRET?: string
}

async function verifyTurnstile(secret: string, token: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    })
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params.token as string

  // PRIVACY: do NOT read context.request headers for IP or User-Agent.
  // This is the anonymity guarantee for drop-spot mode.

  try {
    const form = await env.DB.prepare(
      `SELECT id, cop_session_id, status, form_schema, intent, expires_at, access_level
       FROM survey_drops WHERE share_token = ?`
    ).bind(token).first() as any

    if (!form) {
      return new Response(JSON.stringify({ ok: false, error: 'Form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (form.status !== 'active') {
      return new Response(JSON.stringify({ ok: false, error: 'This form is not currently accepting submissions' }), {
        status: 200, headers: JSON_HEADERS,
      })
    }

    if (form.intent !== 'drop') {
      return new Response(JSON.stringify({ ok: false, error: 'This endpoint is only available for anonymous tip-lines' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return new Response(JSON.stringify({ ok: false, error: 'This form has expired' }), {
        status: 200, headers: JSON_HEADERS,
      })
    }

    // Internal forms are not accessible publicly
    if (form.access_level === 'internal') {
      return new Response(JSON.stringify({ ok: false, error: 'This form requires authentication' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    let body: any
    try {
      body = await context.request.json()
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid request body' }), {
        status: 200, headers: JSON_HEADERS,
      })
    }

    // Turnstile check — fail-OPEN: if TURNSTILE_SECRET is not configured, skip
    if (env.TURNSTILE_SECRET) {
      const cfTurnstileResponse = body['cf-turnstile-response'] || ''
      if (!cfTurnstileResponse) {
        return new Response(JSON.stringify({ ok: false, error: 'Human verification required' }), {
          status: 403, headers: JSON_HEADERS,
        })
      }
      const valid = await verifyTurnstile(env.TURNSTILE_SECRET, cfTurnstileResponse)
      if (!valid) {
        return new Response(JSON.stringify({ ok: false, error: 'Human verification failed. Please try again.' }), {
          status: 403, headers: JSON_HEADERS,
        })
      }
    }

    // Size limit
    const formData = body.form_data || {}
    const formDataStr = JSON.stringify(formData)
    if (formDataStr.length > 65536) {
      return new Response(JSON.stringify({ ok: false, error: 'Submission too large (max 64 KB)' }), {
        status: 200, headers: JSON_HEADERS,
      })
    }

    // Validate required fields from schema
    let formSchema: any[] = []
    try { formSchema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { formSchema = [] }

    for (const field of formSchema) {
      if (field.required && !String(formData[field.name] ?? '').trim()) {
        return new Response(JSON.stringify({ ok: false, error: `Required field "${field.label || field.name}" is missing` }), {
          status: 200, headers: JSON_HEADERS,
        })
      }
    }

    // Content hash — for same-drop content tracking (no dedup — accept every tip)
    const contentHash = await hashFormData(formData)

    const id = generatePrefixedId('drop')
    const now = new Date().toISOString()

    // Insert — no submitter_ip_hash, no submitter geo, no submitter name/contact
    await env.DB.prepare(`
      INSERT INTO survey_responses (
        id, survey_id, cop_session_id,
        form_data, content_hash, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      id, form.id, form.cop_session_id || null,
      formDataStr, contentHash, now
    ).run()

    // Increment submission count
    await env.DB.prepare(
      'UPDATE survey_drops SET submission_count = submission_count + 1 WHERE id = ?'
    ).bind(form.id).run()

    // Emit COP event if linked to a session
    if (form.cop_session_id) {
      await emitCopEvent(env.DB, {
        copSessionId: form.cop_session_id,
        eventType: INGEST_SUBMISSION_RECEIVED,
        entityType: 'submission',
        entityId: id,
        payload: {
          survey_id: form.id,
          drop_mode: true,
          anonymous: true,
        },
        createdBy: 0,
      }).catch(() => {})
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Your tip has been received anonymously.',
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    // Never expose internal error details to the submitter
    console.error('[Drop Submit] Error:', error)
    return new Response(JSON.stringify({ ok: false, error: 'Submission could not be processed. Please try again.' }), {
      status: 200, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
