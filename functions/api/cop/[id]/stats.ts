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

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

// GET - Aggregate workspace stats for a COP session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    // 1. Look up the session to get workspace_id and created_by
    const session = await env.DB.prepare(
      `SELECT workspace_id, created_by FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string; created_by: number }>()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const { workspace_id, created_by } = session

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
      actor_count, source_count, event_count, evidence_count,
      framework_count, relationship_count, open_rfis, answered_questions,
      blocker_count, hypothesis_count,
    ] = await Promise.all([
      safeCount(`SELECT COUNT(*) as cnt FROM actors WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM sources WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM events WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM evidence_items WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM framework_sessions WHERE user_id = ?`, created_by),
      safeCount(`SELECT COUNT(*) as cnt FROM relationships WHERE workspace_id = ?`, workspace_id),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND status = 'open'`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND status IN ('answered', 'accepted')`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_rfis WHERE cop_session_id = ? AND is_blocker = 1 AND status != 'closed'`, sessionId),
      safeCount(`SELECT COUNT(*) as cnt FROM cop_hypotheses WHERE cop_session_id = ?`, sessionId),
    ])

    const entity_count = actor_count + source_count + event_count
    const open_questions = open_rfis

    const stats = {
      evidence_count,
      entity_count,
      actor_count,
      source_count,
      event_count,
      relationship_count,
      framework_count,
      open_questions,
      answered_questions,
      open_rfis,
      blocker_count,
      hypothesis_count,
    }

    return new Response(JSON.stringify({ stats }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP Stats] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get workspace stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
