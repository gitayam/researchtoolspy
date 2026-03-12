/**
 * Export Bundle Orchestrator
 *
 * Selects the right serializer based on format, runs it against the
 * provided data, and returns { content, filename, contentType }.
 *
 * Pure function: no D1 or R2 access. The API endpoint is responsible
 * for fetching data and storing results.
 */

import type { ExportFormat } from '../../types/cop'
import { EXPORT_FORMAT_CONFIG } from '../../types/cop'
import { serializeGeoJsonBundle } from './geojson-serializer'
import { serializeKml } from './kml-serializer'
import { serializeStixBundle } from './stix-serializer'
import { serializeCsvBundle } from './csv-serializer'

export interface ExportInput {
  session: {
    id: string
    name: string
    template_type?: string
    bbox_min_lat?: number | null
    bbox_min_lon?: number | null
    bbox_max_lat?: number | null
    bbox_max_lon?: number | null
    created_at: string
    updated_at?: string | null
  }
  /** GeoJSON FeatureCollections keyed by layer ID (for geojson/kml formats) */
  layerData?: Record<string, any>
  /** Entity arrays (for stix/csv formats) */
  entities?: {
    actors?: any[]
    events?: any[]
    places?: any[]
    evidence?: any[]
    relationships?: any[]
    hypotheses?: any[]
    tasks?: any[]
  }
}

export interface ExportResult {
  /** Serialized content (single file) or map of filename -> content (multi-file) */
  content: string | Record<string, string>
  /** Suggested filename for the export */
  filename: string
  /** MIME type for the primary content */
  contentType: string
  /** Whether the result is a multi-file bundle (needs zip or concatenation) */
  isMultiFile: boolean
}

/**
 * Run the appropriate serializer for the given format.
 */
export function generateExport(format: ExportFormat, input: ExportInput): ExportResult {
  const config = EXPORT_FORMAT_CONFIG[format]
  const sessionSlug = input.session.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const baseFilename = `${sessionSlug}-${timestamp}`

  switch (format) {
    case 'geojson': {
      const bundle = serializeGeoJsonBundle(input.session, input.layerData || {})
      // Return as a single combined JSON with layers embedded
      const combined = {
        _metadata: JSON.parse(bundle.metadata),
        ...Object.fromEntries(
          Object.entries(bundle.layers).map(([k, v]) => [k, JSON.parse(v)])
        ),
      }
      return {
        content: JSON.stringify(combined, null, 2),
        filename: `${baseFilename}${config.ext}`,
        contentType: config.mime,
        isMultiFile: false,
      }
    }

    case 'kml': {
      const kml = serializeKml(input.session, input.layerData || {})
      return {
        content: kml,
        filename: `${baseFilename}${config.ext}`,
        contentType: config.mime,
        isMultiFile: false,
      }
    }

    case 'stix': {
      const stix = serializeStixBundle(input.session, input.entities || {})
      return {
        content: stix,
        filename: `${baseFilename}${config.ext}`,
        contentType: config.mime,
        isMultiFile: false,
      }
    }

    case 'csv': {
      const csvFiles = serializeCsvBundle(input.entities || {})
      // If only one entity type, return single CSV; otherwise combine with separator
      const entries = Object.entries(csvFiles)
      if (entries.length === 0) {
        return {
          content: '',
          filename: `${baseFilename}${config.ext}`,
          contentType: config.mime,
          isMultiFile: false,
        }
      }
      if (entries.length === 1) {
        return {
          content: entries[0][1],
          filename: `${baseFilename}-${entries[0][0]}`,
          contentType: config.mime,
          isMultiFile: false,
        }
      }
      // Multi-file: return map
      return {
        content: csvFiles,
        filename: `${baseFilename}${config.ext}`,
        contentType: config.mime,
        isMultiFile: true,
      }
    }

    case 'cot': {
      // CoT XML is handled by the existing cot-serializer via the /cot endpoint.
      // For export, we generate a snapshot feed from entity data.
      // We reuse the layer data to build CoT events.
      const events: string[] = []
      const now = new Date()
      const staleTime = new Date(now.getTime() + 60 * 60_000) // 1 hour stale

      const formatTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '.000Z')

      for (const [, fc] of Object.entries(input.layerData || {})) {
        for (const feature of fc.features || []) {
          const props = feature.properties || {}
          const geom = feature.geometry
          if (!geom || geom.type !== 'Point') continue
          const [lon, lat] = geom.coordinates
          const uid = props.id || props.uid || `export-${crypto.randomUUID().slice(0, 8)}`
          const callsign = props.name || props.callsign || props.title || ''

          events.push(
            `<event version="2.0" uid="${escapeXmlAttr(String(uid))}" type="a-u-G" ` +
            `time="${formatTime(now)}" start="${formatTime(now)}" stale="${formatTime(staleTime)}" how="h-e">` +
            `<point lat="${lat}" lon="${lon}" hae="0" ce="9999999.0" le="9999999.0"/>` +
            (callsign ? `<detail><contact callsign="${escapeXmlAttr(callsign)}"/></detail>` : '<detail/>') +
            `</event>`
          )
        }
      }

      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<events>\n${events.join('\n')}\n</events>`
      return {
        content: xml,
        filename: `${baseFilename}${config.ext}`,
        contentType: config.mime,
        isMultiFile: false,
      }
    }

    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
