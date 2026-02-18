import { getUserFromRequest } from '../_shared/auth-helpers'
import { callOpenAIViaGateway } from '../_shared/ai-gateway'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const [frameworks, entities, evidenceCount] = await Promise.all([
      env.DB.prepare(`
        SELECT framework_type, title, data, created_at
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
        LIMIT 15
      `).bind(userId).all<{ framework_type: string; title: string; data: string; created_at: string }>(),

      env.DB.prepare(`
        SELECT name, entity_type FROM (
          SELECT name, 'ACTOR' as entity_type FROM actors WHERE user_id = ?
          UNION ALL
          SELECT name, 'SOURCE' as entity_type FROM sources WHERE user_id = ?
          UNION ALL
          SELECT name, 'EVENT' as entity_type FROM events WHERE user_id = ?
        ) LIMIT 50
      `).bind(userId, userId, userId).all<{ name: string; entity_type: string }>(),

      env.DB.prepare(`SELECT COUNT(*) as cnt FROM evidence_items WHERE user_id = ?`)
        .bind(userId).first<{ cnt: number }>(),
    ])

    const fwResults = frameworks.results || []
    if (fwResults.length === 0) {
      return new Response(JSON.stringify({
        watch_list: [],
        emerging_patterns: [],
        collection_gaps: [],
        risk_trajectory: 'STABLE',
        risk_trajectory_reasoning: 'No analysis data available to assess trajectory.',
        generated_at: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const fwSummaries = fwResults.map(fw => {
      let data: any = {}
      try { data = JSON.parse(fw.data || '{}') } catch { /* skip */ }
      const str = JSON.stringify(data)
      return {
        type: fw.framework_type,
        title: fw.title,
        created_at: fw.created_at,
        data_preview: str.substring(0, 300),
      }
    })

    const systemPrompt = `You are an intelligence analyst generating forward-looking predictive indicators based on analytical framework data.

Given a set of completed analyses, identify:
1. Watch list: entities or topics that warrant increased monitoring/collection
2. Emerging patterns: trends or patterns detected across the analysis
3. Collection gaps: areas needing more evidence to increase confidence
4. Risk trajectory: is the situation escalating, stable, or de-escalating

Respond ONLY with valid JSON:
{
  "watch_list": [{ "entity_or_topic": "string", "reason": "string", "priority": "LOW|MEDIUM|HIGH", "related_frameworks": ["type"] }],
  "emerging_patterns": [{ "description": "string", "confidence": 0-100 }],
  "collection_gaps": [{ "area": "string", "current_evidence_count": 0, "recommended_action": "string", "impact_if_filled": "string" }],
  "risk_trajectory": "ESCALATING|STABLE|DE_ESCALATING",
  "risk_trajectory_reasoning": "string"
}`

    const userPrompt = `Based on these analyses and entities, generate predictive intelligence indicators:

Frameworks (${fwSummaries.length}):
${JSON.stringify(fwSummaries, null, 2)}

Known entities (${(entities.results || []).length}):
${(entities.results || []).map(e => `- ${e.name} (${e.entity_type})`).join('\n')}

Evidence items: ${evidenceCount?.cnt ?? 0}

Provide actionable, forward-looking intelligence recommendations.`

    const response = await callOpenAIViaGateway(env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.4,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: 600,
      metadata: { endpoint: 'intelligence-predictions', user_id: String(userId) }
    })

    const content = response.choices?.[0]?.message?.content || '{}'
    let predictions: any
    try {
      predictions = JSON.parse(content)
    } catch {
      predictions = {
        watch_list: [],
        emerging_patterns: [],
        collection_gaps: [],
        risk_trajectory: 'STABLE',
        risk_trajectory_reasoning: 'Unable to generate predictions.',
      }
    }

    return new Response(JSON.stringify({
      ...predictions,
      generated_at: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Intelligence predictions error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate predictions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
