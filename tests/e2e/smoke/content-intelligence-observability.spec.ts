import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  observeContentIntelligenceExtraction,
  type ExtractionAttemptObservation,
} from '../../../functions/api/content-intelligence/_scrape-observability'

const RAW_URL = 'https://private.example.test/article?token=secret'
const RAW_TENANT = 'workspace-sensitive-42'

const directAttempt: ExtractionAttemptObservation = {
  stage: 'fetch',
  strategy: 'direct',
  provider: 'none',
  outcome: 'succeeded',
  httpStatusClass: '2xx',
  contentTypeClass: 'html',
  durationMs: 25,
  responseBytes: 4096,
  extractedWords: 240,
}

function options(points: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    requestId: '018f6d5e-4d58-7ef0-8d12-a4e3aee55301',
    url: RAW_URL,
    tenantScope: RAW_TENANT,
    telemetryKey: 'dedicated-telemetry-key',
    analytics: { writeDataPoint: (point: unknown) => { points.push(point) } },
    ...overrides,
  }
}

test.describe('content-intelligence production observability @smoke', () => {
  test('@smoke emits one attempt and exactly one terminal without raw identifiers', async () => {
    const points: Array<{ blobs?: string[]; doubles?: number[] }> = []
    const result = await observeContentIntelligenceExtraction(options(points), async record => {
      record(directAttempt)
      return {
        success: true,
        text: 'validated article evidence '.repeat(240),
        title: 'Observed article',
        source: 'original',
      }
    })

    expect(result.success).toBe(true)
    expect(points).toHaveLength(2)
    expect(points[0].blobs?.slice(1, 9)).toEqual([
      'attempt', 'content-intelligence', 'article-analysis', 'fetch',
      'direct', 'none', 'succeeded', 'none',
    ])
    expect(points[1].blobs?.slice(1, 8)).toEqual([
      'terminal', 'content-intelligence', 'article-analysis', 'succeeded',
      'none', 'fetch', 'direct',
    ])
    expect(points[1].doubles?.slice(0, 2)).toEqual([1, 1])
    const serialized = JSON.stringify(points)
    expect(serialized).not.toContain(RAW_URL)
    expect(serialized).not.toContain(RAW_TENANT)
    expect(serialized).not.toContain('secret')
  })

  test('@smoke records fallback recovery and terminal failure classifications', async () => {
    const recovered: Array<{ blobs?: string[]; doubles?: number[] }> = []
    await observeContentIntelligenceExtraction(options(recovered), async record => {
      record({ ...directAttempt, outcome: 'failed', errorCode: 'upstream_4xx', httpStatusClass: '4xx' })
      record({
        ...directAttempt,
        stage: 'archive',
        strategy: 'archive',
        provider: 'archive',
      })
      return { success: true, text: 'archive evidence '.repeat(240), source: 'wayback' }
    })

    expect(recovered).toHaveLength(3)
    expect(recovered[2].blobs?.slice(4, 8)).toEqual(['succeeded', 'none', 'archive', 'archive'])
    expect(recovered[2].doubles?.[1]).toBe(2)

    const failed: Array<{ blobs?: string[] }> = []
    await observeContentIntelligenceExtraction(options(failed), async record => {
      record({ ...directAttempt, outcome: 'failed', errorCode: 'timeout', httpStatusClass: 'none' })
      return { success: false, text: '', errorCode: 'timeout' }
    })
    expect(failed).toHaveLength(2)
    expect(failed[1].blobs?.slice(4, 8)).toEqual(['failed', 'timeout', 'fetch', 'direct'])
  })

  test('@smoke missing or failed telemetry never changes extraction', async () => {
    for (const overrides of [
      { telemetryKey: undefined },
      { analytics: undefined },
      { analytics: { writeDataPoint: () => { throw new Error('dataset unavailable') } } },
    ]) {
      const points: unknown[] = []
      const expected = { success: true, text: 'safe extraction '.repeat(180), source: 'original' }
      const returned = await observeContentIntelligenceExtraction(
        options(points, overrides),
        async record => {
          record(directAttempt)
          return expected
        },
      )
      expect(returned).toBe(expected)
    }
  })

  test('@smoke route and fallback chain are wired to the observer', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'functions/api/content-intelligence/analyze-url.ts'),
      'utf8',
    )
    expect(source).toContain('observeContentIntelligenceExtraction({')
    expect(source).toContain('observeAttempt(originalStartedAt, originalResult')
    expect(source).toContain("strategy: 'archive'")
    expect(source).toContain("strategy: 'provider'")
  })
})
