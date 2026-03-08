/**
 * Lightweight claim extraction endpoint for poly-sniff integration.
 * Scrapes a URL, extracts factual claims via GPT, returns them without
 * persisting to DB (no auth required).
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { scrapeUrl } from '../_shared/scraper-utils'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { url } = await context.request.json() as { url: string }

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Scrape the URL
    console.log(`[ExtractClaims] Scraping ${url}...`)
    const scraped = await scrapeUrl(url)

    if (scraped.error) {
      return new Response(JSON.stringify({
        error: 'Scraping failed',
        details: scraped.error
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const content = scraped.content
    const title = scraped.title

    if (!content || content.length < 50) {
      return new Response(JSON.stringify({
        error: 'Insufficient content',
        details: 'Could not extract enough text to analyze.'
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract claims via GPT
    const truncated = content.substring(0, 12000)

    const prompt = `Extract objective factual claims from this article that could be matched to prediction markets. Focus on verifiable, forward-looking, or outcome-based statements.

Article Title: ${title || 'Unknown'}

Extract claims in these categories:
1. EVENT - Specific events: who did what, when, where
2. PREDICTION - Forward-looking claims about what will/may happen
3. STATEMENT - Factual assertions from officials/sources
4. STATISTIC - Numerical data, polls, market figures
5. RELATIONSHIP - Cause-effect claims (policy X leads to outcome Y)

Rules:
- Each claim must be self-contained and specific
- Include names, dates, locations, numbers
- Prioritize claims that map to yes/no outcomes (prediction market style)
- Extract 5-15 claims maximum
- NO opinions or vague speculation

Return ONLY valid JSON array:
[
  {
    "claim": "Israel struck Iranian oil facilities on March 8, 2026",
    "category": "event",
    "source": "NPR",
    "confidence": 0.95,
    "market_potential": "high"
  }
]

market_potential: "high" = easily maps to a prediction market, "medium" = could with some framing, "low" = unlikely

Text to analyze:
${truncated}`

    const aiData = await callOpenAIViaGateway(context.env, {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fact-extraction expert optimized for prediction market matching. Extract specific, verifiable claims that could map to yes/no market outcomes. Return ONLY valid JSON array.'
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 1500,
      temperature: 0.2
    }, {
      cacheTTL: getOptimalCacheTTL('claim-analysis'),
      metadata: { endpoint: 'extract-claims', url: url.substring(0, 100) }
    })

    const rawContent = aiData.choices[0].message.content
    const jsonText = rawContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const claims = JSON.parse(jsonText)

    return new Response(JSON.stringify({
      url,
      title: title || '',
      claims: Array.isArray(claims) ? claims : [],
      model: 'gpt-4o-mini',
      content_length: content.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[ExtractClaims] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to extract claims',
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
