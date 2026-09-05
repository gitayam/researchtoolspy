import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import {
  normalizeWebScrapeError,
  observeWebScrapeRequest,
  scrapeContentTypeClass,
  scrapeHttpStatusClass,
} from '../../../functions/api/_shared/web-scraper-observability'
import type { AnalyticsEngineDataPoint } from '../../../functions/api/_shared/scrape-metrics'

const options = {
  requestId: 'request-123',
  url: 'https://private-source.example/article?secret=value',
  tenantScope: 'user-42',
  extractMode: 'metadata' as const,
  telemetryKey: 'dedicated-telemetry-key',
}

test.describe('web scraper observability @smoke', () => {
  test('@smoke emits each executed stage and exactly one terminal metric', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    const response = await observeWebScrapeRequest({
      ...options,
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'succeeded',
        httpStatusClass: '2xx', contentTypeClass: 'html', durationMs: 12, responseBytes: 2048,
      })
      recordAttempt({
        stage: 'extract', strategy: 'direct', provider: 'none', outcome: 'succeeded',
        contentTypeClass: 'text', durationMs: 3, extractedWords: 450,
      })
      return {
        response: Response.json({ success: true }),
        qualityScore: 0.85,
        accepted: true,
      }
    })

    expect(response.status).toBe(200)
    expect(points).toHaveLength(3)
    expect(points.map(point => point.blobs?.[1])).toEqual(['attempt', 'attempt', 'terminal'])
    expect(points[0].blobs?.slice(2, 11)).toEqual([
      'web-scraper', 'metadata', 'fetch', 'direct', 'none', 'succeeded',
      'none', '2xx', 'html',
    ])
    expect(points[1].blobs?.[4]).toBe('extract')
    expect(points[2].doubles?.[1]).toBe(2)
    expect(points[2].doubles?.[3]).toBe(0.85)
    expect(points[2].doubles?.[4]).toBe(1)

    const serialized = JSON.stringify(points)
    expect(serialized).not.toContain(options.url)
    expect(serialized).not.toContain('secret=value')
    expect(serialized).not.toContain(options.tenantScope)
    expect(serialized).not.toContain(options.requestId)
    expect(points[0].indexes?.[0]).toMatch(/^[a-f0-9]{64}$/)
  })

  test('@smoke preserves failed responses and emits one failed terminal', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    const response = await observeWebScrapeRequest({
      ...options,
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'failed',
        errorCode: 'timeout', durationMs: 15_000,
      })
      return {
        response: Response.json({ success: false, errorType: 'timeout' }, { status: 504 }),
        accepted: false,
      }
    })

    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({ errorType: 'timeout' })
    expect(points).toHaveLength(2)
    expect(points[1].blobs?.slice(1, 8)).toEqual([
      'terminal', 'web-scraper', 'metadata', 'failed', 'timeout', 'fetch', 'direct',
    ])
  })

  test('@smoke separates metadata and text extraction in the purpose dimension', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    await observeWebScrapeRequest({
      ...options,
      extractMode: 'full',
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'succeeded', durationMs: 1,
      })
      return { response: Response.json({ success: true }) }
    })
    expect(points[0].blobs?.[3]).toBe('structured-extraction')
    expect(points[1].blobs?.[3]).toBe('structured-extraction')
  })

  test('@smoke analytics failure and missing configuration never alter behavior', async () => {
    const throwing = await observeWebScrapeRequest({
      ...options,
      analytics: { writeDataPoint: () => { throw new Error('analytics unavailable') } },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'succeeded', durationMs: 1,
      })
      return { response: new Response('unchanged', { status: 202 }) }
    })
    expect(throwing.status).toBe(202)
    expect(await throwing.text()).toBe('unchanged')

    let callbackRan = false
    const disabled = await observeWebScrapeRequest({
      ...options,
      telemetryKey: undefined,
      analytics: { writeDataPoint: () => { throw new Error('must not write') } },
    }, async () => {
      callbackRan = true
      return { response: new Response('disabled') }
    })
    expect(callbackRan).toBe(true)
    expect(await disabled.text()).toBe('disabled')
  })

  test('@smoke thrown route failures still emit exactly one terminal metric', async () => {
    const points: AnalyticsEngineDataPoint[] = []
    await expect(observeWebScrapeRequest({
      ...options,
      analytics: { writeDataPoint: point => points.push(point) },
    }, async recordAttempt => {
      recordAttempt({
        stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'succeeded', durationMs: 2,
      })
      throw new Error('parser detail that must not enter analytics')
    })).rejects.toThrow('parser detail that must not enter analytics')

    expect(points.map(point => point.blobs?.[1])).toEqual(['attempt', 'terminal'])
    expect(points[1].blobs?.[4]).toBe('failed')
    expect(points[1].blobs?.[5]).toBe('internal_error')
    expect(JSON.stringify(points)).not.toContain('parser detail')
  })

  test('@smoke normalizes only closed taxonomy values', () => {
    expect(normalizeWebScrapeError({ code: 'unsafe_url' })).toBe('policy_denied')
    expect(normalizeWebScrapeError({ code: 'dns_resolution_failed' })).toBe('dns_denied')
    expect(normalizeWebScrapeError({ code: 'network_error' })).toBe('upstream_5xx')
    expect(normalizeWebScrapeError(new Error('raw private message'))).toBe('internal_error')
    expect(scrapeHttpStatusClass(204)).toBe('2xx')
    expect(scrapeHttpStatusClass(503)).toBe('5xx')
    expect(scrapeContentTypeClass('text/html; charset=utf-8')).toBe('html')
    expect(scrapeContentTypeClass('application/json')).toBe('json')
  })

  test('@smoke route remains wired to the shared observer around bounded fetch', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/web-scraper.ts'), 'utf8')
    const runbook = readFileSync(resolve(process.cwd(), 'docs/operations/SCRAPING_OBSERVABILITY.md'), 'utf8')
    const apiDoc = readFileSync(resolve(process.cwd(), 'docs/api/SCRAPING-API.md'), 'utf8')
    const observer = source.indexOf('return observeWebScrapeRequest({')
    const fetch = source.indexOf('await safeFetchText(url,', observer)
    const success = source.indexOf('metadata_completeness_score', fetch)
    expect(observer).toBeGreaterThan(0)
    expect(fetch).toBeGreaterThan(observer)
    expect(success).toBeGreaterThan(fetch)
    expect(source).toContain('SCRAPE_ANALYTICS?: AnalyticsEngineLike')
    expect(source).toContain('SCRAPE_TELEMETRY_KEY?: string')
    expect(source).toContain("error: 'Invalid extract_mode'")
    expect(source).toContain("error: 'Invalid create_dataset'")
    expect(source).toContain("import { extractArticle } from './_shared/article-extractor'")
    expect(source).toContain('const article = extractArticle(html, finalUrl.href)')
    expect(source).toContain('extractor_version: article.extractorVersion')
    expect(source).not.toContain('// Extract metadata using regex')
    expect(runbook).toContain('`POST /api/web-scraper`')
    expect(runbook).toContain('All accepted invocations emit exactly one')
    expect(apiDoc).toContain('exactly one terminal outcome')
  })
})
