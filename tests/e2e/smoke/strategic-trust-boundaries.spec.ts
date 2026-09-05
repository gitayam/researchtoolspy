import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { entityNodeId } from '../../../functions/api/intelligence/network'

function source(relativePath: string): string {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8')
}

test.describe('strategic answer-system trust boundaries @smoke', () => {
  test('@smoke content Q&A owner-scopes the source analysis', () => {
    const handler = source('functions/api/content-intelligence/answer-question.ts')
    expect(handler).toContain('WHERE id = ? AND user_id = ?')
    expect(handler).toContain('.bind(analysis_id, userId)')
  })

  test('@smoke evidence recommendations enforce access and scope every evidence query', () => {
    const handler = source('functions/api/evidence/recommend.ts')
    expect(handler).toContain("checkWorkspaceAccess(workspace_id, userId, env, 'VIEWER')")
    expect(handler).toContain("const evidenceScope = workspace_id ? 'e.workspace_id = ?' : 'e.created_by = ?'")

    const evidenceQueries = handler.match(/FROM evidence_items e/g) ?? []
    const scopedQueries = handler.match(/WHERE \$\{evidenceScope\}/g) ?? []
    expect(evidenceQueries.length).toBeGreaterThan(0)
    expect(scopedQueries).toHaveLength(evidenceQueries.length)
  })

  test('@smoke collection creation requires a writable workspace', () => {
    const handler = source('functions/api/collection/start.ts')
    expect(handler).toContain("checkWorkspaceAccess(workspaceId, userId, env, 'EDITOR')")
    expect(handler).toContain("upper(role) IN ('ADMIN', 'EDITOR')")
    expect(handler).toContain("status: 403")
  })

  test('@smoke collection reads and mutations authorize against the job workspace', () => {
    const handlers = [
      ['functions/api/collection/[jobId]/status.ts', 'VIEWER'],
      ['functions/api/collection/[jobId]/results.ts', 'VIEWER'],
      ['functions/api/collection/[jobId]/approve.ts', 'EDITOR'],
    ] as const

    for (const [path, role] of handlers) {
      const handler = source(path)
      expect(handler).toContain('workspace_id')
      expect(handler).toContain(`checkWorkspaceAccess(job.workspace_id`)
      expect(handler).toContain(`'${role}'`)
    }
  })

  test('@smoke graph identities remain distinct across entity tables', () => {
    expect(entityNodeId('actor', 42)).toBe('ACTOR:42')
    expect(entityNodeId('event', 42)).toBe('EVENT:42')
    expect(entityNodeId('actor', 42)).not.toBe(entityNodeId('event', 42))
  })
})
