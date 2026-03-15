/**
 * COP Public Submission API
 *
 * POST /api/cop/public/intake/:token/submit - Submit a public form entry (no auth)
 */
import { emitCopEvent } from '../../../../_shared/cop-events'
import { INGEST_SUBMISSION_RECEIVED } from '../../../../_shared/cop-event-types'
import { generatePrefixedId, JSON_HEADERS } from '../../../../_shared/api-utils'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

interface Env {
  DB: D1Database
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
      if (field.required && !String(formData[field.name] ?? '').trim()) {
        return new Response(JSON.stringify({ error: `${field.label} is required` }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    const id = generatePrefixedId('sub')

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

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
