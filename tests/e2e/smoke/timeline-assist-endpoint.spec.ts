import { expect, test } from '@playwright/test'
import { onRequestGet, onRequestPost } from '../../../functions/api/tools/timeline-assist'
import { TIMELINE_ASSIST_SCHEMA_VERSION } from '../../../functions/api/_shared/timeline-assist-contract'

const validBody = {
  schemaVersion: TIMELINE_ASSIST_SCHEMA_VERSION,
  action: 'suggest_questions',
  article: { url: 'https://publisher.example/story', title: 'Source story' },
  events: [{
    id: 'event-one',
    eventDate: '2026-09-01',
    title: 'Documented event',
    description: null,
    origin: 'source',
    assessment: 'unreviewed',
  }],
}

function dbReturningUser(userId: number): D1Database {
  const statement = {
    bind: () => statement,
    first: async () => ({ id: userId }),
  }
  return { prepare: () => statement } as unknown as D1Database
}

test.describe('timeline AI assistance endpoint @smoke', () => {
  test('@smoke requires a principal before spending an AI call', async () => {
    const response = await onRequestPost({
      request: new Request('https://researchtools.net/api/tools/timeline-assist', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
      env: { DB: dbReturningUser(7), OPENAI_API_KEY: 'not-used' },
    } as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' })
  })

  test('@smoke returns normalized suggestions without mutating the supplied timeline', async () => {
    const originalFetch = globalThis.fetch
    let outboundBody: Record<string, unknown> | null = null
    globalThis.fetch = async (_input, init) => {
      outboundBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [{
                kind: 'question',
                content: 'Which records corroborate the documented event?',
                rationale: 'Identify an independent source.',
                after_event_id: 'event-one',
                before_event_id: null,
              }],
            }),
          },
        }],
      })
    }

    try {
      const response = await onRequestPost({
        request: new Request('https://researchtools.net/api/tools/timeline-assist', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${'a'.repeat(32)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validBody),
        }),
        env: { DB: dbReturningUser(7), OPENAI_API_KEY: 'test-key' },
      } as never)

      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      await expect(response.json()).resolves.toMatchObject({
        schemaVersion: TIMELINE_ASSIST_SCHEMA_VERSION,
        action: 'suggest_questions',
        outcome: 'suggestions',
        suggestions: [{
          kind: 'question',
          content: 'Which records corroborate the documented event?',
          afterEventId: 'event-one',
        }],
      })
      expect(outboundBody).not.toBeNull()
      expect((outboundBody!.messages as Array<{ role: string }>)[0].role).toBe('system')
      expect(validBody.events).toHaveLength(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('@smoke rejects GET with an explicit method contract', async () => {
    const response = await onRequestGet({} as never)
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST, OPTIONS')
  })
})
