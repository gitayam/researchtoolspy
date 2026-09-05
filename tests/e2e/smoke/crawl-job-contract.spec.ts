import { expect, test } from '@playwright/test'
import {
  CRAWL_JOB_SCHEMA_VERSION,
  CRAWL_REQUEST_SCHEMA_VERSION,
  buildCrawlRequestIdentity,
  canTransitionCrawlJob,
  canTransitionCrawlRequest,
  canonicalizeCrawlUrl,
  isValidCrawlJob,
  isValidCrawlRequest,
  type CrawlJobV1,
  type CrawlRequestV1,
} from '../../../functions/api/_shared/crawl-job-contract'

const job: CrawlJobV1 = {
  schemaVersion: CRAWL_JOB_SCHEMA_VERSION,
  id: 'crawl-job:01',
  requestedBy: 42,
  workspaceId: 'workspace:01',
  purpose: 'search',
  seedUrl: 'https://news.example.com/investigation',
  allowedDomains: ['example.com'],
  includeSubdomains: true,
  status: 'queued',
  limits: {
    maxPages: 100,
    maxDepth: 3,
    maxResponseBytes: 2 * 1024 * 1024,
    maxDurationMs: 15 * 60 * 1_000,
    maxBrowserSeconds: 60,
    maxCostUsd: 0.10,
  },
  createdAt: '2026-09-04T12:00:00.000Z',
  updatedAt: '2026-09-04T12:00:00.000Z',
  expiresAt: '2026-09-05T12:00:00.000Z',
}

async function requestFixture(): Promise<CrawlRequestV1> {
  const identity = await buildCrawlRequestIdentity('https://news.example.com/story#comments', 'direct')
  return {
    schemaVersion: CRAWL_REQUEST_SCHEMA_VERSION,
    id: 'crawl-request:01',
    jobId: job.id,
    ...identity,
    depth: 1,
    strategy: 'direct',
    status: 'pending',
    attemptCount: 0,
    maxAttempts: 3,
    availableAt: '2026-09-04T12:00:00.000Z',
  }
}

test.describe('crawl job and request contract @smoke', () => {
  test('@smoke builds a stable fragment-free strategy identity', async () => {
    const first = await buildCrawlRequestIdentity('https://EXAMPLE.com:443/story#one', 'direct')
    const second = await buildCrawlRequestIdentity('https://example.com/story#two', 'direct')
    const rendered = await buildCrawlRequestIdentity('https://example.com/story', 'browser-renderer')
    expect(first).toEqual(second)
    expect(first.canonicalUrl).toBe('https://example.com/story')
    expect(first.uniqueKey).toMatch(/^[a-f0-9]{64}$/)
    expect(rendered.uniqueKey).not.toBe(first.uniqueKey)
    expect(() => canonicalizeCrawlUrl('http://127.0.0.1/private')).toThrow()
  })

  test('@smoke validates owned bounded jobs and denies scope expansion', () => {
    expect(isValidCrawlJob(job)).toBe(true)
    expect(isValidCrawlJob({ ...job, allowedDomains: ['other.example'] })).toBe(false)
    expect(isValidCrawlJob({ ...job, limits: { ...job.limits, maxPages: 1001 } })).toBe(false)
    expect(isValidCrawlJob({ ...job, purpose: 'search', requestedBy: 0 })).toBe(false)
  })

  test('@smoke validates pending and complete leased requests', async () => {
    const request = await requestFixture()
    expect(isValidCrawlRequest(request)).toBe(true)
    expect(isValidCrawlRequest({ ...request, canonicalUrl: `${request.canonicalUrl}#fragment` })).toBe(false)
    expect(isValidCrawlRequest({ ...request, domainKey: 'other.example' })).toBe(false)
    expect(isValidCrawlRequest({ ...request, status: 'leased' })).toBe(false)
    expect(isValidCrawlRequest({ ...request, leasedAt: '2026-09-04T12:00:00.000Z' })).toBe(false)
    expect(isValidCrawlRequest({
      ...request,
      status: 'leased',
      leaseToken: 'lease:01',
      leasedAt: '2026-09-04T12:00:00.000Z',
      leaseExpiresAt: '2026-09-04T12:01:00.000Z',
    })).toBe(true)
  })

  test('@smoke permits retries through pending but keeps terminal states terminal', () => {
    expect(canTransitionCrawlRequest('pending', 'leased')).toBe(true)
    expect(canTransitionCrawlRequest('leased', 'pending')).toBe(true)
    expect(canTransitionCrawlRequest('leased', 'succeeded')).toBe(true)
    expect(canTransitionCrawlRequest('succeeded', 'pending')).toBe(false)
    expect(canTransitionCrawlJob('queued', 'running')).toBe(true)
    expect(canTransitionCrawlJob('running', 'partial')).toBe(true)
    expect(canTransitionCrawlJob('succeeded', 'running')).toBe(false)
  })
})
