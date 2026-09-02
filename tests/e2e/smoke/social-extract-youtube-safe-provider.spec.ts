import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/social-extract'

const VIDEO_ID = 'AbC_dEf-123'
const CANONICAL_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`
const PUBLIC_V4 = '93.184.216.34'
const PUBLIC_V6 = '2606:2800:220:1:248:1893:25c8:1946'

interface TransportCall {
  url: URL
  init?: RequestInit
}

interface HarnessOptions {
  authenticated?: boolean
  signal?: AbortSignal
  provider?: (url: URL, init?: RequestInit) => Response | Promise<Response>
  saveFails?: boolean
}

function providerJson(value: unknown, status = 200): Response {
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
  const dbBindings: unknown[][] = []
  let dbCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com') {
      const isV6 = url.searchParams.get('type') === 'AAAA'
      return providerJson({ Status: 0, Answer: [{ type: isV6 ? 28 : 1, data: isV6 ? PUBLIC_V6 : PUBLIC_V4 }] })
    }
    transport.push({ url, init })
    if (options.provider) return await options.provider(url, init)
    if (url.pathname === '/oembed') return providerJson(oembed())
    if (url.pathname === '/youtubei/v1/player') return providerJson({})
    throw new Error(`Unexpected transport ${url.href}`)
  }) as typeof fetch

  const env = {
    SESSIONS: {
      get: async (token: string) => options.authenticated !== false && token === 'session-token'
        ? JSON.stringify({ user_id: 17 })
        : null,
    },
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

  const invoke = async (body: Record<string, unknown>, headers: Record<string, string> = {}) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-extract', {
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
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  } as never)

  return {
    invoke,
    transport,
    dbBindings,
    dbCalls: () => dbCalls,
    restore: () => { globalThis.fetch = originalFetch },
  }
}

test.describe('INV-019 canonical YouTube provider route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke rejects unauthenticated, missing, invalid, spoofed, mismatched, and invalid options with zero side effects', async () => {
    const scenarios: Array<{ body: Record<string, unknown>; authenticated?: boolean; status: number; json: unknown }> = [
      { body: { url: CANONICAL_URL, platform: 'youtube' }, authenticated: false, status: 401, json: { error: 'Authentication required' } },
      { body: {}, status: 400, json: { error: 'URL and platform are required' } },
      { body: { url: 'https://youtube.com/watch?v=bad', platform: 'youtube' }, status: 500, json: { success: false, error: 'Invalid YouTube URL' } },
      { body: { url: `https://youtube.com.evil.test/watch?v=${VIDEO_ID}`, platform: 'youtube' }, status: 500, json: { success: false, error: 'Invalid YouTube URL' } },
      { body: { url: CANONICAL_URL, platform: 'instagram' }, status: 400, json: { error: 'URL does not match the selected platform' } },
      { body: { url: CANONICAL_URL, platform: 'youtube', options: null }, status: 400, json: { error: 'Invalid extraction options' } },
      { body: { url: CANONICAL_URL, platform: 'youtube', extract_mode: 'unsafe' }, status: 400, json: { error: 'Invalid extraction options' } },
    ]
    for (const scenario of scenarios) {
      const subject = harness({ authenticated: scenario.authenticated })
      try {
        const response = await subject.invoke(scenario.body)
        expect(response.status).toBe(scenario.status)
        expect(await response.json()).toEqual(scenario.json)
        expect(subject.transport).toEqual([])
        expect(subject.dbCalls()).toBe(0)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke canonicalizes aliases, isolates credentials, preserves success fields, and stays ephemeral', async () => {
    const aliases = [
      CANONICAL_URL,
      `http://www.youtube.com/watch/?v=${VIDEO_ID}`,
      `https://m.youtube.com/embed/${VIDEO_ID}`,
      `https://youtube.com/embed/${VIDEO_ID}/`,
      `https://www.youtube.com/shorts/${VIDEO_ID}`,
      `http://m.youtube.com/shorts/${VIDEO_ID}/`,
      `https://youtube.com/live/${VIDEO_ID}`,
      `https://www.youtube.com/live/${VIDEO_ID}/`,
      `https://youtu.be/${VIDEO_ID}`,
      `http://youtu.be/${VIDEO_ID}/`,
      `HTTPS://WWW.YOUTUBE.COM/watch?v=${VIDEO_ID}`,
    ]
    for (const alias of aliases) {
      const subject = harness()
      try {
        const response = await subject.invoke({
          url: alias,
          platform: 'YouTube',
          extract_mode: 'full',
          options: { include_transcript: true, include_media: true },
        })
        expect(response.status).toBe(200)
        const json = await response.json() as {
          media: { download_options: unknown }
          [key: string]: unknown
        }
        expect(json).toMatchObject({
          success: true,
          platform: 'youtube',
          post_type: 'video',
          metadata: { post_url: CANONICAL_URL, video_id: VIDEO_ID },
          content: { transcript_available: false, transcript_word_count: 0 },
          media: { video_url: CANONICAL_URL },
        })
        expect(json.media.download_options).toEqual([
          { name: 'Watch on YouTube', url: CANONICAL_URL, description: 'Open the canonical video on YouTube' },
        ])
        expect(subject.transport.map(call => call.url.hostname)).toEqual(['www.youtube.com', 'www.youtube.com'])
        expect(subject.transport.map(call => call.url.pathname)).toEqual(['/oembed', '/youtubei/v1/player'])
        expect(subject.transport[0].url.searchParams.get('url')).toBe(CANONICAL_URL)
        expect(JSON.parse(String(subject.transport[1].init?.body)).videoId).toBe(VIDEO_ID)
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

  test('@smoke maps required metadata failure to the legacy 500 envelope without persistence', async () => {
    const subject = harness({ provider: () => providerJson({}, 503) })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, platform: 'youtube' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ success: false, error: 'YouTube extraction failed', platform: 'youtube' })
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke keeps transcript transport failure optional with the legacy empty transcript fields', async () => {
    const subject = harness({ provider: url => url.pathname === '/oembed' ? providerJson(oembed()) : providerJson({}, 503) })
    try {
      const response = await subject.invoke({
        url: CANONICAL_URL,
        platform: 'youtube',
        extract_mode: 'full',
        options: { include_transcript: true },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        success: true,
        content: { transcript_available: false, transcript_word_count: 0 },
      })
      expect(subject.dbBindings).toEqual([])
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke treats caller abort as generic failure and performs no provider or D1 work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const subject = harness({ signal: controller.signal })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, platform: 'youtube' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Social media extraction failed' })
      expect(subject.transport).toEqual([])
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke treats abort during provider work as generic failure with zero persistence', async () => {
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
      expect(await response.json()).toEqual({ error: 'Social media extraction failed' })
      expect(cancelled).toBe(true)
      expect(subject.dbCalls()).toBe(0)
    } finally {
      subject.restore()
    }
  })

  test('@smoke always exposes one canonical watch helper across the legacy mode/options matrix', async () => {
    const matrix = [
      { extract_mode: 'metadata', options: undefined },
      { extract_mode: 'metadata', options: { include_media: false } },
      { extract_mode: 'download', options: undefined },
      { extract_mode: 'download', options: { include_media: false } },
      { extract_mode: 'full', options: { include_transcript: false, include_media: false } },
    ]
    for (const entry of matrix) {
      const subject = harness()
      try {
        const response = await subject.invoke({ url: CANONICAL_URL, platform: 'youtube', ...entry })
        expect(response.status).toBe(200)
        const body = await response.json() as Record<string, unknown>
        expect(body).toMatchObject({
          success: true,
          platform: 'youtube',
          post_type: 'video',
          metadata: { post_url: CANONICAL_URL, video_id: VIDEO_ID, post_type: 'video' },
          content: { transcript_available: false, transcript_word_count: 0, description: 'YouTube video content extraction' },
          media: { video_url: CANONICAL_URL, embed_url: `https://www.youtube.com/embed/${VIDEO_ID}` },
        })
        expect((body.media as { download_options: unknown }).download_options).toEqual([
          { name: 'Watch on YouTube', url: CANONICAL_URL, description: 'Open the canonical video on YouTube' },
        ])
        expect(subject.dbCalls()).toBe(0)
      } finally {
        subject.restore()
      }
    }
  })
})
