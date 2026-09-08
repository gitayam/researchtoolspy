import { expect, test } from '@playwright/test'
import {
  onRequestGet,
  onRequestPost,
  scrapeTimelineSource,
} from '../../../functions/api/tools/extract-timeline'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

function routeContext(url: string) {
  return {
    request: new Request('https://researchtools.example/api/tools/extract-timeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer route-token',
        Cookie: 'session=must-not-leak',
      },
      body: JSON.stringify({ url }),
    }),
    env: {
      SESSIONS: sessions as unknown as KVNamespace,
      OPENAI_API_KEY: 'test-openai-key',
    },
    params: {},
  }
}

function strictSuppliedContext(contentText: string, publishedAt = '2026-09-08') {
  return {
    request: new Request('https://researchtools.example/api/tools/extract-timeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer route-token',
      },
      body: JSON.stringify({
        schemaVersion: 'timeline-analysis.v1',
        url: 'https://publisher.example/2026/09/story',
        content: {
          text: contentText,
          title: 'Recovered article',
          publishedAt,
          source: 'publisher-feed',
        },
      }),
    }),
    env: {
      SESSIONS: sessions as unknown as KVNamespace,
      OPENAI_API_KEY: 'test-openai-key',
    },
    params: {},
  }
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

test.describe('extract-timeline bounded static fetch @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke reserved service credentials never fall through to legacy auth', async () => {
    const response = await onRequestPost({
      request: new Request('https://researchtools.example/api/tools/extract-timeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer rt_svc_invalid',
        },
        body: JSON.stringify({
          schemaVersion: 'timeline-analysis.v1',
          url: 'https://publisher.example/article',
        }),
      }),
      env: { SESSIONS: sessions as unknown as KVNamespace },
      params: {},
    } as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      schemaVersion: 'integration-error.v1',
      error: { code: 'invalid_service_token', retryable: false },
    })

    const wrongMethod = await onRequestGet({
      request: new Request('https://researchtools.example/api/tools/extract-timeline', {
        headers: { Authorization: 'Bearer rt_svc_invalid' },
      }),
      env: {},
      params: {},
    } as never)
    expect(wrongMethod.status).toBe(405)
    expect(wrongMethod.headers.get('Allow')).toBe('POST, OPTIONS')
    expect(await wrongMethod.json()).toMatchObject({
      schemaVersion: 'integration-error.v1',
      error: { code: 'method_not_allowed', retryable: false },
    })
  })

  test('@smoke rejects primitive and extended strict request bodies before transport', async () => {
    const primitive = await onRequestPost({
      request: new Request('https://researchtools.example/api/tools/extract-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-token' },
        body: 'null',
      }),
      env: { SESSIONS: sessions as unknown as KVNamespace },
      params: {},
    } as never)
    expect(primitive.status).toBe(400)
    expect(await primitive.json()).toEqual({ error: 'Invalid request body' })

    const extended = await onRequestPost({
      request: new Request('https://researchtools.example/api/tools/extract-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-token' },
        body: JSON.stringify({
          schemaVersion: 'timeline-analysis.v1',
          url: 'https://publisher.example/article',
          unsupported: true,
        }),
      }),
      env: { SESSIONS: sessions as unknown as KVNamespace },
      params: {},
    } as never)
    expect(extended.status).toBe(400)
    expect(await extended.json()).toMatchObject({ code: 'INVALID_REQUEST' })
  })

  test('@smoke rejects oversized request bodies before JSON materialization', async () => {
    const response = await onRequestPost({
      request: new Request('https://researchtools.example/api/tools/extract-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-token' },
        body: JSON.stringify({
          schemaVersion: 'timeline-analysis.v1',
          url: 'https://publisher.example/article',
          content: {
            text: 'x'.repeat(113 * 1024),
            source: 'publisher-feed',
          },
        }),
      }),
      env: { SESSIONS: sessions as unknown as KVNamespace },
      params: {},
    } as never)

    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
    })
  })

  test('@smoke rejects malformed timestamp suffixes before transport', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    try {
      const articleText = Array.from({ length: 90 }, (_, index) => `evidence${index}`).join(' ')
      const response = await onRequestPost(
        strictSuppliedContext(articleText, '2026-09-08Tgarbage') as never,
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke private literals are rejected before transport', async () => {
    let networkCalls = 0
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      return new Response('unexpected')
    }) as typeof fetch

    try {
      const response = await onRequestPost(routeContext('http://127.0.0.1/private') as never)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid or unsafe URL format' })
      expect(networkCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke mixed public/private DNS is denied before target transport', async () => {
    let targetCalls = 0
    const restore = installNetworkMock({
      addresses: { A: ['93.184.216.34'], AAAA: ['::1'] },
      target: () => {
        targetCalls += 1
        return new Response('must not be fetched')
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://mixed.example/article') as never)
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: 'Failed to fetch URL',
        fallback_attempts: ['original'],
      })
      expect(targetCalls).toBe(0)
    } finally {
      restore()
    }
  })

  test('@smoke a private redirect is denied before its second hop', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest' } })
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://public.example/redirect') as never)
      expect(response.status).toBe(422)
      expect(targets).toEqual(['https://public.example/redirect'])
    } finally {
      restore()
    }
  })

  test('@smoke oversized and non-text responses are rejected', async () => {
    for (const createResponse of [
      () => new Response('short', {
          headers: { 'Content-Type': 'text/html', 'Content-Length': String(2 * 1024 * 1024 + 1) },
        }),
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
    ]) {
      const restore = installNetworkMock({ target: createResponse })
      try {
        const result = await scrapeTimelineSource('https://public.example/article')
        expect(result.error).toBeTruthy()
        expect(result.fallbackAttempts).toEqual(['original', 'archive.ph', 'wayback'])
      } finally {
        restore()
      }
    }
  })

  test('@smoke successful fetch preserves final URL and forwards no credentials', async () => {
    const headers: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        headers.push(new Headers(init?.headers))
        if (url.pathname === '/start') {
          return new Response(null, { status: 302, headers: { Location: '/article' } })
        }
        return new Response(`<html><head><title>Timeline source</title><meta property="article:published_time" content="2026-09-08T12:30:00-04:00"></head><body><article><p>${'bounded timeline source '.repeat(90)}</p></article></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      const result = await scrapeTimelineSource('https://public.example/start')
      expect(result.finalUrl).toBe('https://public.example/article')
      expect(result.content).toContain('bounded timeline source')
      expect(result.publishedAt).toBe('2026-09-08T12:30:00-04:00')
      expect(headers).toHaveLength(2)
      for (const outbound of headers) {
        expect(outbound.has('authorization')).toBe(false)
        expect(outbound.has('cookie')).toBe(false)
      }
    } finally {
      restore()
    }
  })

  test('@smoke thin direct content continues to an analysis-grade archive', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.hostname)
        if (url.hostname === 'archive.ph') {
          return new Response(`<html><head><title>Archived timeline</title></head><body><article><p>${'dated event evidence '.repeat(90)}</p></article></body></html>`, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response('<html><head><title>Thin shell</title></head><body><main>Loading article</main></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })
    try {
      const result = await scrapeTimelineSource('https://public.example/thin')
      expect(result).toMatchObject({
        source: 'archive.ph',
        fallbackAttempts: ['original', 'archive.ph'],
        quality: { accepted: true },
      })
      expect(targets).toEqual(['public.example', 'archive.ph'])
    } finally {
      restore()
    }
  })

  test('@smoke live analysis uses extracted publication metadata and never URL path dates', async () => {
    const modelRequests: Record<string, unknown>[] = []
    let includePublishedMetadata = false
    const restore = installNetworkMock({
      target: (url, init) => {
        if (url.hostname === 'api.openai.com') {
          modelRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
          return Response.json({ choices: [{ message: { content: '{"events":[]}' } }] })
        }
        const publishedMeta = includePublishedMetadata
          ? '<meta property="article:published_time" content="2026-09-07T23:15:00Z">'
          : ''
        return new Response(`<html><head><title>Live timeline</title>${publishedMeta}</head><body><article><p>${'dated article evidence '.repeat(90)}</p></article></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      const requestFor = (url: string) => new Request(
        'https://researchtools.example/api/tools/extract-timeline',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-token' },
          body: JSON.stringify({ schemaVersion: 'timeline-analysis.v1', url }),
        },
      )
      const withoutMetadata = await onRequestPost({
        request: requestFor('https://public.example/2026/09/08/story'),
        env: { SESSIONS: sessions as unknown as KVNamespace, OPENAI_API_KEY: 'test-key' },
        params: {},
      } as never)
      expect(withoutMetadata.status).toBe(200)
      expect((await withoutMetadata.json()).article).not.toHaveProperty('publishedAt')
      expect(JSON.stringify(modelRequests[0])).toContain('Article publication date: not reliably available')

      includePublishedMetadata = true
      const withMetadata = await onRequestPost({
        request: requestFor('https://public.example/story-with-metadata'),
        env: { SESSIONS: sessions as unknown as KVNamespace, OPENAI_API_KEY: 'test-key' },
        params: {},
      } as never)
      expect(withMetadata.status).toBe(200)
      expect(await withMetadata.json()).toMatchObject({
        article: { publishedAt: '2026-09-07' },
      })
      expect(JSON.stringify(modelRequests[1])).toContain('Article publication date: 2026-09-07')
    } finally {
      restore()
    }
  })

  test('@smoke legacy success preserves the pre-versioned provenance shape', async () => {
    const restore = installNetworkMock({
      target: (url) => {
        if (url.hostname === 'api.openai.com') {
          return Response.json({ choices: [{ message: { content: '{"events":[]}' } }] })
        }
        return new Response(`<html><head><title>Legacy timeline</title></head><body><article><p>${'legacy article evidence '.repeat(90)}</p></article></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      const response = await onRequestPost(routeContext('https://public.example/legacy') as never)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        extraction: { quality: 'good', word_count: 270 },
        extraction_quality: {
          version: 'analysis-candidate.v1',
          policy: 'timeline',
          accepted: true,
          wordCount: 270,
        },
      })
    } finally {
      restore()
    }
  })

  test('@smoke strict supplied content bypasses transport and preserves month precision', async () => {
    const articleText = Array.from(
      { length: 90 },
      (_, index) => `evidence${index}`,
    ).join(' ')
    const requests: Array<{ url: string; body: Record<string, unknown> }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              events: [{
                event_date: '2026-09',
                title: 'September event',
                description: 'The event is supported by supplied content.',
                category: 'political',
                importance: 'high',
              }],
            }),
          },
        }],
      })
    }) as typeof fetch

    try {
      const response = await onRequestPost(strictSuppliedContext(articleText) as never)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        schemaVersion: 'timeline-analysis.v1',
        outcome: 'events',
        article: {
          url: 'https://publisher.example/2026/09/story',
          title: 'Recovered article',
          publishedAt: '2026-09-08',
        },
        events: [{ eventDate: '2026-09', datePrecision: 'month' }],
        extraction: {
          contentSource: 'publisher-feed',
          sourceMode: 'supplied',
          method: 'caller-supplied',
          wordCount: 90,
        },
      })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.url).toBe('https://api.openai.com/v1/chat/completions')
      expect(JSON.stringify(requests[0]?.body)).toContain('Article publication date: 2026-09-08')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke invalid model output emits a failed, unaccepted supplied terminal', async () => {
    const articleText = Array.from({ length: 90 }, (_, index) => `evidence${index}`).join(' ')
    const points: Array<{ blobs?: string[]; doubles?: number[] }> = []
    const base = strictSuppliedContext(articleText)
    const context = {
      ...base,
      env: {
        ...base.env,
        SCRAPE_TELEMETRY_KEY: 'timeline-test-telemetry-key',
        SCRAPE_ANALYTICS: { writeDataPoint: (point: { blobs?: string[]; doubles?: number[] }) => points.push(point) },
      },
    }
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: JSON.stringify({ events: [{ title: 'Missing date' }] }) } }],
    })) as typeof fetch

    try {
      const response = await onRequestPost(context as never)
      expect(response.status).toBe(502)
      expect(points).toHaveLength(3)
      const terminal = points.at(-1)
      expect(terminal?.blobs?.[4]).toBe('failed')
      expect(terminal?.blobs?.[7]).toBe('supplied')
      expect(terminal?.doubles?.[4]).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
