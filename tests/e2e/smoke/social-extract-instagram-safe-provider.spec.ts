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
    throw new Error('Instagram route must not perform outbound transport')
  }) as typeof fetch

  const env = {
    SESSIONS: {
      get: async (token: string) => options.authenticated !== false && token === 'session-token'
        ? JSON.stringify({ user_id: 31 })
        : null,
    },
    DB: {
      prepare: () => {
        dbCalls += 1
        throw new Error('Instagram route must not prepare D1 persistence')
      },
    },
  }

  const invoke = async (body: Record<string, unknown>) => onRequestPost({
    request: new Request('https://researchtools.example/api/content-intelligence/social-extract', {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.authenticated === false ? {} : {
          Authorization: 'Bearer session-token',
          Cookie: 'private-cookie=1',
          'X-User-Hash': 'private-user-hash',
          'X-Workspace-ID': 'private-workspace',
        }),
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

test.describe('INV-019 deterministic Instagram route @smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('@smoke preserves authentication and platform-required envelopes with zero side effects', async () => {
    const scenarios = [
      {
        authenticated: false,
        body: { url: 'https://instagram.com/p/AbC_123-xYz', platform: 'instagram' },
        status: 401,
        json: { error: 'Authentication required' },
      },
      {
        authenticated: true,
        body: { url: 'https://instagram.com/p/AbC_123-xYz' },
        status: 400,
        json: { error: 'URL and platform are required' },
      },
    ]
    for (const scenario of scenarios) {
      const subject = harness({ authenticated: scenario.authenticated })
      try {
        const response = await subject.invoke(scenario.body)
        expect(response.status).toBe(scenario.status)
        expect(await response.json()).toEqual(scenario.json)
        expectNoSideEffects(subject)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke canonicalizes supported kinds into bounded deterministic manual guidance', async () => {
    const cases = [
      { input: 'https://instagram.com/p/AbC_123-xYz', canonical: 'https://www.instagram.com/p/AbC_123-xYz/', kind: 'post' },
      { input: 'https://www.instagram.com/reel/reel_123/', canonical: 'https://www.instagram.com/reel/reel_123/', kind: 'reel' },
      { input: 'HTTPS://INSTAGRAM.COM/tv/TV-123', canonical: 'https://www.instagram.com/tv/TV-123/', kind: 'igtv' },
    ]
    for (const entry of cases) {
      for (const extract_mode of ['metadata', 'full', 'download']) {
        const subject = harness()
        try {
          const response = await subject.invoke({
            url: entry.input,
            platform: 'Instagram',
            extract_mode,
            options: { include_comments: false, include_transcript: true, include_media: false },
          })
          expect(response.status).toBe(500)
          expect(await response.json()).toEqual({
            success: false,
            error: 'Instagram extraction is unavailable. Download the post manually and upload it to Content Research.',
            platform: 'instagram',
            post_type: entry.kind,
            metadata: {
              shortcode: entry.canonical.split('/').at(-2),
              post_url: entry.canonical,
              direct_link: entry.canonical,
              platform: 'instagram',
              post_type: entry.kind,
            },
            attempts: 0,
            errors: [],
            suggestions: [
              'Download manually from the canonical Instagram post.',
              'Upload the downloaded media to Content Research.',
            ],
          })
          expectNoSideEffects(subject)
        } finally {
          subject.restore()
        }
      }
    }
  })

  test('@smoke rejects spoofed, malformed, and mismatched Instagram targets before side effects', async () => {
    const scenarios = [
      { body: { url: 'https://instagram.com.evil.test/p/AbC_123-xYz', platform: 'instagram' }, status: 500, json: { success: false, error: 'Invalid Instagram URL' } },
      { body: { url: 'http://instagram.com/p/AbC_123-xYz', platform: 'instagram' }, status: 500, json: { success: false, error: 'Invalid Instagram URL' } },
      { body: { url: 'https://instagram.com/p/AbC_123-xYz?igsh=secret', platform: 'instagram' }, status: 500, json: { success: false, error: 'Invalid Instagram URL' } },
      { body: { url: 'https://instagram.com/p/AbC_123-xYz', platform: 'youtube' }, status: 400, json: { error: 'URL does not match the selected platform' } },
      { body: { url: 'https://instagram.com/p/AbC_123-xYz', platform: 'twitter' }, status: 400, json: { error: 'URL does not match the selected platform' } },
    ]
    for (const scenario of scenarios) {
      const subject = harness()
      try {
        const response = await subject.invoke(scenario.body)
        expect(response.status).toBe(scenario.status)
        expect(await response.json()).toEqual(scenario.json)
        expectNoSideEffects(subject)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke rejects invalid Instagram modes and option values before side effects', async () => {
    const url = 'https://instagram.com/p/AbC_123-xYz'
    const scenarios = [
      { url, platform: 'instagram', extract_mode: 'unsafe' },
      { url, platform: 'instagram', options: null },
      { url, platform: 'instagram', options: [] },
      { url, platform: 'instagram', options: { include_comments: 1 } },
      { url, platform: 'instagram', options: { include_transcript: null } },
      { url, platform: 'instagram', options: { include_media: 'yes' } },
    ]
    for (const body of scenarios) {
      const subject = harness()
      try {
        const response = await subject.invoke(body)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Invalid extraction options' })
        expectNoSideEffects(subject)
      } finally {
        subject.restore()
      }
    }
  })

  test('@smoke maps a pre-aborted Instagram request to generic failure without side effects', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller stopped'))
    const subject = harness({ signal: controller.signal })
    try {
      const response = await subject.invoke({ url: 'https://instagram.com/p/AbC_123-xYz', platform: 'instagram' })
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Social media extraction failed' })
      expectNoSideEffects(subject)
    } finally {
      subject.restore()
    }
  })

  test('@smoke source contains no obsolete Instagram transport or provider parsing', () => {
    const source = readFileSync(new URL('../../../functions/api/content-intelligence/social-extract.ts', import.meta.url), 'utf8')
    for (const forbidden of [
      'query_hash=',
      '__a=1',
      'window._sharedData',
      '__additionalDataLoaded',
      'instagram_oembed',
      'graph.facebook.com',
      'formatInstagramSuccess',
      'fetch(`https://www.instagram.com',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
