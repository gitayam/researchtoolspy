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
    try {
      const parsed = survey.form_schema ? JSON.parse(survey.form_schema) : []
      if (Array.isArray(parsed)) formSchema = parsed
    } catch { /* malformed schema */ }

    // Pre-parse form_data once per row (avoid double-parsing for distributions + tags)
    const parsedRows: Record<string, unknown>[] = []
    for (const row of (responses.results || [])) {
      try {
        const data = JSON.parse((row as any).form_data)
        if (data && typeof data === 'object') parsedRows.push(data)
      } catch { /* skip malformed row */ }
    }

    const distributions: Record<string, Record<string, number>> = {}
    const distributableTypes = ['select', 'multiselect', 'likert', 'rating', 'country']

    for (const field of formSchema) {
      if (!distributableTypes.includes(field.type)) continue
      const dist: Record<string, number> = {}
      for (const data of parsedRows) {
        const val = data[field.name]
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

    // Tag distribution from _tags metadata
    const tagBreakdown: Record<string, number> = {}
    // Enrichment aggregation: URLs analyzed, content sources, claims
    const enrichedUrls: { url: string; title?: string; summary?: string; analysis_id?: string }[] = []
    const contentSources: Record<string, number> = {}
    let enrichedCount = 0

    for (const data of parsedRows) {
      const tags = (data as any)._tags
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          tagBreakdown[String(tag)] = (tagBreakdown[String(tag)] || 0) + 1
        }
      }

      // Collect enrichment data from _enriched_* fields
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith('_enriched_') && val && typeof val === 'object') {
          enrichedCount++
          const e = val as Record<string, unknown>
          if (e.url) {
            enrichedUrls.push({
              url: String(e.url),
              title: e.title ? String(e.title) : undefined,
              summary: e.summary ? String(e.summary) : undefined,
              analysis_id: e.analysis_id ? String(e.analysis_id) : undefined,
            })
          }
          if (e.content_source) {
            const src = String(e.content_source)
            contentSources[src] = (contentSources[src] || 0) + 1
          }
        }
      }
    }

    // Cross-reference submitted URLs with content_analysis table for deep intel
    const submittedUrls: string[] = []
    for (const data of parsedRows) {
      for (const field of formSchema) {
        if (field.type === 'url' && data[field.name]) {
          submittedUrls.push(String(data[field.name]))
        }
      }
    }

    // Fetch content analysis for submitted URLs (batch lookup)
    const entities: { name: string; type: string; count: number }[] = []
    const claims: { claim: string; confidence?: number }[] = []
    const sentimentCounts: Record<string, number> = {}
    const topicCounts: Record<string, number> = {}
    let analyzedUrlCount = 0

    if (submittedUrls.length > 0) {
      // Batch in groups of 10 to avoid query size limits
      const batches = []
      for (let i = 0; i < Math.min(submittedUrls.length, 50); i += 10) {
        batches.push(submittedUrls.slice(i, i + 10))
      }

      const batchResults = await Promise.all(batches.map(batch => {
        const placeholders = batch.map(() => '?').join(',')
        return env.DB.prepare(
          `SELECT url, entities, claim_analysis, sentiment_analysis, topics, keyphrases
           FROM content_analysis WHERE url IN (${placeholders}) LIMIT 50`
        ).bind(...batch).all()
      }))

      for (const analyses of batchResults) {
        for (const row of (analyses.results || []) as any[]) {
          analyzedUrlCount++

          // Parse entities
          try {
            const ents = row.entities ? JSON.parse(row.entities) : []
            if (Array.isArray(ents)) {
              for (const e of ents) {
                const name = e.name || e.text || e.entity || String(e)
                const type = e.type || e.label || 'unknown'
                if (typeof name === 'string' && name.length > 1) {
                  const existing = entities.find(x => x.name.toLowerCase() === name.toLowerCase())
                  if (existing) { existing.count++ }
                  else { entities.push({ name, type: String(type), count: 1 }) }
                }
              }
            }
          } catch { /* */ }

          // Parse claims
          try {
            const ca = row.claim_analysis ? JSON.parse(row.claim_analysis) : null
            if (ca) {
              const claimList = ca.claims || ca.key_claims || (Array.isArray(ca) ? ca : [])
              for (const c of claimList.slice(0, 10)) {
                const text = c.claim || c.text || c.statement || (typeof c === 'string' ? c : null)
                if (text) {
                  claims.push({ claim: String(text).substring(0, 300), confidence: c.confidence })
                }
              }
            }
          } catch { /* */ }

          // Parse sentiment
          try {
            const sa = row.sentiment_analysis ? JSON.parse(row.sentiment_analysis) : null
            if (sa?.overall_sentiment) {
              const label = String(sa.overall_sentiment)
              sentimentCounts[label] = (sentimentCounts[label] || 0) + 1
            }
          } catch { /* */ }

          // Parse topics
          try {
            const tp = row.topics ? JSON.parse(row.topics) : null
            if (tp) {
              const topicList = tp.topics || tp.main_topics || (Array.isArray(tp) ? tp : [])
              for (const t of topicList) {
                const name = t.name || t.topic || (typeof t === 'string' ? t : null)
                if (name) topicCounts[String(name)] = (topicCounts[String(name)] || 0) + 1
              }
            }
          } catch { /* */ }
        }
      }
    }

    // Sort entities by count
    entities.sort((a, b) => b.count - a.count)

    return new Response(JSON.stringify({
      total: survey.submission_count,
      by_country: Object.fromEntries((byCountry.results || []).map((r: any) => [r.country, r.count])),
      by_day: Object.fromEntries((byDay.results || []).map((r: any) => [r.day, r.count])),
      by_status: Object.fromEntries((byStatus.results || []).map((r: any) => [r.status, r.count])),
      by_tag: tagBreakdown,
      distributions,
      fields: formSchema.map(f => ({ name: f.name, label: f.label, type: f.type })),
      enrichment: {
        total_enriched: enrichedCount,
        urls: enrichedUrls.slice(0, 50),
        content_sources: contentSources,
      },
      intelligence: {
        analyzed_urls: analyzedUrlCount,
        entities: entities.slice(0, 30),
        claims: claims.slice(0, 20),
        sentiment: sentimentCounts,
        topics: topicCounts,
      },
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
