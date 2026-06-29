/**
 * URL-enrichment pure helpers (pure-Node, no browser, no HTTP server).
 *
 * E-14: COP public intake now runs the SAME background URL-enrichment as System A
 * surveys submit, via the shared `functions/api/_shared/url-enrichment.ts` module.
 * The network-bound part (`enrichResponseUrls`) is not unit-tested here; instead we
 * pin the two pure pieces it is built from:
 *   - `urlFieldsFromSchema` — which schema fields get enriched
 *   - `enrichmentRecord`    — the `_enriched_<field>` record shape written to form_data
 * If either drifts, COP and surveys enrichment would diverge or write a bad shape.
 */
import { test, expect } from '@playwright/test'
import {
  urlFieldsFromSchema,
  enrichmentRecord,
} from '../../../functions/api/_shared/url-enrichment'
import type { ScrapedContent } from '../../../functions/api/_shared/scraper-utils'

test.describe('URL enrichment pure helpers @smoke', () => {
  test('@smoke urlFieldsFromSchema returns only url-type field names', () => {
    const schema = [
      { name: 'source_url', type: 'url', label: 'Source link' },
      { name: 'description', type: 'textarea' },
      { name: 'evidence_url', type: 'url' },
      { name: 'count', type: 'number' },
    ]

    expect(urlFieldsFromSchema(schema)).toEqual(['source_url', 'evidence_url'])
  })

  test('@smoke urlFieldsFromSchema returns [] when there are no url fields', () => {
    const schema = [
      { name: 'description', type: 'textarea' },
      { name: 'count', type: 'number' },
    ]

    expect(urlFieldsFromSchema(schema)).toEqual([])
  })

  test('@smoke urlFieldsFromSchema tolerates empty / non-array schema', () => {
    expect(urlFieldsFromSchema([])).toEqual([])
    expect(urlFieldsFromSchema(undefined)).toEqual([])
    expect(urlFieldsFromSchema(null)).toEqual([])
    // A malformed entry (no name) is skipped, not crashed on.
    expect(urlFieldsFromSchema([{ type: 'url' }, null, { name: 'ok', type: 'url' }])).toEqual(['ok'])
  })

  test('@smoke enrichmentRecord shapes the full record with scrape + analysis', () => {
    const scraped: ScrapedContent = {
      title: 'Breaking: incident report',
      content: 'A'.repeat(1000), // longer than the 500-char excerpt cap
    }
    const analysis = {
      id: 'an-123',
      summary: 'B'.repeat(1000), // longer than the 300-char summary cap
      word_count: 742,
      content_source: 'apify',
    }

    const rec = enrichmentRecord('source_url', 'https://example.com/post/1', scraped, analysis)

    expect(rec.field).toBe('source_url')
    expect(rec.url).toBe('https://example.com/post/1')
    expect(rec.title).toBe('Breaking: incident report')
    expect((rec.excerpt as string).length).toBe(500) // capped at 500
    expect(rec.analysis_id).toBe('an-123')
    expect((rec.summary as string).length).toBe(300) // capped at 300
    expect(rec.word_count).toBe(742)
    expect(rec.content_source).toBe('apify')
    expect(typeof rec.fetched_at).toBe('string')
  })

  test('@smoke enrichmentRecord falls back to analysis_id from analysis_id key', () => {
    const scraped: ScrapedContent = { title: 't', content: 'c' }
    const rec = enrichmentRecord('u', 'https://x.test', scraped, {
      analysis_id: 'fallback-id',
      summary: 'short',
      word_count: 3,
      content_source: 'fetch',
    })

    expect(rec.analysis_id).toBe('fallback-id')
  })

  test('@smoke enrichmentRecord tolerates missing analysis (no analysis fields set)', () => {
    const scraped: ScrapedContent = { title: 'Just a title', content: 'body text' }

    const rec = enrichmentRecord('source_url', 'https://example.com', scraped, null)

    expect(rec.field).toBe('source_url')
    expect(rec.url).toBe('https://example.com')
    expect(rec.title).toBe('Just a title')
    expect(rec.excerpt).toBe('body text')
    expect(typeof rec.fetched_at).toBe('string')
    // No analysis → analysis-derived keys are absent (not undefined-valued noise).
    expect(rec).not.toHaveProperty('analysis_id')
    expect(rec).not.toHaveProperty('summary')
    expect(rec).not.toHaveProperty('word_count')
    expect(rec).not.toHaveProperty('content_source')
  })

  test('@smoke enrichmentRecord tolerates missing scrape content (undefined excerpt)', () => {
    const scraped = { title: 'Only title' } as unknown as ScrapedContent

    const rec = enrichmentRecord('u', 'https://x.test', scraped, null)

    expect(rec.title).toBe('Only title')
    expect(rec.excerpt).toBeUndefined()
  })
})
