/**
 * Full-pipeline claim extraction endpoint for poly-sniff integration.
 *
 * Uses the same quality-aware archive recovery approach as content-intelligence,
 * extracts article text, then runs GPT for claims + entities + key phrases.
 * The route requires auth but does not persist the result.
 */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { fetchSocialViaApify, isApifySupportedUrl } from '../_shared/apify-social'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { extractArticle, type ArticleQualitySignals } from '../_shared/article-extractor'
import {
  ARTICLE_CANDIDATE_POLICIES,
  assessArticleCandidate,
  createArticleCandidateSelector,
  type ArticleCandidateAssessment,
} from '../_shared/article-candidate'
import { fetchArchivePhSource, fetchWaybackSource } from '../_shared/archive-sources'
import { parseSafeOutboundUrl, SafeFetchError, safeFetchText } from '../_shared/safe-fetch'
import type { NormalizedScrapeError } from '../_shared/scrape-contract'

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

interface FetchWithFallbackResult {
  html: string
  text: string
  ogMetadata: OgMetadata
  source: string
  paywalled: boolean
  fallback_attempts: string[]
  quality: ArticleCandidateAssessment
  error?: string
  policyDenied?: boolean
}

interface ClaimsCandidate {
  html: string
  text: string
  ogMetadata: OgMetadata
  source: string
  paywalled: boolean
  success: boolean
  contentKind?: 'article' | 'social'
  qualitySignals?: ArticleQualitySignals
  errorCode?: NormalizedScrapeError
  error?: string
  policyDenied?: boolean
}

interface ClaimsAnalysis {
  claims?: unknown[]
  entities?: unknown
  summary?: string
}

const PRIMARY_MAX_RESPONSE_BYTES = 2 * 1024 * 1024

function terminalPolicyFailure(error: unknown): boolean {
  return error instanceof SafeFetchError && (
    error.code === 'invalid_url'
    || error.code === 'unsafe_url'
    || error.code === 'dns_resolution_failed'
  )
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

export async function fetchWithFallback(url: string): Promise<FetchWithFallbackResult> {
  let ogMetadata: OgMetadata = {}
  let paywalled = false
  const attempts: string[] = []
  const candidates = createArticleCandidateSelector(
    ARTICLE_CANDIDATE_POLICIES.claims,
    (candidate: ClaimsCandidate) => ({
      success: candidate.success,
      text: candidate.text,
      title: candidate.ogMetadata.title,
      blocked: candidate.paywalled,
      contentKind: candidate.contentKind,
      errorCode: candidate.errorCode,
      qualitySignals: candidate.qualitySignals,
    }),
  )
  const totalController = new AbortController()
  const totalTimeout = setTimeout(
    () => totalController.abort(new Error('extract-claims fetch chain timed out')),
    30_000,
  )

  const mergeMetadata = (base: OgMetadata, next: OgMetadata): OgMetadata => {
    const defined = Object.fromEntries(
      Object.entries(next).filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as OgMetadata
    return { ...base, ...defined }
  }
  const buildArticleCandidate = (
    html: string,
    finalUrl: string,
    source: 'original' | 'archive.ph' | 'wayback',
  ): ClaimsCandidate => {
    const article = extractArticle(html, finalUrl)
    const metadata = mergeMetadata(ogMetadata, {
      ...extractOgMetadata(html),
      title: article.title,
      author: article.author,
      publishDate: article.publishedTime,
      siteName: article.siteName,
      description: article.excerpt,
    })
    const blocked = isPaywalledContent(article.text, html)
      || article.qualitySignals.reasons.includes('login_or_paywall')
    return {
      html,
      text: article.text,
      ogMetadata: metadata,
      source,
      paywalled: blocked,
      success: true,
      contentKind: 'article',
      qualitySignals: article.qualitySignals,
    }
  }
  const finish = (
    assessed: ReturnType<typeof candidates.consider>,
    error?: string,
  ): FetchWithFallbackResult => ({
    ...assessed.candidate,
    fallback_attempts: [...attempts],
    quality: assessed.assessment,
    ...(error ? { error } : {}),
  })

  try {
    // Destination policy failures are terminal: never disclose denied targets
    // to a cache or archive provider.
    attempts.push('original')
    try {
      const fetched = await safeFetchText(url, {
        timeoutMs: 15_000,
        maxRedirects: 5,
        maxResponseBytes: PRIMARY_MAX_RESPONSE_BYTES,
        allowedContentTypes: ['text/', 'application/xhtml+xml', 'application/xml'],
        requestInit: {
          signal: totalController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
          },
        },
      })
      if (fetched.response.ok) {
        const candidate = buildArticleCandidate(fetched.text, fetched.finalUrl, 'original')
        ogMetadata = candidate.ogMetadata
        paywalled = candidate.paywalled
        const assessed = candidates.consider(candidate)
        if (assessed.assessment.accepted) return finish(assessed)
      } else {
        const assessed = candidates.consider({
          html: '', text: '', ogMetadata, source: 'original', paywalled,
          success: false,
          errorCode: fetched.response.status === 429
            ? 'rate_limited'
            : fetched.response.status >= 500 ? 'upstream_5xx' : 'upstream_4xx',
        })
        if (fetched.response.status === 401) {
          return finish(assessed, 'The source requires authentication')
        }
      }
    } catch (error) {
      if (terminalPolicyFailure(error)) {
        const assessed = candidates.consider({
          html: '', text: '', ogMetadata, source: 'failed', paywalled,
          success: false, errorCode: 'policy_denied', policyDenied: true,
        })
        return finish(assessed, 'Outbound URL policy denied the destination')
      }
      candidates.consider({
        html: '', text: '', ogMetadata, source: 'original', paywalled,
        success: false,
        errorCode: error instanceof SafeFetchError && error.code === 'timeout'
          ? 'timeout'
          : 'extract_failed',
      })
    }

    attempts.push('archive.ph')
    try {
      const archived = await fetchArchivePhSource(url, totalController.signal)
      if (archived) {
        const assessed = candidates.consider(
          buildArticleCandidate(archived.html, archived.finalUrl, archived.source),
        )
        if (assessed.assessment.accepted) return finish(assessed)
      }
    } catch {
      // Continue to the next exact-host source.
    }

    if (!totalController.signal.aborted) {
      attempts.push('wayback')
      try {
        const archived = await fetchWaybackSource(url, totalController.signal)
        if (archived) {
          const assessed = candidates.consider(
            buildArticleCandidate(archived.html, archived.finalUrl, archived.source),
          )
          if (assessed.assessment.accepted) return finish(assessed)
        }
      } catch {
        // No more network providers remain.
      }
    }

    // Metadata remains useful diagnostic context, but it is never enough to
    // invoke the claim model by itself.
    if (ogMetadata.title) {
      candidates.consider({
        html: '',
        text: [ogMetadata.title, ogMetadata.description].filter(Boolean).join('. '),
        ogMetadata,
        source: 'og-metadata-only',
        paywalled,
        success: true,
      })
    }

    const strongest = candidates.best()
    if (strongest) {
      return finish(strongest, 'No analysis-grade content source passed quality checks')
    }
    const assessed = candidates.consider({
      html: '', text: '', ogMetadata, source: 'failed', paywalled, success: false,
      errorCode: 'extract_failed',
    })
    return finish(assessed, 'All fetch methods failed')
  } finally {
    clearTimeout(totalTimeout)
    if (!totalController.signal.aborted) totalController.abort(new Error('extract-claims fetch chain completed'))
  }
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
): Promise<ClaimsAnalysis> {
  const truncated = text.substring(0, 14000)

  // Short structured documents are valid, but the model must never fill gaps.
  const isPartial = text.split(/\s+/).filter(Boolean).length < 150
  const contentQualifier = isPartial
    ? 'NOTE: The source is short. Return only claims explicitly supported by the supplied text; return fewer claims when evidence is limited. Do not infer claims from the headline or topic.\n\n'
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
Extract up to 15 objective, verifiable claims that could map to prediction market outcomes. Return fewer than 5 when the source supports fewer.

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
  try { return JSON.parse(rawContent) as ClaimsAnalysis } catch {
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

    let parsedUrl: URL
    try {
      parsedUrl = parseSafeOutboundUrl(url)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid or unsafe URL format' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    const normalizedUrl = parsedUrl.href
    const socialPlatform = isApifySupportedUrl(normalizedUrl)

    // Early detection: x.com/twitter.com and tiktok.com block server-side scraping
    // Use Apify if available, otherwise reject with helpful message
    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    if ((host === 'x.com' || host === 'twitter.com') && !context.env.APIFY_API_KEY) {
      return new Response(JSON.stringify({
        error: 'Twitter/X posts cannot be scraped',
        details: 'X.com blocks server-side requests. Configure APIFY_API_KEY to enable Twitter scraping, or paste the tweet text directly.',
        url: normalizedUrl,
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
        url: normalizedUrl,
        paywalled: false
      }), {
        status: 422,
        headers: JSON_HEADERS
      })
    }

    // 1. Try Apify for social media URLs first (richer content than standard fetch)
    let fetched: Awaited<ReturnType<typeof fetchWithFallback>>
    if (context.env.APIFY_API_KEY && socialPlatform) {
      const socialResult = await fetchSocialViaApify(normalizedUrl, context.env.APIFY_API_KEY)
      const socialQuality = socialResult?.success
        ? assessArticleCandidate({
            success: true,
            text: socialResult.text,
            title: socialResult.title,
            contentKind: 'social',
          }, ARTICLE_CANDIDATE_POLICIES.claims)
        : null
      if (socialResult?.success && socialQuality?.accepted) {
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
          fallback_attempts: ['apify'],
          quality: socialQuality,
        }
      } else {
        fetched = await fetchWithFallback(normalizedUrl)
        fetched.fallback_attempts.unshift('apify')
      }
    } else {
      fetched = await fetchWithFallback(normalizedUrl)
    }

    if (fetched.error || !fetched.quality.accepted) {
      console.error('[ExtractClaims] Fetch failed:', fetched.error)
      return new Response(JSON.stringify({
        error: 'Failed to fetch content from URL',
        details: fetched.error,
        content_source: fetched.source,
        fallback_attempts: fetched.fallback_attempts,
        extraction_quality: fetched.quality,
        og_metadata: fetched.ogMetadata,
        paywalled: fetched.paywalled
      }), {
        status: 422,
        headers: JSON_HEADERS
      })
    }

    // 2. The shared gate above guarantees analysis-grade evidence.
    const wordCount = fetched.text.split(/\s+/).filter(Boolean).length

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
      url: normalizedUrl,
      title,
      author: fetched.ogMetadata.author,
      publish_date: fetched.ogMetadata.publishDate,
      site_name: fetched.ogMetadata.siteName,
      content_source: fetched.source,
      fallback_attempts: fetched.fallback_attempts,
      extraction_quality: fetched.quality,
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
