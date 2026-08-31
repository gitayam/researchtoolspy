import { expect, test } from '@playwright/test'
import {
  SCRAPE_SCHEMA_VERSION,
  type ScrapeAttemptV1,
  type ScrapeFailureV1,
  type ScrapeRequestV1,
  type ScrapeSuccessV1,
} from '../../../functions/api/_shared/scrape-contract'
import {
  RecordingScrapeMetricSink,
  observeScrape,
  type OpaqueScrapeIdentifiers,
  type ScrapeMetricSink,
} from '../../../functions/api/_shared/scrape-metrics'

const REQUEST_ID = '018f6d5e-4d58-7ef0-8d12-a4e3aee55301'
const request: ScrapeRequestV1 = {
  schemaVersion: SCRAPE_SCHEMA_VERSION,
  requestId: REQUEST_ID,
  route: 'content-intelligence',
  purpose: 'article-analysis',
  target: { url: 'https://not-emitted.example.test/article' },
  requestedStrategy: 'direct',
}
const identifiers: OpaqueScrapeIdentifiers = {
  tenantId: 'a'.repeat(64),
  urlId: 'b'.repeat(64),
  domainId: 'c'.repeat(64),
}

function attempt(ordinal = 1, outcome: ScrapeAttemptV1['outcome'] = 'succeeded'): ScrapeAttemptV1 {
  return {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    requestId: REQUEST_ID,
    ordinal,
    stage: 'fetch',
    strategy: 'direct',
    provider: 'none',
    outcome,
    ...(outcome === 'failed' ? { errorCode: 'timeout' as const } : {}),
    durationMs: 20,
    responseBytes: 100,
    extractedWords: 10,
  }
}

function success(attempts: readonly ScrapeAttemptV1[] = [attempt()]): ScrapeSuccessV1 {
  return {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    ok: true,
    requestId: REQUEST_ID,
    content: { text: 'article text', title: 'Article' },
    provenance: {
      schemaVersion: SCRAPE_SCHEMA_VERSION,
      sourceMode: 'live',
      fetchStrategy: 'direct',
      extractorVersion: 'article-v1',
      quality: { version: 'quality-v1', score: 0.9, accepted: true },
      contentHash: 'f'.repeat(64),
      attempts,
    },
  }
}

function failure(code: ScrapeFailureV1['error']['code'] = 'extract_failed'): ScrapeFailureV1 {
  return {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    ok: false,
    requestId: REQUEST_ID,
    error: { code, retryable: false, stage: 'extract' },
    attempts: [attempt(1, 'failed')],
  }
}

function terminals(sink: RecordingScrapeMetricSink) {
  return sink.metrics.filter(metric => metric.event === 'terminal')
}

test.describe('scrape terminal coverage @smoke', () => {
  test('@smoke success and normalized failure each emit exactly one correlated terminal', async () => {
    for (const result of [success(), failure()]) {
      const sink = new RecordingScrapeMetricSink()
      const returned = await observeScrape({ request, identifiers, sink }, async observer => {
        expect(observer.attempt(attempt())).toBe(true)
        return result
      })

      expect(returned).toBe(result)
      expect(terminals(sink)).toHaveLength(1)
      expect(sink.metrics).toHaveLength(2)
      expect(new Set(sink.metrics.map(metric => metric.requestId))).toEqual(new Set([REQUEST_ID]))
      for (const metric of sink.metrics) {
        for (const value of Object.values(metric)) {
          if (typeof value === 'number') {
            expect(Number.isFinite(value)).toBe(true)
            expect(value).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
  })

  test('@smoke thrown errors and abort timeouts preserve identity and emit one terminal', async () => {
    const cases = [
      { error: new Error('boom'), code: 'internal_error' },
      { error: new DOMException('deadline', 'AbortError'), code: 'timeout' },
    ] as const

    for (const scenario of cases) {
      const sink = new RecordingScrapeMetricSink()
      let caught: unknown
      try {
        await observeScrape({ request, identifiers, sink }, async observer => {
          observer.attempt(attempt(1, 'failed'))
          throw scenario.error
        })
      } catch (error) {
        caught = error
      }

      expect(caught).toBe(scenario.error)
      expect(terminals(sink)).toHaveLength(1)
      expect(terminals(sink)[0]).toMatchObject({ outcome: 'failed', errorCode: scenario.code })
    }
  })

  test('@smoke explicit and duplicate finish calls still emit one terminal', async () => {
    const sink = new RecordingScrapeMetricSink()
    const result = success([])
    const returned = await observeScrape({ request, identifiers, sink }, async observer => {
      expect(observer.finish(result, 10)).toBe(true)
      expect(observer.finish(result, 20)).toBe(false)
      expect(observer.attempt(attempt())).toBe(false)
      return result
    })

    expect(returned).toBe(result)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ totalMs: 10, attemptCount: 0 })
  })

  test('@smoke attempt recording is bounded and rejects invalid measures', async () => {
    const sink = new RecordingScrapeMetricSink()
    await observeScrape({ request, identifiers, sink }, async observer => {
      for (let ordinal = 1; ordinal <= 8; ordinal += 1) {
        expect(observer.attempt(attempt(ordinal))).toBe(true)
      }
      expect(observer.attempt(attempt(9))).toBe(false)
      expect(observer.attempt({ ...attempt(10), durationMs: Number.NaN })).toBe(false)
      expect(observer.attempt({ ...attempt(11), responseBytes: -1 })).toBe(false)
      return success()
    })

    expect(sink.metrics.filter(metric => metric.event === 'attempt')).toHaveLength(8)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ attemptCount: 8 })
  })

  test('@smoke a throwing sink changes neither returned results nor thrown errors', async () => {
    const throwingSink: ScrapeMetricSink = { emit: () => { throw new Error('metrics unavailable') } }
    const expectedResult = success()
    const returned = await observeScrape({ request, identifiers, sink: throwingSink }, async observer => {
      observer.attempt(attempt())
      return expectedResult
    })
    expect(returned).toBe(expectedResult)

    const expectedError = new Error('route failure')
    let caught: unknown
    try {
      await observeScrape({ request, identifiers, sink: throwingSink }, async () => { throw expectedError })
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(expectedError)
  })
})
