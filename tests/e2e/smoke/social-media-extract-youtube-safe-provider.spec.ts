import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/social-media-extract'

const VIDEO_ID = 'AbC_dEf-123'
const CANONICAL_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`
const PUBLIC_V4 = '93.184.216.34'
const PUBLIC_V6 = '2606:2800:220:1:248:1893:25c8:1946'
const TRANSCRIPT_FALLBACK = 'Transcript not available for this video. Try using YouTube\'s built-in transcript feature.'

interface TransportCall { url: URL; init?: RequestInit }
interface CachePut { key: string; value: string; options?: KVNamespacePutOptions }
interface HarnessOptions {
  authenticated?: boolean
  signal?: AbortSignal
  cached?: string | null
  provider?: (url: URL, init?: RequestInit) => Response | Promise<Response>
  saveFails?: boolean
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Content-Type': 'application/json' } })
}

function oembed(): Record<string, unknown> {
  return {
    title: 'Canonical title',
    author_name: 'Canonical author',
    author_url: 'https://www.youtube.com/@canonical',
    thumbnail_url: `https://i.ytimg.com/vi/${VIDEO_ID}/default.jpg`,
    thumbnail_width: 480,
    thumbnail_height: 360,
  }
}

function harness(options: HarnessOptions = {}) {
  const transport: TransportCall[] = []
  const cacheGets: string[] = []
  const cachePuts: CachePut[] = []
  const dbBindings: unknown[][] = []
  let dbCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const isV6 = url.searchParams.get('type') === 'AAAA'
      return json({ Status: 0, Answer: [{ type: isV6 ? 28 : 1, data: isV6 ? PUBLIC_V6 : PUBLIC_V4 }] })
    }
    transport.push({ url, init })
    if (options.provider) return await options.provider(url, init)
    if (url.pathname === '/oembed') return json(oembed())
    if (url.pathname === '/youtubei/v1/player') return json({})
    throw new Error(`Unexpected provider transport ${url.href}`)
  }) as typeof fetch

  const cache = {
    get: async (key: string) => {
      cacheGets.push(key)
      return options.cached ?? null
    },
    put: async (key: string, value: string, putOptions?: KVNamespacePutOptions) => {
      cachePuts.push({ key, value, options: putOptions })
    },
  }
  const env = {
    SESSIONS: {
      get: async (token: string) => options.authenticated !== false && token === 'session-token'
        ? JSON.stringify({ user_id: 23 })
        : null,
    },
    CACHE: cache,
    DB: {
      prepare: () => {
        dbCalls += 1
        return {
          bind: (...bindings: unknown[]) => {
            dbBindings.push(bindings)
            return {
              run: async () => {
                if (options.saveFails) throw new Error('D1 unavailable')
                return { meta: { changes: 1, last_row_id: 1 } }
              },
            }
          },
        }
      },
    },
  }
  const invoke = async (body: Record<string, unknown>) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-media-extract', {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.authenticated === false ? {} : {
          Authorization: 'Bearer session-token',
          'X-User-Hash': 'sensitive-user-hash',
        }),
        Cookie: 'secret-cookie=1',
        'X-Workspace-ID': 'sensitive-workspace',
      },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  } as never)
  return {
    invoke,
    transport,
    cacheGets,
    cachePuts,
    dbBindings,
    dbCalls: () => dbCalls,
    restore: () => { globalThis.fetch = originalFetch },
  }
}

function expectFriendlyYouTubeError(value: unknown, message: string): void {
  expect(value).toMatchObject({
    success: false,
    platform: 'youtube',
    error: message,
    metadata: { technicalDetails: 'Extraction failed' },
  })
  const metadata = (value as { metadata: { timestamp: unknown } }).metadata
  expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
}

test.describe('INV-020 canonical YouTube provider route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke rejects auth, missing, invalid, spoofed, platform mismatch, and mode errors before cache/provider/D1', async () => {
    const cases: Array<{ body: Record<string, unknown>; authenticated?: boolean; status: number; message?: string; exact?: unknown }> = [
      { body: { url: CANONICAL_URL }, authenticated: false, status: 401, exact: { error: 'Authentication required' } },
      { body: {}, status: 400, exact: { success: false, error: 'URL is required' } },
      { body: { url: 'https://youtube.com/watch?v=bad', platform: 'youtube' }, status: 422, message: 'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).' },
      { body: { url: 'https://youtube.com/watch?v=bad' }, status: 422, message: 'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).' },
      { body: { url: 'http://m.youtube.com/playlist?list=PL123' }, status: 422, message: 'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).' },
      { body: { url: 'https://youtu.be/not-an-id?secret=value' }, status: 422, message: 'Could not find a valid YouTube video ID in the URL. Please use a standard YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...).' },
      { body: { url: `https://youtube.com.evil.test/watch?v=${VIDEO_ID}` }, status: 400, exact: { success: false, error: 'Could not detect social media platform from URL' } },
      { body: { url: `https://youtube。com/watch?v=${VIDEO_ID}` }, status: 400, exact: { success: false, error: 'Could not detect social media platform from URL' } },
      { body: { url: CANONICAL_URL, platform: 'instagram' }, status: 422, message: 'The selected platform does not match the YouTube URL.' },
      { body: { url: CANONICAL_URL, mode: 'unsafe' }, status: 422, message: 'YouTube extraction mode is invalid.' },
    ]
    for (const scenario of cases) {
      const subject = harness({ authenticated: scenario.authenticated })
      try {
        const response = await subject.invoke(scenario.body)
        expect(response.status).toBe(scenario.status)
        const body = await response.json()
        if (scenario.exact) expect(body).toEqual(scenario.exact)
        else expectFriendlyYouTubeError(body, scenario.message!)
        expect(subject.cacheGets).toEqual([])
        expect(subject.cachePuts).toEqual([])
        expect(subject.transport).toEqual([])
        expect(subject.dbCalls()).toBe(0)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke canonical aliases remain ephemeral and credentials never reach YouTube', async () => {
    for (const { url, mode } of [
      { url: `http://youtu.be/${VIDEO_ID}`, mode: 'full' },
      { url: `https://m.youtube.com/live/${VIDEO_ID}/`, mode: 'full' },
      { url: CANONICAL_URL, mode: 'metadata' },
    ]) {
      const subject = harness()
      try {
        const response = await subject.invoke({ url, mode })
        expect(response.status).toBe(200)
        const body = await response.json() as {
          metadata: { watchUrl: unknown; videoId: unknown }
          streamUrl: unknown
          transcript?: unknown
          downloadOptions: unknown
        }
        expect(body.metadata.watchUrl).toBe(CANONICAL_URL)
        expect(body.metadata.videoId).toBe(VIDEO_ID)
        expect(body.streamUrl).toBe(`https://www.youtube.com/embed/${VIDEO_ID}`)
        expect(body.transcript).toBe(mode === 'full' ? TRANSCRIPT_FALLBACK : undefined)
        expect(body.downloadOptions).toEqual(mode === 'full'
          ? [{ quality: 'Watch on YouTube', format: 'web', url: CANONICAL_URL, hasAudio: true, hasVideo: true }]
          : [])
        expect(subject.cacheGets).toEqual([])
        expect(subject.cachePuts).toEqual([])
        expect(subject.transport.every(call => call.url.hostname === 'www.youtube.com')).toBe(true)
        expect(subject.transport.every(call => ['/oembed', '/youtubei/v1/player'].includes(call.url.pathname))).toBe(true)
        expect(subject.transport[0].url.searchParams.get('url')).toBe(CANONICAL_URL)
        for (const call of subject.transport) {
          const headers = new Headers(call.init?.headers)
          expect(headers.has('authorization')).toBe(false)
          expect(headers.has('cookie')).toBe(false)
          expect(headers.has('x-user-hash')).toBe(false)
          expect(headers.has('x-workspace-id')).toBe(false)
        }
        expect(subject.dbBindings).toEqual([])
        expect(subject.dbCalls()).toBe(0)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke maps required failure and caller abort without cache writes or persistence', async () => {
    const failed = harness({ provider: () => json({}, 503) })
    try {
      const response = await failed.invoke({ url: CANONICAL_URL, platform: 'youtube' })
      expect(response.status).toBe(422)
      expectFriendlyYouTubeError(await response.json(), 'YouTube video could not be extracted. The video may be private, age-restricted, or unavailable in your region.')
      expect(failed.cacheGets).toEqual([])
      expect(failed.cachePuts).toEqual([])
      expect(failed.dbCalls()).toBe(0)
    } finally {
      failed.restore()
    }

    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const aborted = harness({ signal: controller.signal })
    try {
      const response = await aborted.invoke({ url: CANONICAL_URL, platform: 'youtube' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ success: false, error: 'Failed to extract social media content' })
      expect(aborted.cacheGets).toEqual([])
      expect(aborted.cachePuts).toEqual([])
      expect(aborted.transport).toEqual([])
      expect(aborted.dbCalls()).toBe(0)
    } finally {
      aborted.restore()
    }
  })

  test('@smoke abort during provider work remains ephemeral', async () => {
    const controller = new AbortController()
    let cancelled = false
    const subject = harness({
      signal: controller.signal,
      provider: (_url, init) => new Response(new ReadableStream<Uint8Array>({
        start(streamController) {
          streamController.enqueue(new TextEncoder().encode('{'))
          init?.signal?.addEventListener('abort', () => streamController.enqueue(new Uint8Array(129 * 1024)), { once: true })
          setTimeout(() => controller.abort(new Error('caller stopped')), 5)
        },
        cancel() { cancelled = true },
      }), { headers: { 'Content-Type': 'application/json' } }),
    })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, platform: 'youtube' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ success: false, error: 'Failed to extract social media content' })
      expect(cancelled).toBe(true)
      expect(subject.cacheGets).toEqual([])
      expect(subject.cachePuts).toEqual([])
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke maps optional transcript transport failure to the exact legacy fallback ephemerally', async () => {
    const subject = harness({ provider: url => url.pathname === '/oembed' ? json(oembed()) : json({}, 503) })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, mode: 'transcript' })
      expect(response.status).toBe(200)
      expect((await response.json() as { transcript: string }).transcript).toBe(TRANSCRIPT_FALLBACK)
      expect(subject.cacheGets).toEqual([])
      expect(subject.cachePuts).toEqual([])
      expect(subject.dbBindings).toEqual([])
    } finally {
      subject.restore()
    }
  })

  test('@smoke preserves transcript success without KV or D1 mutation', async () => {
    const subject = harness({
      saveFails: true,
      provider: url => {
        if (url.pathname === '/oembed') return json(oembed())
        if (url.pathname === '/youtubei/v1/player') {
          return json({ captions: { playerCaptionsTracklistRenderer: { captionTracks: [{
            baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en`, languageCode: 'en',
          }] } } })
        }
        if (url.pathname === '/api/timedtext') return new Response('<text>bounded transcript</text>', { headers: { 'Content-Type': 'application/xml' } })
        throw new Error(`Unexpected ${url.href}`)
      },
    })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, mode: 'transcript' })
      expect(response.status).toBe(200)
      expect((await response.json() as { transcript: string }).transcript).toBe('bounded transcript')
      expect(subject.cacheGets).toEqual([])
      expect(subject.cachePuts).toEqual([])
      expect(subject.dbBindings).toEqual([])
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke rejects an unsupported legacy platform without transport, cache, or D1', async () => {
    const entry = { platform: 'reddit', url: 'https://www.reddit.com/r/example/comments/abc/post', mode: 'full' }
    const subject = harness({ provider: () => { throw new Error('unsupported route must not fetch') } })
    try {
      const response = await subject.invoke(entry)
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({ success: false, platform: 'reddit' })
      expect(subject.transport).toEqual([])
      expect(subject.cacheGets).toEqual([])
      expect(subject.cachePuts).toEqual([])
      expect(subject.dbBindings).toEqual([])
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })
})
