/**
 * Workspace authorization guard smoke test — research/forms/list (pure-Node, no HTTP server).
 *
 * Guards against item #19: the `workspaceId` query parameter on
 * GET /api/research/forms/list must be verified server-side before the main
 * SELECT, so an authenticated user cannot probe another user's workspace IDs
 * (even though the `created_by = ?` clause already prevents data leakage, a
 * missing ownership check allows existence enumeration via empty-vs-populated
 * results or timing).
 *
 * Strategy: source-file assertions (no live DB required).
 *   1. The handler file must reference `workspaceId` AND an ownership check
 *      (SELECT against `cop_sessions` or a collaborators table) before the
 *      main survey_drops query.
 *   2. A 403 response path must exist in the handler.
 *   3. The submissions/list endpoint does NOT accept workspaceId (not vulnerable).
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

function src(rel: string): string {
  return readFileSync(
    new URL(`../../../${rel}`, import.meta.url).pathname,
    'utf-8',
  )
}

test.describe('research/forms/list workspace authorization @smoke', () => {
  test('@smoke handler source references workspaceId parameter', () => {
    const source = src('functions/api/research/forms/list.ts')
    expect(source).toContain('workspaceId')
  })

  test('@smoke handler performs an ownership check against cop_sessions before the main query', () => {
    const source = src('functions/api/research/forms/list.ts')
    // The guard must query cop_sessions to verify ownership.
    expect(source).toContain('cop_sessions')
    // And must check created_by (owner) — the core of the ownership assertion.
    expect(source).toContain('created_by')
  })

  test('@smoke handler has a 403 response path for unauthorized workspace access', () => {
    const source = src('functions/api/research/forms/list.ts')
    expect(source).toContain('403')
    expect(source).toContain('Access denied')
  })

  test('@smoke ownership check (cop_sessions) appears before the main survey_drops SELECT', () => {
    const source = src('functions/api/research/forms/list.ts')
    const ownershipCheckIdx = source.indexOf('cop_sessions')
    const mainQueryIdx = source.indexOf('FROM survey_drops')
    expect(ownershipCheckIdx).toBeGreaterThan(-1)
    expect(mainQueryIdx).toBeGreaterThan(-1)
    // The cop_sessions check (ownership guard) must be declared before the main
    // survey_drops query in the file. The function definition comes first, then
    // the handler body calls it before executing the main query.
    expect(ownershipCheckIdx).toBeLessThan(mainQueryIdx)
  })

  test('@smoke collaborator path is also checked (not just owner)', () => {
    const source = src('functions/api/research/forms/list.ts')
    // The guard must also consult the collaborators table so collaborators
    // can legitimately filter by workspace.
    expect(source).toContain('cop_collaborators')
  })

  test('@smoke submissions/list does not accept workspaceId (not vulnerable to this issue)', () => {
    const source = src('functions/api/research/submissions/list.ts')
    // submissions/list scopes only by formId and status — no workspaceId param.
    expect(source).not.toContain("searchParams.get('workspaceId')")
    expect(source).not.toContain('searchParams.get("workspaceId")')
  })
})
