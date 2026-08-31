import { expect, test } from '@playwright/test'
import { onRequestPost as scrapeMetadataPost } from '../../../functions/api/tools/scrape-metadata'
import { onRequestPost as extractPost } from '../../../functions/api/tools/extract'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function context(request: Request) {
  return {
    request,
    env: { SESSIONS: sessions as unknown as KVNamespace },
    params: {},
  }
}

function routeRequest(path: string, body: Record<string, unknown>, authenticated = true): Request {
  return new Request(`https://researchtools.example${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? {
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
        'X-User-Hash': '0123456789abcdef',
      } : {}),
    },
    body: JSON.stringify(body),
  })
}

interface NetworkMockOptions {
  addresses?: { A?: string[]; AAAA?: string[] }
  target: (url: URL, init?: RequestInit) => Promise<Response> | Response
}

function installNetworkMock(options: NetworkMockOptions): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      const recordType = type === 'AAAA' ? 28 : 1
      const defaults = type === 'AAAA' ? ['2606:2800:220:1:248:1893:25c8:1946'] : ['93.184.216.34']
      const addresses = options.addresses?.[type] ?? defaults
      return Response.json({
        Status: 0,
        Answer: addresses.map(data => ({ type: recordType, data })),
      })
    }
    return await options.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

test.describe('tool routes use bounded outbound adapters @smoke', () => {
  test('@smoke preserves authentication and successful metadata/extraction response shapes', async () => {
    const externalHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (_url, init) => {
        externalHeaders.push(new Headers(init?.headers))
        return new Response(`<!doctype html>
          <html><head><title>Bounded Article | Example</title>
          <meta name="author" content="Alice Example">
          <meta name="description" content="Adapter response">
          </head><body>Bounded route content for extraction.</body></html>`, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      },
    })

    try {
      const unauthenticatedMetadata = await scrapeMetadataPost(context(routeRequest(
        '/api/tools/scrape-metadata', { url: 'https://public.example/article' }, false,
      )) as never)
      const unauthenticatedExtract = await extractPost(context(routeRequest(
        '/api/tools/extract', { url: 'https://public.example/article' }, false,
      )) as never)
      expect(unauthenticatedMetadata.status).toBe(401)
      expect(await unauthenticatedMetadata.json()).toEqual({ error: 'Authentication required' })
      expect(unauthenticatedExtract.status).toBe(401)
      expect(await unauthenticatedExtract.json()).toEqual({ error: 'Authentication required' })

      const metadataResponse = await scrapeMetadataPost(context(routeRequest(
        '/api/tools/scrape-metadata', { url: 'https://public.example/article' },
      )) as never)
      const metadata = await metadataResponse.json()
      expect(metadataResponse.status).toBe(200)
      expect(metadata).toMatchObject({
        success: true,
        title: 'Bounded Article',
        author: 'Alice Example',
        description: 'Adapter response',
        url: 'https://public.example/article',
      })
      expect(metadata.accessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      const extractResponse = await extractPost(context(routeRequest(
        '/api/tools/extract', { url: 'https://public.example/article' },
      )) as never)
      const extracted = await extractResponse.json()
      expect(extractResponse.status).toBe(200)
      expect(extracted).toMatchObject({
        source: { type: 'url', url: 'https://public.example/article' },
        metadata: { title: 'Bounded Article | Example', author: 'Alice Example' },
        content: { text: expect.stringContaining('Bounded route content') },
      })
      expect(extracted.id).toMatch(/^ext_/)
      expect(extracted.extractedAt).toEqual(expect.any(String))
      expect(extracted.analysis.readability).toBeDefined()

      expect(externalHeaders).toHaveLength(2)
      for (const headers of externalHeaders) {
        expect(headers.has('authorization')).toBe(false)
        expect(headers.has('cookie')).toBe(false)
        expect(headers.has('x-user-hash')).toBe(false)
      }
    } finally {
      restore()
    }
  })

  test('@smoke mixed public/private DNS fails before metadata target fetch', async () => {
    let targetCalls = 0
    const restore = installNetworkMock({
      addresses: { A: ['93.184.216.34'], AAAA: ['::1'] },
      target: () => {
        targetCalls += 1
        return new Response('must not be fetched')
      },
    })
    try {
      const response = await scrapeMetadataPost(context(routeRequest(
        '/api/tools/scrape-metadata', { url: 'https://mixed.example/article' },
      )) as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Failed to fetch URL',
        suggestion: 'Unable to access the URL. It may be down, blocked, or require authentication.',
      })
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }
  })

  test('@smoke private redirect is rejected before extract target fetch', async () => {
    const fetchedTargets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        fetchedTargets.push(url.href)
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/private' },
        })
      },
    })
    try {
      const response = await extractPost(context(routeRequest(
        '/api/tools/extract', { url: 'https://public.example/redirect' },
      )) as never)
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to extract content' })
      expect(fetchedTargets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke oversized text is rejected through both bounded route adapters', async () => {
    const restore = installNetworkMock({
      target: () => new Response('<html>short fixture</html>', {
        headers: {
          'Content-Type': 'text/html',
          'Content-Length': String(2 * 1024 * 1024 + 1),
        },
      }),
    })
    try {
      const metadataResponse = await scrapeMetadataPost(context(routeRequest(
        '/api/tools/scrape-metadata', { url: 'https://public.example/large' },
      )) as never)
      expect(metadataResponse.status).toBe(400)
      expect((await metadataResponse.json()).error).toBe('Failed to fetch URL')

      const extractResponse = await extractPost(context(routeRequest(
        '/api/tools/extract', { url: 'https://public.example/large' },
      )) as never)
      expect(extractResponse.status).toBe(500)
      expect(await extractResponse.json()).toEqual({ error: 'Failed to extract content' })
    } finally {
      restore()
    }
  })

  test('@smoke URL PDF content routes through the existing PDF extractor', async () => {
    const pdf = new TextEncoder().encode(
      '%PDF-1.7\n/Type /Page \nBT (PDF routed text) Tj ET\n%%EOF',
    )
    const restore = installNetworkMock({
      target: () => new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }),
    })
    try {
      const response = await extractPost(context(routeRequest(
        '/api/tools/extract', { url: 'https://public.example/report.pdf' },
      )) as never)
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        source: { type: 'url', url: 'https://public.example/report.pdf' },
        content: { text: 'PDF routed text', pages: 1 },
        metadata: {},
      })
    } finally {
      restore()
    }
  })
})
