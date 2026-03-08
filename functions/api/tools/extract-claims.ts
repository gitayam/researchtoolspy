/**
 * Full-pipeline claim extraction endpoint for poly-sniff integration.
 *
 * Uses the same scraping approach as content-intelligence (browser profiles,
 * paywall bypass via archive.ph/wayback), extracts full article text, then
 * runs GPT for claims + entities + key phrases. Returns rich structured data
 * without requiring auth or persisting to DB.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { enhancedFetch } from '../../utils/browser-profiles'

interface Env {
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
}

interface ExtractClaimsRequest {
  url: string
  include_entities?: boolean  // default true
  include_summary?: boolean   // default true
}

// ─── Content extraction (mirrors content-intelligence pipeline) ───

function extractMetaTag(html: string, tag: string): string | undefined {
  // Try property-based meta tags (Open Graph, article:*)
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]+property=["'](?:og:|article:)?${tag}["'][^>]+content=["']([^"']+)["']`, 'i')
  )
  if (propertyMatch) return propertyMatch[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')

  // Try name-based meta tags
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${tag}["'][^>]+content=["']([^"']+)["']`, 'i')
  )
  if (nameMatch) return nameMatch[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"')

  // Title tag
  if (tag === 'title') {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) return titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&#039;/g, "'")
  }

  return undefined
}

function cleanHtmlText(html: string): string {
  let text = html
  // Remove scripts, styles, nav, footer, header, aside
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
  text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
  text = text.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common entities
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

async function fetchWithFallback(url: string): Promise<{
  html: string
  title: string
  author?: string
  publishDate?: string
  source: string
  error?: string
}> {
  // 1. Try original URL with enhanced browser headers
  try {
    const response = await enhancedFetch(url, { maxRetries: 2, retryDelay: 500 })
    if (response.ok) {
      const html = await response.text()
      const text = cleanHtmlText(html)
      if (text.length > 200) {
        return {
          html,
          title: extractMetaTag(html, 'title') || url,
          author: extractMetaTag(html, 'author'),
          publishDate: extractMetaTag(html, 'article:published_time'),
          source: 'original'
        }
      }
    }
  } catch (e) {
    console.log('[ExtractClaims] Original fetch failed, trying fallbacks...')
  }

  // 2. Try archive.ph
  try {
    const archiveResp = await fetch(`https://archive.ph/newest/${url}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow'
    })
    if (archiveResp.ok) {
      const html = await archiveResp.text()
      const text = cleanHtmlText(html)
      if (text.length > 200) {
        return {
          html,
          title: extractMetaTag(html, 'title') || url,
          author: extractMetaTag(html, 'author'),
          source: 'archive.ph'
        }
      }
    }
  } catch (e) {
    console.log('[ExtractClaims] archive.ph failed')
  }

  // 3. Try Wayback Machine
  try {
    const wbResp = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
    )
    if (wbResp.ok) {
      const wbData = await wbResp.json() as any
      const snapshot = wbData?.archived_snapshots?.closest
      if (snapshot?.url) {
        const archiveResp = await fetch(snapshot.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (archiveResp.ok) {
          const html = await archiveResp.text()
          return {
            html,
            title: extractMetaTag(html, 'title') || url,
            author: extractMetaTag(html, 'author'),
            source: 'wayback'
          }
        }
      }
    }
  } catch (e) {
    console.log('[ExtractClaims] Wayback failed')
  }

  return { html: '', title: url, source: 'failed', error: 'All fetch methods failed' }
}

// ─── GPT analysis ───

async function analyzeContent(
  text: string,
  title: string,
  env: Env,
  options: { include_entities: boolean; include_summary: boolean }
): Promise<any> {
  const truncated = text.substring(0, 14000)

  const entityBlock = options.include_entities ? `
PART 2 — ENTITIES
Extract all named entities from the article:
- people: Array of { name, role/title if mentioned }
- organizations: Array of names
- locations: Array of names
- dates: Array of { date, context }
- money: Array of { amount, context }` : ''

  const summaryBlock = options.include_summary ? `
PART 3 — SUMMARY
Write a 2-3 sentence summary of the article.` : ''

  const responseShape = `{
  "claims": [
    {
      "claim": "self-contained factual statement",
      "category": "event|prediction|statement|statistic|relationship",
      "source": "who said/reported this",
      "confidence": 0.0-1.0,
      "market_potential": "high|medium|low",
      "suggested_market": "Optional: how this could be framed as a yes/no prediction market question"
    }
  ]${options.include_entities ? `,
  "entities": {
    "people": [{ "name": "...", "role": "..." }],
    "organizations": ["..."],
    "locations": ["..."],
    "dates": [{ "date": "...", "context": "..." }]
  }` : ''}${options.include_summary ? `,
  "summary": "2-3 sentence summary"` : ''}
}`

  const prompt = `Analyze this article for prediction market research.

Article Title: ${title}

PART 1 — CLAIMS EXTRACTION
Extract 5-15 objective, verifiable claims that could map to prediction market outcomes.

Categories:
1. EVENT — Specific things that happened: who did what, when, where
2. PREDICTION — Forward-looking claims about what will/may happen
3. STATEMENT — Official assertions, policy positions, declarations
4. STATISTIC — Numbers, polls, economic figures, percentages
5. RELATIONSHIP — Cause-effect claims (X led to Y, X threatens Y)

Rules:
- Each claim MUST be self-contained (understandable without the article)
- Include specific names, dates, locations, numbers
- For each claim, suggest how it could be a yes/no market question
- market_potential: "high" = directly maps to yes/no, "medium" = needs framing, "low" = hard to bet on
- NO opinions, editorials, or vague speculation
- Prioritize claims with clear resolvable outcomes
${entityBlock}
${summaryBlock}

Return ONLY valid JSON:
${responseShape}

Article text:
${truncated}`

  const aiData = await callOpenAIViaGateway(env, {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert analyst specializing in extracting verifiable claims from news articles for prediction market matching. Extract specific, actionable claims with clear outcomes. Return ONLY valid JSON.'
      },
      { role: 'user', content: prompt }
    ],
    max_completion_tokens: 3000,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  }, {
    cacheTTL: getOptimalCacheTTL('claim-analysis'),
    metadata: { endpoint: 'extract-claims', url: title.substring(0, 80) }
  })

  const rawContent = aiData.choices[0].message.content
  return JSON.parse(rawContent)
}

// ─── Handler ───

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const startTime = Date.now()

  try {
    const body = await context.request.json() as ExtractClaimsRequest
    const { url, include_entities = true, include_summary = true } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 1. Fetch content with fallback chain
    console.log(`[ExtractClaims] Fetching ${url}...`)
    const fetched = await fetchWithFallback(url)

    if (fetched.error || !fetched.html) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch content',
        details: fetched.error || 'Empty response from all sources'
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // 2. Extract clean text
    const text = cleanHtmlText(fetched.html)
    const wordCount = text.split(/\s+/).length

    if (text.length < 100) {
      return new Response(JSON.stringify({
        error: 'Insufficient content',
        details: `Only ${text.length} characters extracted. Page may be JavaScript-rendered or paywalled.`,
        source: fetched.source
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    console.log(`[ExtractClaims] Extracted ${wordCount} words from ${fetched.source}`)

    // 3. Run GPT analysis (claims + entities + summary)
    const analysis = await analyzeContent(text, fetched.title, context.env, {
      include_entities,
      include_summary
    })

    // 4. Return structured response
    return new Response(JSON.stringify({
      url,
      title: fetched.title,
      author: fetched.author,
      publish_date: fetched.publishDate,
      content_source: fetched.source,
      word_count: wordCount,
      claims: analysis.claims || [],
      entities: analysis.entities || null,
      summary: analysis.summary || null,
      model: 'gpt-4o-mini',
      processing_ms: Date.now() - startTime
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
      details: error instanceof Error ? error.message : String(error),
      processing_ms: Date.now() - startTime
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
