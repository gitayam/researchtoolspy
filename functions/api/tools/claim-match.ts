import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'

interface Env {
  OPENAI_API_KEY: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  AI_GATEWAY_ACCOUNT_ID?: string
}

interface ClaimMatchRequest {
  claim: string
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
    const body = await context.request.json() as ClaimMatchRequest

    if (!body.claim || !body.claim.trim()) {
      return new Response(JSON.stringify({ error: 'claim is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!body.candidates || !Array.isArray(body.candidates) || body.candidates.length === 0) {
      return new Response(JSON.stringify({ error: 'candidates array is required and must not be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (body.candidates.length > 20) {
      return new Response(JSON.stringify({ error: 'Maximum 20 candidates per request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const candidateList = body.candidates.map((c, i) =>
      `${i + 1}. slug: "${c.slug}" | title: "${c.title}" | description: "${(c.description || '').substring(0, 200)}"`
    ).join('\n')

    const systemPrompt = `You are a prediction market analyst. Given a claim or research finding, score how relevant each candidate Polymarket market is to that claim.

SCORING GUIDE:
- 90-100: Direct match — the market is explicitly about this claim
- 70-89: Strong match — the market covers the same topic/event with minor differences
- 40-69: Partial match — related topic but different specific question
- 10-39: Weak match — tangentially related at best
- 0-9: No match

Return ONLY valid JSON in this exact structure:
{
  "results": [
    {"slug": "market-slug", "title": "Market Title", "relevance": 95, "reasoning": "One sentence explanation"}
  ]
}

Include ALL candidates in the results array. Sort by relevance descending.`

    const userPrompt = `CLAIM: "${body.claim}"

CANDIDATE MARKETS:
${candidateList}

Score each candidate's relevance to the claim.`

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
    const parsed = JSON.parse(rawContent)

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[ClaimMatch] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to perform claim matching',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
