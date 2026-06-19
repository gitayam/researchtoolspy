/**
 * Auth resilience smoke test (pure-Node, no browser, no HTTP server).
 *
 * Exercises functions/api/_shared/auth-helpers.ts directly to prove the
 * "503-on-D1-error instead of spurious 401" contract:
 *
 *   - A transient D1 failure while resolving an otherwise-VALID hash must yield
 *     a retryable 503 (the DB hiccupped — the user is authenticated).
 *   - Genuine no-auth (no Bearer, no X-User-Hash) must still yield 401.
 *   - A successful resolution must still return the user id.
 *
 * This imports the helpers and mocks D1 — no `page` fixture, no running server.
 * Mocks are deliberately cast with `as unknown as ...` because the mock D1 does
 * not structurally match the real D1Database type.
 */
import { test, expect } from '@playwright/test'
import {
  requireAuth,
  getUserFromRequest,
  type Env,
} from '../../../functions/api/_shared/auth-helpers'

const VALID_HASH = 'a'.repeat(24) // >= 16 chars, not "default"

/** Mock D1 whose first() always throws — simulates a transient datastore error.
 *  Throwing on every call also covers the SELECT retry path. */
function makeThrowingDb(): Env['DB'] {
  const stmt = {
    bind: () => ({
      first: async () => {
        throw new Error('D1_ERROR: storage caused object to be reset')
      },
    }),
  }
  return { prepare: () => stmt } as unknown as Env['DB']
}

/** Mock D1 whose SELECT first() resolves an existing user row. */
function makeResolvingDb(id: number): Env['DB'] {
  const stmt = {
    bind: () => ({
      first: async () => ({ id }),
    }),
  }
  return { prepare: () => stmt } as unknown as Env['DB']
}

test.describe('Auth resilience: 503 on D1 error, not spurious 401 @smoke', () => {
  test('@smoke transient D1 failure on a valid hash yields a retryable 503', async () => {
    const env = { DB: makeThrowingDb() } as unknown as Env
    const request = new Request('https://researchtools.net/api/anything', {
      headers: { 'X-User-Hash': VALID_HASH },
    })

    let thrown: unknown
    try {
      await requireAuth(request, env)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(Response)
    const res = thrown as Response
    expect(res.status).toBe(503)
    const body = (await res.json()) as { retryable?: boolean }
    expect(body.retryable).toBe(true)
    expect(res.headers.get('Retry-After')).toBe('2')
  })

  test('@smoke genuine no-auth yields a 401', async () => {
    const env = { DB: makeResolvingDb(7) } as unknown as Env
    // No X-User-Hash, no Authorization header.
    const request = new Request('https://researchtools.net/api/anything')

    let thrown: unknown
    try {
      await requireAuth(request, env)
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(Response)
    const res = thrown as Response
    expect(res.status).toBe(401)
  })

  test('@smoke happy path resolves the user id', async () => {
    const env = { DB: makeResolvingDb(42) } as unknown as Env
    const request = new Request('https://researchtools.net/api/anything', {
      headers: { 'X-User-Hash': VALID_HASH },
    })

    const fromRequest = await getUserFromRequest(request, env)
    expect(fromRequest).toBe(42)

    const required = await requireAuth(request, env)
    expect(required).toBe(42)
  })
})
