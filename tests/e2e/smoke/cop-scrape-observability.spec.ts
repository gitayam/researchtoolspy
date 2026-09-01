import { expect, test } from '@playwright/test'
import { observeCopScrapeRequest } from '../../../functions/api/cop/[id]/_scrape-observability'

const RAW_TENANT = 'workspace-sensitive-42'
const RAW_FINGERPRINT = `scrape-request:v1:${'a'.repeat(64)}`

function options(points: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    requestId: crypto.randomUUID(),
    requestFingerprint: RAW_FINGERPRINT,
    tenantScope: RAW_TENANT,
    telemetryKey: 'dedicated-test-telemetry-key',
    analytics: { writeDataPoint: (point: unknown) => { points.push(point) } },
    ...overrides,
  }
}

test.describe('COP provider-job observability @smoke', () => {
  test('@smoke emits bounded provider counts and one privacy-safe terminal', async () => {
    const points: Array<{ blobs?: string[]; doubles?: number[] }> = []
    const response = await observeCopScrapeRequest(options(points), async record => {
      record({
        stage: 'provider',
        strategy: 'provider',
        provider: 'apify',
        outcome: 'succeeded',
        httpStatusClass: '2xx',
        contentTypeClass: 'json',
        durationMs: 25,
        itemsRead: 12,
      })
      record({
        stage: 'extract',
        strategy: 'provider',
        provider: 'internal',
        outcome: 'succeeded',
        durationMs: 5,
        itemsRead: 12,
        itemsWritten: 10,
        duplicatesPrevented: 2,
      })
      return Response.json({ status: 'completed' })
    })

    expect(response.status).toBe(200)
    expect(points).toHaveLength(3)
    expect(points[0].blobs?.slice(1, 8)).toEqual([
      'attempt', 'cop-scrape', 'social-collection', 'provider',
      'provider', 'apify', 'succeeded',
    ])
    expect(points[1].doubles?.slice(5, 8)).toEqual([12, 10, 2])
    expect(points[2].blobs?.slice(1, 8)).toEqual([
      'terminal', 'cop-scrape', 'social-collection', 'succeeded',
      'none', 'extract', 'provider',
    ])
    const serialized = JSON.stringify(points)
    expect(serialized).not.toContain(RAW_TENANT)
    expect(serialized).not.toContain(RAW_FINGERPRINT)
  })

  test('@smoke records paid-request deduplication without a provider attempt', async () => {
    const points: Array<{ blobs?: string[]; doubles?: number[] }> = []
    await observeCopScrapeRequest(options(points), async record => {
      record({
        stage: 'cache',
        strategy: 'cache',
        provider: 'internal',
        outcome: 'succeeded',
        durationMs: 1,
        duplicatesPrevented: 1,
      })
      return Response.json({ deduplicated: true }, { status: 202 })
    })

    expect(points).toHaveLength(2)
    expect(points[0].doubles?.[7]).toBe(1)
    expect(points[1].blobs?.[7]).toBe('cache')
  })

  test('@smoke failed provider attempts produce a failed terminal while preserving the response', async () => {
    const points: Array<{ blobs?: string[] }> = []
    const response = await observeCopScrapeRequest(options(points), async record => {
      record({
        stage: 'provider',
        strategy: 'provider',
        provider: 'apify',
        outcome: 'failed',
        errorCode: 'rate_limited',
        httpStatusClass: '4xx',
        contentTypeClass: 'json',
        durationMs: 10,
      })
      return Response.json({ error: 'Failed to start scraper' }, { status: 502 })
    })

    expect(response.status).toBe(502)
    expect(points).toHaveLength(2)
    expect(points[1].blobs?.slice(4, 8)).toEqual(['failed', 'rate_limited', 'provider', 'provider'])
  })

  test('@smoke unavailable analytics never changes the paid-job response', async () => {
    for (const overrides of [
      { telemetryKey: undefined },
      { analytics: undefined },
      { analytics: { writeDataPoint: () => { throw new Error('analytics unavailable') } } },
    ]) {
      const response = await observeCopScrapeRequest(options([], overrides), async record => {
        record({
          stage: 'provider', strategy: 'provider', provider: 'apify',
          outcome: 'succeeded', durationMs: 1,
        })
        return Response.json({ status: 'running' }, { status: 202 })
      })
      expect(response.status).toBe(202)
    }
  })
})
