import { TIMELINE_EVENT_CATEGORIES, TIMELINE_EVENT_IMPORTANCE, timelineDatePrecision, type TimelineDatePrecision, type TimelineEventCategory, type TimelineEventImportance } from './timeline-contract'
import { ARTIFACT_LIMITS, ArtifactError, artifactResponse, isRecord } from './timeline-artifact-contract'

/** Same overall request cap as the artifact routes: one answer to "how big can a request be". */
export const HANDOFF_REQUEST_MAX_BYTES = ARTIFACT_LIMITS.requestBytes

/** Bounds the redeemed document is truncated to at mint. Never silently dropped — see `truncated`. */
export const HANDOFF_LIMITS = { items: 100, events: 100, sourceUrls: 50, ttlSeconds: 1800, clientQuota: 200 } as const

export const HANDOFF_AUDIENCES = ['researchtools-community.v1', 'researchtools-oidc-subject.v1'] as const
export type HandoffAudience = typeof HANDOFF_AUDIENCES[number]
export const HANDOFF_KINDS = ['article', 'article-set', 'story-snapshot'] as const
export type HandoffKind = typeof HANDOFF_KINDS[number]

export type HandoffErrorCode =
  | 'invalid_request' | 'authentication_required' | 'human_identity_required' | 'access_denied'
  | 'idempotency_conflict' | 'handoff_quota' | 'handoff_not_found' | 'handoff_revoked'
  | 'handoff_already_redeemed' | 'handoff_expired' | 'handoff_audience_denied' | 'datastore_unavailable'

export class HandoffError extends Error {
  readonly code: HandoffErrorCode
  readonly status: number
  constructor(code: HandoffErrorCode, status: number) { super(code); this.name = 'HandoffError'; this.code = code; this.status = status }
}

export interface HandoffOrigin { product: string; returnUrl: string; returnLabel: string }
export interface HandoffItem { url: string; title: string; publisher: string; publishedAt?: string; returnUrl?: string }
export interface HandoffEvent {
  eventDate: string; datePrecision: TimelineDatePrecision; title: string; description: string | null
  category: TimelineEventCategory; importance: TimelineEventImportance; sourceUrls: string[]
}
export interface HandoffCoverage { eventCount: number; sourceCount: number }
export interface HandoffMintRequest {
  schemaVersion: 'timeline-handoff-request.v1'
  audience: HandoffAudience
  audienceSubject?: string
  kind: HandoffKind
  title: string
  origin: HandoffOrigin
  items: HandoffItem[]
  events: HandoffEvent[]
  coverage?: HandoffCoverage
  storyRevision?: string
}
export interface HandoffDocument {
  schemaVersion: 'timeline-handoff.v1'
  kind: HandoffKind
  title: string
  origin: HandoffOrigin
  mintedAt: string
  items: HandoffItem[]
  events: HandoffEvent[]
  truncated?: true
  coverage?: HandoffCoverage
  storyRevision?: string
}

const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key))
const text = (v: unknown, max: number, nonblank = false): v is string =>
  typeof v === 'string' && v.length <= max && (!nonblank || v.trim().length > 0)
function httpsUrl(v: unknown, max = 2048): v is string {
  if (!text(v, max, true)) return false
  try {
    const url = new URL(v)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}
function iso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}
const calendarDay = (v: unknown): v is string => timelineDatePrecision(v) === 'day'
const oidcSubject = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const storyRevision = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-z]{1,16}$/.test(v)
const nonNegativeInt = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0

function validOrigin(v: unknown): v is HandoffOrigin {
  return isRecord(v) && keys(v, ['product', 'returnUrl', 'returnLabel'])
    && text(v.product, 100, true) && httpsUrl(v.returnUrl) && text(v.returnLabel, 300, true)
}
function validItem(v: unknown): v is HandoffItem {
  if (!isRecord(v) || !keys(v, ['url', 'title', 'publisher', 'publishedAt', 'returnUrl'])) return false
  if (!httpsUrl(v.url) || !text(v.title, 300, true) || !text(v.publisher, 200, true)) return false
  if (v.publishedAt !== undefined && !calendarDay(v.publishedAt)) return false
  if (v.returnUrl !== undefined && !httpsUrl(v.returnUrl)) return false
  return true
}
function validEvent(v: unknown): v is HandoffEvent {
  if (!isRecord(v) || !keys(v, ['eventDate', 'datePrecision', 'title', 'description', 'category', 'importance', 'sourceUrls'])) return false
  if (timelineDatePrecision(v.eventDate) === null || timelineDatePrecision(v.eventDate) !== v.datePrecision) return false
  if (!text(v.title, 200, true)) return false
  if (v.description !== null && !text(v.description, 2000)) return false
  if (!(TIMELINE_EVENT_CATEGORIES as readonly string[]).includes(v.category as string)) return false
  if (!(TIMELINE_EVENT_IMPORTANCE as readonly string[]).includes(v.importance as string)) return false
  if (!Array.isArray(v.sourceUrls) || v.sourceUrls.length > HANDOFF_LIMITS.sourceUrls || !v.sourceUrls.every(url => httpsUrl(url))) return false
  return true
}
function validCoverage(v: unknown): v is HandoffCoverage {
  return isRecord(v) && keys(v, ['eventCount', 'sourceCount']) && nonNegativeInt(v.eventCount) && nonNegativeInt(v.sourceCount)
}

/** The mint body. Item/event counts are NOT bounded here — a larger story is truncated at build, never rejected. */
export function validHandoffMintRequest(v: unknown): v is HandoffMintRequest {
  if (!isRecord(v) || !keys(v, ['schemaVersion', 'audience', 'audienceSubject', 'kind', 'title', 'origin', 'items', 'events', 'coverage', 'storyRevision'])) return false
  if (v.schemaVersion !== 'timeline-handoff-request.v1') return false
  if (!(HANDOFF_AUDIENCES as readonly string[]).includes(v.audience as string)) return false
  const subjectBound = v.audience === 'researchtools-oidc-subject.v1'
  if (subjectBound !== (v.audienceSubject !== undefined)) return false
  if (v.audienceSubject !== undefined && !oidcSubject(v.audienceSubject)) return false
  if (!(HANDOFF_KINDS as readonly string[]).includes(v.kind as string)) return false
  if (!text(v.title, 200, true)) return false
  if (!validOrigin(v.origin)) return false
  if (!Array.isArray(v.items) || !v.items.every(validItem)) return false
  if (!Array.isArray(v.events) || !v.events.every(validEvent)) return false
  if (v.coverage !== undefined && !validCoverage(v.coverage)) return false
  if (v.storyRevision !== undefined && !storyRevision(v.storyRevision)) return false
  if ((v.kind !== 'story-snapshot') && (v.coverage !== undefined || v.storyRevision !== undefined)) return false
  return true
}

/** Stored/redeemed document. Validated identically on the way in (mint) and the way out (redeem),
 * so only canonical accepted bytes are ever replayed — the same discipline as `saved()` in
 * timeline-presentation-store.ts. */
export function validHandoffDocument(v: unknown): v is HandoffDocument {
  if (!isRecord(v) || !keys(v, ['schemaVersion', 'kind', 'title', 'origin', 'mintedAt', 'items', 'events', 'truncated', 'coverage', 'storyRevision'])) return false
  if (v.schemaVersion !== 'timeline-handoff.v1') return false
  if (!(HANDOFF_KINDS as readonly string[]).includes(v.kind as string)) return false
  if (!text(v.title, 200, true)) return false
  if (!validOrigin(v.origin)) return false
  if (!iso(v.mintedAt)) return false
  if (!Array.isArray(v.items) || v.items.length > HANDOFF_LIMITS.items || !v.items.every(validItem)) return false
  if (!Array.isArray(v.events) || v.events.length > HANDOFF_LIMITS.events || !v.events.every(validEvent)) return false
  if (v.truncated !== undefined && v.truncated !== true) return false
  if (v.coverage !== undefined && !validCoverage(v.coverage)) return false
  if (v.storyRevision !== undefined && !storyRevision(v.storyRevision)) return false
  if ((v.kind !== 'story-snapshot') && (v.coverage !== undefined || v.storyRevision !== undefined)) return false
  return true
}

/** Truncates to the bounds the seeded workspace codec already enforces, flagging rather than dropping silently. */
export function buildHandoffDocument(request: HandoffMintRequest, mintedAt: string): HandoffDocument {
  const truncated = request.items.length > HANDOFF_LIMITS.items || request.events.length > HANDOFF_LIMITS.events
  const document: HandoffDocument = {
    schemaVersion: 'timeline-handoff.v1',
    kind: request.kind,
    title: request.title,
    origin: request.origin,
    mintedAt,
    items: request.items.slice(0, HANDOFF_LIMITS.items),
    events: request.events.slice(0, HANDOFF_LIMITS.events),
    ...(truncated ? { truncated: true as const } : {}),
    ...(request.coverage !== undefined ? { coverage: request.coverage } : {}),
    ...(request.storyRevision !== undefined ? { storyRevision: request.storyRevision } : {}),
  }
  return document
}

/** Reuses the artifact envelope shape, layered with the presentation-store discipline
 * (no-referrer, noindex) this staged, single-use material also needs. */
export function handoffResponse(body: unknown, status = 200): Response {
  const base = artifactResponse(body, status)
  const headers = new Headers(base.headers)
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('X-Robots-Tag', 'noindex,nofollow')
  return new Response(base.body, { status, headers })
}

/** No exception, token or payload is logged or returned. */
export async function handoffRoute(action: () => Promise<Response>): Promise<Response> {
  try { return await action() } catch (failure) {
    // requireTimelineHuman (timeline-artifact-auth.ts) throws ArtifactError, not HandoffError;
    // its 'authentication_required' / 'human_identity_required' codes are shared verbatim.
    const known = failure instanceof HandoffError || failure instanceof ArtifactError
      ? failure
      : new HandoffError('datastore_unavailable', 503)
    const response = handoffResponse({ schemaVersion: 'timeline-handoff-error.v1', error: { code: known.code } }, known.status)
    if (known.status !== 503) return response
    const headers = new Headers(response.headers)
    headers.set('Retry-After', '2')
    return new Response(response.body, { status: response.status, headers })
  }
}

export function handoffToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new HandoffError('handoff_not_found', 404)
  return value
}
