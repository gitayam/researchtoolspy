/**
 * Survey Drops Public — Slug Resolver
 *
 * GET /api/surveys/public/by-slug/:slug
 * Resolves a custom slug to the survey form schema.
 * Returns share_token so the frontend can use token-based endpoints for submit/verify.
 */
import { extractGeoFromRequest, isCountryAllowed } from '../../../_shared/survey-drops'
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const slug = params.slug as string

  try {
    const form = await env.DB.prepare(
      `SELECT id, title, description, form_schema, require_location, require_contact,
              status, access_level, allowed_countries, expires_at, theme_color, logo_url, success_message, share_token
       FROM survey_drops WHERE custom_slug = ?`
    ).bind(slug).first() as any

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

    // Country gate
    let allowedCountries: string[] = []
    try { allowedCountries = form.allowed_countries ? JSON.parse(form.allowed_countries) : [] } catch { /* */ }

    const geo = extractGeoFromRequest(request)
    if (!isCountryAllowed(allowedCountries, geo.country)) {
      return new Response(JSON.stringify({
        error: 'This form is not available in your region',
        country_blocked: true,
      }), { status: 403, headers: JSON_HEADERS })
    }

    // Password-protected: return metadata + token (needed for verify-password endpoint)
    if (form.access_level === 'password') {
      return new Response(JSON.stringify({
        requires_password: true,
        share_token: (form as any).share_token,
        title: form.title,
        description: form.description,
        theme_color: form.theme_color,
        logo_url: form.logo_url,
        access_level: form.access_level,
      }), { headers: JSON_HEADERS })
    }

    // Internal: block public access
    if (form.access_level === 'internal') {
      return new Response(JSON.stringify({ error: 'This form requires authentication' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    let form_schema = []
    try { form_schema = form.form_schema ? JSON.parse(form.form_schema) : [] } catch { form_schema = [] }

    return new Response(JSON.stringify({
      share_token: (form as any).share_token,
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
    console.error('[Survey Drops Public] Slug resolve error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
