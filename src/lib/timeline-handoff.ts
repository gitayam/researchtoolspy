import { validHandoffDocument, type HandoffDocument } from '../../functions/api/_shared/timeline-handoff-contract'
import { decodeTimelineWorkspace, workspaceVersionForEvents } from './timeline-workspace-codec'
import type {
  TimelineEvidenceLink,
  TimelineEvidenceSource,
  TimelineSourceAssertion,
  TimelineWorkspaceEvent,
  TimelineWorkspaceExport,
} from '@/types/timeline-workspace'

const TOKEN_PATTERN = /^[0-9a-f]{64}$/
const FRAGMENT_KEY = 'handoff'
let captured: string | null = null

function fragmentToken(hash: string): string | null {
  if (!hash.includes(`${FRAGMENT_KEY}=`)) return null
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(FRAGMENT_KEY)
  return value !== null && TOKEN_PATTERN.test(value) ? value : null
}

/**
 * Reads the handoff token out of the URL fragment and clears it with history.replaceState
 * before anything can fetch. A token in the query string reaches Cloudflare's request logs
 * and the Referer of every subresource the SPA loads; a fragment reaches neither, because
 * browsers never send it to a server. Idempotent, so a double-invoked render and a later
 * remount both see the same captured token rather than losing it to the first clear.
 */
export function captureTimelineHandoff(): string | null {
  if (typeof window === 'undefined') return null
  const fresh = fragmentToken(window.location.hash)
  if (fresh === null) return captured
  captured = fresh
  const remaining = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  remaining.delete(FRAGMENT_KEY)
  const rest = remaining.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`)
  return captured
}

export function forgetTimelineHandoff(): void { captured = null }

export type TimelineHandoffFailure =
  | 'handoff_expired' | 'handoff_already_redeemed' | 'handoff_revoked' | 'handoff_audience_denied'
  | 'handoff_not_found' | 'authentication_required' | 'human_identity_required'
  | 'datastore_unavailable' | 'unreadable'

export interface TimelineHandoffRedeemed { document: HandoffDocument }
export interface TimelineHandoffRejected { failure: TimelineHandoffFailure; originReturnUrl?: string }

const REPORTED_FAILURES: readonly string[] = [
  'handoff_expired', 'handoff_already_redeemed', 'handoff_revoked', 'handoff_audience_denied',
  'handoff_not_found', 'authentication_required', 'human_identity_required', 'datastore_unavailable',
]

/** Same credential reader as the workspace-saving panel; missing or malformed values fail closed at the API. */
function humanHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    const hash = localStorage.getItem('omnicore_user_hash')
    if (hash) headers['X-User-Hash'] = hash
    const token = JSON.parse(localStorage.getItem('omnicore_tokens') || 'null')?.access_token
    if (typeof token === 'string' && token) headers.Authorization = `Bearer ${token}`
  } catch { /* No readable credential: the redeem call answers 401 and nothing is consumed. */ }
  return headers
}

/**
 * POST, and only ever from an explicit reader action. Signal unfurls links, browsers prefetch
 * them and crawlers follow them, so a redemption that happened on load would be burned before
 * the recipient ever tapped it.
 */
export async function redeemTimelineHandoff(token: string, signal?: AbortSignal): Promise<TimelineHandoffRedeemed | TimelineHandoffRejected> {
  if (!TOKEN_PATTERN.test(token)) return { failure: 'handoff_not_found' }
  let response: Response
  try {
    response = await fetch(`/api/timeline-handoffs/${token}/redeem`, {
      method: 'POST', signal, redirect: 'error', credentials: 'same-origin',
      headers: { ...humanHeaders(), Accept: 'application/json' },
    })
  } catch { return { failure: 'datastore_unavailable' } }
  let body: unknown
  try { body = await response.json() } catch { return { failure: 'unreadable' } }
  if (response.ok) return validHandoffDocument(body) ? { document: body } : { failure: 'unreadable' }
  const envelope = body as { error?: { code?: unknown }; originReturnUrl?: unknown }
  const code = envelope?.error?.code
  const failure: TimelineHandoffFailure = typeof code === 'string' && REPORTED_FAILURES.includes(code)
    ? code as TimelineHandoffFailure
    : response.status === 401 ? 'authentication_required'
      : response.status === 403 ? 'human_identity_required'
        : response.status === 404 ? 'handoff_not_found' : 'datastore_unavailable'
  const originReturnUrl = typeof envelope?.originReturnUrl === 'string' ? envelope.originReturnUrl : undefined
  return { failure, ...(originReturnUrl !== undefined ? { originReturnUrl } : {}) }
}

export interface SeededTimelineHandoff {
  snapshot: TimelineWorkspaceExport
  /** What the payload carried that the draft could not. Reported, never dropped in silence. */
  omitted: { sources: number; assertions: number }
}

/**
 * The evidence codec's own caps (src/lib/timeline-evidence.ts). The originating surface takes
 * one source slot of its own, so at most 99 of a payload's 100 items can be carried with it.
 */
const EVIDENCE_LIMITS = { sources: 100, assertions: 200 } as const

const hostnameOf = (value: string): string => { try { return new URL(value).hostname } catch { return '' } }

/**
 * Turns a redeemed `timeline-handoff.v1` document into a local draft. The return link is not
 * metadata: it is `sources[0]` of the `timeline-evidence.v1` block, so it is inside the content
 * that gets hashed into every immutable revision. The export is v1 by content, through
 * `workspaceVersionForEvents`, never by assertion.
 */
export function seedTimelineHandoffWorkspace(document: HandoffDocument, seededAt: string = new Date().toISOString()): SeededTimelineHandoff {
  const events: TimelineWorkspaceEvent[] = document.events.map((event, index) => ({
    id: `handoff:event:${index + 1}`,
    eventDate: event.eventDate,
    datePrecision: event.datePrecision,
    title: event.title,
    description: event.description,
    category: event.category,
    importance: event.importance,
    origin: 'source',
    assessment: 'unreviewed',
    analystNote: '',
    modified: false,
  }))
  const carried = document.items.slice(0, EVIDENCE_LIMITS.sources - 1)
  const sources: TimelineEvidenceSource[] = [
    {
      id: 'handoff:origin', url: document.origin.returnUrl, title: document.origin.returnLabel,
      publisher: hostnameOf(document.origin.returnUrl), retrievedAt: document.mintedAt,
    },
    ...carried.map((item, index) => ({
      id: `handoff:source:${index + 1}`, url: item.url, title: item.title, publisher: item.publisher,
      ...(item.publishedAt !== undefined ? { publishedAt: `${item.publishedAt}T00:00:00.000Z` } : {}),
      retrievedAt: document.mintedAt,
    })),
  ]
  const sourceByUrl = new Map(carried.map((item, index) => [item.url, `handoff:source:${index + 1}`]))
  // The codec permits an empty quote but requires a non-blank locator, and this is the honest
  // thing to put there: nothing here was quoted from the publisher.
  const locator = `Listed by ${document.origin.product} as "${document.origin.returnLabel}" at ${document.mintedAt}.`
    + (document.storyRevision !== undefined ? ` Story revision ${document.storyRevision}.` : '')
    + ' Aggregated listing, not a verified quotation from the source.'
  const assertions: TimelineSourceAssertion[] = []
  const links: TimelineEvidenceLink[] = []
  let omittedAssertions = 0
  document.events.forEach((event, eventIndex) => {
    for (const url of event.sourceUrls) {
      const sourceId = sourceByUrl.get(url)
      if (sourceId === undefined || assertions.length >= EVIDENCE_LIMITS.assertions) { omittedAssertions += 1; continue }
      const ordinal = assertions.length + 1
      assertions.push({
        id: `handoff:assertion:${ordinal}`,
        sourceId,
        claimText: event.title,
        temporalClaim: event.eventDate,
        epistemicType: 'reported_claim',
        status: 'active',
        derivesFrom: [],
        passage: { id: `handoff:passage:${ordinal}`, quote: '', locator },
      })
      links.push({ id: `handoff:link:${ordinal}`, eventId: events[eventIndex].id, assertionId: `handoff:assertion:${ordinal}`, relation: 'supports' })
    }
  })
  const snapshot: TimelineWorkspaceExport = {
    schemaVersion: workspaceVersionForEvents(events),
    exportedAt: seededAt,
    // No extraction ran, so claiming timeline-analysis.v1 would fabricate a requestId, a
    // quality score and a model status that nothing produced.
    source: { schemaVersion: 'timeline-manual.v1', title: document.title },
    analystWorkspace: {
      mode: 'robust', events, questions: [], hypotheses: [],
      // reviews stays empty: source independence is an analyst's conclusion and a
      // cross-product import has no standing to make it.
      evidence: { schemaVersion: 'timeline-evidence.v1', sources, assertions, links, reviews: [] },
    },
  }
  // Decoded through the same codec an imported file goes through, so a draft that could not be
  // saved fails here rather than at the reader's first save.
  return {
    snapshot: decodeTimelineWorkspace(JSON.stringify(snapshot)),
    omitted: { sources: document.items.length - carried.length, assertions: omittedAssertions },
  }
}
