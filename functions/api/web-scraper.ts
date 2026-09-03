// Cloudflare Pages Function for Web Scraping API
import { getRandomProfile } from '../utils/browser-profiles'
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, isPrivateUrl } from './_shared/api-utils'
import { SafeFetchError, safeFetchText } from './_shared/safe-fetch'

interface ScrapingRequest {
  url: string
  extract_mode?: 'full' | 'metadata' | 'summary'
  create_dataset?: boolean
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

interface WebScraperContext {
  request: Request
  env: Parameters<typeof getUserFromRequest>[1]
}

const DATASET_CONTEXT_HEADERS = ['Authorization', 'X-User-Hash', 'X-Workspace-ID'] as const

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

    // SSRF protection — block private/internal addresses
    if (isPrivateUrl(body.url)) {
      return new Response(JSON.stringify({ error: 'URLs pointing to private/internal addresses are not allowed' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // Fetch through the shared outbound policy. It validates DNS and every
    // redirect hop, enforces the deadline, and bounds text response bodies.
    let response: Response
    let html: string
    let finalUrl: URL
    try {
      const fetched = await safeFetchText(url, {
        timeoutMs: 15_000,
        maxRedirects: 5,
        maxResponseBytes: 2 * 1024 * 1024,
        requestInit: { headers: getRandomProfile().headers },
      })
      response = fetched.response
      html = fetched.text
      finalUrl = new URL(fetched.finalUrl)
    } catch (fetchError: unknown) {
      if (fetchError instanceof SafeFetchError) return safeFetchFailureResponse(fetchError)
      throw fetchError
    }

    if (!response.ok) {
      let userMessage = 'Failed to access the website'
      let suggestions: string[] = []

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

      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        errorType: 'http_error',
        suggestions,
        technicalDetails: `HTTP ${response.status} ${response.statusText}`
      }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // Extract metadata using regex (lightweight parsing)
    const result: ScrapingResult = {
      ...buildScrapingProvenance(finalUrl.href),
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      result.title = titleMatch[1].trim()
    }

    // Extract meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
    if (descMatch) {
      result.description = descMatch[1].trim()
    }

    // Extract author
    const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["'](.*?)["']/i)
    if (authorMatch) {
      result.author = authorMatch[1].trim()
    }

    // Extract keywords
    const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["'](.*?)["']/i)
    const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : []

    // Extract Open Graph metadata
    const metadata: NonNullable<ScrapingResult['metadata']> = {}

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)
    if (ogTitleMatch) metadata.og_title = ogTitleMatch[1].trim()

    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i)
    if (ogDescMatch) metadata.og_description = ogDescMatch[1].trim()

    const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)
    if (ogImageMatch) metadata.og_image = ogImageMatch[1].trim()

    const ogTypeMatch = html.match(/<meta\s+property=["']og:type["']\s+content=["'](.*?)["']/i)
    if (ogTypeMatch) metadata.og_type = ogTypeMatch[1].trim()

    if (keywords.length > 0) metadata.keywords = keywords

    result.metadata = metadata

    // Extract content if requested
    if (body.extract_mode === 'full' || body.extract_mode === 'summary') {
      // Remove scripts, styles, and other non-content tags
      let textContent = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()

      // Limit content size
      const maxLength = 10000
      if (textContent.length > maxLength) {
        textContent = textContent.substring(0, maxLength) + '...'
      }

      const wordCount = textContent.split(/\s+/).length

      result.content = {
        text: textContent,
        word_count: wordCount,
      }

      // Simple summary (first 500 characters)
      if (body.extract_mode === 'summary' && textContent.length > 500) {
        result.content.summary = textContent.substring(0, 500) + '...'
      }
    }

    result.metadata_completeness_score = calculateMetadataCompletenessScore(result, metadata)

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

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: JSON_HEADERS,
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
