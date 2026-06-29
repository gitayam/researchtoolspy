/**
 * D-E8-2 read-join repoint guard (pure-Node, no browser/server).
 *
 * `evidence_items` is the single canonical evidence table. The handlers below
 * used to SELECT/JOIN the empty legacy `evidence` (singular) table, so their
 * read paths silently returned nothing. This unit repointed them to
 * `evidence_items` and reconciled the column-name drift between the two schemas.
 *
 * This source-level guard (modeled on system-b-retired.spec.ts) asserts:
 *   1. each repointed handler no longer references the bare `evidence` table in
 *      a FROM/JOIN clause (regression guard — the repoint must not be undone), and
 *   2. the column-drift mappings that would throw at runtime if reverted to the
 *      legacy column names are present (so a careless "swap the table back" or a
 *      blind column rename is caught here, not in prod).
 *
 * Out of scope (NOT asserted here): functions/api/evidence.ts is the legacy
 * singular CRUD endpoint that owns the `evidence` table outright — it is allowed
 * to keep referencing it. research_evidence is D-E8-3.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8')
}

// Matches `FROM evidence` / `JOIN evidence` on the bare singular table, while
// NOT matching evidence_items, evidence_citations, *_evidence link tables, etc.
const BARE_EVIDENCE_FROM_JOIN = /(?:FROM|JOIN)\s+evidence\b(?!_)/i

const REPOINTED_FILES = [
  'functions/api/events/[id].ts',
  'functions/api/deception/aggregate.ts',
  'functions/api/settings/data/export.ts',
  'functions/api/claims/[id].ts',
  'functions/api/claims/search-evidence.ts',
  'functions/api/claims/get-evidence-links/[id].ts',
  'functions/api/claims/export-markdown/[id].ts',
  'functions/api/claims/share/[id].ts',
  'functions/api/claims/link-evidence.ts',
]

test.describe('D-E8-2 read joins repointed to evidence_items @smoke', () => {
  for (const f of REPOINTED_FILES) {
    test(`@smoke ${f} no longer reads the bare evidence table`, () => {
      const src = read(f)
      // Strip line comments so a stale "// evidence table" comment can't trip the regex.
      const code = src.replace(/\/\/.*$/gm, '')
      expect(
        BARE_EVIDENCE_FROM_JOIN.test(code),
        `${f} still has a FROM/JOIN against the bare 'evidence' table`
      ).toBe(false)
      // And it must read the canonical table.
      expect(code).toMatch(/(?:FROM|JOIN)\s+evidence_items\b/i)
    })
  }

  test('@smoke search-evidence keeps owner scoping and aliases evidence_type -> type', () => {
    const src = read('functions/api/claims/search-evidence.ts')
    // Response contract preserved: consumers expect a `type` key.
    expect(src).toMatch(/evidence_type\s+AS\s+type/i)
    // Ownership scope must stay on created_by (the evidence_items owner column), not widen.
    expect(src).toContain('e.created_by = ?')
  })

  test('@smoke link-evidence ownership check uses created_by, never legacy user_id', () => {
    const src = read('functions/api/claims/link-evidence.ts')
    // The owner column on evidence_items is created_by; user_id does not exist there.
    expect(src).toContain('SELECT id, created_by')
    expect(src).toContain('evidence.created_by !== authUserId')
    expect(src).not.toContain('evidence.user_id')
  })

  test('@smoke get-evidence-links aliases drifted columns back to their response keys', () => {
    const src = read('functions/api/claims/get-evidence-links/[id].ts')
    expect(src).toMatch(/credibility\s+AS\s+credibility_score/i)
    expect(src).toMatch(/source_classification\s+AS\s+source_type/i)
    expect(src).toMatch(/description\s+AS\s+content_snippet/i)
    expect(src).toMatch(/NULL\s+AS\s+bias_rating/i)
  })

  test('@smoke deception aggregate reads eve_assessment aliased back to sats_evaluation', () => {
    const src = read('functions/api/deception/aggregate.ts')
    expect(src).toMatch(/eve_assessment\s+AS\s+sats_evaluation/i)
    expect(src).toContain('e.eve_assessment IS NOT NULL')
  })

  test('@smoke share endpoint aliases content/date/credibility to preserve its public shape', () => {
    const src = read('functions/api/claims/share/[id].ts')
    expect(src).toMatch(/description\s+AS\s+content/i)
    expect(src).toMatch(/when_occurred\s+AS\s+date/i)
    expect(src).toMatch(/credibility\s+AS\s+credibility_score/i)
    expect(src).toMatch(/evidence_type\s+AS\s+type/i)
  })
})
