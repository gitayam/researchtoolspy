/**
 * COP POO (Point of Origin) Estimates API — CRUD for launch-origin overlays
 *
 * GET    /api/cop/:id/poo-estimates - List POO estimates for session
 * POST   /api/cop/:id/poo-estimates - Create a POO estimate
 * PUT    /api/cop/:id/poo-estimates - Update a POO estimate
 * DELETE /api/cop/:id/poo-estimates - Delete a POO estimate
 */
import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest, verifyCopSessionAccess } from '../../_shared/auth-helpers'
import { generatePrefixedId } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

const VALID_CONFIDENCE = ['CONFIRMED', 'PROBABLE', 'POSSIBLE', 'DOUBTFUL']

// GET — list POO estimates for a session
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const sessionId = params.id as string

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: corsHeaders })
  }
  const accessWorkspaceId = await verifyCopSessionAccess(env.DB, sessionId, userId, { readOnly: true })
  if (!accessWorkspaceId) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
  }

  try {
    const results = await env.DB.prepare(
      `SELECT * FROM cop_poo_estimates WHERE cop_session_id = ? ORDER BY created_at DESC LIMIT 500`
    ).bind(sessionId).all()

    return new Response(JSON.stringify({ estimates: results.results }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP POO Estimates] List error:', error)
    return new Response(JSON.stringify({ error: 'Failed to list POO estimates' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// POST — create a POO estimate
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }

    const body = await request.json() as any

    if (!body.name || body.impact_lat == null || body.impact_lon == null) {
      return new Response(JSON.stringify({ error: 'name, impact_lat, and impact_lon are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (typeof body.impact_lat !== 'number' || typeof body.impact_lon !== 'number') {
      return new Response(JSON.stringify({ error: 'impact_lat and impact_lon must be numbers' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.impact_lat < -90 || body.impact_lat > 90 || body.impact_lon < -180 || body.impact_lon > 180) {
      return new Response(JSON.stringify({ error: 'impact_lat must be -90..90, impact_lon must be -180..180' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.confidence !== undefined && !VALID_CONFIDENCE.includes(body.confidence)) {
      return new Response(JSON.stringify({ error: `confidence must be one of: ${VALID_CONFIDENCE.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.approach_bearing !== undefined && body.approach_bearing !== null) {
      if (typeof body.approach_bearing !== 'number' || body.approach_bearing < 0 || body.approach_bearing > 360) {
        return new Response(JSON.stringify({ error: 'approach_bearing must be a number 0-360' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    // Look up session's workspace
    const session = await env.DB.prepare(
      `SELECT workspace_id FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first<{ workspace_id: string }>()
    const workspaceId = session?.workspace_id ?? sessionId

    const id = generatePrefixedId('poo')
    const now = new Date().toISOString()

    await env.DB.prepare(`
      INSERT INTO cop_poo_estimates (
        id, cop_session_id, workspace_id, name, description,
        impact_lat, impact_lon, max_range_km, min_range_km,
        approach_bearing, sector_width_deg,
        confidence, range_basis, bearing_basis,
        color, opacity, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, sessionId, workspaceId,
      body.name,
      body.description ?? null,
      body.impact_lat,
      body.impact_lon,
      body.max_range_km ?? 10.0,
      body.min_range_km ?? 0,
      body.approach_bearing ?? null,
      body.sector_width_deg ?? 90,
      body.confidence ?? 'POSSIBLE',
      body.range_basis ?? null,
      body.bearing_basis ?? null,
      body.color ?? '#ef4444',
      body.opacity ?? 0.15,
      userId, now, now,
    ).run()

    return new Response(JSON.stringify({ id, message: 'POO estimate created' }), {
      status: 201, headers: corsHeaders,
    })
  } catch (error) {
    console.error('[COP POO Estimates] Create error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create POO estimate' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// PUT — update a POO estimate
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }

    const body = await request.json() as any
    const estimateId = body.estimate_id

    if (!estimateId) {
      return new Response(JSON.stringify({ error: 'estimate_id is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.confidence !== undefined && !VALID_CONFIDENCE.includes(body.confidence)) {
      return new Response(JSON.stringify({ error: `confidence must be one of: ${VALID_CONFIDENCE.join(', ')}` }), {
        status: 400, headers: corsHeaders,
      })
    }

    if (body.approach_bearing !== undefined && body.approach_bearing !== null) {
      if (typeof body.approach_bearing !== 'number' || body.approach_bearing < 0 || body.approach_bearing > 360) {
        return new Response(JSON.stringify({ error: 'approach_bearing must be a number 0-360' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    if (body.impact_lat !== undefined) {
      if (typeof body.impact_lat !== 'number' || body.impact_lat < -90 || body.impact_lat > 90) {
        return new Response(JSON.stringify({ error: 'impact_lat must be a number -90..90' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    if (body.impact_lon !== undefined) {
      if (typeof body.impact_lon !== 'number' || body.impact_lon < -180 || body.impact_lon > 180) {
        return new Response(JSON.stringify({ error: 'impact_lon must be a number -180..180' }), {
          status: 400, headers: corsHeaders,
        })
      }
    }

    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const bindings: any[] = [now]

    const updatableFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      impact_lat: 'impact_lat',
      impact_lon: 'impact_lon',
      max_range_km: 'max_range_km',
      min_range_km: 'min_range_km',
      approach_bearing: 'approach_bearing',
      sector_width_deg: 'sector_width_deg',
      confidence: 'confidence',
      range_basis: 'range_basis',
      bearing_basis: 'bearing_basis',
      color: 'color',
      opacity: 'opacity',
    }

    for (const [bodyKey, dbCol] of Object.entries(updatableFields)) {
      if (body[bodyKey] !== undefined) {
        updates.push(`${dbCol} = ?`)
        bindings.push(body[bodyKey])
      }
    }

    bindings.push(estimateId, sessionId)

    const updateResult = await env.DB.prepare(
      `UPDATE cop_poo_estimates SET ${updates.join(', ')} WHERE id = ? AND cop_session_id = ?`
    ).bind(...bindings).run()

    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'POO estimate not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const estimate = await env.DB.prepare(
      `SELECT * FROM cop_poo_estimates WHERE id = ? AND cop_session_id = ?`
    ).bind(estimateId, sessionId).first()

    return new Response(JSON.stringify({ message: 'POO estimate updated', estimate: estimate || { id: estimateId } }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP POO Estimates] Update error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update POO estimate' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// DELETE — remove a POO estimate
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: corsHeaders,
      })
    }
    if (!(await verifyCopSessionAccess(env.DB, sessionId, userId))) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const estimateId = url.searchParams.get('estimate_id')

    if (!estimateId) {
      return new Response(JSON.stringify({ error: 'estimate_id query param is required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const deleteResult = await env.DB.prepare(
      `DELETE FROM cop_poo_estimates WHERE id = ? AND cop_session_id = ?`
    ).bind(estimateId, sessionId).run()

    if (!deleteResult.meta.changes || deleteResult.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'POO estimate not found in this session' }), {
        status: 404, headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ message: 'POO estimate deleted' }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP POO Estimates] Delete error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete POO estimate' }), {
      status: 500, headers: corsHeaders,
    })
  }
}

// OPTIONS — CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
