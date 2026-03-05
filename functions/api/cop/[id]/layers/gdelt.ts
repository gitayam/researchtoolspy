/**
 * COP Layer: GDELT News Geo Data (External Proxy)
 *
 * GET /api/cop/:id/layers/gdelt
 *
 * Proxies geolocated news data from the GDELT Project GeoJSON API and returns
 * it as a GeoJSON FeatureCollection. Results are cached in KV for 15 minutes
 * keyed by bounding box rounded to 1 decimal place.
 *
 * Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat  (overrides session bbox)
 *   ?query=<search terms>              (overrides default conflict/crisis query)
 *
 * GDELT returns global data, so features are filtered server-side to the
 * session's bounding box before returning.
 *
 * If the GDELT API is unavailable or returns an error, the endpoint returns
 * an empty FeatureCollection with a _meta.error field rather than throwing.
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  COP_CACHE?: KVNamespace
}

const GDELT_BASE_URL = 'https://api.gdeltproject.org/api/v2/geo/geo'
const CACHE_TTL = 900 // 15 minutes in seconds
const DEFAULT_QUERY = 'conflict OR protest OR military OR crisis'
const MAX_POINTS = 500

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash, X-Workspace-ID',
}

interface BBox {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

function parseBBoxParam(param: string | null): BBox | null {
  if (!param) return null
  const parts = param.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return null
  return { minLon: parts[0], minLat: parts[1], maxLon: parts[2], maxLat: parts[3] }
}

function sessionBBox(session: any): BBox | null {
  if (
    session.bbox_min_lon != null &&
    session.bbox_min_lat != null &&
    session.bbox_max_lon != null &&
    session.bbox_max_lat != null
  ) {
    return {
      minLon: session.bbox_min_lon,
      minLat: session.bbox_min_lat,
      maxLon: session.bbox_max_lon,
      maxLat: session.bbox_max_lat,
    }
  }
  return null
}

/** Round to 1 decimal place for cache key bucketing. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Build the KV cache key from the bounding box, rounded to 1 decimal. */
function buildCacheKey(bbox: BBox, query: string, timespan: number): string {
  return `gdelt:${round1(bbox.minLat)},${round1(bbox.minLon)},${round1(bbox.maxLat)},${round1(bbox.maxLon)}:${timespan}:${query}`
}

/** Check if a coordinate point falls within the bounding box. */
function isInBBox(lon: number, lat: number, bbox: BBox): boolean {
  return lon >= bbox.minLon && lon <= bbox.maxLon &&
         lat >= bbox.minLat && lat <= bbox.maxLat
}

function emptyCollection(meta: Record<string, any>) {
  return new Response(JSON.stringify({
    type: 'FeatureCollection',
    features: [],
    _meta: meta,
  }), { headers: corsHeaders })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const sessionId = params.id as string
  const url = new URL(request.url)

  try {
    // 1. Look up the COP session
    const session = await env.DB.prepare(
      `SELECT workspace_id, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon,
              rolling_hours, time_window_start, time_window_end
       FROM cop_sessions WHERE id = ?`
    ).bind(sessionId).first()

    if (!session) {
      return new Response(JSON.stringify({ error: 'COP session not found' }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    // 2. Determine bbox: query param overrides session bbox
    const bbox = parseBBoxParam(url.searchParams.get('bbox')) || sessionBBox(session)

    if (!bbox) {
      return emptyCollection({
        source: 'gdelt',
        count: 0,
        fetched_at: new Date().toISOString(),
        error: 'No bounding box available for GDELT query',
      })
    }

    // 3. Determine search query and timespan
    const query = url.searchParams.get('query') || DEFAULT_QUERY
    const rollingHours = session.rolling_hours ? Number(session.rolling_hours) : 24
    const timespan = rollingHours * 60 // GDELT expects minutes

    // 4. Build cache key and check KV cache
    const cacheKey = buildCacheKey(bbox, query, timespan)

    if (env.COP_CACHE) {
      try {
        const cached = await env.COP_CACHE.get(cacheKey, 'text')
        if (cached) {
          console.log(`[COP GDELT Layer] Cache hit for ${cacheKey}`)
          const parsed = JSON.parse(cached)
          parsed._meta = {
            ...parsed._meta,
            cache_hit: true,
          }
          return new Response(JSON.stringify(parsed), { headers: corsHeaders })
        }
      } catch (e) {
        console.warn('[COP GDELT Layer] KV read error:', e)
        // Continue without cache
      }
    }

    // 5. Build GDELT API URL
    const gdeltUrl = new URL(GDELT_BASE_URL)
    gdeltUrl.searchParams.set('query', query)
    gdeltUrl.searchParams.set('format', 'GeoJSON')
    gdeltUrl.searchParams.set('timespan', String(timespan))
    gdeltUrl.searchParams.set('maxpoints', String(MAX_POINTS))
    gdeltUrl.searchParams.set('sourcelang', 'eng')

    // 6. Fetch from GDELT API
    let gdeltFeatures: any[] = []
    let fetchError: string | undefined

    try {
      const response = await fetch(gdeltUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000), // 15s timeout
      })

      if (!response.ok) {
        fetchError = `GDELT API returned HTTP ${response.status}`
        console.error(`[COP GDELT Layer] ${fetchError}`)
      } else {
        const body = await response.json() as any
        if (body && body.type === 'FeatureCollection' && Array.isArray(body.features)) {
          gdeltFeatures = body.features
        } else if (body && Array.isArray(body.features)) {
          // Fallback: accept any response with a features array
          gdeltFeatures = body.features
        } else {
          fetchError = 'GDELT API returned unexpected response format'
          console.warn(`[COP GDELT Layer] ${fetchError}`, typeof body)
        }
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'GDELT API request failed'
      console.error('[COP GDELT Layer] Fetch error:', e)
    }

    // 7. Filter features to session bounding box and add entity_type
    const features = gdeltFeatures
      .filter((feature: any) => {
        if (!feature?.geometry?.coordinates) return false
        const coords = feature.geometry.coordinates
        // GeoJSON coordinates are [lon, lat]
        const lon = coords[0]
        const lat = coords[1]
        if (typeof lon !== 'number' || typeof lat !== 'number') return false
        return isInBBox(lon, lat, bbox)
      })
      .map((feature: any) => ({
        ...feature,
        properties: {
          ...feature.properties,
          entity_type: 'gdelt',
        },
      }))

    const fetchedAt = new Date().toISOString()

    const result: Record<string, any> = {
      type: 'FeatureCollection',
      features,
      _meta: {
        source: 'gdelt',
        count: features.length,
        fetched_at: fetchedAt,
        cache_hit: false,
        query,
        timespan_minutes: timespan,
        raw_count: gdeltFeatures.length,
        ...(fetchError ? { error: fetchError } : {}),
      },
    }

    // 8. Cache successful results in KV
    if (env.COP_CACHE && features.length > 0) {
      try {
        await env.COP_CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL,
        })
        console.log(`[COP GDELT Layer] Cached ${features.length} features at ${cacheKey}`)
      } catch (e) {
        console.warn('[COP GDELT Layer] KV write error:', e)
      }
    }

    return new Response(JSON.stringify(result), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP GDELT Layer] Error:', error)
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [],
      _meta: {
        source: 'gdelt',
        count: 0,
        fetched_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
