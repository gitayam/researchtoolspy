import {
  SCRAPE_SCHEMA_VERSION,
  boundScrapeAttempts,
  type NormalizedScrapeError,
  type ScrapeAttemptV1,
  type ScrapeContentTypeClass,
  type ScrapeHttpStatusClass,
} from './scrape-contract'
import {
  buildOpaqueScrapeIdentifiers,
  createAnalyticsEngineScrapeMetricSink,
  observeScrape,
  type AnalyticsEngineLike,
} from './scrape-metrics'

export type WebScrapeAttemptObservation = Omit<
  ScrapeAttemptV1,
  'schemaVersion' | 'requestId' | 'ordinal'
>

export interface WebScrapeExecution {
  response: Response
  qualityScore?: number
  accepted?: boolean
}

interface ObserveWebScrapeOptions {
  requestId: string
  url: string
  tenantScope: string
  extractMode: 'metadata' | 'summary' | 'full'
  telemetryKey?: string
  analytics?: AnalyticsEngineLike
}

export function scrapeHttpStatusClass(status: number): ScrapeHttpStatusClass {
  if (status >= 200 && status < 300) return '2xx'
  if (status >= 300 && status < 400) return '3xx'
  if (status >= 400 && status < 500) return '4xx'
  if (status >= 500 && status < 600) return '5xx'
  return 'none'
}

export function scrapeContentTypeClass(contentType: string): ScrapeContentTypeClass {
  const normalized = contentType.toLowerCase()
  if (normalized.includes('html') || normalized.includes('xhtml')) return 'html'
  if (normalized.startsWith('text/')) return 'text'
  if (normalized.includes('json')) return 'json'
  if (normalized.includes('pdf')) return 'pdf'
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('audio/') || normalized.startsWith('video/')) return 'media'
  return normalized ? 'other' : 'unknown'
}

export function normalizeWebScrapeError(error: unknown): NormalizedScrapeError {
  const code = error && typeof error === 'object'
    ? (error as { code?: unknown }).code
    : undefined
  switch (code) {
    case 'invalid_url':
    case 'unsafe_url':
      return 'policy_denied'
    case 'dns_resolution_failed':
      return 'dns_denied'
    case 'timeout':
    case 'redirect_limit':
    case 'response_too_large':
    case 'unsupported_content_type':
      return code
    case 'aborted':
      return 'timeout'
    case 'network_error':
      return 'upstream_5xx'
    default:
      return 'internal_error'
  }
}

function responseError(
  response: Response,
  attempt?: ScrapeAttemptV1,
): NormalizedScrapeError | 'none' {
  if (attempt?.errorCode) return attempt.errorCode
  if (response.status === 429) return 'rate_limited'
  if (response.status >= 500) return 'internal_error'
  if (response.status >= 400) return 'invalid_request'
  return 'none'
}

/**
 * Observe one authenticated, lexically validated web-scraper request. Invalid
 * input is outside the denominator. Telemetry failures never affect the route.
 */
export async function observeWebScrapeRequest(
  options: ObserveWebScrapeOptions,
  execute: (recordAttempt: (attempt: WebScrapeAttemptObservation) => void) => Promise<WebScrapeExecution>,
): Promise<Response> {
  let identifiers: Awaited<ReturnType<typeof buildOpaqueScrapeIdentifiers>> = null
  try {
    identifiers = await buildOpaqueScrapeIdentifiers(options.telemetryKey, {
      requestId: options.requestId,
      tenantScope: options.tenantScope,
      url: options.url,
    })
  } catch {
    // Telemetry must not affect scraping behavior.
  }

  if (!identifiers || !options.analytics) return (await execute(() => {})).response

  const request = {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    requestId: options.requestId,
    route: 'web-scraper' as const,
    purpose: options.extractMode === 'metadata' ? 'metadata' as const : 'structured-extraction' as const,
    target: { url: options.url },
    requestedStrategy: 'direct' as const,
    limits: { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024, maxAttempts: 2 },
  }
  const attempts: ScrapeAttemptV1[] = []
  let execution: WebScrapeExecution | undefined

  await observeScrape({
    request,
    identifiers,
    sink: createAnalyticsEngineScrapeMetricSink(options.analytics, identifiers),
  }, async observer => {
    execution = await execute((observation) => {
      const attempt: ScrapeAttemptV1 = {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        requestId: options.requestId,
        ordinal: attempts.length + 1,
        ...observation,
      }
      if (observer.attempt(attempt)) attempts.push(attempt)
    })

    const errorCode = responseError(execution.response, attempts.at(-1))
    if (errorCode !== 'none') {
      return {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        ok: false,
        requestId: options.requestId,
        error: {
          code: errorCode,
          retryable: errorCode === 'timeout' || errorCode === 'rate_limited' || errorCode === 'upstream_5xx',
          stage: attempts.at(-1)?.stage ?? 'fetch',
        },
        attempts: boundScrapeAttempts(attempts),
      }
    }

    return {
      schemaVersion: SCRAPE_SCHEMA_VERSION,
      ok: true,
      requestId: options.requestId,
      content: { text: '' },
      provenance: {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        sourceMode: 'live' as const,
        fetchStrategy: 'direct' as const,
        extractorVersion: 'web-scraper-regex-v1',
        quality: {
          version: 'web-scraper-metadata-completeness-v1',
          score: Math.max(0, Math.min(1, execution.qualityScore ?? 0)),
          accepted: execution.accepted ?? true,
        },
        // The internal observation result carries no content payload; this is
        // SHA-256 of the empty string and is not written to Analytics Engine.
        contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        attempts: boundScrapeAttempts(attempts),
      },
    }
  })

  if (!execution) throw new Error('Web scraper did not return a response')
  return execution.response
}
