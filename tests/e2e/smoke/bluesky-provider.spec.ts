import { expect, test } from '@playwright/test'
import { fetchBlueskyProvider } from '../../../functions/api/_shared/bluesky-provider'
import { parseCanonicalBlueskyUrl, type CanonicalBlueskyTarget } from '../../../functions/api/_shared/social-url'

const HANDLE_URL = 'https://bsky.app/profile/retr0.id/post/3k5nobkf2w72g'
const DID = 'did:plc:vwzwgnygau7ed7b7wt5ux7y2'
const RKEY = '3k5nobkf2w72g'

function target(input = HANDLE_URL): CanonicalBlueskyTarget {
  const parsed = parseCanonicalBlueskyUrl(input)
  if (!parsed) throw new Error('invalid test target')
  return parsed
}

function postFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uri: `at://${DID}/app.bsky.feed.post/${RKEY}`,
    cid: 'bafy-provider-value-is-not-emitted',
    author: {
      did: DID,
      handle: 'retr0.id',
      displayName: 'David Buchanan',
      avatar: 'https://attacker.example/avatar-not-emitted',
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'Bounded public post text',
      createdAt: '2023-10-19T22:22:08.853Z',
    },
    replyCount: 2,
    repostCount: 3,
    likeCount: 5,
    quoteCount: 7,
    indexedAt: '2023-10-19T22:22:09.000Z',
    ...overrides,
  }
}

function jsonResponse(post = postFixture()): Response {
  return Response.json({ thread: { post } })
}

const publicResolver = async () => ['104.18.30.94']

test.describe('bounded Bluesky provider @smoke', () => {
  test('@smoke performs one exact AppView request and emits only bounded metadata', async () => {
    const calls: URL[] = []
    const result = await fetchBlueskyProvider(target(), {
      resolveHostname: publicResolver,
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(new URL(String(input)))
        return jsonResponse(postFixture({
          embed: {
            $type: 'app.bsky.embed.images#view',
            images: [
              { fullsize: 'https://attacker.example/fullsize-not-emitted' },
              { fullsize: 'https://attacker.example/second-not-emitted' },
            ],
          },
        }))
      }) as typeof fetch,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].origin + calls[0].pathname).toBe('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread')
    expect(calls[0].searchParams.get('uri')).toBe(`at://retr0.id/app.bsky.feed.post/${RKEY}`)
    expect(calls[0].searchParams.get('depth')).toBe('0')
    expect(calls[0].searchParams.get('parentHeight')).toBe('0')
    expect(result).toEqual({
      success: true,
      metadata: {
        text: 'Bounded public post text',
        createdAt: '2023-10-19T22:22:08.853Z',
        authorName: 'David Buchanan',
        authorHandle: '@retr0.id',
        authorDid: DID,
        authorUrl: 'https://bsky.app/profile/retr0.id',
        postUri: `at://${DID}/app.bsky.feed.post/${RKEY}`,
        replyCount: 2,
        repostCount: 3,
        likeCount: 5,
        quoteCount: 7,
        hasMedia: true,
        mediaCount: 2,
        postType: 'post',
      },
    })
    expect(JSON.stringify(result)).not.toContain('attacker.example')
    expect(JSON.stringify(result)).not.toContain('bafy-provider')
  })

  test('@smoke preserves DID identity and classifies replies and quote media without returning media URLs', async () => {
    const didTarget = target(`at://${DID}/app.bsky.feed.post/${RKEY}`)
    const result = await fetchBlueskyProvider(didTarget, {
      resolveHostname: publicResolver,
      fetchImpl: (async () => jsonResponse(postFixture({
        author: { did: DID, handle: 'retr0.id', displayName: '' },
        record: {
          $type: 'app.bsky.feed.post',
          text: '',
          createdAt: '2023-10-19T22:22:08.853Z',
          reply: { root: {}, parent: {} },
        },
        embed: {
          $type: 'app.bsky.embed.recordWithMedia#view',
          media: { $type: 'app.bsky.embed.video#view', playlist: 'https://attacker.example/video.m3u8' },
        },
      }))) as typeof fetch,
    })
    expect(result.success).toBe(true)
    expect(result.metadata).toMatchObject({
      authorName: 'retr0.id', postType: 'reply', text: '', hasMedia: true, mediaCount: 1,
    })
    expect(JSON.stringify(result)).not.toContain('video.m3u8')
  })

  test('@smoke rejects forged targets before DNS or transport', async () => {
    let resolves = 0
    let fetches = 0
    const forged = { ...target(), canonicalUrl: 'https://attacker.example/post' }
    const result = await fetchBlueskyProvider(forged, {
      resolveHostname: async () => { resolves += 1; return ['104.18.30.94'] },
      fetchImpl: (async () => { fetches += 1; return jsonResponse() }) as typeof fetch,
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'invalid_target' } })
    expect({ resolves, fetches }).toEqual({ resolves: 0, fetches: 0 })
  })

  test('@smoke snapshots target identity before asynchronous provider work', async () => {
    const mutable = target()
    let release: (() => void) | undefined
    const gate = new Promise<void>(resolve => { release = resolve })
    const pending = fetchBlueskyProvider(mutable, {
      resolveHostname: async () => { await gate; return ['104.18.30.94'] },
      fetchImpl: (async (input: RequestInfo | URL) => {
        expect(new URL(String(input)).searchParams.get('uri')).toBe(`at://retr0.id/app.bsky.feed.post/${RKEY}`)
        return jsonResponse()
      }) as typeof fetch,
    })
    mutable.actor = 'attacker.example'
    mutable.atUri = `at://attacker.example/app.bsky.feed.post/${RKEY}`
    release?.()
    expect((await pending).success).toBe(true)
  })

  test('@smoke rejects identity mismatch, malformed schemas, unknown embeds, and oversized arrays', async () => {
    const invalidPosts = [
      postFixture({ author: { did: DID, handle: 'other.example', displayName: 'Other' } }),
      postFixture({ author: { did: DID, handle: 'evil.example/path', displayName: 'Other' } }),
      postFixture({ uri: `at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/app.bsky.feed.post/${RKEY}` }),
      postFixture({ record: { $type: 'attacker.record', text: 'text', createdAt: '2023-10-19T22:22:08.853Z' } }),
      postFixture({ record: { $type: 'app.bsky.feed.post', text: 'text', createdAt: 'not-a-date' } }),
      postFixture({ record: { text: 'x'.repeat(3001), createdAt: '2023-10-19T22:22:08.853Z' } }),
      postFixture({ likeCount: -1 }),
      postFixture({ embed: { $type: 'app.bsky.embed.future#view' } }),
      postFixture({ embed: { $type: 'app.bsky.embed.images#view', images: Array.from({ length: 5 }, () => ({})) } }),
    ]
    for (const post of invalidPosts) {
      const result = await fetchBlueskyProvider(target(), {
        resolveHostname: publicResolver,
        fetchImpl: (async () => jsonResponse(post)) as typeof fetch,
      })
      expect(result).toEqual({ success: false, failure: { stage: 'post', code: 'invalid_response' } })
    }
  })

  test('@smoke rejects redirects, wrong MIME, malformed JSON, and oversized bodies', async () => {
    const responses = [
      new Response(null, { status: 302, headers: { Location: 'https://attacker.example/redirect' } }),
      new Response('{}', { headers: { 'Content-Type': 'text/html' } }),
      new Response('{bad', { headers: { 'Content-Type': 'application/json' } }),
      new Response('x'.repeat(256 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }),
    ]
    for (const response of responses) {
      const result = await fetchBlueskyProvider(target(), {
        resolveHostname: publicResolver,
        fetchImpl: (async () => response) as typeof fetch,
      })
      expect(result.success).toBe(false)
      expect(['policy', 'invalid_response']).toContain(result.failure?.code)
    }
  })

  test('@smoke treats an already-aborted caller as terminal before DNS or transport', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    let work = 0
    const result = await fetchBlueskyProvider(target(), {
      signal: controller.signal,
      resolveHostname: async () => { work += 1; return ['104.18.30.94'] },
      fetchImpl: (async () => { work += 1; return jsonResponse() }) as typeof fetch,
    })
    expect(result).toEqual({ success: false, failure: { stage: 'target', code: 'aborted' } })
    expect(work).toBe(0)
  })

  test('@smoke treats caller cancellation during transport as terminal', async () => {
    const controller = new AbortController()
    let started: (() => void) | undefined
    const transportStarted = new Promise<void>(resolve => { started = resolve })
    const pending = fetchBlueskyProvider(target(), {
      signal: controller.signal,
      resolveHostname: publicResolver,
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        started?.()
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
        })
      }) as typeof fetch,
    })
    await transportStarted
    controller.abort(new Error('caller stopped'))
    expect(await pending).toEqual({ success: false, failure: { stage: 'post', code: 'aborted' } })
  })
})
