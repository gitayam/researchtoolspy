// POST /api/cross-table/:id/ai/score-suggest — AI-suggested scores with rationale
import { getUserIdOrDefault } from '../../../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../../../_shared/ai-gateway'

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
    const userId = await getUserIdOrDefault(request, env)

    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, userId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: corsHeaders })
    }

    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
    const body = await request.json() as any
    const { row_id, context: userContext } = body

    // Build scoring instructions based on method
    const scoringGuide = buildScoringGuide(config)

    const targetRow = (config.rows || []).find((r: any) => r.id === row_id)
    const rowLabel = targetRow?.label || 'the selected option'

    const prompt = `You are an intelligence analyst helping score a decision matrix.

Decision: "${table.title}"
${table.description ? `Description: ${table.description}` : ''}
${userContext ? `Additional context: ${userContext}` : ''}

Score the option "${rowLabel}" on each criterion.
${scoringGuide}

Criteria to score:
${(config.columns || []).map((c: any) => `- ${c.label}${c.description ? `: ${c.description}` : ''}`).join('\n')}

Respond with a JSON object with a "scores" array. Each entry should have:
- "col_id": the criterion ID (use these exact IDs: ${(config.columns || []).map((c: any) => c.id).join(', ')})
- "score": the score value
- "rationale": 1 sentence explanation
- "confidence": 0.0 to 1.0 (how confident in this score)`

    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 0,
      metadata: { endpoint: 'cross-table-score-suggest', user_id: String(userId) },
    })

    const content = aiResponse.choices?.[0]?.message?.content || '{"scores":[]}'
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { scores: [] }
    }

    // Validate field-by-field
    const validColIds = new Set((config.columns || []).map((c: any) => c.id))
    const suggestions = (Array.isArray(parsed.scores) ? parsed.scores : [])
      .filter((s: any) => s && typeof s.col_id === 'string' && validColIds.has(s.col_id))
      .map((s: any) => ({
        col_id: String(s.col_id),
        score: (typeof s.score === 'number' || typeof s.score === 'string') ? s.score : null,
        rationale: typeof s.rationale === 'string' ? s.rationale.slice(0, 500) : '',
        confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.5,
      }))

    return new Response(JSON.stringify({ suggestions, row_id }), { headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable AI Score] Error:', err)
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 500, headers: corsHeaders })
  }
}

function buildScoringGuide(config: any): string {
  const method = config.scoring?.method || 'numeric'
  switch (method) {
    case 'numeric':
      return `Scoring: numeric ${config.scoring?.scale?.min ?? 1}-${config.scoring?.scale?.max ?? 10}`
    case 'likert':
      return `Scoring: Likert scale 0-${(config.scoring?.labels?.length || 5) - 1} (${(config.scoring?.labels || ['Very Low', 'Low', 'Medium', 'High', 'Very High']).join(', ')})`
    case 'traffic':
      return 'Scoring: traffic light — use "R" (Red/Bad), "A" (Amber/Mixed), or "G" (Green/Good)'
    case 'ternary':
      return 'Scoring: ternary — use "+" (better), "0" (same), "-" (worse)'
    case 'binary':
      return 'Scoring: binary — use "yes" or "no"'
    case 'ach':
      return 'Scoring: ACH consistency — use "CC" (Strongly Consistent), "C" (Consistent), "N" (Neutral), "I" (Inconsistent), "II" (Strongly Inconsistent)'
    default:
      return 'Scoring: numeric 1-10'
  }
}
