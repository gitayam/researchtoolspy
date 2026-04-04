/**
 * Survey Drops Public — Password Verification
 *
 * POST /api/surveys/public/:token/verify-password
 * Body: { password: string }
 * Returns: full form schema on success, 401 on failure
 */
import { verifyPassword } from '../../../_shared/survey-drops'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = params.token as string

  try {
    const body = await request.json() as any
    if (!body.password) {
      return new Response(JSON.stringify({ error: 'Password is required' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const form = await env.DB.prepare(
      `SELECT id, title, description, form_schema, require_location, require_contact,
              status, access_level, password_hash, expires_at, theme_color, logo_url, success_message
       FROM survey_drops WHERE share_token = ?`
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

    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This form has expired' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    if (form.access_level !== 'password' || !form.password_hash) {
      return new Response(JSON.stringify({ error: 'This form does not require a password' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Slow down brute-force attempts (applied to every call)
    await new Promise(resolve => setTimeout(resolve, 500))

    const valid = await verifyPassword(body.password, form.password_hash)
    if (!valid) {
      // Extra delay on failure to further limit brute-force
      await new Promise(resolve => setTimeout(resolve, 1000))
      return new Response(JSON.stringify({ error: 'Incorrect password' }), {
        status: 401, headers: JSON_HEADERS,
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
      theme_color: form.theme_color,
      logo_url: form.logo_url,
      success_message: form.success_message,
      access_level: form.access_level,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Drops Public] Password verify error:', error)
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
