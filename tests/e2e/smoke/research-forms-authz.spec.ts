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
 *
 * These assertions used to grep the handler for `cop_sessions`, `created_by`
 * and a collaborators table, because the guard was inlined there. It has since
 * moved into the shared `checkWorkspaceAccess` helper — and the assertions kept
 * passing, because the handler still MENTIONS `cop_sessions` in a comment.
 * Grepping a file for a word the guard used to contain is assurance that
 * survives the guard being deleted, which is worse than no assurance.
 *
 * So: the handler must CALL the guard before its main query, and the guard
 * itself must consult ownership and collaborators. Each assertion now reads the
 * file the behaviour lives in.
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

  test('@smoke handler calls the shared workspace guard', () => {
    const source = src('functions/api/research/forms/list.ts')
    expect(source).toContain('checkWorkspaceAccess')
    expect(source).toContain("from '../../_shared/workspace-helpers'")
  })

  test('@smoke the guard itself checks ownership and collaborators', () => {
    // Where the check actually lives. `list.ts` only mentions cop_sessions in a
    // comment now, so asserting against the handler proved nothing.
    const guard = src('functions/api/_shared/workspace-helpers.ts')
    expect(guard).toContain('cop_sessions')
    expect(guard).toContain('created_by')
    // Collaborators can legitimately filter by workspace, so owner-only would
    // lock them out of their own sessions.
    expect(guard).toContain('cop_collaborators')
  })

  test('@smoke handler has a 403 response path for unauthorized workspace access', () => {
    const source = src('functions/api/research/forms/list.ts')
    expect(source).toContain('403')
    expect(source).toContain('Access denied')
  })

  test('@smoke the guard is awaited before the query is executed', () => {
    const source = src('functions/api/research/forms/list.ts')
    const guardIdx = source.indexOf('await checkWorkspaceAccess')
    // Against execution, not against the SQL text. The query is built as a
    // template string BEFORE the guard runs and appended to afterwards, so
    // `FROM survey_drops` legitimately appears first — comparing against it
    // failed while the ordering that matters was correct.
    const executeIdx = source.indexOf('DB.prepare(query)')
    expect(guardIdx, 'guard is awaited').toBeGreaterThan(-1)
    expect(executeIdx, 'query is executed').toBeGreaterThan(-1)
    // Existence enumeration is the risk: a workspace id that is not yours must
    // be refused before anything runs against it.
    expect(guardIdx).toBeLessThan(executeIdx)
  })

  test('@smoke submissions/list does not accept workspaceId (not vulnerable to this issue)', () => {
    const source = src('functions/api/research/submissions/list.ts')
    // submissions/list scopes only by formId and status — no workspaceId param.
    expect(source).not.toContain("searchParams.get('workspaceId')")
    expect(source).not.toContain('searchParams.get("workspaceId")')
  })
})
