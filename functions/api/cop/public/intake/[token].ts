/**
 * COP Public Intake Form Schema API
 *
 * GET /api/cop/public/intake/:token - Get form schema for public submission (no auth)
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Env {
  DB: D1Database
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
