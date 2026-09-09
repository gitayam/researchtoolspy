import { timelineDatePrecision } from './timeline-contract'

export const TIMELINE_ASSIST_SCHEMA_VERSION = 'timeline-assist.v1' as const
export const TIMELINE_ASSIST_ACTIONS = [
  'identify_gaps',
  'suggest_questions',
  'generate_hypotheses',
] as const

export type TimelineAssistAction = typeof TIMELINE_ASSIST_ACTIONS[number]
export type TimelineAssistSuggestionKind = 'question' | 'hypothesis'

export interface TimelineAssistEventV1 {
  id: string
  eventDate: string
  title: string
  description?: string | null
  origin: 'source' | 'analyst'
  assessment: 'unreviewed' | 'corroborated' | 'disputed' | 'hypothesis'
  analystNote?: string
}

export interface TimelineAssistRequestV1 {
  schemaVersion: typeof TIMELINE_ASSIST_SCHEMA_VERSION
  action: TimelineAssistAction
  article: {
    url: string
    title: string
  }
  events: TimelineAssistEventV1[]
  focus?: {
    afterEventId?: string
    beforeEventId?: string
    question?: string
  }
}

export interface TimelineAssistSuggestionV1 {
  id: string
  kind: TimelineAssistSuggestionKind
  content: string
  rationale: string
  afterEventId?: string
  beforeEventId?: string
}

export interface TimelineAssistResponseV1 {
  schemaVersion: typeof TIMELINE_ASSIST_SCHEMA_VERSION
  requestId: string
  action: TimelineAssistAction
  outcome: 'suggestions' | 'no_suggestions' | 'declined'
  suggestions: TimelineAssistSuggestionV1[]
  model: {
    name: string
    status: 'ok' | 'no_suggestions' | 'declined'
    rejectedSuggestionCount: number
  }
}

export interface NormalizedTimelineAssistOutput {
  status: 'ok' | 'no_suggestions' | 'invalid_output'
  suggestions: TimelineAssistSuggestionV1[]
  rejectedSuggestionCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed)
  return Object.keys(value).every(key => keys.has(key))
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 180
}

function validEvent(value: unknown): value is TimelineAssistEventV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id', 'eventDate', 'title', 'description', 'origin', 'assessment', 'analystNote',
  ])) return false
  return validId(value.id)
    && timelineDatePrecision(value.eventDate) !== null
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && value.title.length <= 200
    && (value.description === undefined || value.description === null
      || (typeof value.description === 'string' && value.description.length <= 300))
    && (value.origin === 'source' || value.origin === 'analyst')
    && ['unreviewed', 'corroborated', 'disputed', 'hypothesis'].includes(String(value.assessment))
    && (value.analystNote === undefined
      || (typeof value.analystNote === 'string' && value.analystNote.length <= 300))
}

export function parseTimelineAssistRequest(value: unknown): TimelineAssistRequestV1 | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'action', 'article', 'events', 'focus'])) return null
  if (value.schemaVersion !== TIMELINE_ASSIST_SCHEMA_VERSION) return null
  if (!(TIMELINE_ASSIST_ACTIONS as readonly unknown[]).includes(value.action)) return null
  if (!isRecord(value.article) || !hasOnlyKeys(value.article, ['url', 'title'])) return null
  if (typeof value.article.url !== 'string'
    || value.article.url.length > 2_048
    || (value.article.url.length > 0 && !isSafeHttpUrl(value.article.url))) return null
  if (typeof value.article.title !== 'string' || !value.article.title.trim() || value.article.title.length > 500) return null
  if (!Array.isArray(value.events) || value.events.length === 0 || value.events.length > 100) return null
  if (!value.events.every(validEvent)) return null

  const eventIds = new Set(value.events.map(event => (event as TimelineAssistEventV1).id))
  if (eventIds.size !== value.events.length) return null
  if (value.focus !== undefined) {
    if (!isRecord(value.focus) || !hasOnlyKeys(value.focus, ['afterEventId', 'beforeEventId', 'question'])) return null
    if (value.focus.afterEventId !== undefined && (!validId(value.focus.afterEventId) || !eventIds.has(value.focus.afterEventId))) return null
    if (value.focus.beforeEventId !== undefined && (!validId(value.focus.beforeEventId) || !eventIds.has(value.focus.beforeEventId))) return null
    if (value.focus.question !== undefined
      && (typeof value.focus.question !== 'string' || !value.focus.question.trim() || value.focus.question.length > 300)) return null
  }
  return value as unknown as TimelineAssistRequestV1
}

export function normalizeTimelineAssistModelPayload(
  value: unknown,
  request: TimelineAssistRequestV1,
): NormalizedTimelineAssistOutput {
  if (!isRecord(value) || !Array.isArray(value.suggestions)) {
    return { status: 'invalid_output', suggestions: [], rejectedSuggestionCount: 0 }
  }
  const expectedKind: TimelineAssistSuggestionKind = request.action === 'generate_hypotheses'
    ? 'hypothesis'
    : 'question'
  const knownIds = new Set(request.events.map(event => event.id))
  const suggestions: TimelineAssistSuggestionV1[] = []
  const seen = new Set<string>()
  const candidates = value.suggestions.slice(0, 12)
  let rejectedSuggestionCount = value.suggestions.length - candidates.length

  for (const candidate of candidates) {
    if (!isRecord(candidate) || candidate.kind !== expectedKind) {
      rejectedSuggestionCount += 1
      continue
    }
    const content = typeof candidate.content === 'string'
      ? candidate.content.trim().replace(/\s+/g, ' ').slice(0, 300)
      : ''
    const rationale = typeof candidate.rationale === 'string'
      ? candidate.rationale.trim().replace(/\s+/g, ' ').slice(0, 500)
      : ''
    const requestedAfter = candidate.after_event_id
    const requestedBefore = candidate.before_event_id
    if (!content
      || (requestedAfter !== undefined && requestedAfter !== null && (!validId(requestedAfter) || !knownIds.has(requestedAfter)))
      || (requestedBefore !== undefined && requestedBefore !== null && (!validId(requestedBefore) || !knownIds.has(requestedBefore)))) {
      rejectedSuggestionCount += 1
      continue
    }
    const dedupKey = content.toLocaleLowerCase('en-US')
    if (seen.has(dedupKey)) {
      rejectedSuggestionCount += 1
      continue
    }
    seen.add(dedupKey)
    const afterEventId = typeof requestedAfter === 'string'
      ? requestedAfter
      : request.focus?.afterEventId
    const beforeEventId = typeof requestedBefore === 'string'
      ? requestedBefore
      : request.focus?.beforeEventId
    suggestions.push({
      id: `ai-suggestion-${suggestions.length + 1}`,
      kind: expectedKind,
      content,
      rationale,
      ...(afterEventId ? { afterEventId } : {}),
      ...(beforeEventId ? { beforeEventId } : {}),
    })
  }

  if (suggestions.length > 0) return { status: 'ok', suggestions, rejectedSuggestionCount }
  if (value.suggestions.length === 0) return { status: 'no_suggestions', suggestions, rejectedSuggestionCount }
  return { status: 'invalid_output', suggestions, rejectedSuggestionCount }
}
