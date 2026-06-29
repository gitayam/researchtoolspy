import { test, expect } from '../fixtures/base-test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * D-E8-4 — the singular /api/evidence endpoint is retired (410 Gone).
 *
 * As part of making `evidence_items` the single canonical evidence store, the
 * legacy `evidence`-table CRUD handler was replaced with a tombstone so that
 *   (a) no live code reads/writes the bare `evidence` table (unblocks the D-E8-5
 *       DROP), and
 *   (b) any stray client gets an unambiguous 410 pointing at /api/evidence-items.
 *
 * This is a pure source-guard (no network): it reads the handler source and
 * asserts the retirement is in place and won't silently regress.
 */
const HANDLER = join(process.cwd(), 'functions/api/evidence.ts')

test.describe('D-E8-4 singular /api/evidence retired @smoke', () => {
  const src = readFileSync(HANDLER, 'utf8')

  test('@smoke handler no longer runs any SQL against the bare `evidence` table', () => {
    // No CRUD verbs against the legacy singular table. (We intentionally match
    // the bare table name only — `evidence_items` / `research_evidence` etc. must
    // not exist here either since this file should hold no DB access at all.)
    expect(src).not.toMatch(/FROM\s+evidence\b/i)
    expect(src).not.toMatch(/INTO\s+evidence\b/i)
    expect(src).not.toMatch(/UPDATE\s+evidence\b/i)
    expect(src).not.toMatch(/DELETE\s+FROM\s+evidence\b/i)
    // Belt-and-suspenders: the tombstone touches no database at all.
    expect(src).not.toMatch(/env\.DB\b/)
    expect(src).not.toMatch(/\.prepare\s*\(/)
  })

  test('@smoke handler returns 410 Gone and points to the canonical endpoint', () => {
    expect(src).toMatch(/status:\s*410/)
    expect(src).toContain('/api/evidence-items')
    // Preflight is still handled (CORS must not break for any caller).
    expect(src).toMatch(/OPTIONS/)
    expect(src).toMatch(/status:\s*204/)
  })
})
