/**
 * COP Layer: POO Estimates GeoJSON
 *
 * GET /api/cop/:id/layers/poo-estimates
 *
 * Returns a GeoJSON FeatureCollection of POO (Point of Origin) estimates
 * for the given COP session. Each estimate is a Point feature at the
 * impact location, with range/sector/confidence properties for client-side
 * circle and sector rendering.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopLayerAccess } from '../../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  // Auth: public sessions open, private sessions require owner/collaborator
  const access = await verifyCopLayerAccess(env.DB, sessionId, request, env)
  if (access instanceof Response) return access

  try {

    const results = await env.DB.prepare(
      `SELECT * FROM cop_poo_estimates WHERE cop_session_id = ? ORDER BY created_at DESC LIMIT 500`
    ).bind(sessionId).all()

    const features = (results.results || []).map((row: any) => {
      if (row.impact_lat == null || row.impact_lon == null) return null

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.impact_lon, row.impact_lat],
        },
        properties: {
          id: row.id,
          name: row.name,
          description: row.description,
          max_range_km: row.max_range_km,
          min_range_km: row.min_range_km,
          approach_bearing: row.approach_bearing,
          sector_width_deg: row.sector_width_deg,
          confidence: row.confidence,
          range_basis: row.range_basis,
          bearing_basis: row.bearing_basis,
          color: row.color,
          opacity: row.opacity,
          entity_type: 'poo-estimate',
        },
      }
    }).filter(Boolean)

    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features,
    }), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP POO Estimates Layer] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to load POO estimates layer',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
