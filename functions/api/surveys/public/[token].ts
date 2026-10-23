/**
 * Survey Drops Public Form Schema API
 *
 * GET /api/surveys/public/:token[?share=<share token>]   (X-Question-Ticket: <ticket>)
 *   - Get form schema for public submission (no auth)
 *
 * `question_choices` ([{ id, question, key }]) are the open questions the form offers
 * where it was opened: the standalone link, a share link's Submit sheet (`share`), or a
 * collaborator's workspace (the question ticket, in a header so it stays out of URLs and
 * logs); see questionChoicesForForm. Neither is a credential for anything else, and the
 * route still never reads who is calling.
 */
import { extractGeoFromRequest, isCountryAllowed } from '../../_shared/survey-drops'
import { JSON_HEADERS } from '../../_shared/api-utils'
import { questionChoicesForForm } from '../../_shared/cop-evidence-links'
import { verifyQuestionTicket } from '../../_shared/cop-question-ticket'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = params.token as string

  try {
    const form = await env.DB.prepare(
      `SELECT id, title, description, form_schema, require_location, require_contact,
              status, access_level, allowed_countries, expires_at, theme_color, logo_url, success_message,
              facts, changelog, intent
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

    // Expiry check
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

    // Password-protected: return metadata only (no form_schema)
    if (form.access_level === 'password') {
      return new Response(JSON.stringify({
        requires_password: true,
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

    let facts = []
    try { facts = form.facts ? JSON.parse(form.facts) : [] } catch { facts = [] }

    let changelog = []
    try { changelog = form.changelog ? JSON.parse(form.changelog) : [] } catch { changelog = [] }

    const ticket = request.headers.get('X-Question-Ticket')
    const questionContext = {
      shareToken: new URL(request.url).searchParams.get('share'),
      ticketSessionId: await verifyQuestionTicket(env.JWT_SECRET, ticket),
    }

    return new Response(JSON.stringify({
      title: form.title,
      description: form.description,
      form_schema,
      // "Which question does this help answer?" — for a COP-linked form, by where it was opened.
      question_choices: await questionChoicesForForm(env.DB, form.id, questionContext),
      facts,
      changelog,
      require_location: form.require_location === 1,
      require_contact: form.require_contact === 1,
      theme_color: form.theme_color,
      logo_url: form.logo_url,
      success_message: form.success_message,
      access_level: form.access_level || 'public',
      intent: form.intent || 'survey',
      // A ticket's wider list is for the collaborator who asked, never a shared cache.
    }), { headers: ticket ? { ...JSON_HEADERS, 'Cache-Control': 'no-store' } : JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Drops Public] Form fetch error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load form' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
