import type { NormalizedScrapeError } from '../_shared/scrape-contract'
import { buildOpaqueScrapeIdentifiers } from '../_shared/scrape-metrics'

export interface ExtractionFailureLog {
  level: 'warn'
  source: 'content-intelligence/analyze-url'
  message: 'URL extraction failed'
  context: {
    correlation_id: string
    error_code: NormalizedScrapeError
    url_id?: string
    domain_id?: string
  }
}

/**
 * Build a closed, privacy-safe hard-failure event. A dedicated telemetry key adds
 * stable URL/domain correlation; without it, only the random request correlation
 * remains. Raw URLs, tenants, users, and free-form upstream reasons are never emitted.
 */
export async function extractionFailureLog(input: {
  url: string
  errorCode: NormalizedScrapeError
  tenantScope: string
  telemetryKey?: string
  correlationId?: string
}): Promise<ExtractionFailureLog> {
  const suppliedCorrelation = input.correlationId?.trim()
  const randomCorrelation = suppliedCorrelation
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(suppliedCorrelation)
    ? suppliedCorrelation.toLowerCase()
    : crypto.randomUUID()
  let identifiers: Awaited<ReturnType<typeof buildOpaqueScrapeIdentifiers>> = null
  try {
    identifiers = await buildOpaqueScrapeIdentifiers(input.telemetryKey, {
      requestId: randomCorrelation,
      tenantScope: input.tenantScope,
      url: input.url,
    })
  } catch {
    // Logging must remain privacy-safe and non-blocking even for malformed URLs.
  }

  return {
    level: 'warn',
    source: 'content-intelligence/analyze-url',
    message: 'URL extraction failed',
    context: {
      correlation_id: identifiers?.requestId ?? randomCorrelation,
      error_code: input.errorCode,
      ...(identifiers ? {
        url_id: identifiers.urlId,
        domain_id: identifiers.domainId,
      } : {}),
    },
  }
}
