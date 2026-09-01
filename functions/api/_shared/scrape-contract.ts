export const SCRAPE_SCHEMA_VERSION = 'scrape.v1' as const
export const MAX_SCRAPE_ATTEMPT_SUMMARY = 8
declare const scrapeAttemptSummaryBrand: unique symbol

export type ScrapeRoute =
  | 'web-scraper'
  | 'content-intelligence'
  | 'ai-scrape'
  | 'cop-scrape'
  | 'tools-scrape'
  | 'public-enrichment'
  | 'other'

export type ScrapePurpose =
  | 'article-analysis'
  | 'metadata'
  | 'structured-extraction'
  | 'social-collection'
  | 'url-enrichment'
  | 'preview'
  | 'other'

export type ScrapeStage =
  | 'fetch'
  | 'render'
  | 'extract'
  | 'provider'
  | 'archive'
  | 'cache'
  | 'pdf'
  | 'ai'

export type ScrapeStrategy =
  | 'direct'
  | 'browser-renderer'
  | 'provider'
  | 'archive'
  | 'supplied'
  | 'cache'

export type ScrapeProvider = 'none' | 'apify' | 'browser-renderer' | 'archive' | 'internal'

export type NormalizedScrapeError =
  | 'invalid_request'
  | 'policy_denied'
  | 'dns_denied'
  | 'timeout'
  | 'redirect_limit'
  | 'response_too_large'
  | 'unsupported_content_type'
  | 'upstream_4xx'
  | 'upstream_5xx'
  | 'rate_limited'
  | 'render_failed'
  | 'extract_failed'
  | 'quality_rejected'
  | 'provider_failed'
  | 'internal_error'

export type ScrapeAttemptOutcome = 'succeeded' | 'failed' | 'skipped'
export type ScrapeSourceMode = 'live' | 'supplied' | 'provider' | 'archive' | 'cache'
export type ScrapeHttpStatusClass = 'none' | '2xx' | '3xx' | '4xx' | '5xx'
export type ScrapeContentTypeClass = 'unknown' | 'html' | 'text' | 'json' | 'pdf' | 'image' | 'media' | 'other'

export interface ScrapeRequestV1 {
  schemaVersion: typeof SCRAPE_SCHEMA_VERSION
  requestId: string
  route: ScrapeRoute
  purpose: ScrapePurpose
  target: { url: string }
  requestedStrategy?: ScrapeStrategy
  limits?: {
    timeoutMs?: number
    maxBytes?: number
    maxAttempts?: number
  }
}

export interface ScrapeAttemptV1 {
  schemaVersion: typeof SCRAPE_SCHEMA_VERSION
  requestId: string
  ordinal: number
  stage: ScrapeStage
  strategy: ScrapeStrategy
  provider: ScrapeProvider
  outcome: ScrapeAttemptOutcome
  errorCode?: NormalizedScrapeError
  httpStatusClass?: ScrapeHttpStatusClass
  contentTypeClass?: ScrapeContentTypeClass
  durationMs: number
  responseBytes?: number
  extractedWords?: number
  itemsRead?: number
  itemsWritten?: number
  duplicatesPrevented?: number
}

/** Construct with boundScrapeAttempts; the frozen value is capped at eight entries. */
export type ScrapeAttemptSummaryV1 = readonly ScrapeAttemptV1[] & {
  readonly [scrapeAttemptSummaryBrand]: true
}

export interface ScrapeProvenanceV1 {
  schemaVersion: typeof SCRAPE_SCHEMA_VERSION
  sourceMode: ScrapeSourceMode
  fetchStrategy: ScrapeStrategy
  extractorVersion: string
  quality: {
    version: string
    score: number
    accepted: boolean
  }
  contentHash: string
  attempts: ScrapeAttemptSummaryV1
}

export interface ScrapeContentV1 {
  text: string
  title?: string
  author?: string
  publishedAt?: string
  contentType?: string
}

export interface ScrapeSuccessV1 {
  schemaVersion: typeof SCRAPE_SCHEMA_VERSION
  ok: true
  requestId: string
  content: ScrapeContentV1
  provenance: ScrapeProvenanceV1
}

export interface ScrapeFailureV1 {
  schemaVersion: typeof SCRAPE_SCHEMA_VERSION
  ok: false
  requestId: string
  error: {
    code: NormalizedScrapeError
    retryable: boolean
    stage: ScrapeStage
  }
  attempts: ScrapeAttemptSummaryV1
}

export type ScrapeResultV1 = ScrapeSuccessV1 | ScrapeFailureV1

/** Keep durable/returned attempt summaries small even when an adapter retries more. */
export function boundScrapeAttempts(
  attempts: readonly ScrapeAttemptV1[],
): ScrapeAttemptSummaryV1 {
  return Object.freeze(attempts.slice(0, MAX_SCRAPE_ATTEMPT_SUMMARY)) as ScrapeAttemptSummaryV1
}

export function isFiniteNonnegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0)
}

export function isValidScrapeAttempt(attempt: ScrapeAttemptV1): boolean {
  return Number.isInteger(attempt.ordinal)
    && attempt.ordinal >= 1
    && isFiniteNonnegative(attempt.durationMs)
    && isFiniteNonnegative(attempt.responseBytes)
    && isFiniteNonnegative(attempt.extractedWords)
    && isFiniteNonnegative(attempt.itemsRead)
    && isFiniteNonnegative(attempt.itemsWritten)
    && isFiniteNonnegative(attempt.duplicatesPrevented)
}
