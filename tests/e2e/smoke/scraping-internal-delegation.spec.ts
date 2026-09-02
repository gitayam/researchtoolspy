import { expect, test } from '@playwright/test'
import { onRequestPost as batchProcessPost } from '../../../functions/api/tools/batch-process'
import { onRequestPost as pmesiiImportPost } from '../../../functions/api/frameworks/pmesii-pt/import-url'

const authHeaders = {
  Authorization: 'Bearer session-token',
  'X-User-Hash': 'trusted-user-hash-1234567890',
  'X-Workspace-ID': 'workspace-42',
  'Content-Type': 'application/json',
}

const sessions = {
  get: async (token: string) => token === 'session-token'
    ? JSON.stringify({ user_id: 7 })
    : null,
}

test.describe('internal scraping delegation @smoke', () => {
  test('@smoke batch processing forwards only trusted auth context to bounded same-origin tools', async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init })
      return Response.json({ title: 'Bounded metadata result' })
    }

    try {
      const response = await batchProcessPost({
        request: new Request('https://researchtools.example/api/tools/batch-process', {
          method: 'POST',
          headers: { ...authHeaders, 'X-Untrusted-Secret': 'must-not-forward' },
          body: JSON.stringify({
            operation: 'scrape-metadata',
            items: [{ id: 'one', type: 'url', source: 'https://public.example/article' }],
          }),
        }),
        env: { SESSIONS: sessions },
        params: {},
      } as never)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ succeeded: 1, failed: 0 })
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe('https://researchtools.example/api/tools/scrape-metadata')
      expect(calls[0].init?.redirect).toBe('error')
      const forwarded = new Headers(calls[0].init?.headers)
      expect(forwarded.get('Authorization')).toBe(authHeaders.Authorization)
      expect(forwarded.get('X-User-Hash')).toBe(authHeaders['X-User-Hash'])
      expect(forwarded.get('X-Workspace-ID')).toBe(authHeaders['X-Workspace-ID'])
      expect(forwarded.get('X-Untrusted-Secret')).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke PMESII imports use analyze-url and exclude raw URLs from AI metadata', async () => {
    const originalFetch = globalThis.fetch
    const rawUrl = 'https://public.example/sensitive-article?source=private'
    const contentHash = 'a'.repeat(64)
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      if (url === 'https://researchtools.example/api/content-intelligence/analyze-url') {
        return Response.json({
          url: rawUrl,
          title: 'Imported article',
          summary: 'A bounded analysis summary.',
          content_hash: contentHash,
          entities: {},
          top_phrases: [],
        })
      }
      if (url === 'https://gateway.ai.cloudflare.com/v1/test-account/research-tools-ai/openai/chat/completions') {
        return Response.json({ choices: [{ message: { content: JSON.stringify({ political: [] }) } }] })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }

    try {
      const response = await pmesiiImportPost({
        request: new Request('https://researchtools.example/api/frameworks/pmesii-pt/import-url', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ url: rawUrl }),
        }),
        env: {
          SESSIONS: sessions,
          OPENAI_API_KEY: 'test-openai-key',
          AI_GATEWAY_ACCOUNT_ID: 'test-account',
        },
        params: {},
      } as never)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        success: true,
        analysis_id: null,
        url: rawUrl,
        title: 'Imported article',
        dimensions: { political: [] },
      })
      expect(calls).toHaveLength(2)
      expect(calls[0].init?.redirect).toBe('error')
      const forwarded = new Headers(calls[0].init?.headers)
      expect(forwarded.get('Authorization')).toBe(authHeaders.Authorization)
      expect(forwarded.get('X-Workspace-ID')).toBe(authHeaders['X-Workspace-ID'])
      expect(JSON.parse(String(calls[0].init?.body))).toEqual({ url: rawUrl, mode: 'quick' })

      const aiHeaders = new Headers(calls[1].init?.headers)
      const metadata = aiHeaders.get('cf-aig-metadata')
      expect(metadata).not.toContain(rawUrl)
      expect(metadata).toContain(contentHash)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
