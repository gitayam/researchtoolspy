import {
  SCRAPE_SCHEMA_VERSION,
  boundScrapeAttempts,
  type NormalizedScrapeError,
  type ScrapeAttemptV1,
} from '../../_shared/scrape-contract'
import {
  buildOpaqueScrapeIdentifiers,
  createAnalyticsEngineScrapeMetricSink,
  observeScrape,
  type AnalyticsEngineLike,
} from '../../_shared/scrape-metrics'

export type CopScrapeAttemptObservation = Omit<
  ScrapeAttemptV1,
  'schemaVersion' | 'requestId' | 'ordinal'
>

interface ObserveCopScrapeOptions {
  requestId: string
  requestFingerprint: string
  tenantScope: string
  telemetryKey?: string
  analytics?: AnalyticsEngineLike
}

function responseError(response: Response, attempt?: ScrapeAttemptV1): NormalizedScrapeError {
  if (attempt?.errorCode) return attempt.errorCode
  if (response.status === 429) return 'rate_limited'
  if (response.status >= 500) return 'provider_failed'
  return 'invalid_request'
}

/**
 * Observe one authorized, canonicalized COP provider request. Authentication and
 * invalid-input denials are intentionally outside this paid-job denominator.
 */
export async function observeCopScrapeRequest(
  options: ObserveCopScrapeOptions,
  execute: (recordAttempt: (attempt: CopScrapeAttemptObservation) => void) => Promise<Response>,
): Promise<Response> {
  const target = `https://apify.invalid/job/${options.requestFingerprint.replace(/[^a-f0-9]/gi, '').slice(-64) || 'unknown'}`
  let identifiers: Awaited<ReturnType<typeof buildOpaqueScrapeIdentifiers>> = null
  try {
    identifiers = await buildOpaqueScrapeIdentifiers(options.telemetryKey, {
      requestId: options.requestId,
      tenantScope: options.tenantScope,
      url: target,
    })
  } catch {
    // Telemetry must not affect provider jobs.
  }
  if (!identifiers || !options.analytics) return execute(() => {})

  const request = {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    requestId: options.requestId,
    route: 'cop-scrape' as const,
    purpose: 'social-collection' as const,
    target: { url: target },
    requestedStrategy: 'provider' as const,
    limits: { maxAttempts: 8 },
  }
  const attempts: ScrapeAttemptV1[] = []
  let response: Response | undefined

  await observeScrape({
    request,
    identifiers,
    sink: createAnalyticsEngineScrapeMetricSink(options.analytics, identifiers),
  }, async observer => {
    response = await execute((observation) => {
      const attempt: ScrapeAttemptV1 = {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        requestId: options.requestId,
        ordinal: attempts.length + 1,
        ...observation,
      }
      if (observer.attempt(attempt)) attempts.push(attempt)
    })

    if (response.status >= 400 || attempts.at(-1)?.outcome === 'failed') {
      const errorCode = responseError(response, attempts.at(-1))
      return {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        ok: false,
        requestId: options.requestId,
        error: {
          code: errorCode,
          retryable: errorCode === 'timeout' || errorCode === 'rate_limited' || errorCode === 'upstream_5xx',
          stage: attempts.at(-1)?.stage ?? 'provider',
        },
        attempts: boundScrapeAttempts(attempts),
      }
    }

    const finalStrategy = attempts.at(-1)?.strategy ?? 'provider'
    return {
      schemaVersion: SCRAPE_SCHEMA_VERSION,
      ok: true,
      requestId: options.requestId,
      content: { text: '' },
      provenance: {
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        sourceMode: finalStrategy === 'cache' ? 'cache' : 'provider',
        fetchStrategy: finalStrategy,
        extractorVersion: 'cop-apify-job-v1',
        quality: { version: 'provider-job-v1', score: 1, accepted: true },
        contentHash: options.requestFingerprint.replace(/[^a-f0-9]/gi, '').slice(-64).padStart(64, '0'),
        attempts: boundScrapeAttempts(attempts),
      },
    }
  })

  if (!response) throw new Error('COP scrape request did not return a response')
  return response
}
