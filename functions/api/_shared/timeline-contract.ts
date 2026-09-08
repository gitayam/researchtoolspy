export const TIMELINE_ANALYSIS_SCHEMA_VERSION = 'timeline-analysis.v1' as const

export const TIMELINE_EVENT_CATEGORIES = [
  'event',
  'meeting',
  'communication',
  'financial',
  'legal',
  'travel',
  'publication',
  'military',
  'political',
] as const

export const TIMELINE_EVENT_IMPORTANCE = ['low', 'normal', 'high', 'critical'] as const

export type TimelineEventCategory = typeof TIMELINE_EVENT_CATEGORIES[number]
export type TimelineEventImportance = typeof TIMELINE_EVENT_IMPORTANCE[number]
export type TimelineDatePrecision = 'day' | 'month' | 'year'
export type TimelineSuppliedContentSource =
  | 'bot-scrape'
  | 'content-intelligence'
  | 'publisher-feed'
  | 'browser-render'

export interface TimelineAnalysisRequestV1 {
  schemaVersion: typeof TIMELINE_ANALYSIS_SCHEMA_VERSION
  url: string
  content?: {
    text: string
    title?: string
    publishedAt?: string
    source: TimelineSuppliedContentSource
  }
}

export interface TimelineEventV1 {
  eventDate: string
  datePrecision: TimelineDatePrecision
  title: string
  description: string | null
  category: TimelineEventCategory
  importance: TimelineEventImportance
}

export interface TimelineAnalysisResponseV1 {
  schemaVersion: typeof TIMELINE_ANALYSIS_SCHEMA_VERSION
  requestId: string
  outcome: 'events' | 'no_events'
  article: {
    url: string
    title: string
    domain: string
    publishedAt?: string
  }
  events: TimelineEventV1[]
  extraction: {
    contentSource: string
    sourceMode: 'live' | 'supplied' | 'archive' | 'provider'
    method?: string
    wordCount: number
    quality: {
      version: string
      score: number
      accepted: boolean
      reason?: string
    }
    fallbackAttempts: string[]
  }
  model: {
    name: string
    status: 'ok' | 'no_events'
    rejectedEventCount: number
  }
}

export interface NormalizedTimelineModelOutput {
  status: 'ok' | 'no_events' | 'invalid_output'
  events: TimelineEventV1[]
  rejectedEventCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
}

/** Validate both the syntax and calendar semantics of a model-produced date. */
export function timelineDatePrecision(value: unknown): TimelineDatePrecision | null {
  if (typeof value !== 'string') return null
  if (/^\d{4}$/.test(value)) return Number(value) >= 1000 ? 'year' : null
  const month = /^(\d{4})-(\d{2})$/.exec(value)
  if (month) {
    const year = Number(month[1])
    const monthNumber = Number(month[2])
    return year >= 1000 && monthNumber >= 1 && monthNumber <= 12 ? 'month' : null
  }
  return validCalendarDate(value) ? 'day' : null
}

/**
 * Convert untrusted model JSON into the public contract. Dates and titles are
 * evidence-bearing fields, so malformed entries are dropped rather than filled
 * with today's date or an "unknown event" placeholder.
 */
export function normalizeTimelineModelPayload(value: unknown): NormalizedTimelineModelOutput {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    return { status: 'invalid_output', events: [], rejectedEventCount: 0 }
  }

  const events: TimelineEventV1[] = []
  const candidates = value.events.slice(0, 100)
  let rejectedEventCount = value.events.length - candidates.length
  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      rejectedEventCount += 1
      continue
    }
    const precision = timelineDatePrecision(candidate.event_date)
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
    if (!precision || !title) {
      rejectedEventCount += 1
      continue
    }
    const category = typeof candidate.category === 'string'
      && (TIMELINE_EVENT_CATEGORIES as readonly string[]).includes(candidate.category)
      ? candidate.category as TimelineEventCategory
      : 'event'
    const importance = typeof candidate.importance === 'string'
      && (TIMELINE_EVENT_IMPORTANCE as readonly string[]).includes(candidate.importance)
      ? candidate.importance as TimelineEventImportance
      : 'normal'
    events.push({
      eventDate: candidate.event_date as string,
      datePrecision: precision,
      title: title.slice(0, 200),
      description: typeof candidate.description === 'string'
        ? candidate.description.trim().slice(0, 500) || null
        : null,
      category,
      importance,
    })
  }

  if (events.length > 0) return { status: 'ok', events, rejectedEventCount }
  if (value.events.length === 0) return { status: 'no_events', events, rejectedEventCount }
  return { status: 'invalid_output', events, rejectedEventCount }
}
