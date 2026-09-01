import { expect, test } from '@playwright/test'
import { onRequestPost } from '../../../functions/api/content-intelligence/dime-analyze'

const DIME_RESULT = {
  diplomatic: [{ question: 'Diplomatic question?', answer: 'Diplomatic answer.' }],
  information: [{ question: 'Information question?', answer: 'Information answer.' }],
  military: [{ question: 'Military question?', answer: 'Military answer.' }],
  economic: [{ question: 'Economic question?', answer: 'Economic answer.' }],
  summary: 'Framework summary.',
}

function request(body: Record<string, unknown>, authenticated = false): Request {
  return new Request('https://researchtools.test/api/content-intelligence/dime-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { 'X-User-Hash': '0123456789abcdef0123456789abcdef' } : {}),
    },
    body: JSON.stringify(body),
  })
}

function aiResponse(): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify(DIME_RESULT) } }],
  })
}

test.describe('public DIME framework analysis @smoke', () => {
  test('@smoke generates an ephemeral DIME result without auth, analysis ID, or database writes', async () => {
    const originalFetch = globalThis.fetch
    let aiCalls = 0
    const db = {
      prepare() {
        throw new Error('anonymous DIME must not access D1')
      },
    } as unknown as D1Database

    globalThis.fetch = (async () => {
      aiCalls += 1
      return aiResponse()
    }) as typeof fetch

    try {
      const response = await onRequestPost({
        request: request({
          content_text: 'Public article content with enough context for framework analysis.',
          title: 'Public article',
          url: 'https://example.com/article',
        }),
        env: { DB: db, OPENAI_API_KEY: 'test-key' },
      } as never)

      expect(response.status).toBe(200)
      expect(aiCalls).toBe(1)
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        dime_analysis: DIME_RESULT,
        analysis_id: null,
        is_persisted: false,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke rejects oversized public framework input before AI spend', async () => {
    const originalFetch = globalThis.fetch
    let aiCalls = 0
    globalThis.fetch = (async () => {
      aiCalls += 1
      return aiResponse()
    }) as typeof fetch

    try {
      const response = await onRequestPost({
        request: request({ content_text: 'x'.repeat(100_001) }),
        env: {
          DB: { prepare: () => { throw new Error('must not query D1') } } as unknown as D1Database,
          OPENAI_API_KEY: 'test-key',
        },
      } as never)

      expect(response.status).toBe(413)
      expect(aiCalls).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke rejects an authenticated attempt to update another user analysis before AI spend', async () => {
    const originalFetch = globalThis.fetch
    let aiCalls = 0
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes('FROM users')) return { id: 7 }
                if (sql.includes('FROM content_analysis')) return null
                throw new Error(`Unexpected query: ${sql}`)
              },
            }
          },
        }
      },
    } as unknown as D1Database

    globalThis.fetch = (async () => {
      aiCalls += 1
      return aiResponse()
    }) as typeof fetch

    try {
      const response = await onRequestPost({
        request: request({ analysis_id: 99, content_text: 'Saved article content.' }, true),
        env: { DB: db, OPENAI_API_KEY: 'test-key' },
      } as never)

      expect(response.status).toBe(404)
      expect(aiCalls).toBe(0)
      await expect(response.json()).resolves.toEqual({ error: 'Analysis not found' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke persists DIME only to the authenticated owner analysis', async () => {
    const originalFetch = globalThis.fetch
    const updates: unknown[][] = []
    const db = {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first() {
                if (sql.includes('FROM users')) return { id: 7 }
                if (sql.includes('FROM content_analysis')) return { id: 42 }
                throw new Error(`Unexpected query: ${sql}`)
              },
              async run() {
                if (!sql.includes('UPDATE content_analysis') || !sql.includes('user_id = ?')) {
                  throw new Error(`Unsafe update: ${sql}`)
                }
                updates.push(values)
                return { success: true }
              },
            }
          },
        }
      },
    } as unknown as D1Database

    globalThis.fetch = (async () => aiResponse()) as typeof fetch

    try {
      const response = await onRequestPost({
        request: request({ analysis_id: 42, content_text: 'Owned saved article content.' }, true),
        env: { DB: db, OPENAI_API_KEY: 'test-key' },
      } as never)

      expect(response.status).toBe(200)
      expect(updates).toHaveLength(1)
      expect(updates[0]).toEqual([JSON.stringify(DIME_RESULT), 42, 7])
      await expect(response.json()).resolves.toMatchObject({
        analysis_id: 42,
        is_persisted: true,
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
