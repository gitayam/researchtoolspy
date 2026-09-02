import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { onRequestPost as legacyRoute } from '../../../functions/api/content-intelligence/social-extract'
import { onRequestPost as activeRoute } from '../../../functions/api/content-intelligence/social-media-extract'

const INPUT_URL = 'https://twitter.com/OpenAI/status/1973141012345678901'
const CANONICAL_URL = 'https://x.com/openai/status/1973141012345678901'

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
      html: '<blockquote class="twitter-tweet"><p>Hello &amp; goodbye <a href="https://attacker.example">link</a></p></blockquote>',
      author_name: 'OpenAI',
      author_url: 'https://attacker.example/not-emitted',
    })
  }) as typeof fetch
  const env = {
    SESSIONS: { get: async () => JSON.stringify({ user_id: 17 }) },
    CACHE: {
      get: async () => { cacheCalls.push('get'); return null },
      put: async () => { cacheCalls.push('put') },
    },
    DB: { prepare: () => { dbCalls.push('prepare'); throw new Error('Twitter route must not access D1') } },
  }
  const invoke = (body: Record<string, unknown>) => route({
    request: new Request('https://researchtools.example/api/content-intelligence/social', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token', Cookie: 'private=1' },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  } as never)
  return { invoke, fetchCalls, cacheCalls, dbCalls, restore: () => { globalThis.fetch = originalFetch } }
}

test.describe('canonical Twitter/X routes @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke legacy route canonicalizes and stays ephemeral', async () => {
    const subject = harness(legacyRoute)
    try {
      const response = await subject.invoke({
        url: INPUT_URL,
        platform: 'X',
        extract_mode: 'full',
        options: { include_media: true },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        platform: 'twitter',
        post_type: 'tweet',
        extraction_method: 'X oEmbed API',
        metadata: {
          post_url: CANONICAL_URL,
          tweet_id: '1973141012345678901',
          platform: 'twitter',
          author: 'OpenAI',
          author_url: 'https://x.com/openai',
          author_username: 'openai',
        },
        content: { text: 'Hello & goodbye link', word_count: 4 },
        media: {
          image_count: 0,
          extraction_note: 'Direct media is not returned by the public X oEmbed API. Open the canonical post to view or download media.',
        },
        limitations: [
          'Public oEmbed provides bounded post text and author metadata, not direct media URLs.',
          'Thread context is not included.',
        ],
      })
      expect(subject.fetchCalls).toHaveLength(1)
      expect(subject.fetchCalls[0].hostname).toBe('publish.x.com')
      expect(subject.fetchCalls[0].searchParams.get('url')).toBe(CANONICAL_URL)
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke active route returns canonical open action without cache or persistence', async () => {
    const subject = harness(activeRoute)
    try {
      const response = await subject.invoke({ url: INPUT_URL, platform: 'twitter', mode: 'full' })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        platform: 'twitter',
        postType: 'tweet',
        downloadOptions: [{ quality: 'Open on X', format: 'web', url: CANONICAL_URL, hasAudio: false, hasVideo: false }],
        metadata: {
          tweetId: '1973141012345678901',
          authorName: 'OpenAI',
          authorHandle: '@openai',
          authorUrl: 'https://x.com/openai',
          text: 'Hello & goodbye link',
          tweetUrl: CANONICAL_URL,
          hasMedia: false,
          mediaCount: 0,
          extractedVia: 'X oEmbed API',
          directMediaAvailable: false,
        },
      })
      expect(subject.fetchCalls).toHaveLength(1)
      expect(subject.cacheCalls).toEqual([])
      expect(subject.dbCalls).toEqual([])
    } finally { subject.restore() }
  })

  test('@smoke rejects malformed, spoofed, mismatched, and invalid-mode inputs before side effects', async () => {
    const cases = [
      { url: 'http://x.com/openai/status/1973141012345678901', platform: 'twitter' },
      { url: `${INPUT_URL}?s=20`, platform: 'x' },
      { url: 'https://x.com.evil.test/openai/status/1973141012345678901', platform: 'twitter' },
      { url: INPUT_URL, platform: 'instagram' },
      { url: INPUT_URL, platform: 'twitter', mode: 'unsafe', extract_mode: 'unsafe' },
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

  test('@smoke pre-aborted canonical requests perform no provider, cache, or persistence work', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    for (const route of [legacyRoute, activeRoute]) {
      const subject = harness(route, controller.signal)
      try {
        const response = await subject.invoke({ url: INPUT_URL, platform: 'twitter' })
        expect(response.status).toBe(500)
        expect(subject.fetchCalls).toEqual([])
        expect(subject.cacheCalls).toEqual([])
        expect(subject.dbCalls).toEqual([])
      } finally { subject.restore() }
    }
  })

  test('@smoke source contains no retired Twitter/X provider or raw embed implementation', () => {
    const files = ['social-extract.ts', 'social-media-extract.ts']
      .map(file => readFileSync(resolve(process.cwd(), 'functions/api/content-intelligence', file), 'utf8'))
      .join('\n')
    for (const forbidden of ['api.vxtwitter.com', 'publish.twitter.com', 'extractTweetId', 'extractTweetTextFromHTML', 'embedCode: embedHtml']) {
      expect(files).not.toContain(forbidden)
    }
    expect(files.match(/https:\/\/co\.wuk\.sh/g)).toHaveLength(1)
  })
})
