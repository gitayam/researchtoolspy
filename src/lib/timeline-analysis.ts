import { getCopHeaders, getGuestHeaders } from '@/lib/cop-auth'
import type {
  TimelineAnalysisInput,
  TimelineAnalysisResult,
  TimelineEvent,
} from '@/types/timeline-analysis'

const TIMELINE_SCHEMA_VERSION = 'timeline-analysis.v1' as const
const MAX_SUPPLIED_TEXT_BYTES = 96 * 1024
const DATE_PRECISIONS = new Set(['day', 'month', 'year'])
const EVENT_CATEGORIES = new Set([
  'event', 'meeting', 'communication', 'financial', 'legal',
  'travel', 'publication', 'military', 'political',
])
const EVENT_IMPORTANCE = new Set(['low', 'normal', 'high', 'critical'])
const SOURCE_MODES = new Set(['live', 'supplied', 'archive', 'provider'])

export interface TimelineAnalysisOptions {
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  if (!isRecord(value) || typeof value.eventDate !== 'string') return false
  const precision = timelineDatePrecision(value.eventDate)
  return precision !== null
    && precision === value.datePrecision
    && DATE_PRECISIONS.has(String(value.datePrecision))
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && value.title.length <= 200
    && (value.description === null
      || (typeof value.description === 'string' && value.description.length <= 500))
    && EVENT_CATEGORIES.has(String(value.category))
    && EVENT_IMPORTANCE.has(String(value.importance))
}

function isTimelineResult(value: unknown): value is TimelineAnalysisResult {
  if (!isRecord(value) || value.schemaVersion !== TIMELINE_SCHEMA_VERSION) return false
  if (value.outcome !== 'events' && value.outcome !== 'no_events') return false
  if (!isRecord(value.article) || !isRecord(value.extraction) || !isRecord(value.model)) return false
  if (!isRecord(value.extraction.quality)) return false
  const hasEvents = value.outcome === 'events'
  return typeof value.requestId === 'string'
    && value.requestId.length > 0
    && typeof value.article.url === 'string'
    && isSafeHttpUrl(value.article.url)
    && typeof value.article.title === 'string'
    && value.article.title.trim().length > 0
    && typeof value.article.domain === 'string'
    && value.article.domain.trim().length > 0
    && (value.article.publishedAt === undefined || timelineDatePrecision(value.article.publishedAt) !== null)
    && Array.isArray(value.events)
    && value.events.length <= 100
    && value.events.every(isTimelineEvent)
    && (hasEvents ? value.events.length > 0 : value.events.length === 0)
    && typeof value.extraction.contentSource === 'string'
    && value.extraction.contentSource.length > 0
    && SOURCE_MODES.has(String(value.extraction.sourceMode))
    && (value.extraction.method === undefined || typeof value.extraction.method === 'string')
    && Number.isInteger(value.extraction.wordCount)
    && Number(value.extraction.wordCount) >= 0
    && typeof value.extraction.quality.version === 'string'
    && Number.isFinite(value.extraction.quality.score)
    && Number(value.extraction.quality.score) >= 0
    && Number(value.extraction.quality.score) <= 100
    && value.extraction.quality.accepted === true
    && (value.extraction.quality.reason === undefined || typeof value.extraction.quality.reason === 'string')
    && Array.isArray(value.extraction.fallbackAttempts)
    && value.extraction.fallbackAttempts.every(item => typeof item === 'string')
    && typeof value.model.name === 'string'
    && value.model.name.length > 0
    && value.model.status === (hasEvents ? 'ok' : 'no_events')
    && Number.isInteger(value.model.rejectedEventCount)
    && Number(value.model.rejectedEventCount) >= 0
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return year >= 1000
    && candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day
}

function timelineDatePrecision(value: unknown): 'day' | 'month' | 'year' | null {
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

function truncateUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  if (bytes.byteLength <= MAX_SUPPLIED_TEXT_BYTES) return value
  return new TextDecoder().decode(bytes.slice(0, MAX_SUPPLIED_TEXT_BYTES))
}

function normalizedPublishedAt(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (timelineDatePrecision(trimmed)) return trimmed
  const timestamp = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(trimmed)
  const day = timestamp?.[1]
  return day && timelineDatePrecision(day) === 'day' ? day : undefined
}

export class TimelineAnalysisError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(
    message: string,
    status?: number,
    code?: string,
  ) {
    super(message)
    this.name = 'TimelineAnalysisError'
    this.status = status
    this.code = code
  }
}

export async function analyzeTimeline(
  input: TimelineAnalysisInput,
  options: TimelineAnalysisOptions = {},
): Promise<TimelineAnalysisResult> {
  const publishedAt = normalizedPublishedAt(input.content?.publishedAt)
  const content = input.content
    ? {
        ...input.content,
        text: truncateUtf8(input.content.text),
        ...(publishedAt ? { publishedAt } : { publishedAt: undefined }),
      }
    : undefined

  const body = JSON.stringify({
    schemaVersion: TIMELINE_SCHEMA_VERSION,
    url: input.url,
    ...(content ? { content } : {}),
  })
  const request = (headers: Record<string, string>) => fetch('/api/tools/extract-timeline', {
    method: 'POST',
    headers,
    body,
    signal: options.signal,
  })

  const initialHeaders = getCopHeaders()
  let response = await request(initialHeaders)
  // Public timeline analysis must remain usable when an expired account token
  // is still present locally. Retry once as an isolated guest and never persist.
  if (
    response.status === 401
    && (Boolean(initialHeaders.Authorization) || Boolean(initialHeaders['X-User-Hash']))
    && !options.signal?.aborted
  ) {
    response = await request(getGuestHeaders())
  }
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const error = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'Timeline analysis failed'
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined
    throw new TimelineAnalysisError(error, response.status, code)
  }
  if (!isTimelineResult(payload)) {
    throw new TimelineAnalysisError('Timeline analysis returned an unexpected response.', response.status)
  }
  return payload
}
