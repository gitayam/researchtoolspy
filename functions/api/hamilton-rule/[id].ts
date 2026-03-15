/**
 * Hamilton Rule Analysis API - Single Item Operations
 *
 * GET    /api/hamilton-rule/:id - Get single analysis
 * PUT    /api/hamilton-rule/:id - Update analysis
 * DELETE /api/hamilton-rule/:id - Delete analysis
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, CORS_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
}

// GET - Get single Hamilton Rule analysis
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context
  const id = params.id as string

  try {
    const result = await env.DB.prepare(`
      SELECT
        hr.*,
        b.name as linked_behavior_title
      FROM hamilton_rule_analyses hr
      LEFT JOIN behaviors b ON hr.linked_behavior_id = b.id
      WHERE hr.id = ?
    `).bind(id).first()

    if (!result) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    const analysis = {
      ...result,
      actors: safeJsonParse(result.actors, []),
      relationships: safeJsonParse(result.relationships, []),
      network_analysis: safeJsonParse(result.network_analysis, null),
      ai_analysis: safeJsonParse(result.ai_analysis, null),
      tags: safeJsonParse(result.tags, [])
    }

    return new Response(JSON.stringify({ analysis }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Hamilton Rule API] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get analysis'

    }), { status: 500, headers: JSON_HEADERS })
  }
}

// PUT - Update Hamilton Rule analysis
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const body = await request.json() as any
    const now = new Date().toISOString()

    // Build dynamic update query
    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (body.title !== undefined) {
      updates.push('title = ?')
      values.push(body.title)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.linked_behavior_id !== undefined) {
      updates.push('linked_behavior_id = ?')
      values.push(body.linked_behavior_id)
    }
    if (body.mode !== undefined) {
      updates.push('mode = ?')
      values.push(body.mode)
    }
    if (body.actors !== undefined) {
      updates.push('actors = ?')
      values.push(JSON.stringify(body.actors))
    }
    if (body.relationships !== undefined) {
      // Recalculate Hamilton scores
      const relationships = body.relationships.map((rel: any) => ({
        ...rel,
        hamilton_score: (rel.relatedness || 0) * (rel.benefit || 0) - (rel.cost || 0),
        passes_rule: ((rel.relatedness || 0) * (rel.benefit || 0) - (rel.cost || 0)) > 0
      }))
      updates.push('relationships = ?')
      values.push(JSON.stringify(relationships))

      // Recalculate network analysis
      if (body.mode === 'network' || (!body.mode && relationships.length > 0)) {
        const actors = body.actors || []
        const networkAnalysis = calculateNetworkStats(relationships, actors)
        updates.push('network_analysis = ?')
        values.push(JSON.stringify(networkAnalysis))
      }
    }
    if (body.network_analysis !== undefined) {
      updates.push('network_analysis = ?')
      values.push(JSON.stringify(body.network_analysis))
    }
    if (body.ai_analysis !== undefined) {
      updates.push('ai_analysis = ?')
      values.push(JSON.stringify(body.ai_analysis))
    }
    if (body.is_public !== undefined) {
      updates.push('is_public = ?')
      values.push(body.is_public ? 1 : 0)
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?')
      values.push(JSON.stringify(body.tags))
    }

    values.push(id, userId)

    const result = await env.DB.prepare(`
      UPDATE hamilton_rule_analyses
      SET ${updates.join(', ')}
      WHERE id = ? AND created_by = ?
    `).bind(...values).run()

    if (!result.meta.changes) {
      return new Response(JSON.stringify({ error: 'Analysis not found or not owned by you' }), {
        status: 404, headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({ message: 'Analysis updated' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Hamilton Rule API] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update analysis'

    }), { status: 500, headers: JSON_HEADERS })
  }
}

// DELETE - Delete Hamilton Rule analysis
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const id = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const result = await env.DB.prepare(`
      DELETE FROM hamilton_rule_analyses WHERE id = ? AND created_by = ?
    `).bind(id, userId).run()

    if (!result.meta.changes) {
      return new Response(JSON.stringify({ error: 'Analysis not found or not owned by you' }), {
        status: 404, headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({ message: 'Analysis deleted' }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Hamilton Rule API] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete analysis'

    }), { status: 500, headers: JSON_HEADERS })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Calculate network-level statistics
 */
function calculateNetworkStats(relationships: any[], actors: any[]): any {
  const cooperators = new Set<string>()
  const defectors = new Set<string>()

  let totalCooperation = 0
  let totalDefection = 0
  let totalR = 0
  let totalB = 0
  let totalC = 0

  for (const rel of relationships) {
    const score = rel.hamilton_score || 0
    if (score > 0) {
      totalCooperation += score
      cooperators.add(rel.actor_id)
    } else {
      totalDefection += Math.abs(score)
      defectors.add(rel.actor_id)
    }
    totalR += rel.relatedness || 0
    totalB += rel.benefit || 0
    totalC += rel.cost || 0
  }

  const n = relationships.length || 1
  const netCooperation = totalCooperation - totalDefection

  let stability: 'stable' | 'unstable' | 'transitional' = 'stable'
  if (netCooperation < 0) {
    stability = 'unstable'
  } else if (cooperators.size > 0 && defectors.size > 0) {
    stability = 'transitional'
  }

  return {
    total_cooperation_score: Math.round(totalCooperation * 1000) / 1000,
    total_defection_score: Math.round(totalDefection * 1000) / 1000,
    net_cooperation: Math.round(netCooperation * 1000) / 1000,
    cooperation_threshold: 0,
    predicted_cooperators: Array.from(cooperators),
    predicted_defectors: Array.from(defectors),
    network_stability: stability,
    average_relatedness: Math.round((totalR / n) * 1000) / 1000,
    average_benefit: Math.round((totalB / n) * 1000) / 1000,
    average_cost: Math.round((totalC / n) * 1000) / 1000,
    actor_count: actors.length,
    relationship_count: relationships.length
  }
}
