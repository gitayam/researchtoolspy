import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/social-extract'

interface HarnessOptions {
  authenticated?: boolean
  signal?: AbortSignal
}

function harness(options: HarnessOptions = {}) {
  const originalFetch = globalThis.fetch
  const transports: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  let dbCalls = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    transports.push({ input, init })
    throw new Error('Facebook retirement route must not perform outbound transport')
  }) as typeof fetch

  const env = {
    SESSIONS: {
      get: async (token: string) => options.authenticated !== false && token === 'session-token'
        ? JSON.stringify({ user_id: 43 })
        : null,
    },
    DB: {
      prepare: () => {
        dbCalls += 1
        throw new Error('Facebook retirement route must not prepare D1 persistence')
      },
    },
  }
  const invoke = (body: Record<string, unknown>) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-extract', {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.authenticated === false ? {} : { Authorization: 'Bearer session-token' }),
      },
      body: JSON.stringify(body),
    }),
    env,
    params: {},
  } as never)
  return {
    invoke,
    transports,
    dbCalls: () => dbCalls,
    restore: () => { globalThis.fetch = originalFetch },
  }
}

function expectNoSideEffects(subject: ReturnType<typeof harness>): void {
  expect(subject.transports).toEqual([])
  expect(subject.dbCalls()).toBe(0)
}

test.describe('INV-019 deterministic Facebook retirement @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke preserves authentication before parsing or side effects', async () => {
    const subject = harness({ authenticated: false })
    try {
      const response = await subject.invoke({
        url: 'https://facebook.com/meta/posts/1234567890123456',
        platform: 'facebook',
      })
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Authentication required' })
      expectNoSideEffects(subject)
    } finally { subject.restore() }
  })

  test('@smoke canonicalizes posts and reels into explicit unavailable guidance', async () => {
    const cases = [
      {
        input: 'https://facebook.com/Meta/posts/1234567890123456',
        kind: 'post',
        id: '1234567890123456',
        owner: 'meta',
        canonical: 'https://www.facebook.com/meta/posts/1234567890123456/',
      },
      {
        input: 'https://www.facebook.com/reel/1173275247059289/',
        kind: 'reel',
        id: '1173275247059289',
        owner: undefined,
        canonical: 'https://www.facebook.com/reel/1173275247059289/',
      },
    ]
    for (const entry of cases) {
      for (const extract_mode of ['metadata', 'full', 'download']) {
        const subject = harness()
        try {
          const response = await subject.invoke({
            url: entry.input,
            platform: 'Facebook',
            extract_mode,
            options: { include_comments: false, include_transcript: false, include_media: false },
          })
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            success: false,
            error: 'Automatic Facebook extraction is unavailable. Open the public post on Facebook and capture the required content manually.',
            platform: 'facebook',
            post_type: entry.kind,
            metadata: {
              content_id: entry.id,
              ...(entry.owner ? { owner: entry.owner } : {}),
              post_url: entry.canonical,
              direct_link: entry.canonical,
              platform: 'facebook',
              post_type: entry.kind,
            },
            attempts: 0,
            errors: [],
            suggestions: [
              'Open the canonical public Facebook post.',
              'Capture the required text or media, then upload it to Content Research.',
            ],
          })
          expectNoSideEffects(subject)
        } finally { subject.restore() }
      }
    }
  })

  test('@smoke rejects malformed, spoofed, mismatched, and unsupported Facebook targets', async () => {
    const cases = [
      { body: { url: 'http://facebook.com/meta/posts/123456789', platform: 'facebook' }, status: 500, json: { success: false, error: 'Invalid Facebook URL' } },
      { body: { url: 'https://facebook.com.evil.test/meta/posts/123456789', platform: 'facebook' }, status: 500, json: { success: false, error: 'Invalid Facebook URL' } },
      { body: { url: 'https://facebook.com/meta/posts/123456789?tracking=secret', platform: 'facebook' }, status: 500, json: { success: false, error: 'Invalid Facebook URL' } },
      { body: { url: 'https://facebook.com/watch/?v=123456789', platform: 'facebook' }, status: 500, json: { success: false, error: 'Invalid Facebook URL' } },
      { body: { url: 'https://facebook.com/meta/posts/123456789', platform: 'tiktok' }, status: 400, json: { error: 'URL does not match the selected platform' } },
    ]
    for (const entry of cases) {
      const subject = harness()
      try {
        const response = await subject.invoke(entry.body)
        expect(response.status).toBe(entry.status)
        expect(await response.json()).toEqual(entry.json)
        expectNoSideEffects(subject)
      } finally { subject.restore() }
    }
  })

  test('@smoke rejects invalid modes and closed-option violations before side effects', async () => {
    const url = 'https://facebook.com/meta/posts/123456789'
    const cases = [
      { url, platform: 'facebook', extract_mode: 'unsafe' },
      { url, platform: 'facebook', options: null },
      { url, platform: 'facebook', options: [] },
      { url, platform: 'facebook', options: { include_comments: 1 } },
      { url, platform: 'facebook', options: { credential: 'secret' } },
    ]
    for (const body of cases) {
      const subject = harness()
      try {
        const response = await subject.invoke(body)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Invalid extraction options' })
        expectNoSideEffects(subject)
      } finally { subject.restore() }
    }
  })

  test('@smoke maps pre-aborted canonical input to generic failure without side effects', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const subject = harness({ signal: controller.signal })
    try {
      const response = await subject.invoke({
        url: 'https://facebook.com/meta/posts/123456789',
        platform: 'facebook',
      })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Social media extraction failed' })
      expectNoSideEffects(subject)
    } finally { subject.restore() }
  })

  test('@smoke source contains no false Facebook success or retired provider promise', () => {
    const source = readFileSync(new URL('../../../functions/api/content-intelligence/social-extract.ts', import.meta.url), 'utf8')
    for (const forbidden of [
      'async function extractFacebook(',
      'Use yt-dlp service for video downloads',
      'For full extraction, use the Social Media page',
    ]) expect(source).not.toContain(forbidden)
  })
})
