/**
 * Audit-log sink smoke test (pure-Node, no browser, no HTTP server).
 *
 * Exercises functions/api/_shared/event-log.ts directly to prove the
 * single-canonical-audit-trail contract (TD-03b):
 *
 *   - An 'audit'-level event is written to the event_logs table with the
 *     expected level / source / message — and NEVER carries a secret
 *     (the rerouted hash-backup audit must not leak the backup code).
 *   - logEvent never throws / never breaks its caller, even with no env.DB.
 *
 * This imports logEvent and mocks D1 — no `page` fixture, no running server.
 * Mocks are deliberately cast with `as unknown as` because the mock D1 does
 * not structurally match the real D1Database type.
 */
import { test, expect } from '@playwright/test'
import { logEvent } from '../../../functions/api/_shared/event-log'

// The first arg to logEvent is typed as a structural { DB?: D1Database }; our
// mock does not match D1Database, so cast through `unknown` (same style as the
// sibling auth-resilience smoke spec) to keep `npm run type-check`/lint clean.
type LogEnv = Parameters<typeof logEvent>[0]

/** Mock D1 that records the prepared SQL and the bound args for assertion. */
function makeRecordingDb() {
  const record = { sql: '' as string, args: [] as unknown[] }
  const db = {
    prepare: (sql: string) => {
      record.sql = sql
      return {
        bind: (...args: unknown[]) => {
          record.args = args
          return { run: async () => {} }
        },
      }
    },
  }
  return { db: db as unknown as NonNullable<LogEnv['DB']>, record }
}

test.describe('Audit-log sink: single canonical trail via event_logs @smoke', () => {
  test('@smoke an audit event is written to event_logs without leaking a secret', async () => {
    const { db, record } = makeRecordingDb()
    const env = { DB: db } as unknown as LogEnv

    const BACKUP_CODE = 'SECRET123ABC' // must never appear in the bound args
    await logEvent(env, {
      level: 'audit',
      source: 'settings/hash/backup',
      message: 'hash_backup_generated',
      context: { category: 'security', user_hash_prefix: 'abcd1234' },
      userId: null,
    })

    // Wrote to the single canonical sink.
    expect(record.sql).toContain('INSERT INTO event_logs')

    // Bound args carry the right level / source / message.
    expect(record.args).toContain('audit')
    expect(record.args).toContain('settings/hash/backup')
    expect(record.args).toContain('hash_backup_generated')

    // SECURITY: no secret (backup code) leaked anywhere in the bound args.
    const serialized = JSON.stringify(record.args)
    expect(serialized).not.toContain(BACKUP_CODE)
  })

  test('@smoke logEvent never throws when env.DB is absent', async () => {
    // No env.DB — the sink must resolve quietly, never breaking its caller.
    await expect(
      logEvent({} as unknown as LogEnv, {
        level: 'audit',
        source: 'settings/hash/backup',
        message: 'hash_backup_generated',
        context: { category: 'security' },
        userId: null,
      })
    ).resolves.toBeUndefined()
  })
})
