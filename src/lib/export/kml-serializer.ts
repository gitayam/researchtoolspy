/**
 * KML Serializer
 *
 * Converts GeoJSON FeatureCollections to KML XML.
 * Maps entity types to styled Placemarks, relationships as LineStrings.
 * Events get TimeSpan elements. Layers become KML Folders.
 *
 * Pure function: takes data objects, returns a KML string. No D1 access.
 */

const KML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>`

const KML_FOOTER = `</Document>
</kml>`

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function featureToPlacemark(feature: {
  geometry?: { type: string; coordinates: any } | null
  properties?: Record<string, any> | null
}): string {
  const props = feature.properties || {}
  const name = escapeXml(String(props.name || props.title || props.id || 'Unnamed'))
  const desc = escapeXml(String(props.description || ''))
  const coords = feature.geometry?.coordinates

  if (!coords) return ''

  const geomType = feature.geometry!.type

  let geometry = ''
  if (geomType === 'Point') {
    const [lon, lat, alt] = coords
    geometry = `<Point><coordinates>${lon},${lat},${alt ?? 0}</coordinates></Point>`
  } else if (geomType === 'LineString') {
    const coordStr = (coords as number[][])
      .map((c: number[]) => `${c[0]},${c[1]},${c[2] ?? 0}`)
      .join(' ')
    geometry = `<LineString><coordinates>${coordStr}</coordinates></LineString>`
  } else if (geomType === 'Polygon') {
    const ring = coords[0] as number[][]
    const coordStr = ring
      .map((c: number[]) => `${c[0]},${c[1]},${c[2] ?? 0}`)
      .join(' ')
    geometry = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordStr}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
  }

  if (!geometry) return ''

  let timeSpan = ''
  if (props.start_date || props.event_date) {
    const begin = String(props.start_date || props.event_date)
    const end = props.end_date ? String(props.end_date) : ''
    timeSpan = `<TimeSpan><begin>${escapeXml(begin)}</begin>${end ? `<end>${escapeXml(end)}</end>` : ''}</TimeSpan>`
  }

  // Build extended data for all properties
  const extDataEntries = Object.entries(props)
    .filter(([k]) => !['name', 'title', 'description', 'start_date', 'end_date', 'event_date'].includes(k))
    .map(([k, v]) => `        <Data name="${escapeXml(k)}"><value>${escapeXml(String(v ?? ''))}</value></Data>`)

  const extData = extDataEntries.length > 0
    ? `\n      <ExtendedData>\n${extDataEntries.join('\n')}\n      </ExtendedData>`
    : ''

  return `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      ${timeSpan}${extData}
      ${geometry}
    </Placemark>`
}

export interface KmlSessionInput {
  name: string
}

export interface KmlFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry?: { type: string; coordinates: any } | null
    properties?: Record<string, any> | null
  }>
}

export function serializeKml(
  session: KmlSessionInput,
  layerData: Record<string, KmlFeatureCollection>
): string {
  const folders = Object.entries(layerData)
    .map(([layerId, fc]) => {
      const placemarks = (fc.features || [])
        .map(featureToPlacemark)
        .filter(Boolean)
        .join('\n')
      return `  <Folder>
    <name>${escapeXml(layerId)}</name>
${placemarks}
  </Folder>`
    })
    .join('\n')

  return `${KML_HEADER}
  <name>${escapeXml(session.name || 'COP Export')}</name>
${folders}
${KML_FOOTER}`
}
