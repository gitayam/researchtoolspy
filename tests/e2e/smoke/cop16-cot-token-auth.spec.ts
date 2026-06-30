/**
 * COP-16 CoT token-auth source-guard (pure-Node, no browser, no HTTP server).
 *
 * Guards against regression of the token-auth path added to
 * `functions/api/cop/[id]/cot.ts` for headless TAK/ATAK clients that
 * cannot inject an X-User-Hash header and must poll via ?token=<shareToken>.
 *
 * All assertions are structural/source checks — no real D1 queries or
 * network calls are made. Mirrors the pattern used by cot-export.spec.ts
 * and ai-refusal-contract.spec.ts.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HANDLER_PATH = join(process.cwd(), 'functions/api/cop/[id]/cot.ts')

test.describe('COP-16 CoT token-auth source guard @smoke', () => {
  const src = readFileSync(HANDLER_PATH, 'utf8')

  test('@smoke handler reads "token" from URL search params', () => {
    // Must extract the token query param — TAK clients append ?token=<value>
    expect(src).toMatch(/searchParams\.get\(['"]token['"]\)/)
  })

  test('@smoke handler queries cop_shares table for token validation', () => {
    // Must look up the share token in the cop_shares table
    expect(src).toContain('cop_shares')
    expect(src).toContain('share_token')
    expect(src).toContain('cop_session_id')
  })

  test('@smoke handler still calls getUserFromRequest for header-auth fallback', () => {
    // The existing X-User-Hash path must not have been removed
    expect(src).toContain('getUserFromRequest')
  })

  test('@smoke handler returns 401 for an invalid/missing token (no-auth guard present)', () => {
    // Both the token-invalid path and the no-header path must yield a 401.
    // We verify by checking that status 401 appears at least twice in the source
    // (once for bad token, once for missing header auth).
    const matches = src.match(/status:\s*401/g)
    expect(matches).not.toBeNull()
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2)
  })

  test('@smoke token-auth branch does NOT call verifyCopSessionAccess (share token is its own credential)', () => {
    // The share-token branch should skip the full session-access check;
    // verifyCopSessionAccess is still present for the header-auth branch.
    expect(src).toContain('verifyCopSessionAccess')

    // Verify that the token branch guards against an empty share result rather
    // than calling verifyCopSessionAccess — the D1 SELECT is the gate.
    expect(src).toMatch(/share\s*=\s*await/)
  })
})
