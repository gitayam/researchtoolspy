import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const root = process.cwd()

test.describe('web scraper API documentation contract @smoke', () => {
  const apiIndex = readFileSync(resolve(root, 'docs/api/API.md'), 'utf8')
  const scrapingApi = readFileSync(resolve(root, 'docs/api/SCRAPING-API.md'), 'utf8')
  const implementation = readFileSync(resolve(root, 'functions/api/web-scraper.ts'), 'utf8')

  test('@smoke API index links the scraper reference', () => {
    expect(apiIndex).toContain('POST /api/web-scraper')
    expect(apiIndex).toContain('[`SCRAPING-API.md`](SCRAPING-API.md)')
  })

  test('@smoke documents the current score and dataset semantics', () => {
    expect(scrapingApi).toContain('`metadata_completeness_score`')
    expect(scrapingApi).toContain('It is not source credibility or information reliability.')
    expect(scrapingApi).toContain('It is not copied into `reliability_rating`')
    expect(implementation).toContain('metadata_completeness_score')
    expect(implementation).not.toContain('reliability_score')
  })

  test('@smoke documents enforced transport limits', () => {
    expect(scrapingApi).toContain('maximum 5')
    expect(scrapingApi).toContain('15 seconds')
    expect(scrapingApi).toContain('2 MiB')
    expect(implementation).toContain('timeoutMs: 15_000')
    expect(implementation).toContain('maxRedirects: 5')
    expect(implementation).toContain('maxResponseBytes: 2 * 1024 * 1024')
  })
})
