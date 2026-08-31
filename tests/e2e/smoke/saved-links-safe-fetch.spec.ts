import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/saved-links'

const sessions = {
  get: async (token: string) => token === 'route-token' ? JSON.stringify({ user_id: 7 }) : null,
}

interface DbOperation {
  query: string
  bindings: unknown[]
}

function createDb() {
  const operations: DbOperation[] = []
  let savedLink: Record<string, unknown> = {}

  const db = {
    prepare(query: string) {
      return {
        bind(...bindings: unknown[]) {
          operations.push({ query, bindings })
          return {
            async first() {
              if (query.includes('SELECT id FROM saved_links')) return null
              if (query.includes('SELECT * FROM saved_links WHERE id')) return { ...savedLink }
              return null
            },
            async run() {
              if (query.includes('INSERT INTO saved_links')) {
                savedLink = {
                  id: 41,
                  user_id: bindings[0],
                  url: bindings[1],
                  title: bindings[2],
                  note: bindings[3],
                  tags: bindings[4],
                  reminder_date: bindings[5],
                  domain: bindings[6],
                  is_social_media: bindings[7],
                  social_platform: bindings[8],
                  is_processed: 0,
                  analysis_id: null,
                }
                return { meta: { last_row_id: 41, changes: 1 } }
              }
              if (query.includes('UPDATE saved_links SET analysis_id')) {
                savedLink.analysis_id = bindings[0]
                savedLink.is_processed = 1
              }
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  } as unknown as D1Database

  return { db, operations }
}

function routeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Request {
  return new Request('https://researchtools.example/api/content-intelligence/saved-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer route-token',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function context(request: Request, db: D1Database) {
  return {
    request,
    env: { DB: db, SESSIONS: sessions as unknown as KVNamespace },
    params: {},
  }
}

type DnsAnswers = Record<string, string[]>

function dnsResponse(query: URL, answers: DnsAnswers): Response {
  const hostname = query.searchParams.get('name') || ''
  const type = query.searchParams.get('type')
  const records = (answers[hostname] || [])
    .filter(address => type === 'AAAA' ? address.includes(':') : !address.includes(':'))
    .map(address => ({ type: type === 'AAAA' ? 28 : 1, data: address }))
  return Response.json({ Status: 0, Answer: records })
}

interface NetworkMockOptions {
  answers?: DnsAnswers
  target: (url: URL, init?: RequestInit) => Promise<Response> | Response
}

function installNetworkMock(options: NetworkMockOptions): () => void {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      return dnsResponse(url, options.answers ?? { 'public.example': ['93.184.216.34'] })
    }
    return await options.target(url, init)
  }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

async function createSavedLink(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const fixture = createDb()
  const response = await onRequestPost(context(routeRequest(body, headers), fixture.db) as never)
  return { response, operations: fixture.operations }
}

test.describe('saved links safe-fetch migration @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke rejects mixed/private DNS and private redirects before target transport', async () => {
    const fetchedTargets: string[] = []
    const restore = installNetworkMock({
      answers: {
        'mixed.example': ['93.184.216.34', '10.0.0.2'],
        'public.example': ['93.184.216.34'],
      },
      target: url => {
        fetchedTargets.push(url.href)
        return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } })
      },
    })

    try {
      const mixed = await createSavedLink({ url: 'https://mixed.example/article' })
      const privateAddress = await createSavedLink({ url: 'http://127.0.0.1/metadata' })
      const redirected = await createSavedLink({ url: 'https://public.example/start' })

      expect(mixed.response.status).toBe(201)
      expect(privateAddress.response.status).toBe(201)
      expect(redirected.response.status).toBe(201)
      expect(await mixed.response.json()).toMatchObject({ title: null })
      expect(await privateAddress.response.json()).toMatchObject({ title: null })
      expect(await redirected.response.json()).toMatchObject({ title: null })
      expect(fetchedTargets).toEqual(['https://public.example/start'])
    } finally {
      restore()
    }
  })

  test('@smoke rejects oversized and wrong-MIME title responses', async () => {
    let responseKind: 'oversized' | 'mime' = 'oversized'
    const restore = installNetworkMock({
      target: () => responseKind === 'oversized'
        ? new Response('<html><title>Must not be used</title></html>', {
            headers: { 'Content-Type': 'text/html', 'Content-Length': String(2 * 1024 * 1024 + 1) },
          })
        : new Response('not html', { headers: { 'Content-Type': 'application/json' } }),
    })

    try {
      const oversized = await createSavedLink({ url: 'https://public.example/large' })
      responseKind = 'mime'
      const wrongMime = await createSavedLink({ url: 'https://public.example/data' })

      expect(oversized.response.status).toBe(201)
      expect(wrongMime.response.status).toBe(201)
      expect(await oversized.response.json()).toMatchObject({ title: null })
      expect(await wrongMime.response.json()).toMatchObject({ title: null })
    } finally {
      restore()
    }
  })

  test('@smoke sends no caller credentials to the external title URL', async () => {
    let externalHeaders = new Headers()
    const restore = installNetworkMock({
      target: (_url, init) => {
        externalHeaders = new Headers(init?.headers)
        return new Response('<html><head><title>Bounded title</title></head></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      },
    })

    try {
      const { response } = await createSavedLink(
        { url: 'https://public.example/article' },
        {
          Cookie: 'session=must-not-leak',
          'X-User-Hash': '0123456789abcdef',
          'X-Workspace-ID': 'workspace-secret',
          'X-Api-Key': 'must-not-leak',
          'X-Unrelated-Secret': 'must-not-leak',
        },
      )

      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({ title: 'Bounded title' })
      expect(externalHeaders.get('user-agent')).toContain('ResearchToolsBot')
      for (const name of ['authorization', 'cookie', 'x-user-hash', 'x-workspace-id', 'x-api-key', 'x-unrelated-secret']) {
        expect(externalHeaders.has(name)).toBe(false)
      }
    } finally {
      restore()
    }
  })

  test('@smoke forwards exactly the approved internal headers and preserves analysis linkage', async () => {
    let analyzeHeaders = new Headers()
    let analyzeSignal: AbortSignal | null | undefined
    let deadlineMs: number | undefined
    const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout')
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: (milliseconds: number) => {
        deadlineMs = milliseconds
        return new AbortController().signal
      },
    })
    const restore = installNetworkMock({
      target: (url, init) => {
        expect(url.href).toBe('https://researchtools.example/api/content-intelligence/analyze-url')
        analyzeHeaders = new Headers(init?.headers)
        analyzeSignal = init?.signal
        return Response.json({ id: 77, title: 'compatible extra field' })
      },
    })

    try {
      const { response, operations } = await createSavedLink(
        { url: 'https://public.example/article', title: 'Caller title', tags: ['research'], auto_analyze: true },
        {
          Cookie: 'session=must-not-forward',
          'X-User-Hash': '0123456789abcdef',
          'X-Workspace-ID': 'workspace-7',
          'X-Api-Key': 'must-not-forward',
          'X-Unrelated-Secret': 'must-not-forward',
        },
      )
      const body = await response.json()

      expect(response.status).toBe(201)
      expect([...analyzeHeaders.entries()]).toEqual([
        ['authorization', 'Bearer route-token'],
        ['content-type', 'application/json'],
        ['x-user-hash', '0123456789abcdef'],
        ['x-workspace-id', 'workspace-7'],
      ])
      expect(analyzeSignal).toBeInstanceOf(AbortSignal)
      expect(deadlineMs).toBe(30_000)
      expect(body).toMatchObject({
        id: 41,
        title: 'Caller title',
        tags: ['research'],
        is_social_media: false,
        is_processed: true,
        analysis_id: 77,
      })
      const savedLinkUpdate = operations.find(operation => operation.query.includes('UPDATE saved_links SET analysis_id'))
      const retainedAnalysis = operations.find(operation => operation.query.includes('UPDATE content_analysis SET is_saved'))
      expect(savedLinkUpdate?.bindings).toEqual([77, 41])
      expect(retainedAnalysis?.bindings).toEqual([77])
    } finally {
      restore()
      if (timeoutDescriptor) Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor)
      else Reflect.deleteProperty(AbortSignal, 'timeout')
    }
  })

  test('@smoke preserves internal non-ok, timeout, and malformed-response behavior', async () => {
    let responseKind: 'non-ok' | 'timeout' | 'malformed' = 'non-ok'
    const restore = installNetworkMock({
      target: () => {
        if (responseKind === 'non-ok') return Response.json({ error: 'analysis failed' }, { status: 502 })
        if (responseKind === 'timeout') throw new DOMException('deadline', 'AbortError')
        return Response.json({ id: '77' })
      },
    })

    try {
      const nonOk = await createSavedLink({
        url: 'https://public.example/non-ok', title: 'Provided', auto_analyze: true,
      })
      expect(nonOk.response.status).toBe(201)
      expect(await nonOk.response.json()).toMatchObject({ is_processed: false })
      expect(nonOk.operations.some(operation => operation.query.includes('UPDATE saved_links SET analysis_id'))).toBe(false)

      responseKind = 'timeout'
      const timeout = await createSavedLink({
        url: 'https://public.example/timeout', title: 'Provided', auto_analyze: true,
      })
      expect(timeout.response.status).toBe(500)
      expect(await timeout.response.json()).toEqual({ error: 'Failed to save link' })

      responseKind = 'malformed'
      const malformed = await createSavedLink({
        url: 'https://public.example/malformed', title: 'Provided', auto_analyze: true,
      })
      expect(malformed.response.status).toBe(500)
      expect(await malformed.response.json()).toEqual({ error: 'Failed to save link' })
      expect(malformed.operations.some(operation => operation.query.includes('UPDATE saved_links SET analysis_id'))).toBe(false)
    } finally {
      restore()
    }
  })
})
