/**
 * COP Workspace Stats API
 *
 * GET /api/cop/:id/stats - Aggregate KPI counts for a COP session's workspace
 *
 * Looks up the session's workspace_id, then runs parallel COUNT queries
 * against entity tables, evidence, frameworks, relationships, and RFIs.
 * Powers the KPI status strip at the top of the COP workspace.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}


// GET - Aggregate workspace stats for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const workspace_id = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Helper: run a COUNT query, return 0 if table/column is missing
    const safeCount = async (sql: string, ...bindings: any[]): Promise<number> => {
      try {
        const r = await env.DB.prepare(sql).bind(...bindings).first<{ cnt: number }>()
        return r?.cnt ?? 0
      } catch {
        return 0
      }
    }

    // 2. Run parallel COUNT queries (each individually resilient)
    const [
      actor_count, source_count, event_count, place_count, behavior_count,
      evidence_count,
      framework_count, relationship_count, open_rfis, answered_questions,
      blocker_count, hypothesis_count, claim_count, verified_claim_count,
      alert_count,
    ] = await Promise.all([
      safeCount(`SELECT COUNT(*) as cnt FROM actors WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM sources WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM events WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM places WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM behaviors WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM evidence_items WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COALESCE(JSON_ARRAY_LENGTH(linked_frameworks), 0) as cnt FROM cop_sessions WHERE id = ?`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM relationships WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND status = 'open'`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND status IN ('answered', 'accepted')`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND is_blocker = 1 AND status != 'closed'`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_hypotheses WHERE cop_session_id = ?`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_claims WHERE cop_session_id = ?`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_claims WHERE cop_session_id = ? AND status = 'verified'`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_alert_state WHERE cop_session_id = ? AND status = 'new'`, sessionId),
    ])

    const entity_count = actor_count + source_count + event_count + place_count + behavior_count
    const open_questions = open_rfis

    const stats = {
      evidence_count,
      entity_count,
      actor_count,
      source_count,
      event_count,
      place_count,
      behavior_count,
      relationship_count,
      framework_count,
      open_questions,
      answered_questions,
      open_rfis,
      blocker_count,
      hypothesis_count,
      claim_count,
      verified_claim_count,
      alert_count,
    }

    return new Response(JSON.stringify({ stats }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[COP Stats] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get workspace stats',
    }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
