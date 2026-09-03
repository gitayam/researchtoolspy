import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { onRequestPost as legacyRoute } from '../../../functions/api/content-intelligence/social-extract'
import { onRequestPost as activeRoute } from '../../../functions/api/content-intelligence/social-media-extract'

const INPUT_URL = 'https://tiktok.com/@Scout2015/video/6718335390845095173'
const CANONICAL_URL = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

function harness(route: typeof legacyRoute | typeof activeRoute, signal?: AbortSignal) {
  const fetchCalls: URL[] = []
  const cacheCalls: string[] = []
  const dbCalls: string[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
      const type = url.searchParams.get('type')
      return Response.json({ Status: 0, Answer: [{ type: type === 'AAAA' ? 28 : 1, data: type === 'AAAA' ? '2606:4700::6810:85e5' : '104.16.133.229' }] })
    }
    fetchCalls.push(url)
    return Response.json({
      title: 'Scramble up your name #example',
      author_name: 'Scout & Suki',
      author_url: 'https://attacker.example/not-emitted',
      thumbnail_url: 'https://attacker.example/not-emitted.jpg',
      html: '<script src="https://attacker.example/not-emitted.js"></script>',
    })
  }) as typeof fetch
  const env = {
    SESSIONS: { get: async () => JSON.stringify({ user_id: 17 }) },
    CACHE: {
      get: async () => { cacheCalls.push('get'); return null },
      put: async () => { cacheCalls.push('put') },
    },
    DB: { prepare: () => { dbCalls.push('prepare'); throw new Error('TikTok route must not access D1') } },
  }
  const invoke = (body: Record<string, unknown>) => route({
    request: new Request('https://researchtools.example/api/content-intelligence/social', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token', Cookie: 'private=1' },
      body: JSON.stringify(body),
    }),
    env, params: {},
  } as never)
  return { invoke, fetchCalls, cacheCalls, dbCalls, restore: () => { globalThis.fetch = originalFetch } }
}

test.describe('canonical TikTok routes @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke legacy route preserves bounded metadata and remains ephemeral', async () => {
    const subject = harness(legacyRoute)
    try {
      const response = await subject.invoke({ url: INPUT_URL, platform: 'TikTok', extract_mode: 'full' })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toMatchObject({
        success: true,
        platform: 'tiktok',
        post_type: 'video',
        extraction_method: 'TikTok oEmbed API',
        metadata: {
          post_url: CANONICAL_URL,
          video_id: '6718335390845095173',
          author: 'Scout & Suki',
          author_url: 'https://www.tiktok.com/@scout2015',
        },
        content: { text: 'Scramble up your name #example', word_count: 5 },
        media: { player_url: 'https://www.tiktok.com/player/v1/6718335390845095173', direct_media_available: false },
      })
      expect(JSON.stringify(body)).not.toContain('attacker.example')
      expect(subject.fetchCalls).toHaveLength(1)
      expect(subject.fetchCalls[0].searchParams.get('url')).toBe(CANONICAL_URL)
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke active route emits only first-party player and canonical open action', async () => {
    const subject = harness(activeRoute)
    try {
      const response = await subject.invoke({ url: INPUT_URL, mode: 'full' })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        platform: 'tiktok',
        postType: 'video',
        downloadOptions: [{ quality: 'Open on TikTok', format: 'web', url: CANONICAL_URL, hasAudio: false, hasVideo: false }],
        streamUrl: 'https://www.tiktok.com/player/v1/6718335390845095173',
        embedCode: '<iframe src="https://www.tiktok.com/player/v1/6718335390845095173" allow="encrypted-media; fullscreen" allowfullscreen></iframe>',
        metadata: {
          videoId: '6718335390845095173', authorName: 'Scout & Suki', authorHandle: '@scout2015',
          authorUrl: 'https://www.tiktok.com/@scout2015', description: 'Scramble up your name #example',
          videoUrl: CANONICAL_URL, extractedVia: 'TikTok oEmbed API', directMediaAvailable: false,
        },
      })
      expect(subject.fetchCalls).toHaveLength(1)
      expect(subject.cacheCalls).toEqual([])
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke rejects malformed, spoofed, mismatched, and invalid-mode inputs before side effects', async () => {
    const cases = [
      { url: 'http://www.tiktok.com/@scout/video/6718335390845095173', platform: 'tiktok' },
      { url: `${INPUT_URL}?is_from_webapp=1`, platform: 'tiktok' },
      { url: 'https://www.tiktok.com.evil.test/@scout/video/6718335390845095173', platform: 'tiktok' },
      { url: INPUT_URL, platform: 'twitter' },
      { url: INPUT_URL, platform: 'tiktok', mode: 'unsafe', extract_mode: 'unsafe' },
    ]
    for (const route of [legacyRoute, activeRoute]) {
      for (const body of cases) {
        const subject = harness(route)
        try {
          const response = await subject.invoke(body)
          expect([400, 422, 500]).toContain(response.status)
          expect(subject.fetchCalls).toEqual([])
          expect(subject.cacheCalls).toEqual([])
          expect(subject.dbCalls).toEqual([])
        } finally { subject.restore() }
      }
    }
  })

  test('@smoke pre-aborted requests perform no provider, cache, or persistence work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    for (const route of [legacyRoute, activeRoute]) {
      const subject = harness(route, controller.signal)
      try {
        expect((await subject.invoke({ url: INPUT_URL, platform: 'tiktok' })).status).toBe(500)
        expect(subject.fetchCalls).toEqual([])
        expect(subject.cacheCalls).toEqual([])
        expect(subject.dbCalls).toEqual([])
      } finally { subject.restore() }
    }
  })

  test('@smoke route sources contain no retired TikTok Cobalt transport', () => {
    const source = ['social-extract.ts', 'social-media-extract.ts']
      .map(file => readFileSync(resolve(process.cwd(), 'functions/api/content-intelligence', file), 'utf8')).join('\n')
    expect(source).not.toContain('co.wuk.sh')
    expect(source).not.toContain('extractedVia: \'cobalt.tools\'')
  })
})
