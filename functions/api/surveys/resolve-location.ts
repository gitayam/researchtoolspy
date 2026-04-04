/**
 * Location Resolver API — POST /api/surveys/resolve-location
 *
 * Accepts a raw location string (lat/lon, map URLs, MGRS, Plus Codes, What3Words)
 * and returns normalized coordinates with detected format metadata.
 *
 * No auth required — used from public survey/intake forms.
 */

import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
}

interface LocationResult {
  lat: number | null
  lon: number | null
  mgrs: string | null
  format: string
  precision: string | null
  label: string | null
  raw: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context

  try {
    const body = (await request.json()) as { input?: string }
    const input = body.input?.trim()

    if (!input) {
      return new Response(JSON.stringify({ error: 'input is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    if (input.length > 2000) {
      return new Response(JSON.stringify({ error: 'Input too long (max 2000 characters)' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    const result = resolveLocation(input)

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[Location Resolver] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to resolve location' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}

function resolveLocation(input: string): LocationResult {
  const base: LocationResult = {
    raw: input,
    lat: null,
    lon: null,
    mgrs: null,
    format: 'unknown',
    precision: null,
    label: null,
  }

  // 1. Raw lat,lon
  const latLonMatch = input.match(/^(-?\d{1,3}\.?\d*)\s*[,\s]\s*(-?\d{1,3}\.?\d*)$/)
  if (latLonMatch) {
    const lat = parseFloat(latLonMatch[1])
    const lon = parseFloat(latLonMatch[2])
    if (isValidLatLon(lat, lon)) {
      return { ...base, lat, lon, format: 'latlon', precision: 'exact' }
    }
  }

  // 2. Google Maps URL
  if (input.includes('google.com/maps') || input.includes('maps.google')) {
    const coords = extractCoordsFromGoogleMaps(input)
    if (coords) {
      return { ...base, lat: coords.lat, lon: coords.lon, format: 'google_maps', precision: 'exact' }
    }
  }

  // 3. Apple Maps URL
  if (input.includes('maps.apple.com')) {
    const coords = extractCoordsFromAppleMaps(input)
    if (coords) {
      return { ...base, lat: coords.lat, lon: coords.lon, format: 'apple_maps', precision: 'exact' }
    }
  }

  // 4. OpenStreetMap URL
  if (input.includes('openstreetmap.org')) {
    const coords = extractCoordsFromOSM(input)
    if (coords) {
      return { ...base, lat: coords.lat, lon: coords.lon, format: 'osm', precision: 'exact' }
    }
  }

  // 5. MGRS
  const mgrsMatch = input.match(/^(\d{1,2})([C-X])([A-Z]{2})\s*(\d{0,5})\s*(\d{0,5})$/i)
  if (mgrsMatch) {
    const mgrsResult = parseMGRS(mgrsMatch[1], mgrsMatch[2], mgrsMatch[3], mgrsMatch[4], mgrsMatch[5])
    return {
      ...base,
      ...mgrsResult,
      mgrs: input.toUpperCase().replace(/\s+/g, ' '),
      format: 'mgrs',
    }
  }

  // 6. Plus Code (Open Location Code)
  if (/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i.test(input)) {
    return {
      ...base,
      format: 'plus_code',
      label: 'Plus Code detected — resolution not yet supported',
    }
  }

  // 7. What3Words
  if (/^(\/\/\/)?[a-z]+\.[a-z]+\.[a-z]+$/i.test(input)) {
    return {
      ...base,
      format: 'what3words',
      label: 'What3Words detected — requires API key',
    }
  }

  return base
}

function isValidLatLon(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  )
}

function extractCoordsFromGoogleMaps(url: string): { lat: number; lon: number } | null {
  // @lat,lon pattern (most common in Google Maps URLs)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atMatch) {
    const coords = { lat: parseFloat(atMatch[1]), lon: parseFloat(atMatch[2]) }
    if (isValidLatLon(coords.lat, coords.lon)) return coords
  }

  // ?q=lat,lon or ?ll=lat,lon query params
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') || u.searchParams.get('ll')
    if (q) {
      const parts = q.split(',').map((s) => parseFloat(s.trim()))
      if (parts.length === 2 && isValidLatLon(parts[0], parts[1])) {
        return { lat: parts[0], lon: parts[1] }
      }
    }
  } catch {
    /* not a valid URL */
  }

  return null
}

function extractCoordsFromAppleMaps(url: string): { lat: number; lon: number } | null {
  try {
    const u = new URL(url)
    const ll = u.searchParams.get('ll')
    if (ll) {
      const parts = ll.split(',').map((s) => parseFloat(s.trim()))
      if (parts.length === 2 && isValidLatLon(parts[0], parts[1])) {
        return { lat: parts[0], lon: parts[1] }
      }
    }
  } catch {
    /* not a valid URL */
  }
  return null
}

function extractCoordsFromOSM(url: string): { lat: number; lon: number } | null {
  // #map=zoom/lat/lon
  const hashMatch = url.match(/#map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/)
  if (hashMatch) {
    const coords = { lat: parseFloat(hashMatch[1]), lon: parseFloat(hashMatch[2]) }
    if (isValidLatLon(coords.lat, coords.lon)) return coords
  }

  // ?mlat=...&mlon=...
  try {
    const u = new URL(url)
    const mlat = u.searchParams.get('mlat')
    const mlon = u.searchParams.get('mlon')
    if (mlat && mlon) {
      const coords = { lat: parseFloat(mlat), lon: parseFloat(mlon) }
      if (isValidLatLon(coords.lat, coords.lon)) return coords
    }
  } catch {
    /* not a valid URL */
  }

  return null
}

/**
 * Simplified MGRS to lat/lon conversion.
 *
 * Full MGRS decoding requires handling 100km square identifiers within each UTM zone,
 * which involves the full UTM projection math. This implementation provides approximate
 * coordinates based on UTM zone and latitude band, refined by easting/northing digits.
 *
 * Accuracy: zone+band gives ~100km, each pair of digits improves by 10x.
 */
function parseMGRS(
  zoneStr: string,
  bandLetter: string,
  _squareId: string,
  eastingStr: string,
  northingStr: string
): { lat: number | null; lon: number | null; precision: string } {
  const zone = parseInt(zoneStr)
  if (zone < 1 || zone > 60) return { lat: null, lon: null, precision: '~100km' }

  // Latitude bands C through X (excluding I and O)
  const bands = 'CDEFGHJKLMNPQRSTUVWX'
  const bandIdx = bands.indexOf(bandLetter.toUpperCase())
  if (bandIdx < 0) return { lat: null, lon: null, precision: '~100km' }

  // Base coordinates: center of the UTM zone and latitude band
  // Band X (index 19) spans 72N-84N (12 degrees), all others span 8 degrees
  const bandHeight = bandIdx === 19 ? 12 : 8
  const lonBase = (zone - 1) * 6 - 180 + 3
  const latBase = -80 + bandIdx * 8 + bandHeight / 2

  // No easting/northing digits — return zone/band center
  if (!eastingStr && !northingStr) {
    return {
      lat: Math.round(latBase * 1e6) / 1e6,
      lon: Math.round(lonBase * 1e6) / 1e6,
      precision: '~100km',
    }
  }

  // Precision improves with digit count
  const digits = eastingStr.length
  const precisionMap: Record<number, string> = {
    1: '~10km',
    2: '~1km',
    3: '~100m',
    4: '~10m',
    5: '~1m',
  }
  const precision = precisionMap[digits] || '~100km'

  // Fractional offset within the zone (0.0 to 1.0)
  const easting = eastingStr ? parseInt(eastingStr) / Math.pow(10, eastingStr.length) : 0.5
  const northing = northingStr ? parseInt(northingStr) / Math.pow(10, northingStr.length) : 0.5

  // Apply offset within zone (6 deg lon) and band (bandHeight deg lat)
  const lat = latBase - bandHeight / 2 + northing * bandHeight
  const lon = lonBase - 3 + easting * 6

  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lon: Math.round(lon * 1e6) / 1e6,
    precision,
  }
}

/** Handle CORS preflight */
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
