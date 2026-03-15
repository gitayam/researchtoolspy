// POST /api/cross-table/:id/ai/suggest-criteria — AI-suggested criteria
import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../../../_shared/ai-gateway'
import { JSON_HEADERS } from '../../../_shared/api-utils'


export async function onRequest(context: any) {
  const { request, env, params } = context
  const tableId = params.id as string

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 500, headers: JSON_HEADERS })
  }

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const table = await env.DB.prepare(
      'SELECT * FROM cross_tables WHERE id = ? AND user_id = ?'
    ).bind(tableId, authUserId).first()

    if (!table) {
      return new Response(JSON.stringify({ error: 'Cross table not found' }), { status: 404, headers: JSON_HEADERS })
    }

    const body = await request.json() as any
    const { topic, count } = body
    const config = typeof table.config === 'string' ? JSON.parse(table.config) : table.config
    const numCriteria = Math.min(Math.max(count || 5, 2), 12)

    const prompt = `You are an intelligence analyst helping build a decision matrix.

The decision topic is: "${topic || table.title}"
Template type: ${table.template_type}
Current scoring method: ${config.scoring?.method || 'numeric'}
Existing criteria: ${config.columns?.map((c: any) => c.label).join(', ') || 'none'}

Suggest ${numCriteria} evaluation criteria for this decision matrix. Each criterion should be:
- Specific and measurable
- Relevant to the decision context
- Distinct from existing criteria

Respond with ONLY a JSON array of objects with "label" and "description" fields. No other text.`

    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 300,
      metadata: { endpoint: 'cross-table-suggest-criteria', user_id: String(authUserId) },
    })

    const content = aiResponse.choices?.[0]?.message?.content || '{"criteria":[]}'
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      return new Response(JSON.stringify({ criteria: [] }), { headers: JSON_HEADERS })
    }

    // Validate field-by-field — never spread raw LLM output
    const rawCriteria = Array.isArray(parsed) ? parsed : (parsed.criteria || [])
    const criteria = rawCriteria
      .filter((c: any) => c && typeof c.label === 'string')
      .slice(0, numCriteria)
      .map((c: any) => ({
        label: String(c.label).slice(0, 100),
        description: typeof c.description === 'string' ? String(c.description).slice(0, 500) : '',
      }))

    return new Response(JSON.stringify({ criteria }), { headers: JSON_HEADERS })
  } catch (err: any) {
    console.error('[CrossTable AI Criteria] Error:', err)
    return new Response(JSON.stringify({ error: 'AI request failed' }), { status: 500, headers: JSON_HEADERS })
  }
}
