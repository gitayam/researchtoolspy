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

interface Env {
  CACHE: KVNamespace
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ─── GeoConfirmed API endpoints ───

const GC_API = 'https://geoconfirmed.org/api'

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

interface GCFaction {
  id: number
  name: string
  color: string
  invertTextColor: boolean
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
    if (!u.hostname.includes('geoconfirmed.org')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length === 0) return null
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
  const res = await fetch(`${GC_API}/Conflict`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Conflict API returned ${res.status}`)
  return res.json()
}

async function fetchConflictDetail(shortName: string): Promise<{ factions: GCFaction[] }> {
  const res = await fetch(`${GC_API}/Conflict/${shortName}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Conflict detail API returned ${res.status}`)
  return res.json()
}

async function fetchPlacemarks(conflict: string, page: number, pageSize: number, search?: string): Promise<{ items: GCPlacemark[]; count: number }> {
  // Note: search param returns 403 from server-side requests (needs browser session)
  // Fall back to unfiltered results if search fails
  if (search) {
    const searchUrl = `${GC_API}/Placemark/${conflict}/${page}/${pageSize}?search=${encodeURIComponent(search)}`
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) })
    if (searchRes.ok) return searchRes.json()
    // Fall through to unfiltered if search is blocked
  }
  const url = `${GC_API}/Placemark/${conflict}/${page}/${pageSize}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Placemark API returned ${res.status}`)
  return res.json()
}

// ─── KML fetch + parse (async with DecompressionStream) ───
async function fetchAndParseKML(conflict: string): Promise<KMLPlacemark[]> {
  const res = await fetch(`${GC_API}/map/ExportAsKml/${conflict}`, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`KML export returned ${res.status}`)

  const arrayBuffer = await res.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // Extract doc.kml from zip
  const kmlText = await extractDocKmlFromZipAsync(bytes)
  return parseKMLPlacemarks(kmlText)
}

async function extractDocKmlFromZipAsync(data: Uint8Array): Promise<string> {
  const textDecoder = new TextDecoder('utf-8')

  for (let i = 0; i < data.length - 30; i++) {
    if (data[i] === 0x50 && data[i + 1] === 0x4B && data[i + 2] === 0x03 && data[i + 3] === 0x04) {
      const compressionMethod = data[i + 8] | (data[i + 9] << 8)
      const compressedSize = data[i + 18] | (data[i + 19] << 8) | (data[i + 20] << 16) | (data[i + 21] << 24)
      const uncompressedSize = data[i + 22] | (data[i + 23] << 8) | (data[i + 24] << 16) | (data[i + 25] << 24)
      const filenameLength = data[i + 26] | (data[i + 27] << 8)
      const extraLength = data[i + 28] | (data[i + 29] << 8)
      const filename = textDecoder.decode(data.slice(i + 30, i + 30 + filenameLength))

      if (filename === 'doc.kml') {
        const dataStart = i + 30 + filenameLength + extraLength

        if (compressionMethod === 0) {
          return textDecoder.decode(data.slice(dataStart, dataStart + (uncompressedSize || compressedSize)))
        } else if (compressionMethod === 8) {
          // Raw deflate — use DecompressionStream
          const compressedSlice = data.slice(dataStart, dataStart + compressedSize)
          const ds = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          writer.write(compressedSlice)
          writer.close()

          const reader = ds.readable.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }

          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
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

  try {
    const body = await request.json() as any

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
      }), { headers: corsHeaders })
    }

    // Mode: URL extraction
    if (body.url) {
      const parsed = parseGeoconfirmedUrl(body.url)
      if (!parsed) {
        return new Response(JSON.stringify({ error: 'Not a valid geoconfirmed.org URL' }), {
          status: 400, headers: corsHeaders,
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
        }), { status: 404, headers: corsHeaders })
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
            status: 404, headers: corsHeaders,
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
        }), { headers: corsHeaders })
      }

      // No specific event — return conflict overview with recent events
      const page = body.page || 1
      const pageSize = Math.min(body.pageSize || 50, 200)
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
      }), { headers: corsHeaders })
    }

    // Mode: Search or list
    const conflict = body.conflict || 'Iran'
    const page = body.page || 1
    const pageSize = Math.min(body.pageSize || 50, 200)
    const search = body.search || undefined

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
      }), { status: 404, headers: corsHeaders })
    }

    const result = await fetchPlacemarks(conflictInfo.shortName, page, pageSize, search)

    // If enriched detail requested and page is small enough, merge with KML
    const enriched = body.enriched !== false && pageSize <= 50

    let events: any[]
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
    }), { headers: corsHeaders })

  } catch (error: any) {
    console.error('[GeoConfirmed Crawler] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch GeoConfirmed data',
    }), { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: corsHeaders })
}
