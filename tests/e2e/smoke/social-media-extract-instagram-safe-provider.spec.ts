import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

import { onRequestPost } from '../../../functions/api/content-intelligence/social-media-extract'

const SHORTCODE = 'AbC_123-xYz'
const CANONICAL_URL = `https://www.instagram.com/p/${SHORTCODE}/`
const INVALID_MESSAGE = 'Could not find a valid Instagram post ID in the URL. Please use a standard Instagram link (e.g., instagram.com/p/...).'
const UNAVAILABLE_MESSAGE = 'Automatic Instagram extraction is not currently available. Open the post on Instagram or download it manually, then upload it to Content Intelligence.'

interface HarnessOptions {
  authenticated?: boolean
  signal?: AbortSignal
}

function harness(options: HarnessOptions = {}) {
  const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  const cacheGets: unknown[] = []
  const cachePuts: unknown[] = []
  const dbCalls: string[] = []
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ input, init })
    throw new Error(`Instagram route must not fetch ${String(input)}`)
  }) as typeof fetch

  const env = {
    SESSIONS: {
      get: async (token: string) => options.authenticated !== false && token === 'session-token'
        ? JSON.stringify({ user_id: 41 })
        : null,
    },
    CACHE: {
      get: async (...args: unknown[]) => {
        cacheGets.push(args)
        throw new Error('Instagram route must not read CACHE')
      },
      put: async (...args: unknown[]) => {
        cachePuts.push(args)
        throw new Error('Instagram route must not write CACHE')
      },
    },
    DB: {
      prepare: (query: string) => {
        dbCalls.push(query)
        throw new Error('Instagram route must not access D1')
      },
    },
  }

  const invoke = async (body: Record<string, unknown>) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-media-extract', {
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
    fetchCalls,
    cacheGets,
    cachePuts,
    dbCalls,
    restore: () => { globalThis.fetch = originalFetch },
  }
}

function expectNoInstagramSideEffects(subject: ReturnType<typeof harness>): void {
  expect(subject.fetchCalls).toEqual([])
  expect(subject.cacheGets).toEqual([])
  expect(subject.cachePuts).toEqual([])
  expect(subject.dbCalls).toEqual([])
}

function expectFriendlyError(value: unknown, platform: string, message: string): void {
  expect(value).toMatchObject({
    success: false,
    platform,
    error: message,
    metadata: { technicalDetails: 'Extraction failed' },
  })
  expect((value as { metadata: { timestamp: unknown } }).metadata.timestamp)
    .toMatch(/^\d{4}-\d{2}-\d{2}T/)
}

test.describe('canonical Instagram no-provider route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke canonicalizes every supported kind, alias, hint case, and mode without side effects', async () => {
    const cases = [
      { url: `https://instagram.com/p/${SHORTCODE}`, platform: undefined, mode: 'metadata', kind: 'p' },
      { url: `HTTPS://WWW.INSTAGRAM.COM/reel/${SHORTCODE}/`, platform: 'InStAgRaM', mode: 'download', kind: 'reel' },
      { url: `https://instagram.com/tv/${SHORTCODE}`, platform: 'INSTAGRAM', mode: 'stream', kind: 'tv' },
      { url: `https://www.instagram.com/p/${SHORTCODE}/`, platform: 'instagram', mode: 'transcript', kind: 'p' },
      { url: `https://instagram.com/reel/${SHORTCODE}`, platform: 'instagram', mode: 'full', kind: 'reel' },
    ] as const

    for (const entry of cases) {
      const subject = harness()
      try {
        const response = await subject.invoke(entry)
        expect(response.status).toBe(422)
        expect(await response.json()).toEqual({
          success: false,
          platform: 'instagram',
          postType: entry.kind,
          error: UNAVAILABLE_MESSAGE,
          metadata: {
            kind: entry.kind,
            shortcode: SHORTCODE,
            canonicalUrl: `https://www.instagram.com/${entry.kind}/${SHORTCODE}/`,
            openUrl: `https://www.instagram.com/${entry.kind}/${SHORTCODE}/`,
            manualUploadGuidance: 'Download the post from Instagram, then upload it to Content Intelligence.',
          },
        })
        expectNoInstagramSideEffects(subject)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke classifies exact malformed URLs, mismatch, spoof hosts, and invalid modes before side effects', async () => {
    const cases: Array<{
      body: Record<string, unknown>
      status: number
      exact?: unknown
      platform?: string
      message?: string
    }> = [
      { body: { url: 'http://instagram.com/p/example' }, status: 422, platform: 'instagram', message: INVALID_MESSAGE },
      { body: { url: 'https://www.instagram.com/p/example?igsh=secret' }, status: 422, platform: 'instagram', message: INVALID_MESSAGE },
      { body: { url: 'https://instagram.com/stories/example' }, status: 422, platform: 'instagram', message: INVALID_MESSAGE },
      { body: { url: 'https://instagram.com/p/example', platform: 'INSTAGRAM', mode: 'unsafe' }, status: 422, platform: 'instagram', message: 'Instagram extraction mode is invalid.' },
      { body: { url: CANONICAL_URL, platform: 'twitter' }, status: 422, platform: 'instagram', message: 'The selected platform does not match the Instagram URL.' },
      { body: { url: 'https://instagram.com.evil.test/p/example' }, status: 400, exact: { success: false, error: 'Could not detect social media platform from URL' } },
      { body: { url: 'https://notinstagram.com/p/example' }, status: 400, exact: { success: false, error: 'Could not detect social media platform from URL' } },
      { body: { url: 'https://instagram。com/p/example' }, status: 400, exact: { success: false, error: 'Could not detect social media platform from URL' } },
    ]

    for (const entry of cases) {
      const subject = harness()
      try {
        const response = await subject.invoke(entry.body)
        expect(response.status).toBe(entry.status)
        const body = await response.json()
        if (entry.exact) {
          expect(body).toEqual(entry.exact)
        } else {
          expectFriendlyError(body, entry.platform!, entry.message!)
        }
        expectNoInstagramSideEffects(subject)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke maps a pre-aborted canonical request to generic failure with zero side effects', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const subject = harness({ signal: controller.signal })
    try {
      const response = await subject.invoke({ url: CANONICAL_URL, platform: 'instagram' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ success: false, error: 'Failed to extract social media content' })
      expectNoInstagramSideEffects(subject)
    } finally {
      subject.restore()
    }
  })

  test('@smoke removes every Instagram transport and cache implementation', () => {
    const source = readFileSync(resolve(
      process.cwd(),
      'functions/api/content-intelligence/social-media-extract.ts',
    ), 'utf8')

    for (const forbidden of [
      'extractInstagramVia',
      'extractInstagramShortcode',
      'snapinsta.app',
      'instadp.com',
      'saveinsta.app',
      'api.instagram.com',
      'instagram:${',
    ]) {
      expect(source).not.toContain(forbidden)
    }
    expect(source).not.toContain('https://co.wuk.sh')
  })
})
