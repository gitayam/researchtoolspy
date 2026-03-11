/**
 * CSV Serializer
 *
 * One CSV file per entity type with flat columns.
 * Proper escaping: fields containing commas, quotes, or newlines are
 * double-quoted with internal quotes doubled (RFC 4180).
 *
 * Pure function: takes data objects, returns a map of filename -> CSV string.
 * No D1 access.
 */

/**
 * Escape a single CSV field value per RFC 4180.
 */
function escapeCsvField(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of row objects into a CSV string with the given headers.
 */
function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvField(row[h])).join(',')
  )
  return [headerLine, ...dataLines].join('\n')
}

export interface CsvEntitiesInput {
  actors?: Array<Record<string, unknown>>
  events?: Array<Record<string, unknown>>
  places?: Array<Record<string, unknown>>
  evidence?: Array<Record<string, unknown>>
  tasks?: Array<Record<string, unknown>>
  relationships?: Array<Record<string, unknown>>
  hypotheses?: Array<Record<string, unknown>>
}

/**
 * Serialize COP entities into one CSV per entity type.
 * Returns a map of { "actors.csv": "...", "events.csv": "...", ... }
 */
export function serializeCsvBundle(entities: CsvEntitiesInput): Record<string, string> {
  const files: Record<string, string> = {}

  if (entities.actors?.length) {
    files['actors.csv'] = toCsv(
      ['id', 'name', 'type', 'category', 'affiliation', 'description', 'created_at'],
      entities.actors
    )
  }

  if (entities.events?.length) {
    files['events.csv'] = toCsv(
      ['id', 'name', 'event_type', 'description', 'date', 'location', 'created_at'],
      entities.events
    )
  }

  if (entities.places?.length) {
    // Flatten coordinates into lat/lon columns
    const flatPlaces = entities.places.map((p: any) => {
      let lat: unknown = ''
      let lon: unknown = ''
      try {
        const coords =
          typeof p.coordinates === 'string'
            ? JSON.parse(p.coordinates)
            : p.coordinates
        lat = coords?.lat ?? ''
        lon = coords?.lng ?? ''
      } catch {
        // leave empty
      }
      return { ...p, lat, lon }
    })
    files['places.csv'] = toCsv(
      ['id', 'name', 'place_type', 'description', 'lat', 'lon', 'created_at'],
      flatPlaces
    )
  }

  if (entities.evidence?.length) {
    files['evidence.csv'] = toCsv(
      ['id', 'title', 'type', 'source_url', 'confidence', 'created_at'],
      entities.evidence
    )
  }

  if (entities.tasks?.length) {
    files['tasks.csv'] = toCsv(
      ['id', 'title', 'status', 'priority', 'task_type', 'assigned_to', 'due_date', 'completed_at'],
      entities.tasks
    )
  }

  if (entities.relationships?.length) {
    files['relationships.csv'] = toCsv(
      ['id', 'relationship_type', 'source_entity_type', 'source_entity_id', 'target_entity_type', 'target_entity_id', 'created_at'],
      entities.relationships
    )
  }

  if (entities.hypotheses?.length) {
    files['hypotheses.csv'] = toCsv(
      ['id', 'statement', 'status', 'confidence', 'created_at'],
      entities.hypotheses
    )
  }

  return files
}
