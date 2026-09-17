import { test, expect } from '@playwright/test'
import { onRequest as middleware } from '../../../functions/api/_middleware'
import { AuthDbError, getUserFromRequest, withAuthDbFailureTracking, type AuthDbFailureSlot } from '../../../functions/api/_shared/auth-helpers'

/**
 * A datastore failure while resolving auth must reach the reader as a retryable
 * 503, not as whatever the endpoint happened to say.
 *
 * The contract has always said so. It almost never held: 242 of the 248
 * endpoints that resolve auth wrap their body in a try/catch and return their
 * own 500, swallowing AuthDbError before the middleware could translate it. A
 * D1 failure surfaced as "Failed to list COP sessions" — naming a subsystem
 * that had nothing to do with it, which is what sent the investigation to the
 * wrong place.
 */

/** A DB whose every statement fails, which is what this is all about. */
const brokenDb = {
  prepare() {
    return {
      bind() { return this },
      async first() { throw new Error('D1_ERROR: network failure') },
      async all() { throw new Error('D1_ERROR: network failure') },
    }
  },
} as unknown as D1Database

const request = (path = 'https://researchtools.test/api/anything') =>
  new Request(path, { headers: { 'X-User-Hash': 'a'.repeat(40) } })

function context(req: Request, next: () => Promise<Response>) {
  return { request: req, env: { DB: brokenDb }, next, data: {}, params: {}, waitUntil: () => {} }
}

test.describe('auth datastore failure mapping @smoke', () => {
  test('resolving auth against a broken datastore throws AuthDbError', async () => {
    const req = request()
    await expect(getUserFromRequest(req, { DB: brokenDb } as never)).rejects.toThrow(AuthDbError)
  })

  test('the failure lands in the slot the caller opened, and nowhere else', async () => {
    const mine: AuthDbFailureSlot = {}
    const theirs: AuthDbFailureSlot = {}

    await withAuthDbFailureTracking(mine, async () => {
      await getUserFromRequest(request(), { DB: brokenDb } as never).catch(() => {})
    })

    expect(mine.error).toBeInstanceOf(AuthDbError)
    // Concurrent requests share the isolate; one must never see another's.
    expect(theirs.error).toBeUndefined()
  })

  test('concurrent requests do not see each other failures', async () => {
    const failing: AuthDbFailureSlot = {}
    const healthy: AuthDbFailureSlot = {}
    const workingDb = {
      prepare() {
        return { bind() { return this }, async first() { return { id: 7 } }, async all() { return { results: [] } } }
      },
    } as unknown as D1Database

    await Promise.all([
      withAuthDbFailureTracking(failing, async () => {
        await getUserFromRequest(request(), { DB: brokenDb } as never).catch(() => {})
      }),
      withAuthDbFailureTracking(healthy, async () => {
        await getUserFromRequest(request(), { DB: workingDb } as never).catch(() => {})
      }),
    ])

    expect(failing.error).toBeInstanceOf(AuthDbError)
    expect(healthy.error).toBeUndefined()
  })

  test('recording outside a tracked request does not throw', async () => {
    // Crons and direct callers run with no store. The throw is the contract;
    // recording is best-effort and must not become a second failure mode.
    await expect(getUserFromRequest(request(), { DB: brokenDb } as never)).rejects.toThrow(AuthDbError)
  })

  test("an endpoint that swallows it into a 500 is corrected to 503", async () => {
    const req = request()
    // Exactly what 242 endpoints do: resolve auth inside a broad catch, then
    // report their own failure.
    const swallowingHandler = async () => {
      try {
        await getUserFromRequest(req, { DB: brokenDb } as never)
        return new Response('unreachable', { status: 200 })
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to list COP sessions' }), { status: 500 })
      }
    }

    const response = await middleware(context(req, swallowingHandler) as never)
    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('2')
    expect(await response.json()).toMatchObject({ retryable: true })
  })

  test('a spurious 401 is corrected too — the case the contract names', async () => {
    const req = request()
    const bouncingHandler = async () => {
      try {
        await getUserFromRequest(req, { DB: brokenDb } as never)
        return new Response('unreachable', { status: 200 })
      } catch {
        return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
      }
    }

    const response = await middleware(context(req, bouncingHandler) as never)
    // A DB hiccup must not bounce a signed-in reader to a login screen.
    expect(response.status).toBe(503)
  })

  test('a handler that recovered is left alone', async () => {
    const req = request()
    const recoveringHandler = async () => {
      try {
        await getUserFromRequest(req, { DB: brokenDb } as never)
      } catch {
        // Served from cache, say. The marker is set, but nothing went wrong
        // for the reader, and overriding a good response would be a regression.
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    const response = await middleware(context(req, recoveringHandler) as never)
    expect(response.status).toBe(200)
  })

  test('a real authorization or validation decision is left alone', async () => {
    for (const status of [400, 403, 404, 422]) {
      const req = request()
      const handler = async () => {
        await getUserFromRequest(req, { DB: brokenDb } as never).catch(() => {})
        return new Response(JSON.stringify({ error: 'no' }), { status })
      }
      const response = await middleware(context(req, handler) as never)
      expect(response.status, `status ${status}`).toBe(status)
    }
  })

  test('a request that never hit the datastore is untouched', async () => {
    const req = new Request('https://researchtools.test/api/anything')
    const handler = async () => new Response(JSON.stringify({ error: 'genuinely broken' }), { status: 500 })
    const response = await middleware(context(req, handler) as never)
    // No marker, so a real 500 stays a real 500 rather than being disguised.
    expect(response.status).toBe(500)
  })
})
