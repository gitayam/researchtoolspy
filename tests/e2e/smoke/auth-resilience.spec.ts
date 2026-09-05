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

function activeGuestUser() {
  return { created_at: new Date().toISOString(), role: 'guest' }
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

  test('@smoke guest session resolves an opaque isolated principal', async () => {
    const boundValues: unknown[] = []
    const db = {
      prepare: () => ({
        bind: (...values: unknown[]) => {
          boundValues.push(...values)
          return { first: async () => values[0] === 73 ? activeGuestUser() : { id: 73 } }
        },
      }),
    } as unknown as Env['DB']
    const sessionId = 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891'
    const request = new Request('https://researchtools.net/api/cross-table', {
      headers: { 'X-Guest-Session': sessionId },
    })

    await expect(getUserFromRequest(request, { DB: db })).resolves.toBe(73)
    expect(boundValues[0]).toMatch(/^guest-session:[a-f0-9]{64}$/)
    expect(String(boundValues[0])).not.toContain(sessionId)
  })

  test('@smoke malformed guest session is not authenticated', async () => {
    const env = { DB: makeResolvingDb(7) } as unknown as Env
    const request = new Request('https://researchtools.net/api/anything', {
      headers: { 'X-Guest-Session': 'guest_short' },
    })

    await expect(getUserFromRequest(request, env)).resolves.toBeNull()
  })

  test('@smoke guest workspace is provisioned only for its owning principal', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = []
    const db = {
      prepare: (sql: string) => ({
        bind: (...values: unknown[]) => {
          statements.push({ sql, values })
          return {
            first: async () => {
              if (sql.includes('JOIN workspace_members')) return null
              if (sql.includes('SELECT created_at, role')) return activeGuestUser()
              return sql.includes('SELECT owner_id') ? { owner_id: 73 } : { id: 73 }
            },
            run: async () => ({ success: true }),
          }
        },
      }),
    } as unknown as Env['DB']
    const workspaceId = 'guest-workspace-018f47ce-f8f4-7ad5-9f6d-83e61296f891'
    const request = new Request('https://researchtools.net/api/evidence-items', {
      headers: {
        'X-Guest-Session': 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891',
        'X-Workspace-ID': workspaceId,
      },
    })

    await expect(getUserFromRequest(request, { DB: db })).resolves.toBe(73)
    expect(statements.some(({ sql, values }) =>
      sql.includes('INSERT OR IGNORE INTO workspaces') && values[0] === workspaceId && values[1] === 73
    )).toBe(true)
    expect(statements.some(({ sql, values }) =>
      sql.includes('INSERT OR IGNORE INTO workspace_members') && values[1] === workspaceId && values[2] === 73
    )).toBe(true)
  })

  test('@smoke expired guest session is rejected server-side', async () => {
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => sql.includes('SELECT created_at, role')
            ? { created_at: '2020-01-01T00:00:00.000Z', role: 'guest' }
            : { id: 73 },
        }),
      }),
    } as unknown as Env['DB']
    const request = new Request('https://researchtools.net/api/anything', {
      headers: { 'X-Guest-Session': 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891' },
    })

    await expect(getUserFromRequest(request, { DB: db })).resolves.toBeNull()
  })
})
