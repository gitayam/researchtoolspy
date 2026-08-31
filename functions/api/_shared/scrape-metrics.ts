import {
  MAX_SCRAPE_ATTEMPT_SUMMARY,
  SCRAPE_SCHEMA_VERSION,
  type NormalizedScrapeError,
  type ScrapeAttemptV1,
  type ScrapeContentTypeClass,
  type ScrapeHttpStatusClass,
  type ScrapeProvider,
  type ScrapePurpose,
  type ScrapeRequestV1,
  type ScrapeResultV1,
  type ScrapeRoute,
  type ScrapeStage,
  type ScrapeStrategy,
  isValidScrapeAttempt,
} from './scrape-contract'

export const SCRAPE_METRIC_SCHEMA_VERSION = 'scrape.metric.v1' as const

export interface OpaqueScrapeIdentifiers {
  tenantId: string
  urlId: string
  domainId: string
}

interface ScrapeMetricBaseV1 {
  schemaVersion: typeof SCRAPE_METRIC_SCHEMA_VERSION
  requestId: string
  route: ScrapeRoute
  purpose: ScrapePurpose
  tenantId: string
  urlId: string
  domainId: string
}

export interface ScrapeAttemptMetricV1 extends ScrapeMetricBaseV1 {
  event: 'attempt'
  ordinal: number
  stage: ScrapeStage
  strategy: ScrapeStrategy
  provider: ScrapeProvider
  outcome: 'succeeded' | 'failed' | 'skipped'
  errorCode: NormalizedScrapeError | 'none'
  httpStatusClass: ScrapeHttpStatusClass
  contentTypeClass: ScrapeContentTypeClass
  count: 1
  durationMs: number
  responseBytes: number
  extractedWords: number
}

export interface ScrapeTerminalMetricV1 extends ScrapeMetricBaseV1 {
  event: 'terminal'
  outcome: 'succeeded' | 'failed'
  errorCode: NormalizedScrapeError | 'none'
  terminalStage: ScrapeStage
  finalStrategy: ScrapeStrategy
  attemptCount: number
  totalMs: number
  qualityScore: number
  accepted: 0 | 1
  count: 1
}

export type ScrapeMetricV1 = ScrapeAttemptMetricV1 | ScrapeTerminalMetricV1

export interface ScrapeMetricSink {
  emit(metric: ScrapeMetricV1): void
}

export const noopScrapeMetricSink: ScrapeMetricSink = Object.freeze({ emit: () => {} })

export class RecordingScrapeMetricSink implements ScrapeMetricSink {
  readonly metrics: ScrapeMetricV1[] = []

  emit(metric: ScrapeMetricV1): void {
    this.metrics.push(metric)
  }
}

export interface AnalyticsEngineDataPoint {
  indexes?: string[]
  blobs?: string[]
  doubles?: number[]
}

export interface AnalyticsEngineLike {
  writeDataPoint(point: AnalyticsEngineDataPoint): void
}

function safeEmit(sink: ScrapeMetricSink, metric: ScrapeMetricV1): void {
  try {
    sink.emit(metric)
  } catch {
    // Metrics must never alter the request being observed.
  }
}

function finiteNonnegative(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : 0
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function keyedId(key: string, scope: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${scope}\0${value}`)))
}

/** Returns no identifiers when a dedicated telemetry key is unavailable. */
export async function buildOpaqueScrapeIdentifiers(
  telemetryKey: string | null | undefined,
  input: { tenantScope: string; url: string },
): Promise<OpaqueScrapeIdentifiers | null> {
  if (!telemetryKey?.trim()) return null
  const parsed = new URL(input.url)
  return {
    tenantId: await keyedId(telemetryKey, 'scrape-tenant-v1', input.tenantScope),
    urlId: await keyedId(telemetryKey, 'scrape-url-v1', parsed.href),
    domainId: await keyedId(telemetryKey, 'scrape-domain-v1', parsed.hostname.toLowerCase()),
  }
}

/** Optional adapter: absent binding or keyed identifiers deliberately produces no output. */
export function createAnalyticsEngineScrapeMetricSink(
  binding: AnalyticsEngineLike | null | undefined,
  identifiers: OpaqueScrapeIdentifiers | null | undefined,
): ScrapeMetricSink {
  if (!binding || !identifiers) return noopScrapeMetricSink
  return {
    emit(metric): void {
      try {
        if (metric.event === 'attempt') {
          binding.writeDataPoint({
            indexes: [identifiers.tenantId],
            blobs: [
              metric.schemaVersion, metric.event, metric.route, metric.purpose,
              metric.stage, metric.strategy, metric.provider, metric.outcome,
              metric.errorCode, metric.httpStatusClass, metric.contentTypeClass,
              identifiers.urlId, identifiers.domainId,
            ],
            doubles: [metric.count, metric.ordinal, metric.durationMs, metric.responseBytes, metric.extractedWords],
          })
        } else {
          binding.writeDataPoint({
            indexes: [identifiers.tenantId],
            blobs: [
              metric.schemaVersion, metric.event, metric.route, metric.purpose,
              metric.outcome, metric.errorCode, metric.terminalStage,
              metric.finalStrategy, identifiers.urlId, identifiers.domainId,
            ],
            doubles: [metric.count, metric.attemptCount, metric.totalMs, metric.qualityScore, metric.accepted],
          })
        }
      } catch {
        // Analytics Engine failures are non-blocking.
      }
    },
  }
}

export interface ScrapeObserver {
  attempt(attempt: ScrapeAttemptV1): boolean
  finish(result: ScrapeResultV1, totalMs?: number): boolean
}

export interface ObserveScrapeOptions {
  request: ScrapeRequestV1
  identifiers: OpaqueScrapeIdentifiers
  sink?: ScrapeMetricSink
  now?: () => number
}

function metricBase(options: ObserveScrapeOptions): ScrapeMetricBaseV1 {
  return {
    schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
    requestId: options.request.requestId,
    route: options.request.route,
    purpose: options.request.purpose,
    tenantId: options.identifiers.tenantId,
    urlId: options.identifiers.urlId,
    domainId: options.identifiers.domainId,
  }
}

function failureCode(error: unknown): NormalizedScrapeError {
  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown; code?: unknown }
    if (candidate.name === 'AbortError' || candidate.code === 'timeout') return 'timeout'
  }
  return 'internal_error'
}

/**
 * Observe one accepted scrape. It emits at most eight attempts and exactly one
 * terminal metric, while returning the same result or rethrowing the same error.
 */
export async function observeScrape(
  options: ObserveScrapeOptions,
  execute: (observer: ScrapeObserver) => Promise<ScrapeResultV1>,
): Promise<ScrapeResultV1> {
  const sink = options.sink ?? noopScrapeMetricSink
  const now = options.now ?? Date.now
  const startedAt = now()
  const attempts: ScrapeAttemptV1[] = []
  let finished = false

  const finish = (result: ScrapeResultV1, totalMs = finiteNonnegative(now() - startedAt)): boolean => {
    if (finished) return false
    finished = true
    const finalAttempt = attempts.at(-1)
    const success = result.ok
    const terminal: ScrapeTerminalMetricV1 = {
      ...metricBase(options),
      event: 'terminal',
      outcome: success ? 'succeeded' : 'failed',
      errorCode: success ? 'none' : result.error.code,
      terminalStage: success ? (finalAttempt?.stage ?? 'extract') : result.error.stage,
      finalStrategy: success ? result.provenance.fetchStrategy : (finalAttempt?.strategy ?? options.request.requestedStrategy ?? 'direct'),
      attemptCount: attempts.length,
      totalMs: finiteNonnegative(totalMs),
      qualityScore: success ? finiteNonnegative(result.provenance.quality.score) : 0,
      accepted: success && result.provenance.quality.accepted ? 1 : 0,
      count: 1,
    }
    safeEmit(sink, terminal)
    return true
  }

  const observer: ScrapeObserver = {
    attempt(attempt): boolean {
      if (finished || attempts.length >= MAX_SCRAPE_ATTEMPT_SUMMARY || !isValidScrapeAttempt(attempt)) return false
      if (attempt.requestId !== options.request.requestId || attempt.schemaVersion !== SCRAPE_SCHEMA_VERSION) return false
      attempts.push(attempt)
      safeEmit(sink, {
        ...metricBase(options),
        event: 'attempt',
        ordinal: attempt.ordinal,
        stage: attempt.stage,
        strategy: attempt.strategy,
        provider: attempt.provider,
        outcome: attempt.outcome,
        errorCode: attempt.errorCode ?? 'none',
        httpStatusClass: attempt.httpStatusClass ?? 'none',
        contentTypeClass: attempt.contentTypeClass ?? 'unknown',
        count: 1,
        durationMs: finiteNonnegative(attempt.durationMs),
        responseBytes: finiteNonnegative(attempt.responseBytes),
        extractedWords: finiteNonnegative(attempt.extractedWords),
      })
      return true
    },
    finish,
  }

  try {
    const result = await execute(observer)
    finish(result)
    return result
  } catch (error) {
    if (!finished) {
      const code = failureCode(error)
      finish({
        schemaVersion: SCRAPE_SCHEMA_VERSION,
        ok: false,
        requestId: options.request.requestId,
        error: { code, retryable: code === 'timeout', stage: attempts.at(-1)?.stage ?? 'fetch' },
        attempts,
      })
    }
    throw error
  }
}
