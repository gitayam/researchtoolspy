import {
  SCRAPE_SCHEMA_VERSION,
  boundScrapeAttempts,
  type NormalizedScrapeError,
  type ScrapeAttemptV1,
  type ScrapeContentTypeClass,
  type ScrapeHttpStatusClass,
  type ScrapeProvider,
  type ScrapeStage,
  type ScrapeStrategy,
} from '../_shared/scrape-contract'
import {
  buildOpaqueScrapeIdentifiers,
  createAnalyticsEngineScrapeMetricSink,
  observeScrape,
  type AnalyticsEngineLike,
} from '../_shared/scrape-metrics'

export interface ContentExtractionSnapshot {
  success: boolean
  text: string
  title?: string
  author?: string
  publishDate?: string
  source?: string
  errorCode?: NormalizedScrapeError
}

export interface ExtractionAttemptObservation {
  stage: ScrapeStage
  strategy: ScrapeStrategy
  provider: ScrapeProvider
  outcome: 'succeeded' | 'failed' | 'skipped'
  errorCode?: NormalizedScrapeError
  httpStatusClass?: ScrapeHttpStatusClass
  contentTypeClass?: ScrapeContentTypeClass
  durationMs: number
  responseBytes?: number
  extractedWords?: number
}

interface ObserveContentExtractionOptions {
  requestId: string
  url: string
  tenantScope: string
  telemetryKey?: string
  analytics?: AnalyticsEngineLike
}

const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function sourceMode(source?: string): 'live' | 'supplied' | 'provider' | 'archive' {
  if (source === 'bot-scrape') return 'supplied'
  if (source === 'archive.ph' || source === 'wayback') return 'archive'
  if (source === 'smry.ai' || source === 'apify') return 'provider'
  return 'live'
}

function strategyForSource(source?: string): ScrapeStrategy {
  const mode = sourceMode(source)
  if (mode === 'supplied') return 'supplied'
  if (mode === 'archive') return 'archive'
  if (mode === 'provider') return 'provider'
  return 'direct'
}

/**
 * Instruments one accepted content-intelligence extraction. Telemetry is
 * deliberately disabled unless both the Analytics Engine binding and the
 * dedicated HMAC key are present. Analytics failures never affect extraction.
 */
export async function observeContentIntelligenceExtraction<T extends ContentExtractionSnapshot>(
  options: ObserveContentExtractionOptions,
  execute: (recordAttempt: (attempt: ExtractionAttemptObservation) => void) => Promise<T>,
): Promise<T> {
  let identifiers: Awaited<ReturnType<typeof buildOpaqueScrapeIdentifiers>> = null
  try {
    identifiers = await buildOpaqueScrapeIdentifiers(options.telemetryKey, {
      requestId: options.requestId,
      tenantScope: options.tenantScope,
      url: options.url,
    })
  } catch {
    // Invalid telemetry inputs must not change scraping behavior.
  }

  if (!identifiers || !options.analytics) return execute(() => {})

  const request = {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    requestId: options.requestId,
    route: 'content-intelligence' as const,
    purpose: 'article-analysis' as const,
    target: { url: options.url },
    requestedStrategy: 'direct' as const,
    limits: { maxAttempts: 8 },
  }
  const attempts: ScrapeAttemptV1[] = []
  let extracted: T | undefined

  await observeScrape({
    request,
    identifiers,
    sink: createAnalyticsEngineScrapeMetricSink(options.analytics, identifiers),
  }, async observer => {
    const recordAttempt = (observation: ExtractionAttemptObservation): void => {
      const attempt: ScrapeAttemptV1 = {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        requestId: options.requestId,
        ordinal: attempts.length + 1,
        ...observation,
      }
      if (observer.attempt(attempt)) attempts.push(attempt)
    }

    extracted = await execute(recordAttempt)
    const words = countWords(extracted.text)
    const accepted = extracted.success && words >= 150

    if (!accepted) {
      const errorCode = extracted.success ? 'quality_rejected' : (extracted.errorCode ?? 'extract_failed')
      return {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        ok: false,
        requestId: options.requestId,
        error: {
          code: errorCode,
          retryable: errorCode === 'timeout' || errorCode === 'rate_limited' || errorCode === 'upstream_5xx',
          stage: attempts.at(-1)?.stage ?? 'extract',
        },
        attempts: boundScrapeAttempts(attempts),
      }
    }

    return {
      schemaVersion: SCRAPE_SCHEMA_VERSION,
      ok: true,
      requestId: options.requestId,
      content: {
        text: extracted.text,
        title: extracted.title,
        author: extracted.author,
        publishedAt: extracted.publishDate,
      },
      provenance: {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        sourceMode: sourceMode(extracted.source),
        fetchStrategy: strategyForSource(extracted.source),
        extractorVersion: 'content-intelligence-v1',
        quality: {
          version: 'content-intelligence-quality-v1',
          score: Math.min(1, words / 500),
          accepted: true,
        },
        contentHash: await sha256(extracted.text),
        attempts: boundScrapeAttempts(attempts),
      },
    }
  })

  if (!extracted) throw new Error('Content extraction did not return a result')
  return extracted
}
