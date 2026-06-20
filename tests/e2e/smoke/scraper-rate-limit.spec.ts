/**
 * Apify COP scraper rate-limit path matcher smoke test (pure-Node, no browser,
 * no HTTP server).
 *
 * Proves the exported `isApifyScraperPath` helper from
 * functions/api/_middleware.ts matches ONLY the paid Apify COP scraper endpoint
 * (POST /api/cop/<id>/scrape) and not the cheaper "scrape"-named endpoints that
 * are covered elsewhere, nor other COP sub-routes.
 *
 * This imports the helper directly — no `page` fixture, no running server.
 */
import { test, expect } from '@playwright/test'
import { isApifyScraperPath } from '../../../functions/api/_middleware'

test.describe('Apify scraper rate-limit path matcher @smoke', () => {
  test('@smoke matches the paid COP Apify scraper POST path', () => {
    expect(isApifyScraperPath('/api/cop/abc-123/scrape')).toBe(true)
  })

  test('@smoke does NOT match /api/tools/scrape-metadata (cheaper / covered elsewhere)', () => {
    expect(isApifyScraperPath('/api/tools/scrape-metadata')).toBe(false)
  })

  test('@smoke does NOT match /api/ai/scrape-url (covered by AI limiter)', () => {
    expect(isApifyScraperPath('/api/ai/scrape-url')).toBe(false)
  })

  test('@smoke does NOT match /api/web-scraper', () => {
    expect(isApifyScraperPath('/api/web-scraper')).toBe(false)
  })

  test('@smoke does NOT match other COP sub-routes (e.g. markers)', () => {
    expect(isApifyScraperPath('/api/cop/abc-123/markers')).toBe(false)
  })
})
