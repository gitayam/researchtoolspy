import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/social-media-extract'

const INPUT_URL = 'https://bsky.app/profile/Retr0.ID/post/3k5nobkf2w72g'
const CANONICAL_URL = 'https://bsky.app/profile/retr0.id/post/3k5nobkf2w72g'
const DID = 'did:plc:vwzwgnygau7ed7b7wt5ux7y2'

function harness(signal?: AbortSignal) {
  const originalFetch = globalThis.fetch
  const providerCalls: URL[] = []
  const cacheCalls: string[] = []
  const dbCalls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
      const type = url.searchParams.get('type')
      return Response.json({
        Status: 0,
        Answer: [{ type: type === 'AAAA' ? 28 : 1, data: type === 'AAAA' ? '2606:4700::6812:1e5e' : '104.18.30.94' }],
      })
    }
    providerCalls.push(url)
    return Response.json({
      thread: {
        post: {
          uri: `at://${DID}/app.bsky.feed.post/3k5nobkf2w72g`,
          cid: 'bafy-not-emitted',
          author: {
            did: DID,
            handle: 'retr0.id',
            displayName: 'David Buchanan',
            avatar: 'https://attacker.example/avatar-not-emitted',
          },
          record: {
            $type: 'app.bsky.feed.post',
            text: 'A bounded Bluesky post',
            createdAt: '2023-10-19T22:22:08.853Z',
          },
          embed: {
            $type: 'app.bsky.embed.images#view',
            images: [{ fullsize: 'https://attacker.example/image-not-emitted' }],
          },
          replyCount: 2,
          repostCount: 3,
          likeCount: 5,
          quoteCount: 7,
        },
      },
    })
  }) as typeof fetch
  const env = {
    SESSIONS: { get: async () => JSON.stringify({ user_id: 53 }) },
    CACHE: {
      get: async () => { cacheCalls.push('get'); return null },
      put: async () => { cacheCalls.push('put') },
    },
    DB: { prepare: () => { dbCalls.push('prepare'); throw new Error('Bluesky route must not access D1') } },
  }
  const invoke = (body: Record<string, unknown>) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-media-extract', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  } as never)
  return { invoke, providerCalls, cacheCalls, dbCalls, restore: () => { globalThis.fetch = originalFetch } }
}

test.describe('INV-020 canonical Bluesky route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke returns bounded metadata and a canonical open action without cache or persistence', async () => {
    const subject = harness()
    try {
      const response = await subject.invoke({ url: INPUT_URL, mode: 'full' })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body).toEqual({
        success: true,
        platform: 'bluesky',
        postType: 'post',
        downloadOptions: [{
          quality: 'Open on Bluesky', format: 'web', url: CANONICAL_URL, hasAudio: false, hasVideo: false,
        }],
        metadata: {
          author: 'David Buchanan',
          authorHandle: '@retr0.id',
          authorDid: DID,
          authorUrl: 'https://bsky.app/profile/retr0.id',
          text: 'A bounded Bluesky post',
          createdAt: '2023-10-19T22:22:08.853Z',
          replyCount: 2,
          repostCount: 3,
          likeCount: 5,
          quoteCount: 7,
          uri: `at://${DID}/app.bsky.feed.post/3k5nobkf2w72g`,
          postUrl: CANONICAL_URL,
          hasMedia: true,
          mediaCount: 1,
          directMediaAvailable: false,
          extractedVia: 'Bluesky public AppView API',
        },
      })
      expect(JSON.stringify(body)).not.toContain('attacker.example')
      expect(JSON.stringify(body)).not.toContain('bafy-not-emitted')
      expect(subject.providerCalls).toHaveLength(1)
      expect(subject.providerCalls[0].hostname).toBe('public.api.bsky.app')
      expect(subject.providerCalls[0].searchParams.get('uri')).toBe(`at://retr0.id/app.bsky.feed.post/3k5nobkf2w72g`)
      expect(subject.cacheCalls).toEqual([])
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke accepts a normalized DID AT URI and omits open action in metadata mode', async () => {
    const subject = harness()
    try {
      const response = await subject.invoke({
        url: `at://${DID}/app.bsky.feed.post/3k5nobkf2w72g`,
        platform: 'BLUESKY',
        mode: 'metadata',
      })
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.downloadOptions).toBeUndefined()
      expect(body.metadata.postUrl).toBe(`https://bsky.app/profile/${DID}/post/3k5nobkf2w72g`)
      expect(subject.providerCalls).toHaveLength(1)
      expect(subject.cacheCalls).toEqual([])
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke rejects malformed, spoofed, mismatched, and invalid-mode inputs before side effects', async () => {
    const cases = [
      { url: 'http://bsky.app/profile/retr0.id/post/3k5nobkf2w72g', platform: 'bluesky' },
      { url: `${INPUT_URL}?tracking=secret`, platform: 'bluesky' },
      { url: 'https://bsky.app.evil.test/profile/retr0.id/post/3k5nobkf2w72g', platform: 'bluesky' },
      { url: 'at://did:key:forged/app.bsky.feed.post/3k5nobkf2w72g', platform: 'bluesky' },
      { url: INPUT_URL, platform: 'twitter' },
      { url: INPUT_URL, platform: 'bluesky', mode: 'unsafe' },
    ]
    for (const body of cases) {
      const subject = harness()
      try {
        const response = await subject.invoke(body)
        expect([400, 422]).toContain(response.status)
        expect(subject.providerCalls).toEqual([])
        expect(subject.cacheCalls).toEqual([])
        expect(subject.dbCalls).toEqual([])
      } finally { subject.restore() }
    }
  })

  test('@smoke treats caller cancellation as terminal before provider, cache, or persistence work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const subject = harness(controller.signal)
    try {
      const response = await subject.invoke({ url: INPUT_URL, platform: 'bluesky' })
      expect(response.status).toBe(500)
      expect(subject.providerCalls).toEqual([])
      expect(subject.cacheCalls).toEqual([])
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke route source contains no retired Bluesky raw fetch, cache, persistence, or media URL handling', () => {
    const source = readFileSync(new URL('../../../functions/api/content-intelligence/social-media-extract.ts', import.meta.url), 'utf8')
    for (const forbidden of [
      'com.atproto.identity.resolveHandle',
      'function detectPlatform',
      'fetchWithRetry',
      'getCached',
      'social_media_extractions',
      'saveSocialMediaExtraction',
      'post.embed.playlist',
      'img.fullsize',
    ]) expect(source).not.toContain(forbidden)
  })
})
