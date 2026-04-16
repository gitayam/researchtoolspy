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
import { getUserFromRequest } from '../_shared/auth-helpers'
import { fetchSocialViaApify } from '../_shared/apify-social'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  APIFY_API_KEY?: string
}

interface ExtractClaimsRequest {
  url: string
  include_entities?: boolean  // default true
  include_summary?: boolean   // default true
}

interface OgMetadata {
  title?: string
  description?: string
  author?: string
  publishDate?: string
  siteName?: string
}

// ─── Paywall detection ───

const PAYWALL_INDICATORS = [
  'subscribe to read', 'subscribe to continue', 'subscription required',
  'sign in to read', 'sign in to continue', 'log in to read',
  'register to read', 'create an account', 'premium content',
  'this content is for subscribers', 'subscribers only',
  'already a subscriber', 'become a member', 'start your free trial',
  'to unlock this article', 'unlock full access', 'get unlimited access',
  'read the full story', 'continue reading for', 'paywall',
  'you\'ve reached your limit', 'article limit', 'articles remaining',
  'free articles', 'monthly limit',
]

function isPaywalledContent(text: string, html: string): boolean {
  const lower = text.toLowerCase()
  const lowerHtml = html.toLowerCase()

  // Check text for paywall phrases
  const hasPaywallPhrase = PAYWALL_INDICATORS.some(p => lower.includes(p))
  if (hasPaywallPhrase) return true

  // Check for paywall meta tags or classes
  if (lowerHtml.includes('class="paywall"') ||
      lowerHtml.includes('id="paywall"') ||
      lowerHtml.includes('data-paywall') ||
      lowerHtml.includes('class="barrier"') ||
      lowerHtml.includes('class="gate"') ||
      lowerHtml.includes('name="robots" content="noarchive"')) {
    return true
  }

  // Very short article body relative to HTML size = likely paywall
  // Real articles typically have >500 words; paywall pages have <200 words of actual content
  const wordCount = text.split(/\s+/).length
  if (wordCount < 150 && html.length > 10000) return true

  return false
}

// ─── Content extraction ───

function extractOgMetadata(html: string): OgMetadata {
  const meta: OgMetadata = {}

  // OG tags
  const ogTitle = extractMetaContent(html, 'og:title')
  const ogDesc = extractMetaContent(html, 'og:description')
  const ogSite = extractMetaContent(html, 'og:site_name')

  // Twitter cards
  const twTitle = extractMetaContent(html, 'twitter:title')
  const twDesc = extractMetaContent(html, 'twitter:description')

  // Standard meta
  const metaDesc = extractMetaByName(html, 'description')
  const metaAuthor = extractMetaByName(html, 'author')
  const articleAuthor = extractMetaContent(html, 'article:author')
  const pubDate = extractMetaContent(html, 'article:published_time')

  // Title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const pageTitle = titleMatch ? decodeEntities(titleMatch[1].trim()) : undefined

  meta.title = ogTitle || twTitle || pageTitle
  meta.description = ogDesc || twDesc || metaDesc
  meta.author = articleAuthor || metaAuthor
  meta.publishDate = pubDate
  meta.siteName = ogSite

  return meta
}

function extractMetaContent(html: string, property: string): string | undefined {
  // property="og:title" content="..."
  const propMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']+)["']`, 'i')
  )
  if (propMatch) return decodeEntities(propMatch[1])

  // content="..." property="og:title"  (reversed order)
  const revMatch = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i')
  )
  if (revMatch) return decodeEntities(revMatch[1])

  return undefined
}

function extractMetaByName(html: string, name: string): string | undefined {
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  )
  if (nameMatch) return decodeEntities(nameMatch[1])

  const revMatch = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
  )
  if (revMatch) return decodeEntities(revMatch[1])

  return undefined
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
}

function cleanHtmlText(html: string): string {
  let text = html
  // Remove scripts, styles, nav, footer, header, aside, forms
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
  text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
  text = text.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
  text = text.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode entities
  text = decodeEntities(text).replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

async function fetchWithFallback(url: string): Promise<{
  html: string
  text: string
  ogMetadata: OgMetadata
  source: string
  paywalled: boolean
  error?: string
}> {
  let ogMetadata: OgMetadata = {}
  let paywalled = false

  // 1. Try original URL with enhanced browser headers
  try {
    const response = await enhancedFetch(url, { maxRetries: 2, retryDelay: 500 })
    if (response.ok) {
      const html = await response.text()
      ogMetadata = extractOgMetadata(html)
      const text = cleanHtmlText(html)

      if (text.length > 200 && !isPaywalledContent(text, html)) {
        return { html, text, ogMetadata, source: 'original', paywalled: false }
      }

      if (isPaywalledContent(text, html)) {
        paywalled = true
      }
    }
  } catch (e) {
    // Fallthrough to next source — intentional silent failure
  }

  // 2. Try Google AMP cache (works for many news sites)
  try {
    const ampUrl = `https://cdn.ampproject.org/v/s/${url.replace(/^https?:\/\//, '')}?amp_js_v=0.1`
    const ampResp = await fetch(ampUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    })
    if (ampResp.ok) {
      const html = await ampResp.text()
      const text = cleanHtmlText(html)
      if (text.length > 500 && !isPaywalledContent(text, html)) {
        const meta = extractOgMetadata(html)
        return {
          html, text,
          ogMetadata: { ...ogMetadata, ...meta },
          source: 'google-amp',
          paywalled: false
        }
      }
    }
  } catch (e) {
    // Fallthrough to next source — intentional silent failure
  }

  // 3. Try Google webcache
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`
    const cacheResp = await fetch(cacheUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    })
    if (cacheResp.ok) {
      const html = await cacheResp.text()
      const text = cleanHtmlText(html)
      if (text.length > 500 && !isPaywalledContent(text, html)) {
        const meta = extractOgMetadata(html)
        return {
          html, text,
          ogMetadata: { ...ogMetadata, ...meta },
          source: 'google-cache',
          paywalled: false
        }
      }
    }
  } catch (e) {
    // Fallthrough to next source — intentional silent failure
  }

  // 4. Try archive.ph
  try {
    const archiveResp = await fetch(`https://archive.ph/newest/${url}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    })
    if (archiveResp.ok) {
      const html = await archiveResp.text()
      const text = cleanHtmlText(html)
      if (text.length > 500 && !isPaywalledContent(text, html)) {
        const meta = extractOgMetadata(html)
        return {
          html, text,
          ogMetadata: { ...ogMetadata, ...meta },
          source: 'archive.ph',
          paywalled: false
        }
      }
    }
  } catch (e) {
    // Fallthrough to next source — intentional silent failure
  }

  // 5. Try Wayback Machine
  try {
    const wbResp = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (wbResp.ok) {
      const wbData = await wbResp.json() as any
      const snapshot = wbData?.archived_snapshots?.closest
      if (snapshot?.url) {
        const archiveResp = await fetch(snapshot.url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(15000)
        })
        if (archiveResp.ok) {
          const html = await archiveResp.text()
          const text = cleanHtmlText(html)
          if (text.length > 500) {
            const meta = extractOgMetadata(html)
            return {
              html, text,
              ogMetadata: { ...ogMetadata, ...meta },
              source: 'wayback',
              paywalled: false
            }
          }
        }
      }
    }
  } catch (e) {
    // Fallthrough to next source — intentional silent failure
  }

  // 6. All real sources failed — return OG metadata if we have it
  if (ogMetadata.title && ogMetadata.title.length > 10) {
    const syntheticText = [ogMetadata.title, ogMetadata.description].filter(Boolean).join('. ')
    return {
      html: '',
      text: syntheticText,
      ogMetadata,
      source: 'og-metadata-only',
      paywalled
    }
  }

  return { html: '', text: '', ogMetadata, source: 'failed', paywalled, error: 'All fetch methods failed' }
}

// ─── GPT analysis ───

async function analyzeContent(
  text: string,
  title: string,
  env: Env,
  options: {
    include_entities: boolean
    include_summary: boolean
    source: string
    paywalled: boolean
  }
): Promise<any> {
  const truncated = text.substring(0, 14000)

  // Adjust prompt based on how much content we have
  const isPartial = options.source === 'og-metadata-only' || text.length < 500
  const contentQualifier = isPartial
    ? `NOTE: Only partial content is available (likely paywalled). Extract what you can from the title and description. For claims you cannot verify from the available text, set confidence to 0.3 and note "inferred from headline" in the source field. Still generate suggested_market questions based on the topic.\n\n`
    : ''

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
      "suggested_market": "How this could be framed as a yes/no prediction market question"
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
${contentQualifier}
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
- EVERY claim MUST have a suggested_market: a clear yes/no question suitable for a prediction market (e.g., "Will X happen by Y date?", "Will X reach Y?")
- market_potential: "high" = directly maps to yes/no, "medium" = needs framing, "low" = hard to bet on
- NO opinions, editorials, or vague speculation
- Prioritize claims with clear resolvable outcomes
- suggested_market questions should be specific, time-bound when possible, and resolvable
${entityBlock}
${summaryBlock}

Return ONLY valid JSON:
${responseShape}

Article text:
${truncated}`

  const aiData = await callOpenAIViaGateway(env, {
    model: 'gpt-5.4-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert analyst specializing in extracting verifiable claims from news articles for prediction market matching. Extract specific, actionable claims with clear outcomes. EVERY claim must include a suggested_market question phrased as a yes/no prediction market question. Return ONLY valid JSON.'
      },
      { role: 'user', content: prompt }
    ],
    max_completion_tokens: 3000,
    reasoning_effort: 'none',
    temperature: 0.1,
    response_format: { type: 'json_object' }
  }, {
    cacheTTL: getOptimalCacheTTL('claim-analysis'),
    metadata: { endpoint: 'extract-claims', url: title.substring(0, 80) }
  })

  const rawContent = aiData.choices[0].message.content
  try { return JSON.parse(rawContent) } catch {
    console.warn('[extract-claims] Failed to parse AI response:', rawContent?.substring(0, 200))
    return { claims: [], summary: 'Failed to parse AI response' }
  }
}

// ─── Handler ───

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const startTime = Date.now()

  try {
    const authUserId = await getUserFromRequest(context.request, context.env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }

    const body = await context.request.json() as ExtractClaimsRequest
    const { url, include_entities = true, include_summary = true } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Early detection: x.com/twitter.com and tiktok.com block server-side scraping
    // Use Apify if available, otherwise reject with helpful message
    try {
      const parsedUrl = new URL(url)
      const host = parsedUrl.hostname.replace(/^www\./, '')
      if ((host === 'x.com' || host === 'twitter.com') && !context.env.APIFY_API_KEY) {
        return new Response(JSON.stringify({
          error: 'Twitter/X posts cannot be scraped',
          details: 'X.com blocks server-side requests. Configure APIFY_API_KEY to enable Twitter scraping, or paste the tweet text directly.',
          url,
          paywalled: false
        }), {
          status: 422,
          headers: JSON_HEADERS
        })
      }
      if (host === 'tiktok.com' && !context.env.APIFY_API_KEY) {
        return new Response(JSON.stringify({
          error: 'TikTok videos cannot be scraped',
          details: 'TikTok blocks server-side requests. Configure APIFY_API_KEY to enable TikTok scraping.',
          url,
          paywalled: false
        }), {
          status: 422,
          headers: JSON_HEADERS
        })
      }
    } catch {
      // Invalid URL — will be caught by fetch below
    }

    // 1. Try Apify for social media URLs first (richer content than standard fetch)
    let fetched: Awaited<ReturnType<typeof fetchWithFallback>>
    if (context.env.APIFY_API_KEY) {
      const socialResult = await fetchSocialViaApify(url, context.env.APIFY_API_KEY)
      if (socialResult?.success && socialResult.text.length > 50) {
        fetched = {
          text: socialResult.text,
          html: '',
          ogMetadata: {
            title: socialResult.title,
            author: socialResult.author,
            publishDate: socialResult.publishDate,
          },
          source: 'apify',
          paywalled: false,
        }
      } else {
        fetched = await fetchWithFallback(url)
      }
    } else {
      fetched = await fetchWithFallback(url)
    }

    if (fetched.error && !fetched.text) {
      console.error('[ExtractClaims] Fetch failed:', fetched.error)
      return new Response(JSON.stringify({
        error: 'Failed to fetch content from URL',
        og_metadata: fetched.ogMetadata,
        paywalled: fetched.paywalled
      }), {
        status: 422,
        headers: JSON_HEADERS
      })
    }

    // 2. Check content quality
    const wordCount = fetched.text.split(/\s+/).length

    if (fetched.text.length < 30) {
      return new Response(JSON.stringify({
        error: 'Insufficient content',
        details: `Only ${fetched.text.length} characters extracted. Page may be JavaScript-rendered or paywalled.`,
        source: fetched.source,
        og_metadata: fetched.ogMetadata,
        paywalled: fetched.paywalled
      }), {
        status: 422,
        headers: JSON_HEADERS
      })
    }

    const title = fetched.ogMetadata.title || fetched.text.substring(0, 100)

    // 3. Run GPT analysis (claims + entities + summary)
    const analysis = await analyzeContent(fetched.text, title, context.env, {
      include_entities,
      include_summary,
      source: fetched.source,
      paywalled: fetched.paywalled
    })

    // 4. Return structured response
    return new Response(JSON.stringify({
      url,
      title,
      author: fetched.ogMetadata.author,
      publish_date: fetched.ogMetadata.publishDate,
      site_name: fetched.ogMetadata.siteName,
      content_source: fetched.source,
      word_count: wordCount,
      paywalled: fetched.paywalled,
      claims: analysis.claims || [],
      entities: analysis.entities || null,
      summary: analysis.summary || null,
      model: 'gpt-5.4-mini',
      processing_ms: Date.now() - startTime
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[ExtractClaims] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to extract claims'
,
      processing_ms: Date.now() - startTime
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
