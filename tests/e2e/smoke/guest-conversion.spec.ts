import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { onRequest } from '../../../functions/api/guest-conversions'
import { onRequestGet as getGuestCleanup } from '../../../functions/api/cron/cleanup-guests'

function authDb(role: 'user' | 'guest') {
  return {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          if (sql.includes('SELECT role, user_hash')) {
            return { role, user_hash: role === 'guest' ? 'guest-session:opaque' : String(values[0]) }
          }
          if (sql.includes('SELECT created_at, role')) {
            return { role: 'guest', is_active: 1, created_at: new Date().toISOString() }
          }
          return { id: role === 'guest' ? 73 : 42 }
        },
      }),
    }),
  }
}

test.describe('Guest save boundary @smoke', () => {
  test('@smoke guest identity alone cannot invoke Save Bookmark conversion', async () => {
    const response = await onRequest({
      request: new Request('https://researchtools.net/api/guest-conversions', {
        method: 'POST',
        headers: { 'X-Guest-Session': 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891' },
      }),
      env: { DB: authDb('guest') },
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Login required to save guest work' })
  })

  test('@smoke authenticated account must also prove the guest session', async () => {
    const response = await onRequest({
      request: new Request('https://researchtools.net/api/guest-conversions', {
        method: 'POST',
        headers: { 'X-User-Hash': '1234567890123456' },
      }),
      env: { DB: authDb('user') },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Active guest session required' })
  })

  test('@smoke guest cleanup is secret-guarded', async () => {
    const response = await getGuestCleanup({
      request: new Request('https://researchtools.net/api/cron/cleanup-guests'),
      env: { DB: authDb('user'), CRON_SECRET: 'configured-secret' },
    } as never)
    expect(response.status).toBe(401)
  })

  test('@smoke retention SQL uses valid dependency-aware deletes', () => {
    const source = readFileSync('functions/api/cron/cleanup-guests.ts', 'utf8')
    expect(source).not.toContain('DELETE OR IGNORE')
    expect(source).toContain('pass < 2')
    expect(source).toContain('workspace_id')
  })

  test('@smoke authenticated conversion transfers ownership and stores only opaque guest identity', async () => {
    const executed: Array<{ sql: string; values: unknown[] }> = []
    const db = {
      prepare: (sql: string) => ({
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values
          return this
        },
        first: async function () {
          executed.push({ sql: this.sql, values: this.values })
          if (this.sql.includes('SELECT role, user_hash')) return { role: 'user', user_hash: '1234567890123456' }
          if (this.sql.includes('created_at, role')) {
            return { id: 73, role: 'guest', is_active: 1, created_at: new Date().toISOString() }
          }
          if (this.sql.includes('guest_conversions WHERE')) return null
          if (this.sql.includes('FROM users WHERE user_hash')) {
            return { id: String(this.values[0]).startsWith('guest-session:') ? 73 : 42 }
          }
          return null
        },
        all: async function () {
          executed.push({ sql: this.sql, values: this.values })
          return { results: [{ name: 'cross_tables', sql: 'CREATE TABLE cross_tables (id TEXT, user_id INTEGER)' }] }
        },
        run: async function () {
          executed.push({ sql: this.sql, values: this.values })
          return { meta: { changes: 1, last_row_id: 9 } }
        },
      }),
      batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
        executed.push(...statements.map(({ sql, values }) => ({ sql, values })))
        return statements.map(() => ({ meta: { changes: 1 } }))
      },
    }
    const rawGuestSession = 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891'
    const response = await onRequest({
      request: new Request('https://researchtools.net/api/guest-conversions', {
        method: 'POST',
        headers: {
          'X-User-Hash': '1234567890123456',
          'X-Guest-Session': rawGuestSession,
        },
      }),
      env: { DB: db },
    })

    expect(response.status).toBe(201)
    expect(executed.some(({ sql }) => sql.includes('UPDATE OR IGNORE "cross_tables"'))).toBe(true)
    expect(executed.some(({ sql }) => sql.includes('UPDATE workspaces SET owner_id'))).toBe(true)
    const conversionInsert = executed.find(({ sql }) => sql.includes('INSERT OR IGNORE INTO guest_conversions'))
    expect(conversionInsert?.values[0]).toMatch(/^guest-session:[a-f0-9]{64}$/)
    expect(conversionInsert?.values).not.toContain(rawGuestSession)
  })
})
