export const TIMELINE_PRESENTATION_MAX_BYTES = 512 * 1024
export interface PresentationDate { year: number; month?: number; day?: number; hour?: number; minute?: number; second?: number }
interface PresentationText { headline: string; text: string }
export interface TimelinePresentation {
  schemaVersion: 'timeline-presentation.v1'
  timeline: {
    scale: 'human'
    title: { text: PresentationText; unique_id: 'narrative-title'; autolink: false }
    events: Array<{ start_date: PresentationDate; end_date?: PresentationDate; text: PresentationText; unique_id: string; display_date: string; autolink: false; group?: string }>
  }
}
function invalid(): never { throw new Error('Invalid presentation') }
function record(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid()
  const item = value as Record<string, unknown>
  if (required.some(key => !Object.hasOwn(item, key)) || Reflect.ownKeys(item).some(key => typeof key !== 'string' || ![...required, ...optional].includes(key))) invalid()
  return item
}
function text(value: unknown, max: number, paragraphs = false): string {
  if (typeof value !== 'string' || value.length > max || /[<>]/.test(paragraphs ? value.replace(/<\/?(?:p|strong)>/g, '') : value)) invalid()
  return value
}
function block(value: unknown, limit: number): PresentationText {
  const item = record(value, ['headline', 'text'])
  return { headline: text(item.headline, limit), text: text(item.text, 131072, true) }
}
const fields = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const
function date(value: unknown): PresentationDate {
  const item = record(value, ['year'], fields.slice(1))
  const bounds = { year: [0, 9999], month: [1, 12], day: [1, 31], hour: [0, 23], minute: [0, 59], second: [0, 59] }
  const copy: Record<string, number> = {}
  for (const field of fields) {
    if (!Object.hasOwn(item, field)) continue
    const number = item[field]
    if (typeof number !== 'number' || !Number.isInteger(number) || number < bounds[field][0] || number > bounds[field][1]) invalid()
    copy[field] = number
  }
  if (copy.day !== undefined && copy.month === undefined) invalid()
  if ((copy.hour !== undefined || copy.minute !== undefined || copy.second !== undefined) && copy.day === undefined) invalid()
  if ((copy.hour === undefined) !== (copy.minute === undefined) || (copy.second !== undefined && copy.minute === undefined)) invalid()
  if (copy.day !== undefined) {
    const leap = copy.year % 4 === 0 && (copy.year % 100 !== 0 || copy.year % 400 === 0)
    if (copy.day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][copy.month - 1]) invalid()
  }
  return copy as unknown as PresentationDate
}
/** Browser-independent, strict projection boundary. Never accepts workspace data. */
export function decodeTimelinePresentation(value: unknown): TimelinePresentation {
  const root = record(value, ['schemaVersion', 'timeline'])
  if (root.schemaVersion !== 'timeline-presentation.v1') invalid()
  const timeline = record(root.timeline, ['title', 'events', 'scale'])
  if (timeline.scale !== 'human' || !Array.isArray(timeline.events) || timeline.events.length < 1 || timeline.events.length > 100) invalid()
  const title = record(timeline.title, ['text', 'unique_id', 'autolink'])
  if (title.unique_id !== 'narrative-title' || title.autolink !== false) invalid()
  const ids = new Set<string>()
  const events = timeline.events.map(value => {
    const item = record(value, ['start_date', 'text', 'unique_id', 'display_date', 'autolink'], ['group', 'end_date'])
    if (item.autolink !== false || typeof item.unique_id !== 'string' || item.unique_id.length > 606 || !item.unique_id.startsWith('event-') || ids.has(item.unique_id)) invalid()
    const id = decodeURIComponent(item.unique_id.slice(6))
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(id) || 'event-' + encodeURIComponent(id) !== item.unique_id) invalid()
    ids.add(item.unique_id)
    const start = date(item.start_date)
    const end = Object.hasOwn(item, 'end_date') ? date(item.end_date) : undefined
    if (end) {
      for (const field of fields) {
        const fallback = field === 'month' || field === 'day' ? 1 : 0
        const a = start[field] ?? fallback, b = end[field] ?? fallback
        if (b < a) invalid()
        if (b > a) break
      }
    }
    return { start_date: start, ...(end ? { end_date: end } : {}), text: block(item.text, 6000), unique_id: item.unique_id,
      display_date: text(item.display_date, 1000), autolink: false as const, ...(Object.hasOwn(item, 'group') ? { group: text(item.group, 8000) } : {}) }
  })
  const result: TimelinePresentation = { schemaVersion: 'timeline-presentation.v1', timeline: { scale: 'human', title: { text: block(title.text, 60000), unique_id: 'narrative-title', autolink: false }, events } }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > TIMELINE_PRESENTATION_MAX_BYTES) invalid()
  return result
}
/** Decode adapter formatting once. The result is text, never safe HTML. */
export function presentationPlainText(value: string): string {
  const safe = text(value, TIMELINE_PRESENTATION_MAX_BYTES, true)
  return safe.replace(/<\/?strong>/g, '').replace(/<p>/g, '').replace(/<\/p>/g, '\n\n')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity]!).trim()
}
