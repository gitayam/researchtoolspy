/**
 * URL-enrichment pure helpers (pure-Node, no browser, no HTTP server).
 *
 * E-14: COP public intake now runs the SAME background URL-enrichment as System A
 * surveys submit, via the shared `functions/api/_shared/url-enrichment.ts` module.
 * Pins the pure record helpers plus the public network boundary:
 *   - `urlFieldsFromSchema` — which schema fields get enriched
 *   - `enrichmentRecord`    — the `_enriched_<field>` record shape written to form_data
 * If either drifts, COP and surveys enrichment would diverge or write a bad shape.
 */
import { test, expect } from '@playwright/test'
import {
  urlFieldsFromSchema,
  enrichmentRecord,
  enrichResponseUrls,
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

function dnsResponse(type: string, addresses: string[]): Response {
  const expectedType = type === 'AAAA' ? 28 : 1
  return Response.json({
    Status: 0,
    Answer: addresses.map(data => ({ type: expectedType, data })),
  })
}

function enrichmentDb(updates: string[]): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              return sql.includes('SELECT form_data') ? { form_data: '{}' } : null
            },
            async run() {
              if (sql.includes('UPDATE survey_responses')) updates.push(String(values[0]))
              return { success: true }
            },
          }
        },
      }
    },
  } as unknown as D1Database
}

test.describe('public URL enrichment network boundary @smoke', () => {
  test('@smoke uses bounded static fetch and ephemeral analysis without provider, renderer, or fake auth', async () => {
    const originalFetch = globalThis.fetch
    const updates: string[] = []
    const targetUrls: string[] = []
    let analysisInit: RequestInit | undefined
    let rendererCalls = 0

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        return dnsResponse(url.searchParams.get('type') || 'A',
          url.searchParams.get('type') === 'A' ? ['93.184.216.34'] : [])
      }
      if (url.href === 'https://public.example/article') {
        targetUrls.push(url.href)
        return new Response(`<!doctype html><html><head><title>Public report</title></head><body><main><h1>Public report</h1><p>${'bounded evidence '.repeat(80)}</p></main></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      }
      if (url.href === 'https://researchtools.test/api/content-intelligence/analyze-url') {
        analysisInit = init
        return Response.json({
          title: 'Analyzed report',
          summary: 'An ephemeral summary',
          word_count: 160,
          content_source: 'original',
          is_persisted: false,
        })
      }
      throw new Error(`Unexpected fetch: ${url.href}`)
    }) as typeof fetch

    try {
      await enrichResponseUrls({
        env: {
          DB: enrichmentDb(updates),
          APIFY_API_KEY: 'must-not-be-used',
          BROWSER_RENDERER: {
            async fetch() {
              rendererCalls += 1
              return Response.json({ markdown: 'must not render' })
            },
          },
        } as never,
        origin: 'https://researchtools.test',
        responseId: 'response-1',
        formSchema: [{ name: 'source_url', type: 'url' }],
        formData: { source_url: 'https://public.example/article' },
      })

      expect(targetUrls).toEqual(['https://public.example/article'])
      expect(rendererCalls).toBe(0)
      expect(analysisInit?.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(String(analysisInit?.body))).toEqual({
        url: 'https://public.example/article',
        mode: 'quick',
        save_link: false,
      })
      expect(updates).toHaveLength(1)
      const stored = JSON.parse(updates[0])
      expect(stored._enriched_source_url).toMatchObject({
        url: 'https://public.example/article',
        summary: 'An ephemeral summary',
        content_source: 'original',
      })
      expect(stored._enriched_source_url).not.toHaveProperty('analysis_id')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke denies mixed public/private DNS before public enrichment target transport', async () => {
    const originalFetch = globalThis.fetch
    let targetCalls = 0
    let rendererCalls = 0

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        return dnsResponse(url.searchParams.get('type') || 'A',
          url.searchParams.get('type') === 'A' ? ['93.184.216.34', '10.0.0.8'] : [])
      }
      if (url.hostname === 'mixed.example') {
        targetCalls += 1
        return new Response('must not fetch')
      }
      if (url.pathname === '/api/content-intelligence/analyze-url') {
        return Response.json({ error: 'denied' }, { status: 400 })
      }
      throw new Error(`Unexpected fetch: ${url.href}`)
    }) as typeof fetch

    try {
      await enrichResponseUrls({
        env: {
          DB: enrichmentDb([]),
          APIFY_API_KEY: 'must-not-be-used',
          BROWSER_RENDERER: {
            async fetch() {
              rendererCalls += 1
              return new Response('must not render')
            },
          },
        } as never,
        origin: 'https://researchtools.test',
        responseId: 'response-2',
        formSchema: [{ name: 'source_url', type: 'url' }],
        formData: { source_url: 'https://mixed.example/private' },
      })

      expect(targetCalls).toBe(0)
      expect(rendererCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
