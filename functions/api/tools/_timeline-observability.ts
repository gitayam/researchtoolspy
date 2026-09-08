import type {
  NormalizedScrapeError,
  ScrapeContentTypeClass,
  ScrapeProvider,
  ScrapeStage,
  ScrapeStrategy,
} from '../_shared/scrape-contract'
import {
  SCRAPE_METRIC_SCHEMA_VERSION,
  buildOpaqueScrapeIdentifiers,
  createAnalyticsEngineScrapeMetricSink,
  type AnalyticsEngineLike,
  type ScrapeMetricV1,
} from '../_shared/scrape-metrics'

export interface TimelineAttemptObservation {
  stage: ScrapeStage
  strategy: ScrapeStrategy
  provider: ScrapeProvider
  outcome: 'succeeded' | 'failed' | 'skipped'
  errorCode?: NormalizedScrapeError
  contentTypeClass?: ScrapeContentTypeClass
  durationMs: number
  responseBytes?: number
  extractedWords?: number
  itemsWritten?: number
}

export interface TimelineTerminalObservation {
  outcome: 'succeeded' | 'failed'
  errorCode?: NormalizedScrapeError
  terminalStage: ScrapeStage
  finalStrategy: ScrapeStrategy
  qualityScore?: number
  accepted: boolean
}

interface ObserveTimelineOptions {
  requestId: string
  url: string
  tenantScope: string
  telemetryKey?: string
  analytics?: AnalyticsEngineLike
}

export interface TimelineObservationResult<T> {
  value: T
  terminal: TimelineTerminalObservation
}

const finiteNonnegative = (value: number | undefined): number => (
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : 0
)

/** Emit privacy-safe attempt and exactly one terminal metric for a timeline run. */
export async function observeTimelineAnalysis<T>(
  options: ObserveTimelineOptions,
  execute: (
    recordAttempt: (attempt: TimelineAttemptObservation) => void,
  ) => Promise<TimelineObservationResult<T>>,
): Promise<T> {
  let identifiers: Awaited<ReturnType<typeof buildOpaqueScrapeIdentifiers>> = null
  try {
    identifiers = await buildOpaqueScrapeIdentifiers(options.telemetryKey, {
      requestId: options.requestId,
      tenantScope: options.tenantScope,
      url: options.url,
    })
  } catch {
    // Telemetry inputs never change timeline behavior.
  }
  if (!identifiers || !options.analytics) return (await execute(() => {})).value

  const sink = createAnalyticsEngineScrapeMetricSink(options.analytics, identifiers)
  const startedAt = Date.now()
  let ordinal = 0
  let lastStrategy: ScrapeStrategy = 'direct'
  const recordAttempt = (attempt: TimelineAttemptObservation): void => {
    ordinal += 1
    lastStrategy = attempt.strategy
    const metric: ScrapeMetricV1 = {
      schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
      event: 'attempt',
      requestId: identifiers.requestId,
      route: 'tools-scrape',
      purpose: 'timeline-analysis',
      tenantId: identifiers.tenantId,
      urlId: identifiers.urlId,
      domainId: identifiers.domainId,
      ordinal,
      stage: attempt.stage,
      strategy: attempt.strategy,
      provider: attempt.provider,
      outcome: attempt.outcome,
      errorCode: attempt.errorCode ?? 'none',
      httpStatusClass: 'none',
      contentTypeClass: attempt.contentTypeClass ?? 'unknown',
      count: 1,
      durationMs: finiteNonnegative(attempt.durationMs),
      responseBytes: finiteNonnegative(attempt.responseBytes),
      extractedWords: finiteNonnegative(attempt.extractedWords),
      itemsRead: 0,
      itemsWritten: finiteNonnegative(attempt.itemsWritten),
      duplicatesPrevented: 0,
    }
    try { void sink.emit(metric) } catch { /* metrics are non-authoritative */ }
  }

  const emitTerminal = (terminal: TimelineTerminalObservation): void => {
    const metric: ScrapeMetricV1 = {
      schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
      event: 'terminal',
      requestId: identifiers.requestId,
      route: 'tools-scrape',
      purpose: 'timeline-analysis',
      tenantId: identifiers.tenantId,
      urlId: identifiers.urlId,
      domainId: identifiers.domainId,
      outcome: terminal.outcome,
      errorCode: terminal.errorCode ?? 'none',
      terminalStage: terminal.terminalStage,
      finalStrategy: terminal.finalStrategy,
      attemptCount: ordinal,
      totalMs: finiteNonnegative(Date.now() - startedAt),
      qualityScore: finiteNonnegative(terminal.qualityScore),
      accepted: terminal.accepted ? 1 : 0,
      count: 1,
    }
    try { void sink.emit(metric) } catch { /* metrics are non-authoritative */ }
  }

  try {
    const result = await execute(recordAttempt)
    emitTerminal(result.terminal)
    return result.value
  } catch (error) {
    emitTerminal({
      outcome: 'failed',
      errorCode: 'internal_error',
      terminalStage: ordinal > 0 ? 'ai' : 'fetch',
      finalStrategy: lastStrategy,
      accepted: false,
    })
    throw error
  }
}
