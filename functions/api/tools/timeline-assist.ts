/** Opt-in AI assistance for reviewing a working timeline. Never mutates source events. */

import { callOpenAIViaGateway, RateLimitError, wrapUntrustedContent } from '../_shared/ai-gateway'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { AuthDbError, getUserFromRequest } from '../_shared/auth-helpers'
import { logEvent } from '../_shared/event-log'
import {
  normalizeTimelineAssistModelPayload,
  parseTimelineAssistRequest,
  TIMELINE_ASSIST_SCHEMA_VERSION,
  type TimelineAssistAction,
  type TimelineAssistRequestV1,
  type TimelineAssistResponseV1,
} from '../_shared/timeline-assist-contract'

interface Env {
  DB: D1Database
  OPENAI_API_KEY?: string
  AI_GATEWAY_ACCOUNT_ID?: string
  CACHE?: KVNamespace
  RATE_LIMIT?: KVNamespace
  SESSIONS?: KVNamespace
  JWT_SECRET?: string
}

const MODEL = 'gpt-5.4-mini'
const MAX_REQUEST_BYTES = 128 * 1024

type BoundedJson = { ok: true; value: unknown } | { ok: false; tooLarge: boolean }

async function readBoundedJson(request: Request): Promise<BoundedJson> {
  const declaredLength = request.headers.get('Content-Length')
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_REQUEST_BYTES) {
    try { await request.body?.cancel('timeline assist request exceeds byte limit') } catch { /* best effort */ }
    return { ok: false, tooLarge: true }
  }
  if (!request.body) return { ok: false, tooLarge: false }
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  let bytesRead = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytesRead += chunk.value.byteLength
      if (bytesRead > MAX_REQUEST_BYTES) {
        try { await reader.cancel('timeline assist request exceeds byte limit') } catch { /* best effort */ }
        return { ok: false, tooLarge: true }
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    try { await reader.cancel('invalid timeline assist request') } catch { /* best effort */ }
    return { ok: false, tooLarge: false }
  }
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  return { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
}

function errorResponse(status: number, error: string, code: string): Response {
  return new Response(JSON.stringify({ error, code }), {
    status,
    headers: headers(status === 405 ? { Allow: 'POST, OPTIONS' } : {}),
  })
}

function actionInstruction(action: TimelineAssistAction): string {
  if (action === 'identify_gaps') {
    return 'Identify the most consequential temporal or causal discontinuities. Return a specific question for each gap.'
  }
  if (action === 'suggest_questions') {
    return 'Propose specific, self-contained collection questions that could confirm, challenge, or contextualize the chronology.'
  }
  return 'Generate distinct, falsifiable working hypotheses that could explain an important interval. Phrase each as a possibility, never as an event that occurred.'
}

function promptFor(request: TimelineAssistRequestV1): string {
  const focus = request.focus
    ? `Focus interval: after=${request.focus.afterEventId ?? 'start'}, before=${request.focus.beforeEventId ?? 'end'}${request.focus.question ? `\nAnalyst question: ${request.focus.question}` : ''}`
    : 'Focus interval: review the complete chronology.'
  const eventData = JSON.stringify({ article: request.article, events: request.events, focus: request.focus })
  const expectedKind = request.action === 'generate_hypotheses' ? 'hypothesis' : 'question'
  return `${actionInstruction(request.action)}

Important limits:
- You only have event summaries, not the underlying source documents or live web access.
- Do not answer missing-data questions and do not assert that a missing event occurred.
- Treat source and analyst-added events as distinct. A disputed or hypothetical event is not established fact.
- Events are supplied in the analyst's working order. positionLabel is authoritative when a date is unknown or the analyst intentionally placed an event.
- Return 3-6 high-value suggestions, not generic filler.
- after_event_id and before_event_id must be exact IDs from the supplied events or null.
${focus}

Return ONLY valid JSON in this form:
{"suggestions":[{"kind":"${expectedKind}","content":"...","rationale":"Why this matters or what would falsify it","after_event_id":null,"before_event_id":null}]}

Timeline data:
${wrapUntrustedContent(eventData)}`
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const requestId = `req-${crypto.randomUUID()}`
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) return errorResponse(401, 'Authentication or guest session required', 'AUTHENTICATION_REQUIRED')
    if (!env.OPENAI_API_KEY) return errorResponse(503, 'Timeline AI assistance is unavailable', 'AI_UNAVAILABLE')

    const body = await readBoundedJson(request)
    if (body.ok === false) {
      return body.tooLarge
        ? errorResponse(413, 'Timeline AI request is too large', 'PAYLOAD_TOO_LARGE')
        : errorResponse(400, 'Invalid JSON request body', 'INVALID_REQUEST')
    }
    const parsed = parseTimelineAssistRequest(body.value)
    if (!parsed) return errorResponse(400, 'Request must match timeline-assist.v1', 'INVALID_REQUEST')

    const data = await callOpenAIViaGateway(env, {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a critical timeline-review assistant. You identify collection gaps and generate questions or explicitly tentative hypotheses. You never claim access to evidence that was not supplied, never turn an inference into a fact, preserve event IDs exactly, and return only valid JSON.',
        },
        { role: 'user', content: promptFor(parsed) },
      ],
      max_completion_tokens: 1800,
      reasoning_effort: 'none',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }, {
      cacheTTL: 900,
      metadata: { endpoint: 'timeline-assist', user_id: String(userId), action: parsed.action },
      timeout: 30_000,
    })

    if (data?._refusal) {
      const declined: TimelineAssistResponseV1 = {
        schemaVersion: TIMELINE_ASSIST_SCHEMA_VERSION,
        requestId,
        action: parsed.action,
        outcome: 'declined',
        suggestions: [],
        model: { name: MODEL, status: 'declined', rejectedSuggestionCount: 0 },
      }
      return new Response(JSON.stringify(declined), { headers: headers() })
    }

    const rawContent = data?.choices?.[0]?.message?.content
    if (typeof rawContent !== 'string') {
      return errorResponse(502, 'Timeline AI returned an invalid response', 'MODEL_OUTPUT_INVALID')
    }
    let modelPayload: unknown
    try {
      modelPayload = JSON.parse(rawContent)
    } catch {
      return errorResponse(502, 'Timeline AI returned invalid JSON', 'MODEL_OUTPUT_INVALID')
    }
    const normalized = normalizeTimelineAssistModelPayload(modelPayload, parsed)
    if (normalized.status === 'invalid_output') {
      return errorResponse(502, 'Timeline AI suggestions failed validation', 'MODEL_OUTPUT_INVALID')
    }
    const response: TimelineAssistResponseV1 = {
      schemaVersion: TIMELINE_ASSIST_SCHEMA_VERSION,
      requestId,
      action: parsed.action,
      outcome: normalized.status === 'ok' ? 'suggestions' : 'no_suggestions',
      suggestions: normalized.suggestions,
      model: {
        name: MODEL,
        status: normalized.status === 'ok' ? 'ok' : 'no_suggestions',
        rejectedSuggestionCount: normalized.rejectedSuggestionCount,
      },
    }
    return new Response(JSON.stringify(response), { headers: headers() })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return errorResponse(429, 'Timeline AI rate limit reached. Try again shortly.', 'RATE_LIMITED')
    }
    if (error instanceof AuthDbError || (error as { isAuthDbError?: boolean })?.isAuthDbError) {
      return new Response(JSON.stringify({
        error: 'Authentication service temporarily unavailable',
        code: 'AUTH_UNAVAILABLE',
        retryable: true,
      }), { status: 503, headers: headers({ 'Retry-After': '2' }) })
    }
    await logEvent(env, {
      level: 'error',
      source: 'tools/timeline-assist',
      message: 'timeline AI assistance failed',
      context: { request_id: requestId, error_type: error instanceof Error ? error.name : 'unknown' },
    })
    return errorResponse(500, 'Timeline AI assistance failed', 'INTERNAL_ERROR')
  }
}

export const onRequestGet: PagesFunction = async () => errorResponse(405, 'Method not allowed. Use POST.', 'METHOD_NOT_ALLOWED')
export const onRequestOptions: PagesFunction = async () => optionsResponse()
