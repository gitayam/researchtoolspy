// POST /api/cross-table/:id/ai/insights — AI analysis of matrix results
import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../../../_shared/ai-gateway'
import { computeRankings } from '../../../../../src/lib/cross-table/engine/ranking'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: corsHeaders })
  }

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, authUserId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config

    const scoresResult = await env.DB.prepare(
      'SELECT * FROM cross_table_scores WHERE cross_table_id = ?'
    ).bind(tableId).all()

    const scores = scoresResult.results || []
    const results = computeRankings(config, scores as any)

    // Build context for AI
    const rowLabels = Object.fromEntries((config.rows || []).map((r: any) => [r.id, r.label]))
    const colLabels = Object.fromEntries((config.columns || []).map((c: any) => [c.id, c.label]))

    const rankingSummary = results.map(r => ({
      option: rowLabels[r.row_id] || r.row_id,
      rank: r.rank,
      weighted_score: Math.round(r.weighted_score * 1000) / 1000,
      scores: Object.fromEntries(
        Object.entries(r.normalized_scores).map(([colId, val]) => [colLabels[colId] || colId, Math.round(val * 100) / 100])
      ),
    }))

    const prompt = `You are an intelligence analyst reviewing a decision matrix analysis.

Decision: "${table.title}"
${table.description ? `Description: ${table.description}` : ''}
Template: ${table.template_type}
Scoring method: ${config.scoring?.method || 'numeric'}
Criteria weights: ${(config.columns || []).map((c: any) => `${c.label}: ${c.weight}`).join(', ')}

Rankings:
${JSON.stringify(rankingSummary, null, 2)}

Provide analysis as a JSON object with these fields:
- "summary": 2-3 sentence overview of the results
- "challenges": array of 2-3 potential challenges or risks with the top-ranked option
- "sensitivity_narrative": 1-2 sentences about which criteria most influence the outcome
- "blind_spots": array of 2-3 factors that may not be captured by the current criteria`

    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 0,
      metadata: { endpoint: 'cross-table-insights', user_id: String(authUserId) },
    })

    const content = aiResponse.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {}
    }

    // Validate field-by-field
    const insights = {
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 1000) : 'Analysis could not be generated.',
      challenges: Array.isArray(parsed.challenges)
        ? parsed.challenges.filter((c: any) => typeof c === 'string').slice(0, 5).map((c: string) => c.slice(0, 500))
        : [],
      sensitivity_narrative: typeof parsed.sensitivity_narrative === 'string' ? parsed.sensitivity_narrative.slice(0, 1000) : '',
      blind_spots: Array.isArray(parsed.blind_spots)
        ? parsed.blind_spots.filter((b: any) => typeof b === 'string').slice(0, 5).map((b: string) => b.slice(0, 500))
        : [],
    }

    return new Response(JSON.stringify({ insights, results: rankingSummary }), { headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable AI Insights] Error:', err)
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 500, headers: corsHeaders })
  }
}
