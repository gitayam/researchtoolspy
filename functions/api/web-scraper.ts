// Cloudflare Pages Function for Web Scraping API
import { getRandomProfile } from '../utils/browser-profiles'
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, isPrivateUrl } from './_shared/api-utils'
import { SafeFetchError, safeFetchText } from './_shared/safe-fetch'
import { extractArticle } from './_shared/article-extractor'
import {
  normalizeWebScrapeError,
  observeWebScrapeRequest,
  scrapeContentTypeClass,
  scrapeHttpStatusClass,
} from './_shared/web-scraper-observability'
import type { AnalyticsEngineLike } from './_shared/scrape-metrics'
import {
  extractProduct,
  looksLikeShopify,
  matchOfferWithScore,
  shopifyProductJsUrl,
  type ProductExtraction,
  type ProductExtractionInput,
  type ProductOffer,
} from './_shared/product-extractor'
import {
  fromWooVariations,
  looksLikeMagento,
  looksLikeWooCommerce,
  magentoGraphqlUrl,
  wooProductId,
  wooStoreApiUrls,
} from './_shared/product-platforms'

interface ScrapingRequest {
  url: string
  extract_mode?: 'full' | 'metadata' | 'summary' | 'product'
  create_dataset?: boolean
  /** product mode only: page content the caller already fetched. Nothing is fetched when present. */
  content?: { html?: string; shopify_json?: Record<string, unknown> }
  /** product mode only: variant/offer description used to pick `matched_offer`. */
  match?: string
}

/** Same bound as a fetched response body, so supplied and fetched content are interchangeable. */
export const MAX_SUPPLIED_PRODUCT_BYTES = 2 * 1024 * 1024
export const MAX_PRODUCT_MATCH_LENGTH = 300

export interface SuppliedProductContent {
  html: string | null
  shopifyJson: Record<string, unknown> | null
  bytes: number
}

/**
 * Product mode identifies itself honestly instead of borrowing a browser's
 * identity: stores that block automated access get to see that they are
 * blocking it. The URL explains what the agent does and how to reach us.
 */
export const PRODUCT_BOT_USER_AGENT = 'ResearchTools/1.0 (+https://researchtools.net/bot)'
const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
const JSON_ACCEPT = 'application/json, text/javascript, */*;q=0.1'

export function productFetchHeaders(accept: string = HTML_ACCEPT): Record<string, string> {
  return { 'User-Agent': PRODUCT_BOT_USER_AGENT, Accept: accept }
}

export interface ProductScrapeResult {
  success: true
  url: string
  domain: string
  /** `rendered`: the static page had no offers and a headless render of it did (PRODUCT_BROWSER_FALLBACK). */
  content_source: 'fetched' | 'supplied' | 'rendered'
  product: ProductExtraction
  matched_offer?: (ProductOffer & { match_score: number; ambiguous_same_price: boolean }) | null
  extracted_at: string
}

/**
 * Validate caller-supplied product content: the normalized content, or an
 * error with its status (400 malformed, 413 over the 2 MiB fetch-equivalent bound).
 */
export function validateSuppliedProductContent(
  value: unknown,
): SuppliedProductContent | { error: string; status: 400 | 413 } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'content must be an object with html and/or shopify_json', status: 400 }
  }
  const { html, shopify_json: shopifyJson } = value as Record<string, unknown>
  if (html !== undefined && typeof html !== 'string') {
    return { error: 'content.html must be a string', status: 400 }
  }
  if (shopifyJson !== undefined
    && (typeof shopifyJson !== 'object' || shopifyJson === null || Array.isArray(shopifyJson))) {
    return { error: 'content.shopify_json must be an object', status: 400 }
  }
  const cleanHtml = typeof html === 'string' ? html.replace(/\0/g, '') : ''
  if (!cleanHtml.trim() && shopifyJson === undefined) {
    return { error: 'content must include non-empty html or shopify_json', status: 400 }
  }
  const encoder = new TextEncoder()
  const bytes = encoder.encode(cleanHtml).byteLength
    + (shopifyJson === undefined ? 0 : encoder.encode(JSON.stringify(shopifyJson)).byteLength)
  if (bytes > MAX_SUPPLIED_PRODUCT_BYTES) {
    return { error: 'Supplied content exceeds the 2 MiB limit', status: 413 }
  }
  return {
    html: cleanHtml.trim() ? cleanHtml : null,
    shopifyJson: (shopifyJson as Record<string, unknown> | undefined) ?? null,
    bytes,
  }
}

export function buildProductScrapeResult(
  finalUrl: string,
  product: ProductExtraction,
  contentSource: ProductScrapeResult['content_source'],
  match?: string,
  extractedAt = new Date().toISOString(),
): ProductScrapeResult {
  const provenance = buildScrapingProvenance(finalUrl, extractedAt)
  const result: ProductScrapeResult = {
    success: true,
    url: provenance.url,
    domain: provenance.domain!,
    content_source: contentSource,
    product,
    extracted_at: provenance.extracted_at,
  }
  if (match !== undefined) {
    const matched = matchOfferWithScore(product.offers, match, { productName: product.name })
    result.matched_offer = matched
      ? { ...matched.offer, match_score: matched.score, ambiguous_same_price: matched.ambiguous_same_price }
      : null
  }
  return result
}

interface ScrapingResult {
  url: string
  title?: string
  description?: string
  author?: string
  published_date?: string
  domain?: string
  content?: {
    text: string
    summary?: string
    word_count: number
  }
  metadata?: {
    keywords?: string[]
    og_title?: string
    og_description?: string
    og_image?: string
    [key: string]: unknown
  }
  metadata_completeness_score?: number
  dataset_id?: string | number
  extracted_at: string
}

/** The `researchtools-browser-renderer` service binding (workers/browser-renderer). */
export interface BrowserRendererBinding {
  fetch(input: string, init?: RequestInit): Promise<Response>
}

type WebScraperEnv = Parameters<typeof getUserFromRequest>[1] & {
  SCRAPE_ANALYTICS?: AnalyticsEngineLike
  SCRAPE_TELEMETRY_KEY?: string
  BROWSER_RENDERER?: BrowserRendererBinding
  /** "1" lets product mode render a 2xx page that yielded no offers. Off by default: it costs browser time. */
  PRODUCT_BROWSER_FALLBACK?: string
}

interface WebScraperContext {
  request: Request
  env: WebScraperEnv
}

const DATASET_CONTEXT_HEADERS = ['Authorization', 'X-User-Hash', 'X-Guest-Session', 'X-Workspace-ID'] as const

export function buildScrapingProvenance(
  finalUrl: string,
  extractedAt = new Date().toISOString(),
): Pick<ScrapingResult, 'url' | 'domain' | 'extracted_at'> {
  const validatedUrl = new URL(finalUrl)
  return {
    url: validatedUrl.href,
    domain: validatedUrl.hostname,
    extracted_at: extractedAt,
  }
}

export function buildScrapeDatasetData(
  result: ScrapingResult,
  finalUrl: string,
  metadata: NonNullable<ScrapingResult['metadata']>,
  accessDate = new Date().toISOString().split('T')[0],
): Record<string, unknown> {
  const validatedUrl = new URL(finalUrl)
  const datasetMetadata = {
    ...metadata,
    metadata_completeness_score: result.metadata_completeness_score ?? 0,
  }

  return {
    title: result.title || validatedUrl.hostname,
    description: result.description || `Content from ${validatedUrl.hostname}`,
    source: validatedUrl.href,
    type: 'web_article',
    source_name: validatedUrl.hostname,
    source_url: validatedUrl.href,
    author: result.author,
    tags: metadata.keywords || [],
    metadata: JSON.stringify(datasetMetadata),
    access_date: accessDate,
  }
}

/**
 * Measure only whether the metadata fields this extractor understands are
 * present. This is extraction coverage, not a claim about source credibility.
 */
export function calculateMetadataCompletenessScore(
  result: Pick<ScrapingResult, 'title' | 'description' | 'author'>,
  metadata: NonNullable<ScrapingResult['metadata']>,
): number {
  const present = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0
  let score = 0

  if (present(result.title)) score += 20
  if (present(result.description)) score += 20
  if (present(result.author)) score += 15
  if (Array.isArray(metadata.keywords) && metadata.keywords.some(present)) score += 10
  if (present(metadata.og_title)) score += 10
  if (present(metadata.og_description)) score += 10
  if (present(metadata.og_image)) score += 10
  if (present(metadata.og_type)) score += 5

  return score
}

/**
 * Create a dataset through the authenticated API on the scraper request's own
 * origin. Only the narrow authentication/workspace context understood by our
 * APIs is forwarded; scraped destinations can never receive these headers.
 */
export async function createDatasetForScrape(
  request: Request,
  datasetData: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<string | number | null> {
  const requestUrl = new URL(request.url)
  const datasetUrl = new URL('/api/datasets', requestUrl.origin)
  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const name of DATASET_CONTEXT_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const response = await fetchImpl(datasetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(datasetData),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) return null

  const payload = await response.json() as { id?: unknown }
  return typeof payload.id === 'string' || typeof payload.id === 'number'
    ? payload.id
    : null
}

export function safeFetchFailureResponse(error: SafeFetchError): Response {
  switch (error.code) {
    case 'timeout':
      return new Response(JSON.stringify({
        success: false,
        error: 'The website took too long to respond',
        errorType: 'timeout',
        suggestions: [
          'Try again - the site might be temporarily slow',
          'Check if the URL is accessible in your browser',
          'The website might have anti-bot protection',
        ],
        technicalDetails: 'Request timeout after 15 seconds',
      }), { status: 504, headers: JSON_HEADERS })

    case 'aborted':
      return new Response(JSON.stringify({
        success: false,
        error: 'The scraping request was cancelled',
        errorType: 'cancelled',
        suggestions: ['Retry the request when ready'],
      }), { status: 408, headers: JSON_HEADERS })

    case 'invalid_url':
    case 'unsafe_url':
    case 'dns_resolution_failed':
      return new Response(JSON.stringify({
        success: false,
        error: 'URLs pointing to private/internal or unresolvable addresses are not allowed',
        errorType: 'invalid_url',
        suggestions: ['Check that the URL is a public HTTP or HTTPS website'],
      }), { status: 400, headers: JSON_HEADERS })

    case 'redirect_limit':
    case 'response_too_large':
    case 'unsupported_content_type':
      return new Response(JSON.stringify({
        success: false,
        error: 'The website response could not be safely processed',
        errorType: 'http_error',
        suggestions: ['Try a direct HTML page with fewer redirects'],
      }), { status: 400, headers: JSON_HEADERS })

    case 'network_error':
      return new Response(JSON.stringify({
        success: false,
        error: 'Unable to connect to the website',
        errorType: 'network',
        suggestions: ['Check if the URL is correct and accessible', 'Try again later'],
      }), { status: 502, headers: JSON_HEADERS })

    case 'unsafe_method':
    case 'unsafe_headers':
    case 'invalid_options':
      return new Response(JSON.stringify({
        success: false,
        error: 'The scraper request policy is misconfigured',
        errorType: 'configuration',
        suggestions: ['Contact support if this problem continues'],
      }), { status: 500, headers: JSON_HEADERS })

    default: {
      const exhaustive: never = error.code
      throw new Error(`Unhandled safe-fetch error code: ${exhaustive}`)
    }
  }
}

type RecordWebScrapeAttempt = Parameters<Parameters<typeof observeWebScrapeRequest>[1]>[0]

function productExecution(result: ProductScrapeResult) {
  return {
    response: new Response(JSON.stringify(result), { status: 200, headers: JSON_HEADERS }),
    qualityScore: result.product.confidence,
    // An empty extraction is still a 200 with offers: [] so callers can tell
    // "no structured price on this page" from a fetch failure.
    accepted: result.product.offers.length > 0,
  }
}

/**
 * GET a JSON document from the storefront that served the page. Same hostname
 * only, 10 s, 2 MiB, at most 3 redirects, honest identity. Best effort: any
 * failure is recorded and returns null, leaving extraction to the HTML.
 */
export async function fetchSameHostJson(
  jsonUrl: string,
  pageUrl: URL,
  recordAttempt: RecordWebScrapeAttempt,
  fetchText: typeof safeFetchText = safeFetchText,
): Promise<unknown> {
  const startedAt = Date.now()
  try {
    if (new URL(jsonUrl).hostname !== pageUrl.hostname) return null
    const fetched = await fetchText(jsonUrl, {
      timeoutMs: 10_000,
      maxRedirects: 3,
      maxResponseBytes: 2 * 1024 * 1024,
      // Product JSON is only trusted from the storefront that served the page.
      allowedHostnames: [pageUrl.hostname],
      requestInit: { method: 'GET', headers: productFetchHeaders(JSON_ACCEPT) },
    })
    const ok = fetched.response.ok
    let parsed: unknown = null
    if (ok) {
      try {
        parsed = JSON.parse(fetched.text)
      } catch {
        parsed = null
      }
    }
    const usable = typeof parsed === 'object' && parsed !== null
    recordAttempt({
      stage: 'fetch',
      strategy: 'direct',
      provider: 'none',
      outcome: usable ? 'succeeded' : 'failed',
      ...(usable ? {} : {
        errorCode: !ok
          ? (fetched.response.status === 429 ? 'rate_limited' : fetched.response.status >= 500 ? 'upstream_5xx' : 'upstream_4xx')
          : 'extract_failed',
      }),
      httpStatusClass: scrapeHttpStatusClass(fetched.response.status),
      contentTypeClass: scrapeContentTypeClass(fetched.contentType),
      durationMs: Date.now() - startedAt,
      responseBytes: fetched.bytesRead,
    })
    return usable ? parsed : null
  } catch (error) {
    recordAttempt({
      stage: 'fetch',
      strategy: 'direct',
      provider: 'none',
      outcome: 'failed',
      errorCode: normalizeWebScrapeError(error),
      durationMs: Date.now() - startedAt,
    })
    return null
  }
}

/**
 * Shopify publishes per-variant titles, prices (cents) and availability at
 * `<product-url>.js`. Best effort: any failure leaves extraction to the HTML.
 */
export async function fetchShopifyProductJson(
  html: string,
  pageUrl: URL,
  recordAttempt: RecordWebScrapeAttempt,
  fetchText: typeof safeFetchText = safeFetchText,
): Promise<Record<string, unknown> | null> {
  const jsUrl = looksLikeShopify(html) ? shopifyProductJsUrl(pageUrl.href) : null
  if (!jsUrl) return null
  const parsed = await fetchSameHostJson(jsUrl, pageUrl, recordAttempt, fetchText)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
}

/**
 * WooCommerce Store API (public, read-only): the product, and for a variable
 * product its variations in one listing call. Prices are minor units. Fetched
 * only when the page itself did not already give per-variant prices and stock.
 */
export async function fetchWooStoreApi(
  html: string,
  pageUrl: URL,
  staticProduct: ProductExtraction,
  recordAttempt: RecordWebScrapeAttempt,
  fetchText: typeof safeFetchText = safeFetchText,
): Promise<NonNullable<ProductExtractionInput['wooStoreApi']> | null> {
  if (!looksLikeWooCommerce(html)) return null
  const deferred = fromWooVariations(html, pageUrl.href).deferred
  const complete = staticProduct.offers.length > 0 && staticProduct.offers.every(o => o.availability !== 'unknown')
  if (complete && !deferred) return null
  const id = wooProductId(html)
  const urls = id ? wooStoreApiUrls(pageUrl.href, id) : null
  if (!urls) return null
  const product = await fetchSameHostJson(urls.product, pageUrl, recordAttempt, fetchText)
  if (typeof product !== 'object' || product === null || Array.isArray(product)) return null
  const record = product as Record<string, unknown>
  const variations = record.type === 'variable' && Array.isArray(record.variations) && record.variations.length > 0
    ? await fetchSameHostJson(urls.variations, pageUrl, recordAttempt, fetchText)
    : null
  return { product, variations: Array.isArray(variations) ? variations : null }
}

/**
 * Magento 2 GraphQL GET (cacheable, read-only) by url_key: child SKUs, prices
 * and stock for a configurable product. Many stores disable it; best effort.
 */
export async function fetchMagentoGraphql(
  html: string,
  pageUrl: URL,
  staticProduct: ProductExtraction,
  recordAttempt: RecordWebScrapeAttempt,
  fetchText: typeof safeFetchText = safeFetchText,
): Promise<unknown> {
  if (!looksLikeMagento(html)) return null
  const complete = staticProduct.offers.length > 0
    && staticProduct.offers.every(o => o.sku && o.availability !== 'unknown')
    && !staticProduct.sources.includes('magento-spconfig')
  if (complete) return null
  const url = magentoGraphqlUrl(pageUrl.href)
  if (!url) return null
  const parsed = await fetchSameHostJson(url, pageUrl, recordAttempt, fetchText)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null
}

/** A bot-management interstitial, which a headless render would only hit again. */
export function looksLikeChallengePage(html: string): boolean {
  const head = html.slice(0, 50_000)
  return /<title>\s*(?:Just a moment|Attention Required|Access denied|Please Wait)/i.test(head)
    || /cf-chl-|challenge-platform|_Incapsula_Resource|px-captcha|datadome/i.test(head)
}

/**
 * Render the page with the browser-renderer Worker (Cloudflare Browser Run,
 * `content` quick action) and return its HTML. Never used on a challenge page:
 * Browser Run identifies itself and does not get past bot protection.
 */
export async function renderProductHtml(
  renderer: BrowserRendererBinding,
  pageUrl: URL,
  recordAttempt: RecordWebScrapeAttempt,
): Promise<string | null> {
  const startedAt = Date.now()
  try {
    const response = await renderer.fetch('https://browser-renderer.internal/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl.href, mode: 'html' }),
      signal: AbortSignal.timeout(45_000),
    })
    const payload = response.ok ? await response.json().catch(() => null) as { html?: unknown } | null : null
    const html = typeof payload?.html === 'string' ? payload.html.slice(0, 2 * 1024 * 1024) : null
    recordAttempt({
      stage: 'render',
      strategy: 'browser-renderer',
      provider: 'browser-renderer',
      outcome: html ? 'succeeded' : 'failed',
      ...(html ? {} : { errorCode: 'render_failed' as const }),
      httpStatusClass: scrapeHttpStatusClass(response.status),
      contentTypeClass: html ? 'html' : 'unknown',
      durationMs: Date.now() - startedAt,
      ...(html ? { responseBytes: new TextEncoder().encode(html).byteLength } : {}),
    })
    return html
  } catch {
    recordAttempt({
      stage: 'render',
      strategy: 'browser-renderer',
      provider: 'browser-renderer',
      outcome: 'failed',
      errorCode: 'render_failed',
      durationMs: Date.now() - startedAt,
    })
    return null
  }
}

export async function onRequest(context: WebScraperContext) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })
  }

  // Require authentication
  const authUserId = await getUserFromRequest(request, env)
  if (!authUserId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  try {
    const body: ScrapingRequest = await request.json()

    if (!body.url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    const rawExtractMode: unknown = body.extract_mode
    if (rawExtractMode !== undefined
      && rawExtractMode !== 'metadata'
      && rawExtractMode !== 'summary'
      && rawExtractMode !== 'full'
      && rawExtractMode !== 'product') {
      return new Response(JSON.stringify({ error: 'Invalid extract_mode' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (body.create_dataset !== undefined && typeof body.create_dataset !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid create_dataset' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    const extractMode = (rawExtractMode ?? 'metadata') as NonNullable<ScrapingRequest['extract_mode']>

    if (extractMode !== 'product' && (body.content !== undefined || body.match !== undefined)) {
      return new Response(JSON.stringify({ error: 'content and match are only supported with extract_mode "product"' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    if (body.match !== undefined
      && (typeof body.match !== 'string' || !body.match.trim() || body.match.length > MAX_PRODUCT_MATCH_LENGTH)) {
      return new Response(JSON.stringify({ error: `match must be a non-empty string of at most ${MAX_PRODUCT_MATCH_LENGTH} characters` }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }
    let supplied: SuppliedProductContent | null = null
    if (body.content !== undefined) {
      const validated = validateSuppliedProductContent(body.content)
      if ('error' in validated) {
        return new Response(JSON.stringify({ error: validated.error }), {
          status: validated.status,
          headers: JSON_HEADERS,
        })
      }
      supplied = validated
    }

    // Validate URL
    let url: URL
    try {
      url = new URL(body.url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // Supplied content is attributed to `url` without our own fetch to vouch
    // for it, so require the stronger form: public HTTPS.
    if (supplied && url.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Supplied content requires an https URL' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // SSRF protection — block private/internal addresses
    if (isPrivateUrl(body.url)) {
      return new Response(JSON.stringify({ error: 'URLs pointing to private/internal addresses are not allowed' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    const telemetryRequestId = crypto.randomUUID()
    return observeWebScrapeRequest({
      requestId: telemetryRequestId,
      url: url.href,
      tenantScope: String(authUserId),
      extractMode,
      strategy: supplied ? 'supplied' : 'direct',
      telemetryKey: env.SCRAPE_TELEMETRY_KEY,
      analytics: env.SCRAPE_ANALYTICS,
    }, async recordAttempt => {
      if (supplied) {
        const extractionStartedAt = Date.now()
        const product = extractProduct({ html: supplied.html, shopifyJson: supplied.shopifyJson, url: url.href })
        recordAttempt({
          stage: 'extract',
          strategy: 'supplied',
          provider: 'none',
          outcome: product.offers.length > 0 ? 'succeeded' : 'failed',
          ...(product.offers.length > 0 ? {} : { errorCode: 'extract_failed' as const }),
          contentTypeClass: supplied.html ? 'html' : 'json',
          durationMs: Date.now() - extractionStartedAt,
          responseBytes: supplied.bytes,
          itemsRead: product.offers.length,
        })
        return productExecution(buildProductScrapeResult(url.href, product, 'supplied', body.match))
      }

      // Fetch through the shared outbound policy. It validates DNS and every
      // redirect hop, enforces the deadline, and bounds text response bodies.
      const fetchStartedAt = Date.now()
      let response: Response
      let html: string
      let finalUrl: URL
      try {
        const fetched = await safeFetchText(url, {
          timeoutMs: 15_000,
          maxRedirects: 5,
          maxResponseBytes: 2 * 1024 * 1024,
          // Product mode: honest identity. Other modes keep the browser profile for now.
          requestInit: { headers: extractMode === 'product' ? productFetchHeaders() : getRandomProfile().headers },
        })
        response = fetched.response
        html = fetched.text
        finalUrl = new URL(fetched.finalUrl)
        recordAttempt({
          stage: 'fetch',
          strategy: 'direct',
          provider: 'none',
          outcome: response.ok ? 'succeeded' : 'failed',
          ...(response.ok ? {} : {
            errorCode: response.status >= 500 ? 'upstream_5xx' : 'upstream_4xx',
          }),
          httpStatusClass: scrapeHttpStatusClass(response.status),
          contentTypeClass: scrapeContentTypeClass(fetched.contentType),
          durationMs: Date.now() - fetchStartedAt,
          responseBytes: fetched.bytesRead,
        })
      } catch (fetchError: unknown) {
        recordAttempt({
          stage: 'fetch',
          strategy: 'direct',
          provider: 'none',
          outcome: 'failed',
          errorCode: normalizeWebScrapeError(fetchError),
          durationMs: Date.now() - fetchStartedAt,
        })
        if (fetchError instanceof SafeFetchError) {
          return { response: safeFetchFailureResponse(fetchError), accepted: false }
        }
        throw fetchError
      }

      if (!response.ok) {
        let userMessage = 'Failed to access the website'
        let suggestions: string[]

        if (response.status === 403 || response.status === 401) {
          userMessage = 'The website is blocking automated access'
          suggestions = [
            'This website has anti-bot protection',
            'Try accessing the URL directly in your browser',
            'The content may require authentication',
            'Consider manually copying the content instead'
          ]
        } else if (response.status === 404) {
          userMessage = 'The page was not found'
          suggestions = [
            'Check if the URL is correct',
            'The page might have been moved or deleted',
            'Try searching for the content on the website'
          ]
        } else if (response.status >= 500) {
          userMessage = 'The website server is having issues'
          suggestions = [
            'Try again later - the server might be temporarily down',
            'Check if the website is accessible in your browser',
            'The website might be experiencing technical difficulties'
          ]
        } else {
          suggestions = [
            'Try again later',
            'Check if the URL is correct and accessible',
            'The website might be experiencing issues'
          ]
        }

        if (extractMode === 'product' && (response.status === 429 || response.status === 403)) {
          if (response.status === 429) userMessage = 'The website is rate limiting automated access'
          suggestions = [
            ...(response.status === 429 ? ['Try again later'] : []),
            'Fetch the page from your own network and send it as content.html (and content.shopify_json for Shopify stores)',
          ]
        }

        return { response: new Response(JSON.stringify({
          success: false,
          error: userMessage,
          errorType: 'http_error',
          suggestions,
          technicalDetails: `HTTP ${response.status} ${response.statusText}`
        }), {
          status: 400,
          headers: JSON_HEADERS,
        }), accepted: false }
      }

      if (extractMode === 'product') {
        const shopifyJson = await fetchShopifyProductJson(html, finalUrl, recordAttempt)
        const extractionStartedAt = Date.now()
        let product = extractProduct({ html, shopifyJson, url: finalUrl.href })
        // Second same-host GETs, only where the page left variants or stock out.
        const wooStoreApi = await fetchWooStoreApi(html, finalUrl, product, recordAttempt)
        const magentoGraphql = await fetchMagentoGraphql(html, finalUrl, product, recordAttempt)
        if (wooStoreApi || magentoGraphql) {
          product = extractProduct({ html, shopifyJson, wooStoreApi, magentoGraphql, url: finalUrl.href })
        }
        recordAttempt({
          stage: 'extract',
          strategy: 'direct',
          provider: 'none',
          outcome: product.offers.length > 0 ? 'succeeded' : 'failed',
          ...(product.offers.length > 0 ? {} : { errorCode: 'extract_failed' as const }),
          contentTypeClass: 'html',
          durationMs: Date.now() - extractionStartedAt,
          itemsRead: product.offers.length,
        })
        let contentSource: ProductScrapeResult['content_source'] = 'fetched'
        if (product.offers.length === 0 && env.PRODUCT_BROWSER_FALLBACK === '1' && env.BROWSER_RENDERER
          && !looksLikeChallengePage(html)) {
          const rendered = await renderProductHtml(env.BROWSER_RENDERER, finalUrl, recordAttempt)
          if (rendered) {
            const renderedStartedAt = Date.now()
            const renderedProduct = extractProduct({ html: rendered, url: finalUrl.href })
            recordAttempt({
              stage: 'extract',
              strategy: 'browser-renderer',
              provider: 'browser-renderer',
              outcome: renderedProduct.offers.length > 0 ? 'succeeded' : 'failed',
              ...(renderedProduct.offers.length > 0 ? {} : { errorCode: 'extract_failed' as const }),
              contentTypeClass: 'html',
              durationMs: Date.now() - renderedStartedAt,
              itemsRead: renderedProduct.offers.length,
            })
            if (renderedProduct.offers.length > 0) {
              product = renderedProduct
              contentSource = 'rendered'
            }
          }
        }
        return productExecution(buildProductScrapeResult(finalUrl.href, product, contentSource, body.match))
      }

      const extractionStartedAt = Date.now()
      try {
        const article = extractArticle(html, finalUrl.href)
        const result: ScrapingResult = {
          ...buildScrapingProvenance(finalUrl.href),
          title: article.title,
          description: article.excerpt,
          author: article.author,
          published_date: article.publishedTime,
        }
        const metadata: NonNullable<ScrapingResult['metadata']> = {
          ...(article.keywords.length > 0 ? { keywords: article.keywords } : {}),
          ...(article.ogTitle ? { og_title: article.ogTitle } : {}),
          ...(article.ogDescription ? { og_description: article.ogDescription } : {}),
          ...(article.image ? { og_image: article.image } : {}),
          ...(article.ogType ? { og_type: article.ogType } : {}),
          extractor_version: article.extractorVersion,
          extraction_method: article.method,
          extraction_quality: article.qualitySignals,
        }
        result.metadata = metadata

        // Extract content if requested
        if (extractMode === 'full' || extractMode === 'summary') {
          let textContent = article.text
          const maxLength = 10000
          if (textContent.length > maxLength) {
            textContent = textContent.substring(0, maxLength) + '...'
          }

          result.content = {
            text: textContent,
            word_count: textContent ? textContent.split(/\s+/).length : 0,
          }

          // Simple summary (first 500 characters)
          if (extractMode === 'summary' && textContent.length > 500) {
            result.content.summary = textContent.substring(0, 500) + '...'
          }
        }

        result.metadata_completeness_score = calculateMetadataCompletenessScore(result, metadata)
        recordAttempt({
          stage: 'extract',
          strategy: 'direct',
          provider: 'none',
          outcome: 'succeeded',
          contentTypeClass: 'text',
          durationMs: Date.now() - extractionStartedAt,
          extractedWords: article.wordCount,
        })

        // Optionally create dataset
        if (body.create_dataset) {
          try {
            const datasetData = buildScrapeDatasetData(result, finalUrl.href, metadata)

            const datasetId = await createDatasetForScrape(request, datasetData)
            if (datasetId !== null) result.dataset_id = datasetId
          } catch (error) {
            console.error('Failed to create dataset:', error)
            // Don't fail the whole request if dataset creation fails
          }
        }

        return {
          response: new Response(JSON.stringify({
            success: true,
            data: result
          }), {
            status: 200,
            headers: JSON_HEADERS,
          }),
          qualityScore: result.metadata_completeness_score / 100,
          accepted: true,
        }
      } catch (extractionError) {
        recordAttempt({
          stage: 'extract',
          strategy: 'direct',
          provider: 'none',
          outcome: 'failed',
          errorCode: 'extract_failed',
          durationMs: Date.now() - extractionStartedAt,
        })
        throw extractionError
      }
    })
  } catch (error: unknown) {
    console.error('Web scraping error:', error)
    const errorName = error instanceof Error ? error.name : ''
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Create user-friendly error message
    let userMessage: string
    let suggestions: string[]
    let errorType: string

    // Network/timeout errors
    if (errorName === 'AbortError' || errorMessage.includes('timeout')) {
      errorType = 'timeout'
      userMessage = 'The website took too long to respond'
      suggestions = [
        'Try again - the site might be temporarily slow',
        'Check if the URL is correct',
        'The website might be blocking automated requests'
      ]
    }
    // Fetch/network errors
    else if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      errorType = 'network'
      userMessage = 'Unable to connect to the website'
      suggestions = [
        'Check your internet connection',
        'Verify the URL is correct and accessible',
        'The website might be down or blocking requests'
      ]
    }
    // Blocked/forbidden
    else if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('blocked')) {
      errorType = 'blocked'
      userMessage = 'The website is blocking automated access'
      suggestions = [
        'Some websites block scraping tools for security',
        'Try accessing the URL directly in your browser first',
        'Consider manually copying the content instead',
        'The site may require authentication or have anti-bot protection'
      ]
    }
    // Invalid URL
    else if (errorMessage.includes('Invalid URL') || errorMessage.includes('protocol')) {
      errorType = 'invalid_url'
      userMessage = 'The URL format is invalid'
      suggestions = [
        'Make sure the URL starts with http:// or https://',
        'Check for typos in the URL',
        'Ensure the URL is complete and properly formatted'
      ]
    }
    // Generic parsing/extraction error
    else {
      errorType = 'parsing'
      userMessage = 'Failed to extract content from the website'
      suggestions = [
        'The page structure might be unusual or dynamic',
        'Try a different page or source',
        'Some content requires JavaScript which we cannot execute'
      ]
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      errorType,
      suggestions
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
