import { expect, test } from '@playwright/test'
import { assertApifyIdentifier, fetchApifyJson } from '../../../functions/api/_shared/apify-client'

test.describe('fixed-host Apify client @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke constructs only the fixed provider origin and keeps credentials on a manual request', async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ headers: Headers; redirect?: RequestRedirect; url: string }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ headers: new Headers(init?.headers), redirect: init?.redirect, url: String(input) })
      return Response.json({ data: { id: 'run-1', status: 'RUNNING' } })
    }) as typeof fetch
    try {
      const response = await fetchApifyJson('provider-secret', {
        path: ['acts', 'apidojo~tweet-scraper', 'runs'],
        method: 'POST',
        searchParams: { waitForFinish: 60 },
        body: { maxItems: 1 },
      })
      expect(response.ok).toBe(true)
      expect(calls).toHaveLength(1)
      expect(new URL(calls[0].url)).toMatchObject({ hostname: 'api.apify.com', pathname: '/v2/acts/apidojo~tweet-scraper/runs' })
      expect(calls[0].redirect).toBe('manual')
      expect(calls[0].headers.get('authorization')).toBe('Bearer provider-secret')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke rejects redirects, oversized JSON, and unsafe provider identifiers', async () => {
    const originalFetch = globalThis.fetch
    let calls = 0
    try {
      globalThis.fetch = (async () => {
        calls += 1
        return new Response(null, { status: 302, headers: { Location: 'https://evil.example/token' } })
      }) as typeof fetch
      await expect(fetchApifyJson('provider-secret', { path: ['actor-runs', 'run-1'] }))
        .rejects.toThrow('Apify redirects are not allowed')
      expect(calls).toBe(1)

      globalThis.fetch = (async () => new Response('{}', {
        headers: { 'Content-Type': 'application/json', 'Content-Length': '1025' },
      })) as typeof fetch
      await expect(fetchApifyJson('provider-secret', {
        path: ['actor-runs', 'run-1'],
        maxResponseBytes: 1024,
      })).rejects.toThrow('Apify response exceeds byte limit')

      expect(() => assertApifyIdentifier('../token', 'run ID')).toThrow('Invalid Apify run ID')
      await expect(fetchApifyJson('provider-secret', { path: ['actor-runs', '../token'] }))
        .rejects.toThrow('Invalid Apify path segment')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
