import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface ClaimMatchRequest {
  claim: string
  claims?: string[]  // Additional claims for richer context
  candidates: Array<{
    slug: string
    title: string
    description?: string
  }>
}

interface MatchResult {
  slug: string
  title: string
  relevance: number
  reasoning: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await getUserFromRequest(context.request, context.env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as ClaimMatchRequest

    if (!body.claim || !body.claim.trim()) {
      return new Response(JSON.stringify({ error: 'claim is required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    if (!body.candidates || !Array.isArray(body.candidates) || body.candidates.length === 0) {
      return new Response(JSON.stringify({ error: 'candidates array is required and must not be empty' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    if (body.candidates.length > 25) {
      return new Response(JSON.stringify({ error: 'Maximum 25 candidates per request' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const candidateList = body.candidates.map((c, i) =>
      `${i + 1}. slug: "${c.slug}" | title: "${c.title}" | description: "${(c.description || '').substring(0, 200)}"`
    ).join('\n')

    // Build context from primary claim + additional claims
    const additionalContext = body.claims && body.claims.length > 0
      ? `\n\nADDITIONAL CONTEXT (related claims from the same source):\n${body.claims.slice(0, 10).map((c, i) => `- ${c}`).join('\n')}`
      : ''

    const systemPrompt = `You are a prediction market analyst. Given a claim (and optionally additional related claims for context), score how relevant each candidate Polymarket market is.

SCORING GUIDE:
- 90-100: Direct match — the market is explicitly about this claim or event
- 70-89: Strong match — the market covers the same topic/event/person with minor differences in framing
- 40-69: Partial match — related topic area but different specific question
- 10-39: Weak match — tangentially related at best
- 0-9: No match

IMPORTANT MATCHING RULES:
- Focus on SEMANTIC meaning, not exact word overlap
- "Will X happen?" matches claims about X happening or being planned
- Claims about a person/country/topic match markets about the same person/country/topic
- A claim about "tariffs on China" should match markets about "US-China trade war", "China tariffs", etc.
- Consider the ADDITIONAL CONTEXT claims to understand the broader topic — a market matching ANY of the context claims should score higher
- Be generous with partial matches (40-69) when the topic area overlaps

Return ONLY valid JSON in this exact structure:
{
  "results": [
    {"slug": "market-slug", "title": "Market Title", "relevance": 95, "reasoning": "One sentence explanation"}
  ]
}

Include ALL candidates in the results array. Sort by relevance descending.`

    const userPrompt = `PRIMARY CLAIM: "${body.claim}"${additionalContext}

CANDIDATE MARKETS:
${candidateList}

Score each candidate's relevance to the claim and its broader topic.`

    const aiData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.0,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: { endpoint: 'claim-match', claim: body.claim.substring(0, 100) }
    })

    const rawContent = aiData.choices[0].message.content
    let parsed: any
    try { parsed = JSON.parse(rawContent) } catch {
      console.warn('[claim-match] Failed to parse AI response:', rawContent?.substring(0, 200))
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', claim: body.claim, results: [] }), {
        status: 502, headers: JSON_HEADERS,
      })
    }

    const results: MatchResult[] = (parsed.results || []).map((r: any) => ({
      slug: r.slug || '',
      title: r.title || body.candidates.find(c => c.slug === r.slug)?.title || '',
      relevance: Math.min(100, Math.max(0, Number(r.relevance) || 0)),
      reasoning: r.reasoning || ''
    }))

    results.sort((a, b) => b.relevance - a.relevance)

    return new Response(JSON.stringify({
      claim: body.claim,
      results,
      model: 'gpt-4o-mini',
      cached: false
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[ClaimMatch] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to perform claim matching'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
