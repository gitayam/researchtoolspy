/**
 * Survey Analytics
 *
 * GET /api/surveys/:id/analytics
 *
 * Returns aggregated stats: by country, by day, field distributions, credibility breakdown.
 */
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const surveyId = params.id as string
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const survey = await env.DB.prepare(
      'SELECT id, form_schema, submission_count FROM survey_drops WHERE id = ? AND created_by = ?'
    ).bind(surveyId, userId).first<{ id: string; form_schema: string; submission_count: number }>()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    // Run aggregate queries in parallel
    const [byCountry, byDay, byStatus, responses] = await Promise.all([
      env.DB.prepare(
        'SELECT submitter_country as country, COUNT(*) as count FROM survey_responses WHERE survey_id = ? AND submitter_country IS NOT NULL GROUP BY submitter_country ORDER BY count DESC LIMIT 30'
      ).bind(surveyId).all(),

      env.DB.prepare(
        "SELECT DATE(created_at) as day, COUNT(*) as count FROM survey_responses WHERE survey_id = ? GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30"
      ).bind(surveyId).all(),

      env.DB.prepare(
        'SELECT status, COUNT(*) as count FROM survey_responses WHERE survey_id = ? GROUP BY status'
      ).bind(surveyId).all(),

      // Fetch form_data for field distributions (limit to last 200)
      env.DB.prepare(
        "SELECT form_data FROM survey_responses WHERE survey_id = ? AND status IN ('pending', 'accepted') ORDER BY created_at DESC LIMIT 200"
      ).bind(surveyId).all(),
    ])

    // Compute field value distributions from form_data
    let formSchema: { name: string; type: string; label: string }[] = []
    try { formSchema = JSON.parse(survey.form_schema) } catch { /* */ }

    const distributions: Record<string, Record<string, number>> = {}
    const distributableTypes = ['select', 'multiselect', 'likert', 'rating', 'country']

    for (const field of formSchema) {
      if (!distributableTypes.includes(field.type)) continue
      const dist: Record<string, number> = {}
      for (const row of (responses.results || [])) {
        try {
          const data = JSON.parse((row as any).form_data)
          const val = data[field.name]
          if (val) {
            const values = field.type === 'multiselect' ? String(val).split(',') : [String(val)]
            for (const v of values) {
              const trimmed = v.trim()
              if (trimmed) dist[trimmed] = (dist[trimmed] || 0) + 1
            }
          }
        } catch { /* */ }
      }
      if (Object.keys(dist).length > 0) {
        distributions[field.name] = dist
      }
    }

    // Tag distribution from _tags metadata
    const tagBreakdown: Record<string, number> = {}
    for (const row of (responses.results || [])) {
      try {
        const data = JSON.parse((row as any).form_data)
        if (Array.isArray(data._tags)) {
          for (const tag of data._tags) {
            tagBreakdown[String(tag)] = (tagBreakdown[String(tag)] || 0) + 1
          }
        }
      } catch { /* */ }
    }

    return new Response(JSON.stringify({
      total: survey.submission_count,
      by_country: Object.fromEntries((byCountry.results || []).map((r: any) => [r.country, r.count])),
      by_day: Object.fromEntries((byDay.results || []).map((r: any) => [r.day, r.count])),
      by_status: Object.fromEntries((byStatus.results || []).map((r: any) => [r.status, r.count])),
      by_tag: tagBreakdown,
      distributions,
      fields: formSchema.map(f => ({ name: f.name, label: f.label, type: f.type })),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Survey Analytics] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load analytics' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
