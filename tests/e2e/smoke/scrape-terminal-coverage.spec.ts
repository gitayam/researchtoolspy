import { expect, test } from '@playwright/test'
import {
  SCRAPE_SCHEMA_VERSION,
  boundScrapeAttempts,
  type ScrapeAttemptV1,
  type ScrapeFailureV1,
  type ScrapeRequestV1,
  type ScrapeSuccessV1,
} from '../../../functions/api/_shared/scrape-contract'
import {
  RecordingScrapeMetricSink,
  buildOpaqueScrapeIdentifiers,
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
async function identifiers(): Promise<OpaqueScrapeIdentifiers> {
  const value = await buildOpaqueScrapeIdentifiers('dedicated-telemetry-key', {
    requestId: REQUEST_ID,
    tenantScope: 'workspace-sensitive-42',
    url: request.target.url,
  })
  if (!value) throw new Error('expected opaque test identifiers')
  return value
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
      attempts: boundScrapeAttempts(attempts),
    },
  }
}

function failure(code: ScrapeFailureV1['error']['code'] = 'extract_failed'): ScrapeFailureV1 {
  return {
    schemaVersion: SCRAPE_SCHEMA_VERSION,
    ok: false,
    requestId: REQUEST_ID,
    error: { code, retryable: false, stage: 'extract' },
    attempts: boundScrapeAttempts([attempt(1, 'failed')]),
  }
}

function terminals(sink: RecordingScrapeMetricSink) {
  return sink.metrics.filter(metric => metric.event === 'terminal')
}

test.describe('scrape terminal coverage @smoke', () => {
  test('@smoke success and normalized failure each emit exactly one correlated terminal', async () => {
    for (const result of [success(), failure()]) {
      const sink = new RecordingScrapeMetricSink()
      const opaque = await identifiers()
      const returned = await observeScrape({ request, identifiers: opaque, sink }, async observer => {
        expect(observer.attempt(attempt())).toBe(true)
        return result
      })

      expect(returned).toBe(result)
      expect(terminals(sink)).toHaveLength(1)
      expect(sink.metrics).toHaveLength(2)
      expect(new Set(sink.metrics.map(metric => metric.requestId))).toEqual(new Set([opaque.requestId]))
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
        await observeScrape({ request, identifiers: await identifiers(), sink }, async observer => {
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
    const returned = await observeScrape({ request, identifiers: await identifiers(), sink }, async observer => {
      expect(observer.finish(result, 10)).toBe(true)
      expect(observer.finish(result, 20)).toBe(false)
      expect(observer.attempt(attempt())).toBe(false)
      return result
    })

    expect(returned).toBe(result)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ totalMs: 10, attemptCount: 0 })
  })

  test('@smoke a throw overrides a staged success terminal', async () => {
    const sink = new RecordingScrapeMetricSink()
    const staged = success([])
    const expectedError = new Error('failed after finish was staged')
    let caught: unknown

    try {
      await observeScrape({ request, identifiers: await identifiers(), sink }, async observer => {
        expect(observer.finish(staged, 10)).toBe(true)
        throw expectedError
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(expectedError)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ outcome: 'failed', errorCode: 'internal_error' })
  })

  test('@smoke the returned result overrides a mismatched staged result', async () => {
    const sink = new RecordingScrapeMetricSink()
    const staged = success([])
    const returnedFailure = failure('quality_rejected')
    const returned = await observeScrape(
      { request, identifiers: await identifiers(), sink, now: () => 50 },
      async observer => {
        expect(observer.finish(staged, 999)).toBe(true)
        return returnedFailure
      },
    )

    expect(returned).toBe(returnedFailure)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ outcome: 'failed', errorCode: 'quality_rejected', totalMs: 0 })
  })

  test('@smoke a result for another request fails telemetry closed without changing the result', async () => {
    const sink = new RecordingScrapeMetricSink()
    const mismatched = { ...success([]), requestId: 'scrape_request_other' }
    const returned = await observeScrape(
      { request, identifiers: await identifiers(), sink },
      async () => mismatched,
    )

    expect(returned).toBe(mismatched)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({
      outcome: 'failed',
      errorCode: 'internal_error',
      accepted: 0,
      qualityScore: 0,
    })
  })

  test('@smoke attempt recording is bounded and rejects invalid measures', async () => {
    const sink = new RecordingScrapeMetricSink()
    await observeScrape({ request, identifiers: await identifiers(), sink }, async observer => {
      for (let ordinal = 1; ordinal <= 8; ordinal += 1) {
        expect(observer.attempt(attempt(ordinal))).toBe(true)
      }
      expect(observer.attempt(attempt(9))).toBe(false)
      expect(observer.attempt({ ...attempt(10), durationMs: Number.NaN })).toBe(false)
      expect(observer.attempt({ ...attempt(11), responseBytes: -1 })).toBe(false)
      expect(observer.attempt({ ...attempt(12), itemsRead: -1 })).toBe(false)
      expect(observer.attempt({ ...attempt(13), itemsWritten: Number.NaN })).toBe(false)
      expect(observer.attempt({ ...attempt(14), duplicatesPrevented: -1 })).toBe(false)
      return success()
    })

    expect(sink.metrics.filter(metric => metric.event === 'attempt')).toHaveLength(8)
    expect(terminals(sink)).toHaveLength(1)
    expect(terminals(sink)[0]).toMatchObject({ attemptCount: 8 })
  })

  test('@smoke a throwing sink changes neither returned results nor thrown errors', async () => {
    const throwingSink: ScrapeMetricSink = { emit: () => { throw new Error('metrics unavailable') } }
    const expectedResult = success()
    const returned = await observeScrape({ request, identifiers: await identifiers(), sink: throwingSink }, async observer => {
      observer.attempt(attempt())
      return expectedResult
    })
    expect(returned).toBe(expectedResult)

    const expectedError = new Error('route failure')
    let caught: unknown
    try {
      await observeScrape({ request, identifiers: await identifiers(), sink: throwingSink }, async () => { throw expectedError })
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(expectedError)

    const rejectingSink: ScrapeMetricSink = {
      emit: () => Promise.reject(new Error('async metrics unavailable')),
    }
    const asynchronouslyObserved = await observeScrape(
      { request, identifiers: await identifiers(), sink: rejectingSink },
      async observer => {
        observer.attempt(attempt())
        return expectedResult
      },
    )
    expect(asynchronouslyObserved).toBe(expectedResult)
    await Promise.resolve()
  })

  test('@smoke malformed caller-supplied identifiers fail closed', async () => {
    const sink = new RecordingScrapeMetricSink()
    const rawIdentifiers = {
      requestId: REQUEST_ID,
      tenantId: 'workspace-sensitive-42',
      urlId: request.target.url,
      domainId: 'not-emitted.example.test',
    }

    const result = success([])
    const returned = await observeScrape(
      { request, identifiers: rawIdentifiers as never, sink },
      async observer => {
        expect(observer.attempt(attempt())).toBe(true)
        return result
      },
    )

    expect(returned).toBe(result)
    expect(sink.metrics).toHaveLength(0)
  })
})
