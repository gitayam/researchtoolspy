/**
 * Cursor on Target (CoT) XML Serializer
 *
 * Converts COP entities to CoT XML for ATAK/WinTAK/iTAK interoperability.
 * CoT spec: MIL-STD-6040 / https://www.mitre.org/sites/default/files/pdf/09_4937.pdf
 *
 * This is a pure utility module with no HTTP handler -- it exports functions
 * consumed by the CoT feed endpoint and potentially other services.
 */

export interface CoTEvent {
  uid: string
  type: string         // e.g., "a-f-G-U-C" (friendly ground unit combat)
  lat: number
  lon: number
  hae?: number
  callsign?: string
  staleMinutes?: number
  detail?: Record<string, string>
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

/**
 * Convert a CoTEvent to a CoT XML <event> element string.
 */
export function entityToCoT(event: CoTEvent): string {
  const now = new Date()
  const stale = new Date(now.getTime() + (event.staleMinutes ?? 5) * 60_000)

  let detailXml = ''
  if (event.callsign) {
    detailXml += `\n    <contact callsign="${escapeXml(event.callsign)}"/>`
  }
  if (event.detail) {
    for (const [key, value] of Object.entries(event.detail)) {
      detailXml += `\n    <__${escapeXml(key)}>${escapeXml(value)}</__${escapeXml(key)}>`
    }
  }

  return `<event version="2.0"
  uid="${escapeXml(event.uid)}"
  type="${escapeXml(event.type)}"
  time="${formatTime(now)}"
  start="${formatTime(now)}"
  stale="${formatTime(stale)}"
  how="h-e">
  <point lat="${event.lat}" lon="${event.lon}"
    hae="${event.hae ?? 0}"
    ce="9999999.0" le="9999999.0"/>${detailXml ? `\n  <detail>${detailXml}\n  </detail>` : '\n  <detail/>'}
</event>`
}

/**
 * Wrap an array of CoT <event> XML strings in a feed envelope.
 */
export function wrapCoTFeed(events: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<events>
${events.join('\n')}
</events>`
}

// ---------------------------------------------------------------------------
// Entity type -> CoT type atom mappers
// ---------------------------------------------------------------------------

/**
 * Map a place type to a CoT type atom.
 *
 * FACILITY/INSTALLATION -> b-i-X-i (infrastructure)
 * CITY/REGION/COUNTRY   -> a-n-G   (neutral ground point)
 */
export function placeToCoTType(placeType: string): string {
  const map: Record<string, string> = {
    FACILITY: 'b-i-X-i',
    INSTALLATION: 'b-i-X-i',
    CITY: 'a-n-G',
    REGION: 'a-n-G',
    COUNTRY: 'a-n-G',
  }
  return map[placeType] || 'b-i-X-i'
}

/**
 * Map an event type to a CoT type atom.
 *
 * OPERATION/INCIDENT/ACTIVITY -> b-r-f-h-c (SIGACT)
 * MEETING                     -> a-n-G-U   (neutral ground unit)
 */
export function eventToCoTType(eventType: string): string {
  const map: Record<string, string> = {
    OPERATION: 'b-r-f-h-c',
    INCIDENT: 'b-r-f-h-c',
    MEETING: 'a-n-G-U',
    ACTIVITY: 'b-r-f-h-c',
  }
  return map[eventType] || 'b-r-f-h-c'
}

/**
 * Map an actor type to a CoT type atom.
 *
 * PERSON                              -> a-u-G-U   (unknown ground unit)
 * ORGANIZATION/GROUP/GOVERNMENT/UNIT  -> a-u-G-U-C (unknown ground unit combat)
 */
export function actorToCoTType(actorType: string): string {
  const map: Record<string, string> = {
    PERSON: 'a-u-G-U',
    ORGANIZATION: 'a-u-G-U-C',
    GROUP: 'a-u-G-U-C',
    GOVERNMENT: 'a-u-G-U-C',
    UNIT: 'a-u-G-U-C',
  }
  return map[actorType] || 'a-u-G-U'
}
