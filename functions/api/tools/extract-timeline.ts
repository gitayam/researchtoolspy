/** Extract a versioned, provenance-bearing event timeline from URL or supplied text. */

import { callOpenAIViaGateway, getOptimalCacheTTL } from '../_shared/ai-gateway'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import {
  ARTICLE_CANDIDATE_POLICIES,
  assessArticleCandidate,
  type ArticleCandidateAssessment,
} from '../_shared/article-candidate'
import {
  buildIntegrationErrorDocument,
  readIntegrationCorrelationId,
  type IntegrationErrorCode,
} from '../_shared/integration-contract'
import {
  getIntegrationPrincipalFromRequest,
  IntegrationAuthError,
  isReservedIntegrationAuthorization,
  type IntegrationAuthEnv,
} from '../_shared/service-auth'
import { scrapeUrl, type ScrapedContent } from '../_shared/scraper-utils'
import { parseSafeOutboundUrl } from '../_shared/safe-fetch'
import type { NormalizedScrapeError, ScrapeStrategy } from '../_shared/scrape-contract'
import type { AnalyticsEngineLike } from '../_shared/scrape-metrics'
import {
  normalizeTimelineModelPayload,
  TIMELINE_ANALYSIS_SCHEMA_VERSION,
  timelineDatePrecision,
  type NormalizedTimelineModelOutput,
  type TimelineAnalysisRequestV1,
  type TimelineAnalysisResponseV1,
  type TimelineSuppliedContentSource,
} from '../_shared/timeline-contract'
import {
  observeTimelineAnalysis,
  type TimelineAttemptObservation,
  type TimelineTerminalObservation,
} from './_timeline-observability'

interface Env extends IntegrationAuthEnv {
  DB: D1Database
  OPENAI_API_KEY: string
  AI_GATEWAY_ACCOUNT_ID?: string
  AI_CONFIG: KVNamespace
  CACHE: KVNamespace
  SESSIONS?: KVNamespace
  RATE_LIMIT?: KVNamespace
  JWT_SECRET?: string
  COMMUNITY_INTEGRATIONS_ENABLED?: string
  SCRAPE_TELEMETRY_KEY?: string
  SCRAPE_ANALYTICS?: AnalyticsEngineLike
}

interface LegacyTimelineRequest {
  url?: string
  schemaVersion?: unknown
}

interface TimelineAuthorization {
  tenantScope: string
}

interface TimelineSource {
  title: string
  text: string
  publishedAt?: string
  source: string
  fallbackAttempts: string[]
  quality: ArticleCandidateAssessment
  extraction?: { method: string; quality: string; wordCount: number }
}

const MODEL = 'gpt-5.4-mini'
const MAX_SUPPLIED_CONTENT_BYTES = 100 * 1024
const MAX_TIMELINE_REQUEST_BYTES = 112 * 1024
const SUPPLIED_CONTENT_SOURCES = new Set<TimelineSuppliedContentSource>([
  'bot-scrape', 'content-intelligence', 'publisher-feed', 'browser-render',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed)
  return Object.keys(value).every(key => allowedKeys.has(key))
}

export function scrapeTimelineSource(url: string) {
  return scrapeUrl(url, undefined, { purpose: 'timeline', allowArchives: true })
}

function responseHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { ...JSON_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
}

function integrationErrorResponse(options: {
  requestId: string
  correlationId?: string
  code: IntegrationErrorCode
  message: string
  retryable: boolean
  status: number
}): Response {
  return new Response(JSON.stringify(buildIntegrationErrorDocument(options)), {
    status: options.status,
    headers: responseHeaders(
      options.status === 503
        ? { 'Retry-After': '2' }
        : options.status === 405
          ? { Allow: 'POST, OPTIONS' }
          : {},
    ),
  })
}

function legacyErrorResponse(
  status: number,
  error: string,
  code?: string,
  details: Record<string, unknown> = {},
): Response {
  return new Response(JSON.stringify({ error, ...(code ? { code } : {}), ...details }), {
    status,
    headers: responseHeaders(status === 405 ? { Allow: 'POST, OPTIONS' } : {}),
  })
}

type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'invalid_json' | 'too_large' }

async function readBoundedJson(request: Request): Promise<BoundedJsonResult> {
  const declaredLength = request.headers.get('Content-Length')
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength)
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_TIMELINE_REQUEST_BYTES) {
      try { await request.body?.cancel('timeline request exceeds byte limit') } catch { /* best effort */ }
      return { ok: false, reason: 'too_large' }
    }
  }

  if (!request.body) return { ok: false, reason: 'invalid_json' }
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  let bytesRead = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytesRead += chunk.value.byteLength
      if (bytesRead > MAX_TIMELINE_REQUEST_BYTES) {
        try { await reader.cancel('timeline request exceeds byte limit') } catch { /* best effort */ }
        return { ok: false, reason: 'too_large' }
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return { ok: true, value: JSON.parse(text) as unknown }
  } catch {
    try { await reader.cancel('invalid timeline request body') } catch { /* best effort */ }
    return { ok: false, reason: 'invalid_json' }
  }
}

async function authorizeTimelineRequest(
  request: Request,
  env: Env,
  requestId: string,
  correlationId?: string,
): Promise<TimelineAuthorization | Response> {
  if (isReservedIntegrationAuthorization(request)) {
    try {
      const principal = await getIntegrationPrincipalFromRequest(request, env)
      if (!principal) {
        return integrationErrorResponse({
          requestId,
          correlationId,
          code: 'authentication_required',
          message: 'A ResearchTools service credential is required.',
          retryable: false,
          status: 401,
        })
      }
      if (
        env.COMMUNITY_INTEGRATIONS_ENABLED !== 'true'
        || !principal.scopes.includes('community.research.execute')
      ) {
        return integrationErrorResponse({
          requestId,
          correlationId,
          code: 'scope_denied',
          message: 'Timeline analysis is not enabled for this service credential.',
          retryable: false,
          status: 403,
        })
      }
      return { tenantScope: principal.communityId }
    } catch (error) {
      if (error instanceof IntegrationAuthError) {
        return integrationErrorResponse({
          requestId,
          correlationId,
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          status: error.status,
        })
      }
      return integrationErrorResponse({
        requestId,
        correlationId,
        code: 'internal_error',
        message: 'Timeline authentication failed.',
        retryable: true,
        status: 500,
      })
    }
  }

  const authUserId = await getUserFromRequest(request, env)
  if (!authUserId) return legacyErrorResponse(401, 'Authentication required')
  return { tenantScope: `legacy-user:${authUserId}` }
}

function normalizePublishedAt(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (timelineDatePrecision(trimmed)) return trimmed
  const timestamp = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(trimmed)
  const timestampDay = timestamp?.[1]
  return timestampDay && timelineDatePrecision(timestampDay) === 'day' ? timestampDay : undefined
}

function sourceMode(source: string): TimelineAnalysisResponseV1['extraction']['sourceMode'] {
  if (source === 'archive.ph' || source === 'wayback') return 'archive'
  if (source === 'apify' || source === 'smry.ai') return 'provider'
  if (
    source === 'bot-scrape'
    || source === 'content-intelligence'
    || source === 'publisher-feed'
    || source === 'browser-render'
  ) return 'supplied'
  return 'live'
}

function strategyForSource(source: string): ScrapeStrategy {
  const mode = sourceMode(source)
  if (mode === 'archive') return 'archive'
  if (mode === 'provider') return 'provider'
  if (mode === 'supplied') return 'supplied'
  return 'direct'
}

function providerForSource(source: string): TimelineAttemptObservation['provider'] {
  if (source === 'archive.ph' || source === 'wayback') return 'archive'
  if (source === 'apify') return 'apify'
  return 'none'
}

function normalizedSourceError(source: ScrapedContent): NormalizedScrapeError {
  return source.quality?.errorCode ?? (source.content ? 'quality_rejected' : 'extract_failed')
}

function validSuppliedContentShape(value: unknown): value is TimelineAnalysisRequestV1['content'] {
  if (!isRecord(value) || !hasOnlyKeys(value, ['text', 'title', 'publishedAt', 'source'])) return false
  const content = value
  return typeof content.text === 'string'
    && new TextEncoder().encode(content.text).byteLength <= MAX_SUPPLIED_CONTENT_BYTES
    && typeof content.source === 'string'
    && SUPPLIED_CONTENT_SOURCES.has(content.source as TimelineSuppliedContentSource)
    && (content.title === undefined
      || (typeof content.title === 'string' && content.title.length <= 500))
    && (content.publishedAt === undefined || normalizePublishedAt(content.publishedAt) !== undefined)
}

function suppliedTimelineSource(
  content: TimelineAnalysisRequestV1['content'],
  fallbackTitle: string,
): TimelineSource | null {
  if (!content || typeof content.text !== 'string') return null
  const text = content.text.replace(/\0/g, '').trim()
  if (new TextEncoder().encode(text).byteLength > MAX_SUPPLIED_CONTENT_BYTES) return null
  const quality = assessArticleCandidate({
    success: true,
    text,
    title: typeof content.title === 'string' ? content.title : fallbackTitle,
  }, ARTICLE_CANDIDATE_POLICIES.timeline)
  if (!quality.accepted) return null
  return {
    title: typeof content.title === 'string' && content.title.trim()
      ? content.title.trim().slice(0, 500)
      : fallbackTitle,
    text,
    publishedAt: normalizePublishedAt(content.publishedAt),
    source: content.source,
    fallbackAttempts: [content.source],
    quality,
    extraction: { method: 'caller-supplied', quality: 'analysis-grade', wordCount: quality.wordCount },
  }
}

function fetchedTimelineSource(source: ScrapedContent): TimelineSource | null {
  if (source.error || !source.quality?.accepted) return null
  return {
    title: source.title,
    text: source.content,
    publishedAt: normalizePublishedAt(source.publishedAt),
    source: source.source ?? 'original',
    fallbackAttempts: source.fallbackAttempts ?? [],
    quality: source.quality,
    extraction: source.extraction,
  }
}

async function extractTimelineFromText(
  env: Env,
  text: string,
  title: string,
  publishedAt?: string,
): Promise<NormalizedTimelineModelOutput> {
  const publicationContext = publishedAt
    ? `Article publication date: ${publishedAt}\n`
    : 'Article publication date: not reliably available; do not resolve relative dates unless the article itself provides an anchor.\n'
  const prompt = `Analyze the following article and extract a chronological timeline of events. For each event, identify:
- event_date: The date (ISO format YYYY-MM-DD if exact, YYYY-MM if only month known, or YYYY if only year). Never invent a date. Resolve relative dates only when publication context or the article supplies a reliable anchor.
- title: A concise one-line summary of the event (under 120 chars)
- description: A 1-2 sentence description with key details
- category: One of: event, meeting, communication, financial, legal, travel, publication, military, political
- importance: One of: low, normal, high, critical

Return ONLY valid JSON:
{ "events": [{ "event_date": "...", "title": "...", "description": "...", "category": "...", "importance": "..." }] }

If no datable events can be found, return { "events": [] }.

Article title: ${title}
${publicationContext}
Article text:
${text.slice(0, 12000)}`

  const aiData = await callOpenAIViaGateway(env, {
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an intelligence analyst specializing in chronological event extraction. Extract only events supported by the supplied article, preserve date precision, never substitute today for a missing date, and return only valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 3000,
    reasoning_effort: 'none',
    temperature: 0.1,
    response_format: { type: 'json_object' },
  }, {
    cacheTTL: getOptimalCacheTTL('timeline-extraction'),
    metadata: { endpoint: 'extract-timeline', url: title.substring(0, 80) },
  })

  const rawContent = aiData.choices?.[0]?.message?.content
  if (typeof rawContent !== 'string') {
    return { status: 'invalid_output', events: [], rejectedEventCount: 0 }
  }
  try {
    return normalizeTimelineModelPayload(JSON.parse(rawContent) as unknown)
  } catch {
    console.warn('[extract-timeline] Model returned invalid JSON')
    return { status: 'invalid_output', events: [], rejectedEventCount: 0 }
  }
}

function strictResponse(
  requestId: string,
  url: string,
  source: TimelineSource,
  model: NormalizedTimelineModelOutput,
  publishedAt?: string,
): TimelineAnalysisResponseV1 {
  const wordCount = source.extraction?.wordCount ?? source.quality.wordCount
  return {
    schemaVersion: TIMELINE_ANALYSIS_SCHEMA_VERSION,
    requestId,
    outcome: model.status === 'no_events' ? 'no_events' : 'events',
    article: {
      url,
      title: source.title || url,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      ...(publishedAt ? { publishedAt } : {}),
    },
    events: model.events,
    extraction: {
      contentSource: source.source,
      sourceMode: sourceMode(source.source),
      ...(source.extraction?.method ? { method: source.extraction.method } : {}),
      wordCount,
      quality: {
        version: source.quality.version,
        score: source.quality.score,
        accepted: source.quality.accepted,
        ...(source.quality.reason ? { reason: source.quality.reason } : {}),
      },
      fallbackAttempts: source.fallbackAttempts,
    },
    model: {
      name: MODEL,
      status: model.status === 'no_events' ? 'no_events' : 'ok',
      rejectedEventCount: model.rejectedEventCount,
    },
  }
}

function legacySuccess(
  response: TimelineAnalysisResponseV1,
  source: TimelineSource,
): Record<string, unknown> {
  return {
    events: response.events.map(event => ({
      event_date: event.eventDate,
      title: event.title,
      description: event.description,
      category: event.category,
      importance: event.importance,
    })),
    title: response.article.title,
    domain: response.article.domain,
    url: response.article.url,
    event_count: response.events.length,
    extraction: {
      method: source.extraction?.method,
      quality: source.extraction?.quality,
      word_count: source.extraction?.wordCount
        ?? (source.text ? source.text.split(/\s+/).length : 0),
    },
    content_source: source.source,
    fallback_attempts: source.fallbackAttempts,
    extraction_quality: source.quality,
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const requestId = `req-${crypto.randomUUID()}`
  const correlationId = readIntegrationCorrelationId(request)
  const serviceRequest = isReservedIntegrationAuthorization(request)

  try {
    const authorization = await authorizeTimelineRequest(request, env, requestId, correlationId)
    if (authorization instanceof Response) return authorization

    const bodyRead = await readBoundedJson(request)
    if (bodyRead.ok === false && bodyRead.reason === 'too_large') {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'The request body exceeds 112 KiB.', retryable: false, status: 413,
          })
        : legacyErrorResponse(413, 'Request body too large', 'PAYLOAD_TOO_LARGE')
    }
    if (bodyRead.ok === false) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'The request body must be valid JSON.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'Invalid request body')
    }
    const rawBody = bodyRead.value
    if (!isRecord(rawBody)) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'The request body must be a JSON object.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'Invalid request body')
    }
    const body = rawBody as unknown as LegacyTimelineRequest | TimelineAnalysisRequestV1

    const strict = body.schemaVersion === TIMELINE_ANALYSIS_SCHEMA_VERSION
    if (body.schemaVersion !== undefined && body.schemaVersion !== TIMELINE_ANALYSIS_SCHEMA_VERSION) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'Unsupported timeline contract version.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'Unsupported timeline contract version', 'INVALID_REQUEST')
    }
    if (serviceRequest && !strict) {
      return integrationErrorResponse({
        requestId, correlationId, code: 'invalid_request', message: 'schemaVersion timeline-analysis.v1 is required.', retryable: false, status: 400,
      })
    }
    if (strict && !hasOnlyKeys(rawBody, ['schemaVersion', 'url', 'content'])) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'The request contains unsupported fields.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'The request contains unsupported fields', 'INVALID_REQUEST')
    }
    if (typeof body.url !== 'string' || !body.url.trim()) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'url is required.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'url is required')
    }

    const requestedContent = strict && 'content' in body ? body.content : undefined
    if (requestedContent !== undefined && !validSuppliedContentShape(requestedContent)) {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'content must match the timeline-analysis.v1 supplied-content contract.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'Invalid supplied content', 'INVALID_REQUEST')
    }

    let url: string
    try {
      url = parseSafeOutboundUrl(body.url).href
    } catch {
      return serviceRequest
        ? integrationErrorResponse({
            requestId, correlationId, code: 'invalid_request', message: 'The URL is invalid or unsafe.', retryable: false, status: 400,
          })
        : legacyErrorResponse(400, 'Invalid or unsafe URL format')
    }

    return await observeTimelineAnalysis({
      requestId,
      url,
      tenantScope: authorization.tenantScope,
      telemetryKey: env.SCRAPE_TELEMETRY_KEY,
      analytics: env.SCRAPE_ANALYTICS,
    }, async recordAttempt => {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
      const suppliedContent = requestedContent
      const hasSuppliedContent = suppliedContent !== undefined
      if ((host === 'x.com' || host === 'twitter.com') && !hasSuppliedContent) {
        recordAttempt({
          stage: 'fetch', strategy: 'direct', provider: 'none', outcome: 'failed',
          errorCode: 'policy_denied', durationMs: 0,
        })
        const value = serviceRequest
          ? integrationErrorResponse({
              requestId, correlationId, code: 'content_unavailable', message: 'The source is not available to timeline analysis.', retryable: false, status: 422,
            })
          : legacyErrorResponse(422, 'Twitter/X posts cannot be scraped', 'CONTENT_UNAVAILABLE', {
              details: 'X.com blocks server-side requests. Enter timeline events manually instead.',
            })
        return {
          value,
          terminal: {
            outcome: 'failed', errorCode: 'policy_denied', terminalStage: 'fetch',
            finalStrategy: 'direct', accepted: false,
          },
        }
      }

      const extractionStarted = Date.now()
      let source: TimelineSource | null = null
      let failedSource: ScrapedContent | null = null
      if (hasSuppliedContent) {
        source = suppliedTimelineSource(suppliedContent, url)
        recordAttempt({
          stage: 'extract', strategy: 'supplied', provider: 'none',
          outcome: source ? 'succeeded' : 'failed',
          ...(source ? {} : { errorCode: 'quality_rejected' as const }),
          contentTypeClass: 'text',
          durationMs: Date.now() - extractionStarted,
          responseBytes: source ? new TextEncoder().encode(source.text).byteLength : 0,
          extractedWords: source?.quality.wordCount ?? 0,
        })
      } else {
        failedSource = await scrapeTimelineSource(url)
        source = fetchedTimelineSource(failedSource)
        const strategy = strategyForSource(failedSource.source ?? 'original')
        recordAttempt({
          stage: source ? 'extract' : 'fetch',
          strategy,
          provider: providerForSource(failedSource.source ?? 'original'),
          outcome: source ? 'succeeded' : 'failed',
          ...(source ? {} : { errorCode: normalizedSourceError(failedSource) }),
          contentTypeClass: 'html',
          durationMs: Date.now() - extractionStarted,
          extractedWords: failedSource.quality?.wordCount ?? 0,
        })
      }

      if (!source) {
        const contentSource = failedSource?.source
        const fallbackAttempts = failedSource?.fallbackAttempts ?? []
        const extractionQuality = failedSource?.quality
        const value = serviceRequest
          ? integrationErrorResponse({
              requestId, correlationId, code: 'content_unavailable', message: 'No analysis-grade content was available.', retryable: false, status: 422,
            })
          : legacyErrorResponse(
              422,
              failedSource?.content
                ? 'Insufficient content to extract timeline events'
                : 'Failed to fetch URL',
              'INSUFFICIENT_CONTENT',
              {
                details: failedSource?.error,
                content_source: contentSource,
                fallback_attempts: fallbackAttempts,
                extraction_quality: extractionQuality,
              },
            )
        return {
          value,
          terminal: {
            outcome: 'failed',
            errorCode: failedSource ? normalizedSourceError(failedSource) : 'quality_rejected',
            terminalStage: strict && 'content' in body ? 'extract' : 'fetch',
            finalStrategy: strict && 'content' in body
              ? 'supplied'
              : strategyForSource(failedSource?.source ?? 'original'),
            qualityScore: extractionQuality?.score,
            accepted: false,
          },
        }
      }

      const publishedAt = source.publishedAt
      const aiStarted = Date.now()
      const model = await extractTimelineFromText(env, source.text, source.title || url, publishedAt)
      recordAttempt({
        stage: 'ai',
        strategy: strategyForSource(source.source),
        provider: 'internal',
        outcome: model.status === 'invalid_output' ? 'failed' : 'succeeded',
        ...(model.status === 'invalid_output' ? { errorCode: 'model_output_invalid' as const } : {}),
        durationMs: Date.now() - aiStarted,
        itemsWritten: model.events.length,
      })

      if (model.status === 'invalid_output') {
        const value = serviceRequest
          ? integrationErrorResponse({
              requestId, correlationId, code: 'upstream_invalid_response', message: 'Timeline analysis returned an invalid model response.', retryable: true, status: 502,
            })
          : legacyErrorResponse(502, 'Timeline analysis returned an invalid model response', 'MODEL_OUTPUT_INVALID')
        return {
          value,
          terminal: {
            outcome: 'failed', errorCode: 'model_output_invalid', terminalStage: 'ai',
            finalStrategy: strategyForSource(source.source), qualityScore: source.quality.score,
            accepted: false,
          },
        }
      }

      const response = strictResponse(requestId, url, source, model, publishedAt)
      const value = new Response(JSON.stringify(strict ? response : legacySuccess(response, source)), {
        status: 200,
        headers: responseHeaders(),
      })
      const terminal: TimelineTerminalObservation = {
        outcome: 'succeeded',
        terminalStage: 'ai',
        finalStrategy: strategyForSource(source.source),
        qualityScore: source.quality.score,
        accepted: true,
      }
      return { value, terminal }
    })
  } catch (error) {
    console.error('[ExtractTimeline] Error:', error)
    return serviceRequest
      ? integrationErrorResponse({
          requestId, correlationId, code: 'internal_error', message: 'Timeline analysis failed.', retryable: true, status: 500,
        })
      : legacyErrorResponse(500, 'Failed to extract timeline events')
  }
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  if (!isReservedIntegrationAuthorization(request)) {
    return legacyErrorResponse(405, 'Method not allowed. Use POST.')
  }
  return integrationErrorResponse({
    requestId: `req-${crypto.randomUUID()}`,
    correlationId: readIntegrationCorrelationId(request),
    code: 'method_not_allowed',
    message: 'Method not allowed. Use POST.',
    retryable: false,
    status: 405,
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()
