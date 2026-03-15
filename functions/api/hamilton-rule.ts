/**
 * Hamilton Rule Analysis API - List and Create
 *
 * GET  /api/hamilton-rule - List all analyses
 * POST /api/hamilton-rule - Create new analysis
 *
 * Hamilton's Rule: rB > C
 * A behavior is favored when relatedness × benefit > cost
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from './_shared/auth-helpers'
import { generatePrefixedId, JSON_HEADERS, CORS_HEADERS } from './_shared/api-utils'

interface Env {
  DB: D1Database
  OPENAI_API_KEY: string
  SESSIONS?: KVNamespace
}

const corsHeaders = JSON_HEADERS

// GET - List all Hamilton Rule analyses
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }

    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || null

    const results = await env.DB.prepare(`
      SELECT
        hr.*,
        b.name as linked_behavior_title
      FROM hamilton_rule_analyses hr
      LEFT JOIN behaviors b ON hr.linked_behavior_id = b.id
      WHERE hr.workspace_id = ?
      ORDER BY hr.updated_at DESC
      LIMIT 200
    `).bind(workspaceId).all()

    const safeJSON = (val: any, fallback: any = []) => {
      if (!val) return fallback
      try { return JSON.parse(val) } catch { return fallback }
    }

    const analyses = (results.results || []).map((row: any) => ({
      ...row,
      actors: safeJSON(row.actors, []),
      relationships: safeJSON(row.relationships, []),
      network_analysis: safeJSON(row.network_analysis, null),
      ai_analysis: safeJSON(row.ai_analysis, null),
      tags: safeJSON(row.tags, [])
    }))

    return new Response(JSON.stringify({ analyses }), { headers: corsHeaders })
  } catch (error) {
    console.error('[Hamilton Rule API] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list analyses'

    }), { status: 500, headers: corsHeaders })
  }
}

// POST - Create new Hamilton Rule analysis
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders
      })
    }

    const workspaceId = request.headers.get('X-Workspace-ID') || url.searchParams.get('workspace_id') || null
    const body = await request.json() as any

    if (!body.title) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const id = generatePrefixedId('hr')
    const now = new Date().toISOString()
    const mode = body.mode || 'pairwise'

    // Calculate Hamilton scores for any provided relationships
    let relationships = body.relationships || []
    if (relationships.length > 0) {
      relationships = relationships.map((rel: any) => ({
        ...rel,
        hamilton_score: (rel.relatedness || 0) * (rel.benefit || 0) - (rel.cost || 0),
        passes_rule: ((rel.relatedness || 0) * (rel.benefit || 0) - (rel.cost || 0)) > 0
      }))
    }

    // Calculate network analysis if in network mode
    let networkAnalysis = null
    if (mode === 'network' && relationships.length > 0) {
      networkAnalysis = calculateNetworkStats(relationships, body.actors || [])
    }

    await env.DB.prepare(`
      INSERT INTO hamilton_rule_analyses (
        id, title, description, linked_behavior_id,
        mode, actors, relationships, network_analysis,
        workspace_id, created_by, created_at, updated_at,
        is_public, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.title,
      body.description || null,
      body.linked_behavior_id || null,
      mode,
      body.actors ? JSON.stringify(body.actors) : '[]',
      JSON.stringify(relationships),
      networkAnalysis ? JSON.stringify(networkAnalysis) : null,
      workspaceId,
      userId,
      now,
      now,
      body.is_public ? 1 : 0,
      body.tags ? JSON.stringify(body.tags) : '[]'
    ).run()

    return new Response(JSON.stringify({ id, message: 'Analysis created' }), {
      status: 201,
      headers: corsHeaders
    })
  } catch (error) {
    console.error('[Hamilton Rule API] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create analysis'

    }), { status: 500, headers: corsHeaders })
  }
}

// OPTIONS - CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
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
