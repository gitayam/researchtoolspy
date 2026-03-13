/**
 * COP Layer: ACLED Conflict Data (External Proxy)
 *
 * GET /api/cop/:id/layers/acled
 *
 * Proxies conflict event data from the ACLED (Armed Conflict Location & Event
 * Data) API and returns it as a GeoJSON FeatureCollection. Results are cached
 * in KV for 1 hour keyed by bounding box rounded to 1 decimal place.
 *
 * Accepts optional query params:
 *   ?bbox=minLon,minLat,maxLon,maxLat  (overrides session bbox)
 *
 * Time filtering uses the session's rolling_hours or time_window_start/end.
 *
 * If the ACLED API is unavailable or returns an error, the endpoint returns
 * an empty FeatureCollection with a _meta.error field rather than throwing.
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  CACHE?: KVNamespace
  ACLED_API_KEY?: string
  ACLED_EMAIL?: string
}

const ACLED_BASE_URL = 'https://api.acleddata.com/acled/read'
const CACHE_TTL = 3600 // 1 hour in seconds
const ACLED_LIMIT = 500

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
function buildCacheKey(bbox: BBox, dateFrom?: string): string {
  const base = `acled:${round1(bbox.minLat)},${round1(bbox.minLon)},${round1(bbox.maxLat)},${round1(bbox.maxLon)}`
  if (dateFrom) return `${base}:${dateFrom}`
  return base
}

/** Convert ISO date or datetime to YYYY-MM-DD for ACLED date filtering. */
function toDateStr(isoStr: string): string {
  return isoStr.slice(0, 10)
}

/** Compute a "from" date based on rolling_hours from now. */
function rollingDate(hours: number): string {
  const d = new Date(Date.now() - hours * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

interface AcledRecord {
  data_id: string
  latitude: string
  longitude: string
  event_type: string
  sub_event_type: string
  event_date: string
  actor1: string
  actor2: string
  fatalities: string
  country: string
  notes: string
  source: string
}

function acledRecordToFeature(record: AcledRecord) {
  const lat = parseFloat(record.latitude)
  const lon = parseFloat(record.longitude)
  if (isNaN(lat) || isNaN(lon)) return null

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [lon, lat],
    },
    properties: {
      id: `acled-${record.data_id}`,
      name: `${record.event_type}: ${record.sub_event_type}`,
      event_type: record.event_type,
      sub_event_type: record.sub_event_type,
      event_date: record.event_date,
      actor1: record.actor1,
      actor2: record.actor2,
      fatalities: parseInt(record.fatalities, 10) || 0,
      country: record.country,
      notes: record.notes,
      source: record.source,
      entity_type: 'acled',
    },
  }
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
        source: 'acled',
        count: 0,
        fetched_at: new Date().toISOString(),
        error: 'No bounding box available for ACLED query',
      })
    }

    // 3. Determine date range from session time settings
    let dateFrom: string | undefined
    let dateTo: string | undefined
    const today = new Date().toISOString().slice(0, 10)

    if (session.rolling_hours) {
      dateFrom = rollingDate(Number(session.rolling_hours))
      dateTo = today
    } else if (session.time_window_start) {
      dateFrom = toDateStr(session.time_window_start as string)
      dateTo = session.time_window_end ? toDateStr(session.time_window_end as string) : today
    }

    // 4. Build cache key and check KV cache
    const cacheKey = buildCacheKey(bbox, dateFrom)

    if (env.CACHE) {
      try {
        const cached = await env.CACHE.get(cacheKey, 'text')
        if (cached) {
          const parsed = JSON.parse(cached)
          parsed._meta = {
            ...parsed._meta,
            cache_hit: true,
          }
          return new Response(JSON.stringify(parsed), { headers: corsHeaders })
        }
      } catch (e) {
        console.warn('[COP ACLED Layer] KV read error:', e)
        // Continue without cache
      }
    }

    // 5. Build ACLED API URL (without credentials for safe logging)
    const acledUrl = new URL(ACLED_BASE_URL)
    acledUrl.searchParams.set('limit', String(ACLED_LIMIT))

    // ACLED uses BETWEEN syntax: latitude=minLat|maxLat, longitude=minLon|maxLon
    acledUrl.searchParams.set('latitude', `${bbox.minLat}|${bbox.maxLat}`)
    acledUrl.searchParams.set('longitude', `${bbox.minLon}|${bbox.maxLon}`)

    // Date filtering: event_date uses the same BETWEEN syntax
    if (dateFrom && dateTo) {
      acledUrl.searchParams.set('event_date', `${dateFrom}|${dateTo}`)
      acledUrl.searchParams.set('event_date_where', 'BETWEEN')
    } else if (dateFrom) {
      acledUrl.searchParams.set('event_date', dateFrom)
      acledUrl.searchParams.set('event_date_where', '>=')
    }

    // Add credentials only to the fetch URL (never log this URL)
    const acledFetchUrl = new URL(acledUrl.toString())
    if (env.ACLED_API_KEY) acledFetchUrl.searchParams.set('key', env.ACLED_API_KEY)
    if (env.ACLED_EMAIL) acledFetchUrl.searchParams.set('email', env.ACLED_EMAIL)

    // 6. Fetch from ACLED API
    let acledData: AcledRecord[] = []
    let fetchError: string | undefined

    try {
      const response = await fetch(acledFetchUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000), // 15s timeout
      })

      if (!response.ok) {
        fetchError = `ACLED API returned HTTP ${response.status}`
        console.error(`[COP ACLED Layer] ${fetchError}`)
      } else {
        const body = await response.json() as any
        if (body && Array.isArray(body.data)) {
          acledData = body.data
        } else {
          fetchError = 'ACLED API returned unexpected response format'
          console.warn(`[COP ACLED Layer] ${fetchError}`)
        }
      }
    } catch (e) {
      fetchError = 'ACLED API request failed'
      console.error('[COP ACLED Layer] Fetch error:', e)
    }

    // 7. Convert to GeoJSON features
    const features = acledData.map(acledRecordToFeature).filter(Boolean)
    const fetchedAt = new Date().toISOString()

    const result: Record<string, any> = {
      type: 'FeatureCollection',
      features,
      _meta: {
        source: 'acled',
        count: features.length,
        fetched_at: fetchedAt,
        cache_hit: false,
        ...(fetchError ? { error: fetchError } : {}),
      },
    }

    // 8. Cache successful results in KV (even partial results are worth caching)
    if (env.CACHE && features.length > 0) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL,
        })
      } catch (e) {
        console.warn('[COP ACLED Layer] KV write error:', e)
      }
    }

    return new Response(JSON.stringify(result), { headers: corsHeaders })
  } catch (error) {
    console.error('[COP ACLED Layer] Error:', error)
    return new Response(JSON.stringify({
      type: 'FeatureCollection',
      features: [],
      _meta: {
        source: 'acled',
        count: 0,
        fetched_at: new Date().toISOString(),
        error: 'Failed to fetch ACLED data',
      },
    }), { headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
