import { expect, test } from '@playwright/test'
import {
  MAX_SCRAPE_ATTEMPT_SUMMARY,
  SCRAPE_SCHEMA_VERSION,
  boundScrapeAttempts,
  isValidScrapeAttempt,
  type ScrapeAttemptV1,
} from '../../../functions/api/_shared/scrape-contract'
import {
  SCRAPE_METRIC_SCHEMA_VERSION,
  RecordingScrapeMetricSink,
  buildOpaqueScrapeIdentifiers,
  createAnalyticsEngineScrapeMetricSink,
  noopScrapeMetricSink,
  type ScrapeMetricV1,
} from '../../../functions/api/_shared/scrape-metrics'

const RAW_URL = 'https://private.example.test/article?q=secret'
const RAW_TENANT = 'workspace-sensitive-42'
const REQUEST_ID = '018f6d5e-4d58-7ef0-8d12-a4e3aee55301'

function attempt(ordinal: number): ScrapeAttemptV1 {
  return {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    ordinal,
    stage: 'fetch',
    strategy: 'direct',
    provider: 'none',
    outcome: 'succeeded',
    httpStatusClass: '2xx',
    contentTypeClass: 'html',
    durationMs: ordinal * 10,
    responseBytes: ordinal * 100,
    extractedWords: ordinal * 5,
  }
}

function assertPrivacySafe(value: unknown): void {
  const forbiddenKeys = /^(?:url|host|hostname|query|body|content|prompt|cookie|token|ip|userAgent|userId|workspaceId|error|message)$/i
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (current && typeof current === 'object') {
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        expect(forbiddenKeys.test(key), `forbidden metric key: ${key}`).toBe(false)
        visit(child)
      }
      return
    }
    if (typeof current === 'string') {
      expect(current).not.toMatch(/https?:\/\//i)
      expect(current).not.toContain(RAW_TENANT)
      expect(current).not.toContain('secret')
    }
    if (typeof current === 'number') {
      expect(Number.isFinite(current)).toBe(true)
      expect(current).toBeGreaterThanOrEqual(0)
    }
  }
  visit(value)
}

test.describe('scrape observability contract @smoke', () => {
  test('@smoke versions and bounds the durable attempt summary', () => {
    const attempts = Array.from({ length: 12 }, (_, index) => attempt(index + 1))
    const bounded = boundScrapeAttempts(attempts)

    expect(SCRAPE_SCHEMA_VERSION).toBe('scrape.v1')
    expect(SCRAPE_METRIC_SCHEMA_VERSION).toBe('scrape.metric.v1')
    expect(bounded).toHaveLength(MAX_SCRAPE_ATTEMPT_SUMMARY)
    expect(bounded.map(item => item.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(isValidScrapeAttempt(attempt(1))).toBe(true)
    expect(isValidScrapeAttempt({ ...attempt(1), durationMs: Number.NaN })).toBe(false)
    expect(isValidScrapeAttempt({ ...attempt(1), responseBytes: -1 })).toBe(false)
  })

  test('@smoke creates domain-separated opaque identifiers only with an injected key', async () => {
    await expect(buildOpaqueScrapeIdentifiers('', { tenantScope: RAW_TENANT, url: RAW_URL })).resolves.toBeNull()
    await expect(buildOpaqueScrapeIdentifiers(undefined, { tenantScope: RAW_TENANT, url: RAW_URL })).resolves.toBeNull()

    const first = await buildOpaqueScrapeIdentifiers('dedicated-telemetry-key', {
      tenantScope: RAW_TENANT,
      url: RAW_URL,
    })
    const repeated = await buildOpaqueScrapeIdentifiers('dedicated-telemetry-key', {
      tenantScope: RAW_TENANT,
      url: RAW_URL,
    })
    const anotherUrl = await buildOpaqueScrapeIdentifiers('dedicated-telemetry-key', {
      tenantScope: RAW_TENANT,
      url: 'https://private.example.test/another',
    })

    expect(first).toEqual(repeated)
    expect(first?.urlId).not.toBe(anotherUrl?.urlId)
    expect(first?.domainId).toBe(anotherUrl?.domainId)
    for (const opaque of Object.values(first ?? {})) {
      expect(opaque).toMatch(/^[a-f0-9]{64}$/)
      expect(opaque).not.toContain('private')
    }
  })

  test('@smoke metric shapes recursively exclude raw and free-form request data', () => {
    const sink = new RecordingScrapeMetricSink()
    const metric: ScrapeMetricV1 = {
      schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
      event: 'attempt',
      requestId: REQUEST_ID,
      route: 'web-scraper',
      purpose: 'article-analysis',
      tenantId: 'a'.repeat(64),
      urlId: 'b'.repeat(64),
      domainId: 'c'.repeat(64),
      ordinal: 1,
      stage: 'fetch',
      strategy: 'direct',
      provider: 'none',
      outcome: 'failed',
      errorCode: 'timeout',
      httpStatusClass: 'none',
      contentTypeClass: 'unknown',
      count: 1,
      durationMs: 25,
      responseBytes: 0,
      extractedWords: 0,
    }
    sink.emit(metric)
    sink.emit({
      schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
      event: 'terminal',
      requestId: REQUEST_ID,
      route: 'web-scraper',
      purpose: 'article-analysis',
      tenantId: 'a'.repeat(64),
      urlId: 'b'.repeat(64),
      domainId: 'c'.repeat(64),
      outcome: 'failed',
      errorCode: 'timeout',
      terminalStage: 'fetch',
      finalStrategy: 'direct',
      attemptCount: 1,
      totalMs: 25,
      qualityScore: 0,
      accepted: 0,
      count: 1,
    })

    expect(sink.metrics).toHaveLength(2)
    expect(sink.metrics[0]).toEqual(metric)
    assertPrivacySafe(sink.metrics)
  })

  test('@smoke optional Analytics Engine adapter is noop without binding or keyed identifiers', () => {
    const points: unknown[] = []
    const binding = { writeDataPoint: (point: unknown) => { points.push(point) } }
    const identifiers = { tenantId: 'a'.repeat(64), urlId: 'b'.repeat(64), domainId: 'c'.repeat(64) }
    const metric: ScrapeMetricV1 = {
      schemaVersion: SCRAPE_METRIC_SCHEMA_VERSION,
      event: 'terminal',
      requestId: REQUEST_ID,
      route: 'web-scraper',
      purpose: 'article-analysis',
      ...identifiers,
      outcome: 'succeeded',
      errorCode: 'none',
      terminalStage: 'extract',
      finalStrategy: 'direct',
      attemptCount: 1,
      totalMs: 40,
      qualityScore: 0.8,
      accepted: 1,
      count: 1,
    }

    createAnalyticsEngineScrapeMetricSink(binding, null).emit(metric)
    createAnalyticsEngineScrapeMetricSink(undefined, identifiers).emit(metric)
    noopScrapeMetricSink.emit(metric)
    expect(points).toHaveLength(0)

    createAnalyticsEngineScrapeMetricSink(binding, identifiers).emit(metric)
    expect(points).toHaveLength(1)
    assertPrivacySafe(points)

    const failingBinding = { writeDataPoint: () => { throw new Error('dataset unavailable') } }
    expect(() => createAnalyticsEngineScrapeMetricSink(failingBinding, identifiers).emit(metric)).not.toThrow()
  })
})
