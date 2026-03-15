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

    // Build workspace-scoped filter for entity tables
    const entityFilter = workspaceId
      ? 'created_by = ? AND workspace_id = ?'
      : 'created_by = ?'
    const entityParams = workspaceId ? [userId, workspaceId] : [userId]

    // Run all queries in parallel
    const [
      frameworksResult,
      actorsCount,
      sourcesCount,
      eventsCount,
      placesCount,
      behaviorsCount,
      evidenceCount,
      frameworksForConfidence,
      momAssessments,
      relationshipCount,
      recentFrameworks,
    ] = await Promise.all([
      env.DB.prepare(`
        SELECT framework_type, COUNT(*) as cnt
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        GROUP BY framework_type
      `).bind(userId).all<{ framework_type: string; cnt: number }>(),

      env.DB.prepare(`SELECT COUNT(*) as cnt FROM actors WHERE ${entityFilter}`).bind(...entityParams).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM sources WHERE ${entityFilter}`).bind(...entityParams).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM events WHERE ${entityFilter}`).bind(...entityParams).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM places WHERE ${entityFilter}`).bind(...entityParams).first<{ cnt: number }>(),
      env.DB.prepare(`SELECT COUNT(*) as cnt FROM behaviors WHERE ${entityFilter}`).bind(...entityParams).first<{ cnt: number }>(),

      env.DB.prepare(`SELECT COUNT(*) as cnt FROM evidence_items WHERE created_by = ?`).bind(userId).first<{ cnt: number }>(),

      env.DB.prepare(`
        SELECT framework_type, data, created_at
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
      `).bind(userId).all<{ framework_type: string; data: string; created_at: string }>(),

      env.DB.prepare(`
        SELECT motive, opportunity, means
        FROM mom_assessments
        WHERE assessed_by = ?
      `).bind(userId).all<{ motive: number; opportunity: number; means: number }>(),

      env.DB.prepare(`SELECT COUNT(*) as cnt FROM relationships WHERE created_by = ?`).bind(userId).first<{ cnt: number }>(),

      env.DB.prepare(`
        SELECT created_at, framework_type, data
        FROM framework_sessions
        WHERE user_id = ? AND status != 'archived'
        ORDER BY created_at DESC
        LIMIT 7
      `).bind(userId).all<{ created_at: string; framework_type: string; data: string }>(),
    ])

    // Calculate derived values
    const frameworksByType: Record<string, number> = {}
    let totalFrameworks = 0
    for (const row of frameworksResult.results || []) {
      frameworksByType[row.framework_type] = row.cnt
      totalFrameworks += row.cnt
    }

    const entitiesByType: Record<string, number> = {
      ACTOR: actorsCount?.cnt ?? 0,
      SOURCE: sourcesCount?.cnt ?? 0,
      EVENT: eventsCount?.cnt ?? 0,
      PLACE: placesCount?.cnt ?? 0,
      BEHAVIOR: behaviorsCount?.cnt ?? 0,
    }
    const totalEntities = Object.values(entitiesByType).reduce((a, b) => a + b, 0)

    // Extract confidence from framework data
    const confidenceValues: number[] = []
    for (const fw of frameworksForConfidence.results || []) {
      try {
        const data = JSON.parse(fw.data || '{}')
        if (data.confidence) confidenceValues.push(Number(data.confidence))
        if (data.overall_confidence) confidenceValues.push(Number(data.overall_confidence))
        if (data.hypotheses && Array.isArray(data.hypotheses)) {
          const scores = data.hypotheses.map((h: any) => h.score ?? h.likelihood ?? 0).filter((s: number) => s > 0)
          if (scores.length > 0) confidenceValues.push(Math.max(...scores))
        }
      } catch { /* skip unparseable */ }
    }
    const avgConfidence = confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
      : 0

    // Confidence sparkline from recent frameworks
    const sparkline = (recentFrameworks.results || []).reverse().map(fw => {
      try {
        const data = JSON.parse(fw.data || '{}')
        return data.confidence ?? data.overall_confidence ?? 50
      } catch { return 50 }
    })

    // Deception risk from MOM assessments
    const momRows = momAssessments.results || []
    let deceptionScore = 0
    if (momRows.length > 0) {
      const avgMom = momRows.reduce((sum, r) => sum + (r.motive + r.opportunity + r.means) / 3, 0) / momRows.length
      deceptionScore = Math.round(avgMom * 10) / 10
    }
    const deceptionLevel = deceptionScore >= 4 ? 'CRITICAL' : deceptionScore >= 3 ? 'HIGH' : deceptionScore >= 2 ? 'MEDIUM' : 'LOW'

    // Coverage gap
    const relCount = relationshipCount?.cnt ?? 0
    const coverageGap = totalEntities > 0
      ? Math.round((Math.max(0, totalEntities - relCount) / totalEntities) * 100)
      : 0

    return new Response(JSON.stringify({
      active_frameworks: totalFrameworks,
      frameworks_by_type: frameworksByType,
      entities_tracked: totalEntities,
      entities_by_type: entitiesByType,
      evidence_count: evidenceCount?.cnt ?? 0,
      avg_confidence: avgConfidence,
      confidence_sparkline: sparkline,
      deception_risk_level: deceptionLevel,
      deception_risk_score: deceptionScore,
      coverage_gap_pct: coverageGap,
    }), {
      status: 200,
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('Intelligence KPI error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch KPI data' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}
