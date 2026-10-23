/**
 * COP Layer: Webcams GeoJSON
 *
 * GET /api/cop/:id/layers/webcams
 *
 * A Point per located webcam (properties.kind = 'webcam'), plus a view-cone
 * Polygon (kind = 'view_cone') for each one with a bearing. A share link reads
 * this layer only when it shows the `cams` panel (shareMayReadLayer). Until
 * managed migration 0020 is applied the layer is empty.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { verifyCopLayerAccess } from '../../../_shared/auth-helpers'
import { JSON_HEADERS } from '../../../_shared/api-utils'
import { logEvent } from '../../../_shared/event-log'
import { listSessionWebcams, webcamFeatureCollection } from '../../../_shared/cop-webcams'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string

  const access = await verifyCopLayerAccess(env.DB, sessionId, request, env, 'webcams')
  if (access instanceof Response) return access

  try {
    const rows = await listSessionWebcams(env.DB, sessionId)
    return new Response(JSON.stringify(webcamFeatureCollection(rows)), { headers: JSON_HEADERS })
  } catch (error) {
    await logEvent(env, {
      level: 'error',
      source: 'cop/layers/webcams',
      message: String(error instanceof Error ? error.message : error).slice(0, 500),
      context: { error: String(error) },
    })
    return new Response(JSON.stringify({ error: 'Failed to load webcams layer' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
