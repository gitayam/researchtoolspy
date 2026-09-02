/**
 * GeoConfirmed Crawler API
 *
 * Purpose-built crawler for geoconfirmed.org that extracts structured
 * geolocation intelligence data (events, coordinates, sources, factions).
 *
 * Endpoints:
 *   POST /api/tools/geoconfirmed
 *     body: { conflict?: string, url?: string, search?: string, page?: number, pageSize?: number }
 *
 * Modes:
 *   1. URL mode: Extract event from a specific geoconfirmed.org URL
 *   2. Search mode: Search placemarks with boolean query
 *   3. List mode: Paginated listing with enriched data from KML
 *   4. Conflicts mode: List available conflicts (no body needed, or { action: "conflicts" })
 */

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { fetchFixedProviderBytes, fetchFixedProviderJson } from '../_shared/fixed-provider'

interface Env {
  CACHE: KVNamespace
  DB?: D1Database
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

interface GeoConfirmedRequest {
  action?: 'conflicts'
  conflict?: string
  url?: string
  search?: string
  page?: number
  pageSize?: number
  enriched?: boolean
}

// ─── GeoConfirmed API endpoints ───

const GC_ORIGIN = 'https://geoconfirmed.org'
const MAX_KMZ_BYTES = 8 * 1024 * 1024
const MAX_KML_BYTES = 16 * 1024 * 1024

// ─── Types ───

interface GCPlacemark {
  id: string
  date: string
  la: number
  lo: number
  icon: string
}

interface GCConflict {
  order: number
  name: string
  shortName: string
  code: string
  startDate: string
  endDate: string | null
  hasTimeline: boolean
  latitude: number
  longitude: number
}

interface EnrichedEvent {
  id: string
  date: string
  latitude: number
  longitude: number
  description: string | null
  sources: string[]
  geolocations: string[]
  faction: string | null
  faction_color: string | null
  equipment_type: string | null
  destroyed: boolean
  icon_path: string
}

interface TimelineEvent extends Omit<EnrichedEvent, 'description' | 'sources' | 'geolocations'> {
  description?: string | null
  sources?: string[]
  geolocations?: string[]
  url: string
}

// ─── Faction color → name mapping (from API_EXPLORATION.md) ───

const FACTION_COLORS: Record<string, Record<string, string>> = {
  Iran: {
    'E00000': 'Iranian Armed Forces',
    'FF6666': 'Iranian Civilian',
    '400080': 'Hezbollah',
    '0051CA': 'Israel Defense Forces / US',
    '0A5900': 'Allied Armed Forces',
    'AC7339': 'Neutral/Infrastructure',
    '666666': 'Unknown',
  },
  Ukraine: {
    '0051CA': 'Ukraine',
    'E00000': 'Russia',
    'AC7339': 'Neutral/Infrastructure',
    '666666': 'Unknown',
  },
  Israel: {
    '0051CA': 'Israel Defense Forces',
    'E00000': 'Hamas / Hezbollah',
    'AC7339': 'Neutral/Infrastructure',
    '666666': 'Unknown',
  },
}

// ─── Icon number → equipment type mapping ───

const EQUIPMENT_RANGES: [number, number, string][] = [
  [10, 19, 'Tank/Armored Vehicle'],
  [20, 29, 'Artillery/Rocket System'],
  [30, 39, 'Military Position/Base'],
  [40, 49, 'Naval Vessel'],
  [50, 59, 'Drone/UAV'],
  [60, 69, 'Aircraft'],
  [70, 79, 'Helicopter'],
  [80, 89, 'Radar/Air Defense'],
  [90, 99, 'Explosion/Impact'],
  [100, 109, 'Civilian/Infrastructure'],
  [110, 119, 'Ammunition/Depot'],
  [120, 129, 'Airfield/Base'],
  [130, 139, 'Bridge/Road'],
  [140, 149, 'Factory/Industrial'],
  [150, 159, 'Power/Energy'],
  [160, 169, 'Communications'],
  [170, 179, 'Transport Vehicle'],
  [180, 189, 'Missile System'],
  [190, 199, 'General Military'],
  [200, 209, 'Ship/Maritime'],
]

function decodeIcon(iconPath: string, conflict: string): { faction: string | null; faction_color: string | null; equipment_type: string | null; destroyed: boolean } {
  // Format: /icons/{COLOR}/{DESTROYED}/icons/{FOLDER}/{FILENAME}.png
  const match = iconPath.match(/icons\/([A-Fa-f0-9]+)\/(True|False)\/icons\/(\w+)\/(.+)\.png/)
  if (!match) return { faction: null, faction_color: null, equipment_type: null, destroyed: false }

  const [, colorCode, destroyedFlag, , filename] = match
  const factionMap = FACTION_COLORS[conflict] || {}
  const faction = factionMap[colorCode] || null
  const destroyed = destroyedFlag === 'True'

  // Try to decode equipment from filename number
  const numMatch = filename.match(/^(\d+)$/)
  let equipment_type: string | null = null
  if (numMatch) {
    const num = parseInt(numMatch[1])
    for (const [min, max, type] of EQUIPMENT_RANGES) {
      if (num >= min && num <= max) {
        equipment_type = type
        break
      }
    }
  } else {
    // Named icons like "radar_4", "tunnel", "harbor"
    equipment_type = filename.replace(/_\d+$/, '').replace(/_/g, ' ')
    equipment_type = equipment_type.charAt(0).toUpperCase() + equipment_type.slice(1)
  }

  return { faction, faction_color: colorCode ? `#${colorCode}` : null, equipment_type, destroyed }
}

// ─── KML Parser ───

interface KMLPlacemark {
  name: string
  description: string
  coordinates: [number, number] // [lon, lat]
  styleUrl: string
  timestamp: string | null
}

function parseKMLPlacemarks(kmlText: string): KMLPlacemark[] {
  const placemarks: KMLPlacemark[] = []
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g
  let match

  while ((match = placemarkRegex.exec(kmlText)) !== null) {
    const block = match[1]

    const nameMatch = block.match(/<name[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/name>/)
    const descMatch = block.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)
    const coordMatch = block.match(/<coordinates[^>]*>(?:<!\[CDATA\[)?([\d.,-]+)(?:\]\]>)?<\/coordinates>/)
    const styleMatch = block.match(/<styleUrl[^>]*>(?:<!\[CDATA\[)?#?(.*?)(?:\]\]>)?<\/styleUrl>/)
    const timeMatch = block.match(/<when>(.*?)<\/when>/)

    if (coordMatch) {
      const [lon, lat] = coordMatch[1].split(',').map(Number)
      placemarks.push({
        name: nameMatch?.[1]?.trim() || '',
        description: descMatch?.[1]?.trim() || '',
        coordinates: [lon, lat],
        styleUrl: styleMatch?.[1] || '',
        timestamp: timeMatch?.[1] || null,
      })
    }
  }

  return placemarks
}

function parseDescription(desc: string): { text: string; sources: string[]; geolocations: string[] } {
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean)
  const sources: string[] = []
  const geolocations: string[] = []
  const textLines: string[] = []
  let section: 'text' | 'sources' | 'geolocations' = 'text'

  for (const line of lines) {
    if (/^Source\(s\):?\s*$/i.test(line)) { section = 'sources'; continue }
    if (/^Geolocation\(s\):?\s*$/i.test(line)) { section = 'geolocations'; continue }

    if (section === 'sources' && line.startsWith('http')) {
      sources.push(line)
    } else if (section === 'geolocations' && line.startsWith('http')) {
      geolocations.push(line)
    } else if (section === 'text') {
      textLines.push(line)
    }
  }

  return { text: textLines.join(' '), sources, geolocations }
}

// ─── URL parsing ───

function parseGeoconfirmedUrl(url: string): { conflict: string; eventId: string | null } | null {
  // Formats:
  //   https://geoconfirmed.org/iran/6ec0bf37-a740-43e8-058f-08de7b1cb859
  //   https://geoconfirmed.org/ukraine
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.port || !['geoconfirmed.org', 'www.geoconfirmed.org'].includes(u.hostname.toLowerCase())) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0 || parts.length > 2) return null
    if (!parts.every(part => /^[a-zA-Z0-9_-]{1,128}$/.test(part))) return null
    return {
      conflict: parts[0],
      eventId: parts[1] || null,
    }
  } catch {
    return null
  }
}

// ─── Fetch helpers ───

async function fetchConflicts(): Promise<GCConflict[]> {
  const result = await fetchFixedProviderJson<GCConflict[]>(GC_ORIGIN, ['api', 'Conflict'])
  if (!result.response.ok || !Array.isArray(result.data)) throw new Error(`Conflict API returned ${result.response.status}`)
  return result.data
}

async function fetchPlacemarks(conflict: string, page: number, pageSize: number, search?: string): Promise<{ items: GCPlacemark[]; count: number }> {
  // Note: search param returns 403 from server-side requests (needs browser session)
  // Fall back to unfiltered results if search fails
  if (search) {
    const searchResult = await fetchFixedProviderJson<{ items: GCPlacemark[]; count: number }>(
      GC_ORIGIN,
      ['api', 'Placemark', conflict, String(page), String(pageSize)],
      { searchParams: { search } },
    )
    if (searchResult.response.ok && searchResult.data) return searchResult.data
    // Fall through to unfiltered if search is blocked
  }
  const result = await fetchFixedProviderJson<{ items: GCPlacemark[]; count: number }>(
    GC_ORIGIN,
    ['api', 'Placemark', conflict, String(page), String(pageSize)],
  )
  if (!result.response.ok || !result.data) throw new Error(`Placemark API returned ${result.response.status}`)
  return result.data
}

// ─── KML fetch + parse (async with DecompressionStream) ───
async function fetchAndParseKML(conflict: string): Promise<KMLPlacemark[]> {
  const result = await fetchFixedProviderBytes(GC_ORIGIN, ['api', 'map', 'ExportAsKml', conflict], {
    timeoutMs: 30_000,
    maxResponseBytes: MAX_KMZ_BYTES,
    allowedContentTypes: [
      'application/vnd.google-earth.kmz',
      'application/zip',
      'application/octet-stream',
    ],
  })
  if (!result.response.ok) throw new Error(`KML export returned ${result.response.status}`)
  const bytes = result.bytes
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new Error('KML export did not return a valid KMZ archive')
  }

  // Extract doc.kml from zip
  const kmlText = await extractDocKmlFromZipAsync(bytes)
  return parseKMLPlacemarks(kmlText)
}

export async function extractDocKmlFromZipAsync(data: Uint8Array): Promise<string> {
  const textDecoder = new TextDecoder('utf-8')

  for (let i = 0; i <= data.length - 30; i++) {
    if (data[i] === 0x50 && data[i + 1] === 0x4B && data[i + 2] === 0x03 && data[i + 3] === 0x04) {
      const compressionMethod = data[i + 8] | (data[i + 9] << 8)
      const view = new DataView(data.buffer, data.byteOffset + i, 30)
      const compressedSize = view.getUint32(18, true)
      const uncompressedSize = view.getUint32(22, true)
      const filenameLength = data[i + 26] | (data[i + 27] << 8)
      const extraLength = data[i + 28] | (data[i + 29] << 8)
      const filename = textDecoder.decode(data.slice(i + 30, i + 30 + filenameLength))

      if (filename === 'doc.kml') {
        const dataStart = i + 30 + filenameLength + extraLength
        if (compressedSize > MAX_KMZ_BYTES
          || uncompressedSize > MAX_KML_BYTES
          || dataStart + compressedSize > data.length) {
          throw new Error('KMZ entry exceeds its bounded size')
        }

        if (compressionMethod === 0) {
          return textDecoder.decode(data.slice(dataStart, dataStart + (uncompressedSize || compressedSize)))
        } else if (compressionMethod === 8) {
          // Raw deflate — use DecompressionStream
          const compressedSlice = data.slice(dataStart, dataStart + compressedSize)
          const ds = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          await writer.write(compressedSlice)
          await writer.close()

          const reader = ds.readable.getReader()
          const chunks: Uint8Array[] = []
          let totalLength = 0
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            totalLength += value.length
            if (totalLength > MAX_KML_BYTES) {
              await reader.cancel('decompressed KML exceeds size limit')
              throw new Error('Decompressed KML exceeds its bounded size')
            }
          }

          const result = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }
          return textDecoder.decode(result)
        }
      }
    }
  }

  throw new Error('doc.kml not found in KMZ archive')
}

// ─── Cache helpers ───

async function getCachedKML(env: Env, conflict: string): Promise<KMLPlacemark[] | null> {
  if (!env.CACHE) return null
  try {
    const cached = await env.CACHE.get(`gc:kml:${conflict}`, 'json')
    return cached as KMLPlacemark[] | null
  } catch {
    return null
  }
}

async function setCachedKML(env: Env, conflict: string, placemarks: KMLPlacemark[]): Promise<void> {
  if (!env.CACHE) return
  try {
    // Cache for 1 hour — data updates periodically
    await env.CACHE.put(`gc:kml:${conflict}`, JSON.stringify(placemarks), { expirationTtl: 3600 })
  } catch { /* non-fatal */ }
}

// ─── Main handler ───

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Auth check — this endpoint crawls external geoconfirmed.org API
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  try {
    const parsedBody: unknown = await request.json()
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const body = parsedBody as GeoConfirmedRequest
    if ((body.url !== undefined && (typeof body.url !== 'string' || body.url.length > 2048))
      || (body.conflict !== undefined && (typeof body.conflict !== 'string' || body.conflict.length > 64))
      || (body.search !== undefined && (typeof body.search !== 'string' || body.search.length > 500))
      || (body.page !== undefined && (!Number.isInteger(body.page) || body.page < 1 || body.page > 100_000))
      || (body.pageSize !== undefined && (!Number.isInteger(body.pageSize) || body.pageSize < 1 || body.pageSize > 200))) {
      return new Response(JSON.stringify({ error: 'Invalid or oversized GeoConfirmed request parameters' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Mode: List conflicts
    if (body.action === 'conflicts' || (!body.conflict && !body.url && !body.search)) {
      const conflicts = await fetchConflicts()
      return new Response(JSON.stringify({
        conflicts: conflicts.map(c => ({
          name: c.name,
          shortName: c.shortName,
          code: c.code,
          startDate: c.startDate,
          endDate: c.endDate,
          url: `https://geoconfirmed.org/${c.shortName.toLowerCase()}`,
        })),
      }), { headers: JSON_HEADERS })
    }

    // Mode: URL extraction
    if (body.url) {
      const parsed = parseGeoconfirmedUrl(body.url)
      if (!parsed) {
        return new Response(JSON.stringify({ error: 'Not a valid geoconfirmed.org URL' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }

      // Resolve conflict shortName (URL uses lowercase path like "iran")
      const conflicts = await fetchConflicts()
      const conflict = conflicts.find(c =>
        c.shortName.toLowerCase() === parsed.conflict.toLowerCase() ||
        c.code.toLowerCase() === parsed.conflict.toLowerCase()
      )

      if (!conflict) {
        return new Response(JSON.stringify({
          error: `Unknown conflict: ${parsed.conflict}`,
          available: conflicts.map(c => c.shortName),
        }), { status: 404, headers: JSON_HEADERS })
      }

      if (parsed.eventId) {
        // Fetch KML to find specific event by ID
        // The ID in the URL maps to the placemark's id in the JSON API
        // but KML doesn't have IDs — we need to match by coordinates or description

        // First try JSON API to get coordinates
        const allPlacemarks = await fetchPlacemarks(conflict.shortName, 1, 2000)
        const target = allPlacemarks.items.find(p => p.id === parsed.eventId)

        if (!target) {
          return new Response(JSON.stringify({ error: 'Event not found', eventId: parsed.eventId }), {
            status: 404, headers: JSON_HEADERS,
          })
        }

        // Now get enriched data from KML
        let kmlPlacemarks = await getCachedKML(env, conflict.shortName)
        if (!kmlPlacemarks) {
          kmlPlacemarks = await fetchAndParseKML(conflict.shortName)
          await setCachedKML(env, conflict.shortName, kmlPlacemarks)
        }

        // Match KML placemark by coordinates (within ~0.001 degree tolerance)
        const kmlMatch = kmlPlacemarks.find(kp =>
          Math.abs(kp.coordinates[0] - target.lo) < 0.001 &&
          Math.abs(kp.coordinates[1] - target.la) < 0.001
        )

        const iconInfo = decodeIcon(target.icon, conflict.shortName)
        const descParsed = kmlMatch ? parseDescription(kmlMatch.description) : null

        const event: EnrichedEvent = {
          id: target.id,
          date: target.date,
          latitude: target.la,
          longitude: target.lo,
          description: descParsed?.text || kmlMatch?.name || null,
          sources: descParsed?.sources || [],
          geolocations: descParsed?.geolocations || [],
          faction: iconInfo.faction,
          faction_color: iconInfo.faction_color,
          equipment_type: iconInfo.equipment_type,
          destroyed: iconInfo.destroyed,
          icon_path: target.icon,
        }

        return new Response(JSON.stringify({
          conflict: { name: conflict.name, code: conflict.code },
          event,
          url: body.url,
        }), { headers: JSON_HEADERS })
      }

      // No specific event — return conflict overview with recent events
      const page = body.page ?? 1
      const pageSize = body.pageSize ?? 50
      const result = await fetchPlacemarks(conflict.shortName, page, pageSize)

      return new Response(JSON.stringify({
        conflict: { name: conflict.name, code: conflict.code, shortName: conflict.shortName },
        total: result.count,
        page,
        pageSize,
        events: result.items.map(p => ({
          id: p.id,
          date: p.date,
          latitude: p.la,
          longitude: p.lo,
          ...decodeIcon(p.icon, conflict.shortName),
          icon_path: p.icon,
          url: `https://geoconfirmed.org/${parsed.conflict}/${p.id}`,
        })),
      }), { headers: JSON_HEADERS })
    }

    // Mode: Search or list
    const conflict = body.conflict?.trim() || 'Iran'
    const page = body.page ?? 1
    const pageSize = body.pageSize ?? 50
    const search = body.search?.trim() || undefined

    // Validate conflict exists
    const conflicts = await fetchConflicts()
    const conflictInfo = conflicts.find(c =>
      c.shortName.toLowerCase() === conflict.toLowerCase() ||
      c.code.toLowerCase() === conflict.toLowerCase() ||
      c.name.toLowerCase() === conflict.toLowerCase()
    )

    if (!conflictInfo) {
      return new Response(JSON.stringify({
        error: `Unknown conflict: ${conflict}`,
        available: conflicts.map(c => ({ name: c.name, shortName: c.shortName })),
      }), { status: 404, headers: JSON_HEADERS })
    }

    const result = await fetchPlacemarks(conflictInfo.shortName, page, pageSize, search)

    // If enriched detail requested and page is small enough, merge with KML
    const enriched = body.enriched !== false && pageSize <= 50

    let events: TimelineEvent[]
    if (enriched) {
      let kmlPlacemarks = await getCachedKML(env, conflictInfo.shortName)
      if (!kmlPlacemarks) {
        kmlPlacemarks = await fetchAndParseKML(conflictInfo.shortName)
        await setCachedKML(env, conflictInfo.shortName, kmlPlacemarks)
      }

      events = result.items.map(p => {
        const iconInfo = decodeIcon(p.icon, conflictInfo.shortName)
        // Match by coordinates
        const kmlMatch = kmlPlacemarks!.find(kp =>
          Math.abs(kp.coordinates[0] - p.lo) < 0.001 &&
          Math.abs(kp.coordinates[1] - p.la) < 0.001
        )
        const descParsed = kmlMatch ? parseDescription(kmlMatch.description) : null

        return {
          id: p.id,
          date: p.date,
          latitude: p.la,
          longitude: p.lo,
          description: descParsed?.text || kmlMatch?.name || null,
          sources: descParsed?.sources || [],
          geolocations: descParsed?.geolocations || [],
          ...iconInfo,
          icon_path: p.icon,
          url: `https://geoconfirmed.org/${conflictInfo.shortName.toLowerCase()}/${p.id}`,
        }
      })
    } else {
      events = result.items.map(p => ({
        id: p.id,
        date: p.date,
        latitude: p.la,
        longitude: p.lo,
        ...decodeIcon(p.icon, conflictInfo.shortName),
        icon_path: p.icon,
        url: `https://geoconfirmed.org/${conflictInfo.shortName.toLowerCase()}/${p.id}`,
      }))
    }

    return new Response(JSON.stringify({
      conflict: { name: conflictInfo.name, code: conflictInfo.code, shortName: conflictInfo.shortName },
      total: result.count,
      page,
      pageSize,
      search: search || null,
      enriched,
      events,
    }), { headers: JSON_HEADERS })

  } catch {
    console.error('[GeoConfirmed Crawler] bounded provider request failed')
    return new Response(JSON.stringify({
      error: 'Failed to fetch GeoConfirmed data',
    }), { status: 500, headers: JSON_HEADERS })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
