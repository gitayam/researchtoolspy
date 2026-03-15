// POST /api/cross-table/ai/suggest-setup — standalone AI criteria+rows suggestions (no tableId needed)
import { getUserFromRequest } from '../../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../../_shared/ai-gateway'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export async function onRequest(context: any) {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    const body = await request.json() as any
    const { topic, template_type, count } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Topic must be at least 3 characters' }), { status: 400, headers: corsHeaders })
    }

    const numCriteria = Math.min(Math.max(count || 6, 2), 12)

    const prompt = `You are an intelligence analyst helping set up a decision matrix.

The decision context: "${topic.trim()}"
Template type: ${template_type || 'weighted'}

Suggest ${numCriteria} evaluation criteria AND 3-4 alternatives (options being compared) for this decision matrix.

Each criterion should be:
- Specific and measurable
- Relevant to the decision context
- Distinct from each other

Each alternative should be:
- A realistic option someone might consider for this decision
- Distinct from other alternatives

Respond with ONLY a JSON object with this shape:
{
  "criteria": [{"label": "...", "description": "..."}],
  "rows": [{"label": "...", "description": "..."}]
}`

    const aiResponse = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 300,
      metadata: { endpoint: 'cross-table-suggest-setup', user_id: String(userId) },
    })

    const content = aiResponse.choices?.[0]?.message?.content || '{"criteria":[],"rows":[]}'
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      return new Response(JSON.stringify({ criteria: [], rows: [] }), { headers: corsHeaders })
    }

    // Validate field-by-field — never spread raw LLM output
    const rawCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : []
    const criteria = rawCriteria
      .filter((c: any) => c && typeof c.label === 'string')
      .slice(0, numCriteria)
      .map((c: any) => ({
        label: String(c.label).slice(0, 100),
        description: typeof c.description === 'string' ? String(c.description).slice(0, 500) : '',
      }))

    const rawRows = Array.isArray(parsed.rows) ? parsed.rows : []
    const rows = rawRows
      .filter((r: any) => r && typeof r.label === 'string')
      .slice(0, 6)
      .map((r: any) => ({
        label: String(r.label).slice(0, 100),
        description: typeof r.description === 'string' ? String(r.description).slice(0, 500) : '',
      }))

    return new Response(JSON.stringify({ criteria, rows }), { headers: corsHeaders })
  } catch (err: any) {
    console.error('[CrossTable AI Setup] Error:', err)
    return new Response(JSON.stringify({ error: 'AI suggestion request failed' }), { status: 500, headers: corsHeaders })
  }
}
