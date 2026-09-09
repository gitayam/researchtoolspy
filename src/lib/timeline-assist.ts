import { getCopHeaders, getGuestHeaders } from '@/lib/cop-auth'
import type {
  TimelineAssistAction,
  TimelineAssistInput,
  TimelineAssistRequestEvent,
  TimelineAssistResult,
  TimelineAssistSuggestion,
} from '@/types/timeline-assist'
import { timelineEventTemporalLabel } from '@/lib/timeline-workspace'

const SCHEMA_VERSION = 'timeline-assist.v1' as const
const ACTIONS = new Set<TimelineAssistAction>(['identify_gaps', 'suggest_questions', 'generate_hypotheses'])
const OUTCOMES = new Set(['suggestions', 'no_suggestions', 'declined'])
const STATUSES = new Set(['ok', 'no_suggestions', 'declined'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSuggestion(value: unknown, knownEventIds: Set<string>): value is TimelineAssistSuggestion {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && value.id.length > 0
    && (value.kind === 'question' || value.kind === 'hypothesis')
    && typeof value.content === 'string'
    && value.content.trim().length > 0
    && value.content.length <= 300
    && typeof value.rationale === 'string'
    && value.rationale.length <= 500
    && (value.afterEventId === undefined
      || (typeof value.afterEventId === 'string' && knownEventIds.has(value.afterEventId)))
    && (value.beforeEventId === undefined
      || (typeof value.beforeEventId === 'string' && knownEventIds.has(value.beforeEventId)))
}

function isResult(
  value: unknown,
  action: TimelineAssistAction,
  knownEventIds: Set<string>,
): value is TimelineAssistResult {
  if (!isRecord(value) || !isRecord(value.model)) return false
  if (value.schemaVersion !== SCHEMA_VERSION || value.action !== action) return false
  if (!OUTCOMES.has(String(value.outcome)) || !STATUSES.has(String(value.model.status))) return false
  if (typeof value.requestId !== 'string' || !value.requestId) return false
  if (!Array.isArray(value.suggestions) || value.suggestions.length > 12) return false
  if (!value.suggestions.every(suggestion => isSuggestion(suggestion, knownEventIds))) return false
  if (new Set(value.suggestions.map(suggestion => (suggestion as TimelineAssistSuggestion).id)).size !== value.suggestions.length) return false
  const expectedKind = action === 'generate_hypotheses' ? 'hypothesis' : 'question'
  if (!value.suggestions.every(suggestion => (suggestion as TimelineAssistSuggestion).kind === expectedKind)) return false
  const hasSuggestions = value.outcome === 'suggestions'
  return (hasSuggestions ? value.suggestions.length > 0 && value.model.status === 'ok' : value.suggestions.length === 0)
    && (value.outcome !== 'no_suggestions' || value.model.status === 'no_suggestions')
    && (value.outcome !== 'declined' || value.model.status === 'declined')
    && typeof value.model.name === 'string'
    && value.model.name.length > 0
    && Number.isInteger(value.model.rejectedSuggestionCount)
    && Number(value.model.rejectedSuggestionCount) >= 0
}

export class TimelineAssistError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(
    message: string,
    status?: number,
    code?: string,
  ) {
    super(message)
    this.name = 'TimelineAssistError'
    this.status = status
    this.code = code
  }
}

export interface TimelineAssistOptions {
  signal?: AbortSignal
}

export async function assistTimeline(
  input: TimelineAssistInput,
  options: TimelineAssistOptions = {},
): Promise<TimelineAssistResult> {
  if (!ACTIONS.has(input.action)) throw new TimelineAssistError('Unsupported timeline AI task.')
  if (input.events.length === 0) throw new TimelineAssistError('Add at least one event before using AI assistance.')
  if (input.events.length > 100) throw new TimelineAssistError('AI review supports at most 100 events at a time.')
  const events: TimelineAssistRequestEvent[] = input.events.map(event => ({
    id: event.id,
    ...(event.eventDate ? { eventDate: event.eventDate } : {}),
    ...(event.eventTime ? { eventTime: event.eventTime } : {}),
    positionLabel: `Position ${(event.sequenceOrder ?? 0) + 1}: ${timelineEventTemporalLabel(event)}`,
    title: event.title,
    description: event.description?.slice(0, 300) || null,
    origin: event.origin,
    assessment: event.assessment,
    ...(event.analystNote ? { analystNote: event.analystNote.slice(0, 300) } : {}),
  }))
  const body = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    action: input.action,
    article: { url: input.article.url, title: input.article.title },
    events,
    ...(input.focus ? { focus: input.focus } : {}),
  })
  const request = (headers: Record<string, string>) => fetch('/api/tools/timeline-assist', {
    method: 'POST',
    headers,
    body,
    signal: options.signal,
  })

  const initialHeaders = getCopHeaders()
  let response = await request(initialHeaders)
  if (
    response.status === 401
    && (Boolean(initialHeaders.Authorization) || Boolean(initialHeaders['X-User-Hash']))
    && !options.signal?.aborted
  ) {
    response = await request(getGuestHeaders())
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'Timeline AI assistance failed'
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : undefined
    throw new TimelineAssistError(message, response.status, code)
  }
  const knownEventIds = new Set(events.map(event => event.id))
  if (!isResult(payload, input.action, knownEventIds)) {
    throw new TimelineAssistError('Timeline AI returned an unexpected response.', response.status)
  }
  return payload
}
