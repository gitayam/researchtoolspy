/**
 * Public Survey Results
 *
 * GET /api/surveys/public/:token/results
 *
 * Returns aggregated and individual results for a survey.
 * Available to anyone with the share token (same access as submitting).
 * Strips PII (submitter_name, submitter_contact, ip_hash) from results.
 */
import { JSON_HEADERS } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const token = params.token as string

  try {
    // Verify survey exists and is active
    const survey = await env.DB.prepare(
      `SELECT id, title, description, submission_count, form_schema, status
       FROM survey_drops WHERE share_token = ?`
    ).bind(token).first<{
      id: string; title: string; description: string | null
      submission_count: number; form_schema: string; status: string
    }>()

    if (!survey) {
      return new Response(JSON.stringify({ error: 'Survey not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (survey.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Survey is not active' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Fetch accepted responses (no PII)
    const responses = await env.DB.prepare(
      `SELECT id, form_data, submitter_country, lat, lon, status, created_at
       FROM survey_responses
       WHERE survey_id = ? AND status = 'accepted'
       ORDER BY created_at DESC
       LIMIT 200`
    ).bind(survey.id).all()

    // Parse form schema for field labels
    let formSchema: { name: string; type: string; label: string; options?: string[] }[] = []
    try { formSchema = JSON.parse(survey.form_schema) } catch { /* */ }

    // Parse form_data in each response
    const results = (responses.results || []).map((r: any) => {
      let formData: Record<string, unknown> = {}
      try { formData = JSON.parse(r.form_data) } catch { /* */ }

      return {
        id: r.id,
        data: formData,
        country: r.submitter_country,
        lat: r.lat,
        lon: r.lon,
        created_at: r.created_at,
      }
    })

    // Aggregate stats
    const countryBreakdown: Record<string, number> = {}
    for (const r of results) {
      if (r.country) {
        countryBreakdown[r.country] = (countryBreakdown[r.country] || 0) + 1
      }
    }

    // Field value distributions for select/multiselect/likert/rating fields
    const distributions: Record<string, Record<string, number>> = {}
    for (const field of formSchema) {
      if (['select', 'multiselect', 'likert', 'rating'].includes(field.type)) {
        const dist: Record<string, number> = {}
        for (const r of results) {
          const val = r.data[field.name]
          if (val) {
            const values = field.type === 'multiselect' ? String(val).split(',') : [String(val)]
            for (const v of values) {
              const trimmed = v.trim()
              if (trimmed) dist[trimmed] = (dist[trimmed] || 0) + 1
            }
          }
        }
        if (Object.keys(dist).length > 0) {
          distributions[field.name] = dist
        }
      }
    }

    return new Response(JSON.stringify({
      title: survey.title,
      description: survey.description,
      total: survey.submission_count,
      showing: results.length,
      fields: formSchema.map(f => ({ name: f.name, label: f.label, type: f.type })),
      results,
      stats: {
        by_country: countryBreakdown,
        distributions,
      },
    }), {
      headers: { ...JSON_HEADERS, 'Cache-Control': 'private, max-age=30' },
    })
  } catch (error) {
    console.error('[Survey Results] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load results' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
