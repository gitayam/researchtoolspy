import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get('workspace_id') || request.headers.get('X-Workspace-ID')

    const fwCount = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM framework_sessions
      WHERE user_id = ? AND status != 'archived'
    `).bind(userId).first<{ cnt: number }>()
    const totalFrameworks = fwCount?.cnt ?? 0

    // Build workspace-scoped entity filter
    const wsFilter = workspaceId
      ? 'created_by = ? AND workspace_id = ?'
      : 'created_by = ?'
    const wsParams = workspaceId ? [userId, workspaceId] : [userId]
    const bindParams = [...wsParams, ...wsParams, ...wsParams, ...wsParams, ...wsParams, userId, userId, userId]

    const entitiesResult = await env.DB.prepare(`
      SELECT
        e.id as entity_id,
        e.name as entity_name,
        e.entity_type,
        COALESCE(r_count.rel_count, 0) as relationship_count,
        m.avg_mom as mom_score
      FROM (
        SELECT CAST(id AS TEXT) as id, name, 'ACTOR' as entity_type, created_by FROM actors WHERE ${wsFilter}
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'SOURCE' as entity_type, created_by FROM sources WHERE ${wsFilter}
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'EVENT' as entity_type, created_by FROM events WHERE ${wsFilter}
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'PLACE' as entity_type, created_by FROM places WHERE ${wsFilter}
        UNION ALL
        SELECT CAST(id AS TEXT) as id, name, 'BEHAVIOR' as entity_type, created_by FROM behaviors WHERE ${wsFilter}
      ) e
      LEFT JOIN (
        SELECT entity_id, COUNT(*) as rel_count FROM (
          SELECT source_entity_id as entity_id FROM relationships WHERE created_by = ?
          UNION ALL
          SELECT target_entity_id as entity_id FROM relationships WHERE created_by = ?
        ) GROUP BY entity_id
      ) r_count ON r_count.entity_id = e.id
      LEFT JOIN (
        SELECT actor_id, AVG((motive + opportunity + means) / 3.0) as avg_mom
        FROM mom_assessments
        WHERE assessed_by = ?
        GROUP BY actor_id
      ) m ON m.actor_id = e.id AND e.entity_type = 'ACTOR'
      ORDER BY COALESCE(r_count.rel_count, 0) DESC
      LIMIT 100
    `).bind(...bindParams).all<{
      entity_id: string
      entity_name: string
      entity_type: string
      relationship_count: number
      mom_score: number | null
    }>()

    const entities = (entitiesResult.results || []).map(e => {
      const estimatedFrameworks = Math.min(totalFrameworks, Math.ceil(e.relationship_count / 2))
      const convergenceScore = totalFrameworks > 0
        ? Math.round((estimatedFrameworks / totalFrameworks) * 100) / 100
        : 0

      const riskLevel = e.mom_score !== null
        ? (e.mom_score >= 4 ? 'CRITICAL' : e.mom_score >= 3 ? 'HIGH' : e.mom_score >= 2 ? 'MEDIUM' : 'LOW')
        : null

      return {
        entity_id: e.entity_id,
        entity_name: e.entity_name,
        entity_type: e.entity_type,
        frameworks_count: estimatedFrameworks,
        convergence_score: convergenceScore,
        relationship_count: e.relationship_count,
        risk_level: riskLevel,
        mom_score: e.mom_score !== null ? Math.round(e.mom_score * 10) / 10 : null,
      }
    })

    return new Response(JSON.stringify({
      entities,
      total_frameworks: totalFrameworks,
    }), {
      status: 200,
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('Intelligence entities error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch entity convergence data' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}
