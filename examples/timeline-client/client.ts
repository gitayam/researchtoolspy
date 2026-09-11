/** Dependency-free server-side timeline-analysis.v1 client. Never ship service credentials to browsers. */
export const TIMELINE_VERSION = 'timeline-analysis.v1' as const
export const TIMELINE_LIMITS = Object.freeze({ requestBytes: 112 * 1024, textBytes: 100 * 1024, responseBytes: 1024 * 1024, events: 100 })
const categories = ['event', 'meeting', 'communication', 'financial', 'legal', 'travel', 'publication', 'military', 'political'] as const
const importance = ['low', 'normal', 'high', 'critical'] as const
const sources = ['bot-scrape', 'content-intelligence', 'publisher-feed', 'browser-render'] as const
const errorCodes = ['invalid_request', 'authentication_required', 'invalid_service_token', 'expired_service_token', 'scope_denied', 'workspace_denied', 'content_unavailable', 'upstream_invalid_response', 'method_not_allowed', 'internal_error', 'auth_datastore_unavailable'] as const
export type ServiceErrorCode = typeof errorCodes[number]
export interface TimelineInput {
  url: string
  content?: { text: string; title?: string; publishedAt?: string; source: typeof sources[number] }
}
export interface TimelineResult {
  schemaVersion: typeof TIMELINE_VERSION
  requestId: string
  outcome: 'events' | 'no_events'
  article: { url: string; title: string; domain: string; publishedAt?: string }
  events: Array<{ eventDate: string; datePrecision: 'year' | 'month' | 'day'; title: string; description: string | null; category: typeof categories[number]; importance: typeof importance[number] }>
  extraction: { contentSource: string; sourceMode: 'live' | 'supplied' | 'archive' | 'provider'; method?: string; wordCount: number; quality: { version: string; score: number; accepted: true; reason?: string }; fallbackAttempts: string[] }
  model: { name: string; status: 'ok' | 'no_events'; rejectedEventCount: number }
}
export interface TimelineCapabilities {
  schemaVersion: 'integration-capabilities.v1'
  requestId: string
  identityType: 'service'
  clientId: string
  communityId: string
  workspaceId: string
  investigationId: string
  environment: 'development' | 'staging' | 'production'
  maximumVisibility: 'private' | 'community' | 'public'
  scopes: string[]
  capabilities: Record<string, boolean>
  contractVersions: { capabilities: 'integration-capabilities.v1'; timelineAnalysis?: typeof TIMELINE_VERSION }
  limits: Record<string, number>
  correlationId?: string
}
export interface IntegrationError {
  schemaVersion: 'integration-error.v1'
  requestId: string
  correlationId?: string
  error: { code: ServiceErrorCode; message: string; retryable: boolean }
}
export type ClientErrorCode = ServiceErrorCode | 'invalid_input' | 'invalid_response' | 'response_too_large' | 'redirect_denied' | 'network_error' | 'aborted' | 'timeout' | 'capability_unavailable' | 'rate_limited' | 'service_unavailable' | 'http_error'
export class TimelineClientError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly requestId?: string,
    public readonly correlationId?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    // Do not retain arbitrary server text, transport causes, URLs, headers or tokens.
    super(`Timeline request failed (${code}).`)
    this.name = 'TimelineClientError'
  }
}
export interface TimelineCallOptions { signal?: AbortSignal; correlationId?: string }
export interface TimelineClientOptions {
  /** Trusted operator-selected HTTPS origin; not a caller-controlled URL. */
  baseUrl: string
  serviceToken: string
  fetch?: typeof globalThis.fetch
  /** Entire request and response-body deadline, 1–120000 ms. Default 30000. */
  timeoutMs?: number
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string')
const integer = (v: unknown): boolean => Number.isSafeInteger(v) && Number(v) >= 0
const member = (v: unknown, values: readonly string[]): boolean => typeof v === 'string' && values.includes(v)
const optionalString = (v: unknown): boolean => v === undefined || typeof v === 'string'
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(v)
const correlation = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9._:-]{16,128}$/.test(v)

export function datePrecision(value: unknown): 'year' | 'month' | 'day' | null {
  if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1000) return null
  if (value.length === 4) return 'year'
  if (month < 1 || month > 12) return null
  if (value.length === 7) return 'month'
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? 'day' : null
}

/** Conservative lexical guard. The server still enforces DNS and redirect policy. */
function publicUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null
    // This reference client deliberately excludes all literal IP addresses.
    if (!host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host)) return null
    if (['local', 'localhost', 'internal', 'invalid', 'lan', 'test'].some(suffix => host === suffix || host.endsWith(`.${suffix}`))) return null
    return url
  } catch { return null }
}

export function isTimelineResult(v: unknown): v is TimelineResult {
  if (!record(v) || v.schemaVersion !== TIMELINE_VERSION || !id(v.requestId) || !member(v.outcome, ['events', 'no_events'])) return false
  if (!record(v.article) || !record(v.extraction) || !record(v.model) || !record(v.extraction.quality)) return false
  const { article, extraction, model } = v
  const quality = extraction.quality as Record<string, unknown>
  // Response URLs need HTTP(S) syntax; server-supported public IP literals are valid wire output.
  let articleUrl: URL
  try { articleUrl = new URL(String(article.url)) } catch { return false }
  if (typeof article.url !== 'string' || !['http:', 'https:'].includes(articleUrl.protocol) || articleUrl.username || articleUrl.password) return false
  if (!nonempty(article.title) || !nonempty(article.domain) || (article.publishedAt !== undefined && !datePrecision(article.publishedAt))) return false
  if (!Array.isArray(v.events) || v.events.length > 100 || (v.outcome === 'events' ? !v.events.length : v.events.length !== 0)) return false
  if (!v.events.every(event => record(event) && datePrecision(event.eventDate) !== null && datePrecision(event.eventDate) === event.datePrecision
    && nonempty(event.title) && event.title.length <= 200
    && (event.description === null || (typeof event.description === 'string' && event.description.length <= 500))
    && member(event.category, categories) && member(event.importance, importance))) return false
  return nonempty(extraction.contentSource) && member(extraction.sourceMode, ['live', 'supplied', 'archive', 'provider'])
    && optionalString(extraction.method) && integer(extraction.wordCount) && nonempty(quality.version)
    && typeof quality.score === 'number' && Number.isFinite(quality.score) && quality.score >= 0 && quality.score <= 100
    && quality.accepted === true && optionalString(quality.reason) && strings(extraction.fallbackAttempts)
    && nonempty(model.name) && model.status === (v.outcome === 'events' ? 'ok' : 'no_events') && integer(model.rejectedEventCount)
}

export function isIntegrationError(v: unknown): v is IntegrationError {
  return record(v) && v.schemaVersion === 'integration-error.v1' && id(v.requestId)
    && (v.correlationId === undefined || correlation(v.correlationId)) && record(v.error)
    && member(v.error.code, errorCodes) && typeof v.error.message === 'string' && typeof v.error.retryable === 'boolean'
}

function isCapabilities(v: unknown): v is TimelineCapabilities {
  const requiredCapabilities = ['anonymousAnalysis', 'publicBcw', 'communityIngest', 'jobStatus', 'artifactRead', 'projectionRead', 'persistentWorkspace', 'researchQuestions', 'cop', 'behaviorIntake', 'claimMatch', 'feedJobs', 'webhookManagement']
  return record(v) && v.schemaVersion === 'integration-capabilities.v1' && id(v.requestId) && v.identityType === 'service'
    && ['clientId', 'communityId', 'workspaceId', 'investigationId'].every(key => nonempty(v[key]))
    && member(v.environment, ['development', 'staging', 'production']) && member(v.maximumVisibility, ['private', 'community', 'public'])
    && strings(v.scopes) && new Set(v.scopes).size === v.scopes.length
    && (v.correlationId === undefined || correlation(v.correlationId))
    && record(v.capabilities) && requiredCapabilities.every(key => typeof (v.capabilities as Record<string, unknown>)[key] === 'boolean')
    && Object.values(v.capabilities).every(value => typeof value === 'boolean')
    && record(v.contractVersions) && v.contractVersions.capabilities === 'integration-capabilities.v1'
    && (v.contractVersions.timelineAnalysis === undefined || v.contractVersions.timelineAnalysis === TIMELINE_VERSION)
    && record(v.limits) && Object.values(v.limits).every(value => integer(value) && Number(value) > 0)
}

function requestBody(input: TimelineInput): string {
  if (!record(input) || Object.keys(input).some(key => !['url', 'content'].includes(key)) || !publicUrl(input.url)) throw new TimelineClientError('invalid_input')
  if (input.content !== undefined) {
    const c = input.content
    if (!record(c) || Object.keys(c).some(key => !['text', 'title', 'publishedAt', 'source'].includes(key))
      || typeof c.text !== 'string' || new TextEncoder().encode(c.text).byteLength > TIMELINE_LIMITS.textBytes
      || !member(c.source, sources) || (c.title !== undefined && (typeof c.title !== 'string' || c.title.length > 500))) throw new TimelineClientError('invalid_input')
    if (c.publishedAt !== undefined) {
      const value = typeof c.publishedAt === 'string' ? c.publishedAt.trim() : ''
      const timestamp = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(value)
      if (!datePrecision(value) && !(timestamp && datePrecision(timestamp[1]) === 'day')) throw new TimelineClientError('invalid_input')
    }
  }
  const body = JSON.stringify({ schemaVersion: TIMELINE_VERSION, ...input })
  if (new TextEncoder().encode(body).byteLength > TIMELINE_LIMITS.requestBytes) throw new TimelineClientError('invalid_input')
  return body
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > TIMELINE_LIMITS.responseBytes) {
    void response.body?.cancel().catch(() => {})
    throw new TimelineClientError('response_too_large', response.status)
  }
  if (!response.body || !/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
    void response.body?.cancel().catch(() => {})
    throw new TimelineClientError('invalid_response', response.status)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    if (signal.aborted) throw new TimelineClientError('aborted')
    while (true) {
      const chunk = await withAbort(reader.read(), signal)
      if (signal.aborted) throw new TimelineClientError('aborted')
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > TIMELINE_LIMITS.responseBytes) throw new TimelineClientError('response_too_large', response.status)
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    cancel()
    if (error instanceof TimelineClientError) throw error
    throw new TimelineClientError('invalid_response', response.status)
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
}

/** Also bounds test/custom transports which do not implement AbortSignal themselves. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new TimelineClientError('aborted'))
    // Attach rejection handling even if a custom transport synchronously aborts.
    promise.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
  })
}

export function createTimelineClient(options: TimelineClientOptions) {
  const origin = publicUrl(options.baseUrl)
  const timeoutMs = options.timeoutMs ?? 30_000
  if (!origin || origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash
    || !/^rt_svc_[a-z0-9][a-z0-9_-]{15,63}\.[A-Za-z0-9_-]{43}$/.test(options.serviceToken)
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new TimelineClientError('invalid_input')
  const originUrl = origin.origin
  const fetchImpl = options.fetch ?? globalThis.fetch
  // Copy the credential into the closure so mutation of options cannot redirect or change identity.
  const token = options.serviceToken
  const safeId = (value: string | undefined) => value?.includes(token) ? undefined : value
  async function request(path: string, body: string | undefined, call: TimelineCallOptions): Promise<unknown> {
    if (call.correlationId !== undefined && !correlation(call.correlationId)) throw new TimelineClientError('invalid_input')
    if (call.signal?.aborted) throw new TimelineClientError('aborted')
    const controller = new AbortController()
    let timedOut = false
    const abort = () => controller.abort()
    call.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    try {
      const transport = fetchImpl(new URL(path, originUrl), {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(call.correlationId ? { 'X-Correlation-ID': call.correlationId } : {}) },
        ...(body === undefined ? {} : { body }),
        credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
      })
      // A custom transport may resolve after cancellation; release that late body.
      void transport.then(response => { if (controller.signal.aborted) void response.body?.cancel().catch(() => {}) }, () => {})
      const response = await withAbort(transport, controller.signal)
      if (response.redirected || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        void response.body?.cancel().catch(() => {})
        throw new TimelineClientError('redirect_denied', response.status)
      }
      const payload = await boundedJson(response, controller.signal)
      if (!response.ok) {
        const retryHeader = response.headers.get('retry-after')
        const retryAfter = retryHeader && /^\d+$/.test(retryHeader) && Number.isSafeInteger(Number(retryHeader)) ? Number(retryHeader) : undefined
        if (isIntegrationError(payload)) throw new TimelineClientError(payload.error.code, response.status, payload.error.retryable, safeId(payload.requestId), safeId(payload.correlationId), retryAfter)
        if (record(payload) && typeof payload.error === 'string' && response.status === 429) throw new TimelineClientError('rate_limited', 429, true, undefined, undefined, retryAfter)
        if (record(payload) && typeof payload.error === 'string' && payload.retryable === true && response.status === 503) throw new TimelineClientError('service_unavailable', 503, true, undefined, undefined, retryAfter)
        throw new TimelineClientError('http_error', response.status)
      }
      return payload
    } catch (error) {
      if (timedOut) throw new TimelineClientError('timeout', undefined, true)
      if (call.signal?.aborted) throw new TimelineClientError('aborted')
      if (error instanceof TimelineClientError) throw error
      throw new TimelineClientError('network_error', undefined, true)
    } finally { clearTimeout(timer); call.signal?.removeEventListener('abort', abort) }
  }
  async function discover(call: TimelineCallOptions = {}): Promise<TimelineCapabilities> {
    const payload = await request('/api/integrations/capabilities', undefined, call)
    if (!isCapabilities(payload)) throw new TimelineClientError('invalid_response', 200)
    return payload
  }
  async function analyze(input: TimelineInput, call: TimelineCallOptions = {}): Promise<TimelineResult> {
    const body = requestBody(input)
    // Discover each time: revocation/readiness must not be hidden by a stale client cache.
    const capabilities = await discover(call)
    if (capabilities.capabilities.timelineAnalysis !== true || capabilities.contractVersions.timelineAnalysis !== TIMELINE_VERSION || !capabilities.scopes.includes('community.research.execute')) throw new TimelineClientError('capability_unavailable')
    const payload = await request('/api/tools/extract-timeline', body, call)
    if (!isTimelineResult(payload)) throw new TimelineClientError('invalid_response', 200)
    return payload
  }
  return { discover, analyze }
}
