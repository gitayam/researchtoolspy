/**
 * Resolve the workspace that owns a research question or investigation packet,
 * and confirm the caller may read it.
 *
 * The research list endpoints filtered only on the caller-supplied
 * researchQuestionId / investigationPacketId, with no ownership predicate at
 * all -- `SELECT * FROM evidence_items WHERE 1=1 AND research_question_id = ?`.
 * Any caller could therefore enumerate ids and read other people's evidence and
 * tasks in full.
 *
 * The workspace is derived from the parent row rather than taken from the
 * request, so callers cannot widen their own scope by naming a different one,
 * and the existing frontend needs no new parameter.
 */

import { checkWorkspaceAccess } from '../../_shared/workspace-helpers'

export interface ResearchScope {
  workspaceId: string
}

export async function resolveResearchScope(
  db: D1Database,
  userId: number,
  params: { researchQuestionId?: string | null; investigationPacketId?: string | null },
): Promise<ResearchScope | null> {
  let row: { workspace_id: string | null } | null = null

  if (params.researchQuestionId) {
    row = await db.prepare('SELECT workspace_id FROM research_questions WHERE id = ?')
      .bind(params.researchQuestionId).first<{ workspace_id: string | null }>()
  } else if (params.investigationPacketId) {
    row = await db.prepare('SELECT workspace_id FROM investigation_packets WHERE id = ?')
      .bind(params.investigationPacketId).first<{ workspace_id: string | null }>()
  }

  if (!row?.workspace_id) return null
  if (!(await checkWorkspaceAccess(row.workspace_id, userId, { DB: db }, 'VIEWER'))) return null
  return { workspaceId: row.workspace_id }
}
