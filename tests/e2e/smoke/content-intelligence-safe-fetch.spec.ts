import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkArchivePh,
  checkWaybackMachine,
  extractUrlContent,
  onRequestPost,
} from '../../../functions/api/content-intelligence/analyze-url'
import {
  isPublicContentAnalysisPath,
  onRequest as apiMiddleware,
} from '../../../functions/api/_middleware'

type DnsAnswers = Record<string, string[]>

interface NetworkMock {
  answers?: DnsAnswers
  target(url: URL, init?: RequestInit): Response | Promise<Response>
}

function installNetworkMock(mock: NetworkMock): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
      const addresses = mock.answers?.[url.searchParams.get('name') || '']
        ?? (type === 'AAAA' ? ['2606:2800:220:1:248:1893:25c8:1946'] : ['93.184.216.34'])
      return Response.json({
        Status: 0,
        Answer: addresses
          .filter(address => type === 'AAAA' ? address.includes(':') : !address.includes(':'))
          .map(data => ({ type: type === 'AAAA' ? 28 : 1, data })),
      })
    }
    return await mock.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

const longArticle = `<!doctype html><html><head><title>Validated Final Article</title></head>
  <body><article><p>${'bounded extraction words '.repeat(60)}</p>
  <a href="/next-source">Next source</a></article></body></html>`

interface EventLogCall {
  query: string
  bindings: unknown[]
}

function authorizedRouteContext(
  body: Record<string, unknown>,
  options: { telemetryKey?: string; apifyKey?: string } = {},
): { context: Record<string, unknown>; eventLogs: EventLogCall[] } {
  const eventLogs: EventLogCall[] = []
  const db = {
    prepare(query: string) {
      return {
        bind(...bindings: unknown[]) {
          return {
            async first() {
              if (query.includes('SELECT id FROM workspaces')) return { id: 'workspace-sensitive-42' }
              if (query.includes('SELECT user_hash FROM users')) return { user_hash: 'user-hash-sensitive-1234' }
              return null
            },
            async all() {
              return { results: [] }
            },
            async run() {
              if (query.includes('INSERT INTO event_logs')) eventLogs.push({ query, bindings })
              return { meta: { changes: 1, last_row_id: 1 } }
            },
          }
        },
      }
    },
  }
  const sessions = {
    get: async (token: string) => token === 'session-token'
      ? JSON.stringify({ user_id: 7 })
      : null,
  }
  const env: Record<string, unknown> = {
    DB: db,
    SESSIONS: sessions,
    OPENAI_API_KEY: 'openai-token-must-not-log',
    APIFY_API_KEY: options.apifyKey,
    SCRAPE_TELEMETRY_KEY: options.telemetryKey,
  }

  return {
    eventLogs,
    context: {
      request: new Request('https://researchtools.example/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
          'X-Workspace-ID': 'workspace-sensitive-42',
        },
        body: JSON.stringify(body),
      }),
      env,
      params: {},
    },
  }
}

function eventLogContext(call: EventLogCall): Record<string, unknown> {
  expect(call.bindings.slice(0, 3)).toEqual([
    'warn',
    'content-intelligence/analyze-url',
    'URL extraction failed',
  ])
  expect(call.bindings[4]).toBeNull()
  return JSON.parse(String(call.bindings[3])) as Record<string, unknown>
}

function expectRecursivelyAbsent(value: unknown, forbidden: readonly string[]): void {
  const serialized = JSON.stringify(value)
  for (const text of forbidden) expect(serialized).not.toContain(text)
  const visit = (current: unknown): void => {
    if (!current || typeof current !== 'object') return
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      expect(key).not.toMatch(/^(url|host|query|reason|user|user_id|workspace|workspace_id)$/i)
      visit(child)
    }
  }
  visit(value)
}

test.describe('content-intelligence URL safe-fetch migration @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke public analysis has an exact-path IP budget', async () => {
    expect(isPublicContentAnalysisPath('/api/content-intelligence/analyze-url')).toBe(true)
    expect(isPublicContentAnalysisPath('/api/content-intelligence/analyze-url/extra')).toBe(false)

    let nextCalled = false
    const response = await apiMiddleware({
      request: new Request('https://researchtools.example/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.8' },
      }),
      env: {
        CACHE: {
          get: async () => '12',
          put: async () => undefined,
        },
      },
      next: async () => {
        nextCalled = true
        return new Response('unexpected')
      },
    })

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: 'Public analysis limit reached. Please try again later.',
    })
    expect(nextCalled).toBe(false)
  })

  test('@smoke keeps existing-analysis auth while public requests pass the workspace gate', async () => {
    const sessions = {
      get: async (token: string) => token === 'session-token' ? JSON.stringify({ user_id: 7 }) : null,
    }
    const deniedDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          all: async () => ({ results: [] }),
        }),
      }),
    }
    const invoke = (body: Record<string, unknown>, authenticated = true, workspace?: string) => onRequestPost({
      request: new Request('https://researchtools.example/api/content-intelligence/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authenticated ? { Authorization: 'Bearer session-token' } : {}),
          ...(workspace ? { 'X-Workspace-ID': workspace } : {}),
        },
        body: JSON.stringify(body),
      }),
      env: { DB: deniedDb, SESSIONS: sessions },
      params: {},
    } as never)

    const unauthenticated = await invoke({}, false)
    expect(unauthenticated.status).toBe(400)
    expect(await unauthenticated.json()).toEqual({ error: 'URL is required' })

    const missingWorkspace = await invoke({})
    expect(missingWorkspace.status).toBe(400)
    expect(await missingWorkspace.json()).toEqual({ error: 'URL is required' })

    const deniedWorkspace = await invoke({}, true, 'workspace-7')
    expect(deniedWorkspace.status).toBe(400)
    expect(await deniedWorkspace.json()).toEqual({ error: 'URL is required' })

    const existing = await invoke({ load_existing: true, analysis_id: 42 }, false)
    expect(existing.status).toBe(401)
    expect(await existing.json()).toEqual({ error: 'Authentication required' })

    const supplied = await invoke({
      url: 'https://public.example/article',
      content_text: 'caller supplied content '.repeat(160),
    }, false)
    expect(supplied.status).toBe(401)
    expect(await supplied.json()).toEqual({ error: 'Authentication required for supplied content' })
  })

  test('@smoke anonymous normal analysis succeeds without database persistence', async () => {
    let dbCalls = 0
    const db = {
      prepare() {
        dbCalls++
        throw new Error('Public successful analysis must not access D1')
      },
    }
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.hostname === 'cloudflare-dns.com') {
        const type = url.searchParams.get('type') === 'AAAA' ? 'AAAA' : 'A'
        return Response.json({
          Status: 0,
          Answer: type === 'AAAA'
            ? [{ type: 28, data: '2606:2800:220:1:248:1893:25c8:1946' }]
            : [{ type: 1, data: '93.184.216.34' }],
        })
      }
      if (url.hostname === 'public.example') {
        return new Response(longArticle, { headers: { 'Content-Type': 'text/html' } })
      }
      expect(url.hostname).toBe('api.openai.com')
      const request = JSON.parse(String(init?.body || '{}')) as { messages?: Array<{ content?: string }> }
      const prompt = request.messages?.at(-1)?.content || ''
      let content = JSON.stringify({
        people: [], organizations: [], locations: [], dates: [], money: [],
        events: [], products: [], percentages: [],
      })
      if (prompt.includes('Summarize this content')) content = 'Public summary'
      if (prompt.includes('sentiment')) content = JSON.stringify({
        overall: 'neutral', score: 0, confidence: 1,
        emotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 },
        controversialClaims: [], keyInsights: [],
      })
      if (prompt.includes('main topics')) content = '[]'
      if (prompt.includes('keyphrases')) content = '[]'
      return Response.json({ choices: [{ message: { content } }] })
    }) as typeof fetch

    try {
      const response = await onRequestPost({
        request: new Request('https://researchtools.example/api/content-intelligence/analyze-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://public.example/supplied',
            mode: 'normal',
            save_link: true,
          }),
        }),
        env: { DB: db, OPENAI_API_KEY: 'test-openai-key' },
        params: {},
      } as never)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        title: 'Validated Final Article',
        summary: 'Public summary',
        is_persisted: false,
        persistence_notice: expect.stringContaining('Public analysis completed without saving'),
      })
      expect(dbCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke denies private, mixed-DNS, and private-redirect targets before transport', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      answers: { 'mixed.example': ['93.184.216.34', '10.0.0.8'] },
      target: url => {
        targets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })
      },
    })
    try {
      const literal = await extractUrlContent('http://127.0.0.1/private')
      expect(literal).toMatchObject({ success: false, errorCode: 'policy_denied' })
      const mixed = await extractUrlContent('https://mixed.example/article')
      expect(mixed).toMatchObject({ success: false, errorCode: 'policy_denied' })
      const redirected = await extractUrlContent('https://public.example/start')
      expect(redirected).toMatchObject({ success: false, errorCode: 'policy_denied' })
      expect(targets).toEqual(['https://public.example/start'])
    } finally {
      restore()
    }
  })

  test('@smoke enforces direct and archive text budgets and exact archive redirect hosts', async () => {
    const targets: string[] = []
    let mode: 'large' | 'archive-escape' | 'wayback-invalid' | 'wayback-valid' | 'wayback-large' = 'large'
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (mode === 'archive-escape') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://archive.ph.attacker.example/snapshot' },
          })
        }
        if (mode === 'wayback-invalid') {
          return new Response('key not-a-timestamp original text/html 200 digest 10', {
            headers: { 'Content-Type': 'text/plain' },
          })
        }
        if (mode === 'wayback-valid') {
          return new Response('key 20260831010203 original text/html 200 digest 10', {
            headers: { 'Content-Type': 'text/plain' },
          })
        }
        if (mode === 'wayback-large') {
          return new Response('small fixture', {
            headers: {
              'Content-Type': 'text/plain',
              'Content-Length': String(256 * 1024 + 1),
            },
          })
        }
        return new Response('small fixture', {
          headers: {
            'Content-Type': 'text/html',
            'Content-Length': String(2 * 1024 * 1024 + 1),
          },
        })
      },
    })
    try {
      const direct = await extractUrlContent('https://public.example/large')
      expect(direct).toMatchObject({ success: false, errorCode: 'response_too_large' })
      const archiveText = await extractUrlContent('https://archive.ph/snapshot', undefined, undefined, ['archive.ph'])
      expect(archiveText).toMatchObject({ success: false, errorCode: 'response_too_large' })

      mode = 'archive-escape'
      const archiveStart = targets.length
      await expect(checkArchivePh('https://public.example/article')).resolves.toBeNull()
      expect(targets.slice(archiveStart)).toHaveLength(1)
      expect(targets.at(-1)).toContain('https://archive.ph/newest/')

      mode = 'wayback-invalid'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBeNull()
      mode = 'wayback-valid'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBe(
        'https://web.archive.org/web/20260831010203/https://public.example/article',
      )
      mode = 'wayback-large'
      await expect(checkWaybackMachine('https://public.example/article')).resolves.toBeNull()
    } finally {
      restore()
    }
  })

  test('@smoke matches shorteners by exact host and restricts every short-link hop', async () => {
    const requests: Array<{ url: string; method: string }> = []
    const restore = installNetworkMock({
      target: (url, init) => {
        const method = String(init?.method || 'GET')
        requests.push({ url: url.href, method })
        if (url.hostname === 'spotify.link') {
          return new Response(null, { status: 302, headers: { Location: 'https://open.spotify.com/track/123' } })
        }
        if (url.hostname === 'open.spotify.com' && method === 'HEAD') return new Response(null)
        if (url.hostname === 'open.spotify.com') {
          return new Response('<html><head><meta property="og:title" content="Safe Track"><meta property="og:description" content="A safely resolved track description"></head></html>', {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        if (url.hostname === 'fb.watch') {
          return new Response(null, { status: 302, headers: { Location: 'https://www.facebook.com/watch/456' } })
        }
        if (url.hostname === 'www.facebook.com' && method === 'HEAD') return new Response(null)
        if (url.hostname === 'www.facebook.com') {
          return new Response('<html><head><meta property="og:title" content="Safe Facebook Video"><meta property="og:description" content="A safely resolved Facebook description"></head></html>', {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(longArticle, { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      const impostor = await extractUrlContent('https://spotify.link.attacker.example/article')
      expect(impostor.success).toBe(true)
      expect(requests[0]).toEqual({ url: 'https://spotify.link.attacker.example/article', method: 'GET' })

      requests.length = 0
      const shortened = await extractUrlContent('https://spotify.link/abc')
      expect(shortened.success).toBe(true)
      expect(requests).toEqual([
        { url: 'https://spotify.link/abc', method: 'HEAD' },
        { url: 'https://open.spotify.com/track/123', method: 'HEAD' },
        { url: 'https://open.spotify.com/track/123', method: 'GET' },
      ])

      requests.length = 0
      const facebook = await extractUrlContent('https://fb.watch/abc')
      expect(facebook.success).toBe(true)
      expect(requests).toEqual([
        { url: 'https://fb.watch/abc', method: 'HEAD' },
        { url: 'https://www.facebook.com/watch/456', method: 'HEAD' },
        { url: 'https://www.facebook.com/watch/456', method: 'GET' },
      ])
    } finally {
      restore()
    }
  })

  test('@smoke preserves archive and short-link host constraints for PDF redirects', async () => {
    const requests: Array<{ url: string; method: string }> = []
    let scenario: 'archive-cross-host' | 'short-private' = 'archive-cross-host'
    const restore = installNetworkMock({
      target: (url, init) => {
        const method = String(init?.method || 'GET')
        requests.push({ url: url.href, method })
        if (scenario === 'archive-cross-host') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://archive.ph.attacker.example/stolen.pdf' },
          })
        }
        if (url.hostname === 'spotify.link') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://open.spotify.com/document.pdf' },
          })
        }
        if (method === 'HEAD') return new Response(null)
        return new Response(null, {
          status: 302,
          headers: { Location: 'http://127.0.0.1/private.pdf' },
        })
      },
    })

    try {
      const archive = await extractUrlContent(
        'https://archive.ph/document.pdf',
        undefined,
        undefined,
        ['archive.ph'],
      )
      expect(archive).toMatchObject({ success: false, errorCode: 'policy_denied', isPDF: true })
      expect(requests).toEqual([{ url: 'https://archive.ph/document.pdf', method: 'GET' }])

      scenario = 'short-private'
      requests.length = 0
      const shortened = await extractUrlContent('https://spotify.link/document.pdf')
      expect(shortened).toMatchObject({ success: false, errorCode: 'policy_denied', isPDF: true })
      expect(requests).toEqual([
        { url: 'https://spotify.link/document.pdf', method: 'HEAD' },
        { url: 'https://open.spotify.com/document.pdf', method: 'HEAD' },
        { url: 'https://open.spotify.com/document.pdf', method: 'GET' },
      ])
    } finally {
      restore()
    }
  })

  test('@smoke constrained scanned PDFs upload only validated bytes to the fixed OCR provider', async () => {
    const downloaded = new TextEncoder().encode('%PDF-1.7\nvalidated-but-not-parseable')
    let sourceHeaders = new Headers()
    const providerRequests: Array<{ url: string; headers: Headers; body: BodyInit | null | undefined }> = []
    const restore = installNetworkMock({
      target: (url, init) => {
        if (url.hostname === 'archive.ph') {
          sourceHeaders = new Headers(init?.headers)
          return new Response(downloaded, { headers: { 'Content-Type': 'application/pdf' } })
        }
        if (url.href === 'https://api.pdf.co/v1/file/upload') {
          providerRequests.push({ url: url.href, headers: new Headers(init?.headers), body: init?.body })
          return Response.json({ url: 'https://files.pdf.co/validated-upload.pdf' })
        }
        if (url.href === 'https://api.pdf.co/v1/pdf/convert/to/text') {
          providerRequests.push({ url: url.href, headers: new Headers(init?.headers), body: init?.body })
          return Response.json({ body: 'OCR text from constrained PDF', pageCount: 1 })
        }
        throw new Error(`Unexpected transport: ${url.href}`)
      },
    })

    try {
      const result = await extractUrlContent(
        'https://archive.ph/scanned.pdf',
        undefined,
        'pdfco-secret',
        ['archive.ph'],
      )

      expect(result).toMatchObject({
        success: true,
        text: 'OCR text from constrained PDF',
        isPDF: true,
        pdfMetadata: { pageCount: 1 },
      })
      expect(sourceHeaders.has('x-api-key')).toBe(false)
      expect(sourceHeaders.has('authorization')).toBe(false)
      expect(providerRequests.map(request => request.url)).toEqual([
        'https://api.pdf.co/v1/file/upload',
        'https://api.pdf.co/v1/pdf/convert/to/text',
      ])
      for (const request of providerRequests) {
        expect(request.headers.get('x-api-key')).toBe('pdfco-secret')
      }
      expect([...new Uint8Array(providerRequests[0].body as ArrayBuffer)]).toEqual([...downloaded])
      expect(JSON.parse(String(providerRequests[1].body))).toEqual({
        url: 'https://files.pdf.co/validated-upload.pdf',
        inline: true,
      })
    } finally {
      restore()
    }
  })

  test('@smoke API key presence and an impostor social host cannot trigger provider disclosure', async () => {
    const targets: string[] = []
    const restore = installNetworkMock({
      target: url => {
        targets.push(url.href)
        if (url.hostname === 'web.archive.org') {
          return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
        }
        if (url.hostname === 'archive.ph') return new Response(null, { status: 404 })
        return new Response('<html>upstream unavailable</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      const fixture = authorizedRouteContext({
        url: 'https://x.com.attacker.example/status/123?token=caller-secret',
      }, { apifyKey: 'apify-token-must-not-leave' })
      const response = await onRequestPost(fixture.context as never)
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: 'The website is experiencing issues. Try again later or use a bypass URL.',
        technical_error: expect.stringContaining('HTTP 503'),
      })
      expect(targets.some(target => new URL(target).hostname === 'api.apify.com')).toBe(false)
      expect(targets).toContain('https://x.com.attacker.example/status/123?token=caller-secret')
      expect(fixture.eventLogs).toHaveLength(1)
    } finally {
      restore()
    }
  })

  test('@smoke authorized hard failures persist only normalized opaque context with and without a key', async () => {
    const rawUrl = 'https://secret.example/private/path?token=do-not-log'
    const forbidden = [
      rawUrl,
      'secret.example',
      '/private/path',
      'token=do-not-log',
      'upstream unavailable',
      'openai-token-must-not-log',
      'apify-token-must-not-leave',
      'workspace-sensitive-42',
      'user-hash-sensitive-1234',
      'session-token',
      'user_id',
    ]
    const restore = installNetworkMock({
      target: url => {
        if (url.hostname === 'web.archive.org') {
          return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
        }
        if (url.hostname === 'archive.ph') return new Response(null, { status: 404 })
        return new Response('<html>upstream unavailable private customer material</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      },
    })

    try {
      for (const telemetryKey of [undefined, 'dedicated-scrape-telemetry-key']) {
        const fixture = authorizedRouteContext({ url: rawUrl }, {
          telemetryKey,
          apifyKey: 'apify-token-must-not-leave',
        })
        const response = await onRequestPost(fixture.context as never)
        expect(response.status).toBe(422)
        expect(fixture.eventLogs).toHaveLength(1)
        const logged = eventLogContext(fixture.eventLogs[0])
        expect(logged.error_code).toBe('upstream_5xx')
        if (telemetryKey) {
          expect(logged).toMatchObject({
            correlation_id: expect.stringMatching(/^[a-f0-9]{64}$/),
            url_id: expect.stringMatching(/^[a-f0-9]{64}$/),
            domain_id: expect.stringMatching(/^[a-f0-9]{64}$/),
          })
        } else {
          expect(logged).toEqual({
            correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            error_code: 'upstream_5xx',
          })
        }
        expectRecursivelyAbsent(logged, forbidden)
      }
    } finally {
      restore()
    }
  })

  test('@smoke preserves the successful supplied-content quick envelope', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).hostname).toBe('api.openai.com')
      return Response.json({ choices: [{ message: { content: 'Compatible summary' } }] })
    }) as typeof fetch
    try {
      const fixture = authorizedRouteContext({
        url: 'https://public.example/supplied',
        mode: 'quick',
        content_text: 'trusted supplied article content with meaningful evidence '.repeat(35),
        content_title: 'Supplied title',
        content_source: 'bot-scrape',
      })
      const response = await onRequestPost(fixture.context as never)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        url: 'https://public.example/supplied',
        title: 'Supplied title',
        summary: 'Compatible summary',
        processing_mode: 'quick',
        content_source: 'bot-scrape',
        fallback_attempts: ['bot-scrape'],
      })
      expect(fixture.eventLogs).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke uses the validated final URL for extraction and forwards no request credentials', async () => {
    const outboundHeaders: Headers[] = []
    const restore = installNetworkMock({
      target: (url, init) => {
        outboundHeaders.push(new Headers(init?.headers))
        if (url.hostname === 'start.example') {
          return new Response(null, { status: 302, headers: { Location: 'https://final.example/article' } })
        }
        return new Response(longArticle, { headers: { 'Content-Type': 'text/html' } })
      },
    })
    try {
      const result = await extractUrlContent('https://start.example/old-base')
      expect(result.success).toBe(true)
      expect(result.title).toBe('Validated Final Article')
      expect(result.links).toEqual(expect.arrayContaining([
        expect.objectContaining({ url: 'https://final.example/next-source' }),
      ]))
      for (const headers of outboundHeaders) {
        expect(headers.has('authorization')).toBe(false)
        expect(headers.has('cookie')).toBe(false)
        expect(headers.has('x-user-hash')).toBe(false)
        expect(headers.has('x-workspace-id')).toBe(false)
      }
    } finally {
      restore()
    }
  })

  test('@smoke analyze-url contains no dynamic renderer call or binding reference', () => {
    const source = readFileSync(resolve(process.cwd(), 'functions/api/content-intelligence/analyze-url.ts'), 'utf8')
    expect(source).not.toContain('BROWSER_RENDERER')
    expect(source).not.toContain('renderArticleFallback')
    expect(source).not.toContain('RendererBinding')
    expect(source).not.toContain("../_shared/apify-social")
    expect(source).not.toContain('fetchSocialViaApify')
    expect(source).not.toContain('APIFY_API_KEY')
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).toContain('telemetryKey: env.SCRAPE_TELEMETRY_KEY')
    expect(source).not.toMatch(/telemetryKey:\s*env\.JWT_SECRET/)
  })
})
