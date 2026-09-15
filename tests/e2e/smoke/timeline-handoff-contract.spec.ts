import { test, expect } from '@playwright/test'
import { ArtifactError } from '../../../functions/api/_shared/timeline-artifact-contract'
import {
  HANDOFF_LIMITS,
  HandoffError,
  buildHandoffDocument,
  handoffResponse,
  handoffRoute,
  handoffToken,
  validHandoffDocument,
  validHandoffMintRequest,
  type HandoffEvent,
  type HandoffItem,
  type HandoffMintRequest,
} from '../../../functions/api/_shared/timeline-handoff-contract'

function origin(overrides: Record<string, unknown> = {}) {
  return { product: 'irregulars-rss', returnUrl: 'https://rss.irregulars.io/link/abc123', returnLabel: 'IrregularChat Links — story', ...overrides }
}
function item(overrides: Partial<HandoffItem> = {}): HandoffItem {
  return { url: 'https://publisher.example/story', title: 'Story title', publisher: 'publisher.example', publishedAt: '2024-07-19', ...overrides }
}
function eventEntry(overrides: Partial<HandoffEvent> = {}): HandoffEvent {
  return { eventDate: '2024-07-19', datePrecision: 'day', title: 'Something happened', description: null, category: 'event', importance: 'normal', sourceUrls: ['https://publisher.example/story'], ...overrides }
}
function request(overrides: Record<string, unknown> = {}): HandoffMintRequest {
  return {
    schemaVersion: 'timeline-handoff-request.v1',
    audience: 'researchtools-community.v1',
    kind: 'article',
    title: 'Content update deployed',
    origin: origin(),
    items: [item()],
    events: [eventEntry()],
    ...overrides,
  } as HandoffMintRequest
}

test.describe('Timeline handoff wire contract @smoke', () => {
  test('accepts a well-formed community-audience mint request and the three kinds', () => {
    expect(validHandoffMintRequest(request())).toBe(true)
    for (const kind of ['article', 'article-set', 'story-snapshot'] as const) {
      const body = kind === 'story-snapshot'
        ? request({ kind, coverage: { eventCount: 3, sourceCount: 2 }, storyRevision: 'a1b2c3' })
        : request({ kind })
      expect(validHandoffMintRequest(body)).toBe(true)
    }
  })

  test('audience binding is exact: subject required iff oidc-subject audience, and validated', () => {
    expect(validHandoffMintRequest(request({ audience: 'researchtools-oidc-subject.v1' }))).toBe(false)
    expect(validHandoffMintRequest(request({ audience: 'researchtools-oidc-subject.v1', audienceSubject: 'a'.repeat(64) }))).toBe(true)
    expect(validHandoffMintRequest(request({ audienceSubject: 'a'.repeat(64) }))).toBe(false)
    expect(validHandoffMintRequest(request({ audience: 'researchtools-oidc-subject.v1', audienceSubject: '' }))).toBe(false)
    expect(validHandoffMintRequest(request({ audience: 'not-a-real-audience' }))).toBe(false)
  })

  test('rejects malformed origin, item and event shapes without crashing', () => {
    expect(validHandoffMintRequest(request({ origin: origin({ returnUrl: 'http://rss.irregulars.io/link/abc123' }) }))).toBe(false)
    expect(validHandoffMintRequest(request({ origin: origin({ returnUrl: 'https://user:pass@rss.irregulars.io/link/abc123' }) }))).toBe(false)
    expect(validHandoffMintRequest(request({ origin: origin({ returnUrl: 'not a url' }) }))).toBe(false)
    expect(validHandoffMintRequest(request({ origin: { ...origin(), extra: 'field' } }))).toBe(false)
    expect(validHandoffMintRequest(request({ items: [item({ url: 'ftp://publisher.example/story' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ items: [item({ publishedAt: '2024-13-40' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ items: [item({ publishedAt: '2024-07' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ events: [eventEntry({ datePrecision: 'month' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ events: [eventEntry({ category: 'not-a-category' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ events: [eventEntry({ importance: 'not-a-level' })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ events: [eventEntry({ sourceUrls: Array.from({ length: HANDOFF_LIMITS.sourceUrls + 1 }, () => 'https://publisher.example/story') })] }))).toBe(false)
    expect(validHandoffMintRequest(request({ kind: 'not-a-kind' }))).toBe(false)
    expect(validHandoffMintRequest(request({ title: '' }))).toBe(false)
    expect(validHandoffMintRequest(null)).toBe(false)
    expect(validHandoffMintRequest([])).toBe(false)
    expect(validHandoffMintRequest({ ...request(), extraTopLevelField: true })).toBe(false)
  })

  test('coverage and storyRevision are exclusive to story-snapshot in both request and document validators', () => {
    expect(validHandoffMintRequest(request({ kind: 'article', coverage: { eventCount: 1, sourceCount: 1 } }))).toBe(false)
    expect(validHandoffMintRequest(request({ kind: 'article', storyRevision: 'abc123' }))).toBe(false)
    expect(validHandoffMintRequest(request({ kind: 'story-snapshot', coverage: { eventCount: -1, sourceCount: 0 } }))).toBe(false)
    const document = buildHandoffDocument(request({ kind: 'article' }), '2026-09-15T14:02:11.000Z')
    expect(validHandoffDocument({ ...document, coverage: { eventCount: 1, sourceCount: 1 } })).toBe(false)
  })

  test('build truncates beyond bounds and flags truncated, never silently drops within bounds', () => {
    const withinBounds = request({
      items: Array.from({ length: HANDOFF_LIMITS.items }, (_, index) => item({ url: `https://publisher.example/story-${index}` })),
      events: Array.from({ length: HANDOFF_LIMITS.events }, (_, index) => eventEntry({ title: `Event ${index}` })),
    })
    const exact = buildHandoffDocument(withinBounds, '2026-09-15T14:02:11.000Z')
    expect(exact.items).toHaveLength(HANDOFF_LIMITS.items)
    expect(exact.events).toHaveLength(HANDOFF_LIMITS.events)
    expect(exact.truncated).toBeUndefined()
    expect(validHandoffDocument(exact)).toBe(true)

    const overBounds = request({
      items: Array.from({ length: HANDOFF_LIMITS.items + 37 }, (_, index) => item({ url: `https://publisher.example/story-${index}` })),
      events: Array.from({ length: HANDOFF_LIMITS.events + 5 }, (_, index) => eventEntry({ title: `Event ${index}` })),
    })
    const truncated = buildHandoffDocument(overBounds, '2026-09-15T14:02:11.000Z')
    expect(truncated.items).toHaveLength(HANDOFF_LIMITS.items)
    expect(truncated.events).toHaveLength(HANDOFF_LIMITS.events)
    expect(truncated.truncated).toBe(true)
    expect(validHandoffDocument(truncated)).toBe(true)
  })

  test('the built document is exactly what the redeemed schema accepts, and rejects tampering', () => {
    const document = buildHandoffDocument(request(), '2026-09-15T14:02:11.000Z')
    expect(document.schemaVersion).toBe('timeline-handoff.v1')
    expect(validHandoffDocument(document)).toBe(true)
    expect(validHandoffDocument({ ...document, schemaVersion: 'timeline-handoff-request.v1' })).toBe(false)
    expect(validHandoffDocument({ ...document, mintedAt: 'not-a-timestamp' })).toBe(false)
    expect(validHandoffDocument({ ...document, truncated: false })).toBe(false)
    expect(validHandoffDocument({ ...document, extraField: 1 })).toBe(false)
    expect(validHandoffDocument({ ...document, items: Array.from({ length: HANDOFF_LIMITS.items + 1 }, () => item()) })).toBe(false)
  })

  test('handoffToken accepts only well-formed 64-hex and reports the tampered case identically to missing', () => {
    const valid = 'a'.repeat(64)
    expect(handoffToken(valid)).toBe(valid)
    for (const bad of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), '', undefined, null, 123]) {
      let thrown: unknown
      try { handoffToken(bad) } catch (error) { thrown = error }
      expect(thrown).toBeInstanceOf(HandoffError)
      expect((thrown as HandoffError).code).toBe('handoff_not_found')
      expect((thrown as HandoffError).status).toBe(404)
    }
  })

  test('handoffResponse sets the full staged-material header set', async () => {
    const response = handoffResponse({ ok: true }, 201)
    expect(response.status).toBe(201)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex,nofollow')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.json()).toEqual({ ok: true })
  })

  test('handoffRoute maps HandoffError and ArtifactError to the bounded envelope without leaking messages', async () => {
    const cases: Array<{ error: unknown; code: string; status: number }> = [
      { error: new HandoffError('handoff_expired', 410), code: 'handoff_expired', status: 410 },
      { error: new HandoffError('handoff_already_redeemed', 409), code: 'handoff_already_redeemed', status: 409 },
      { error: new ArtifactError('human_identity_required', 403), code: 'human_identity_required', status: 403 },
      { error: new ArtifactError('authentication_required', 401), code: 'authentication_required', status: 401 },
      { error: new Error('leaky internal detail: token=deadbeef'), code: 'datastore_unavailable', status: 503 },
    ]
    for (const { error, code, status } of cases) {
      const response = await handoffRoute(() => { throw error })
      expect(response.status).toBe(status)
      const body = await response.text()
      expect(JSON.parse(body)).toEqual({ schemaVersion: 'timeline-handoff-error.v1', error: { code } })
      expect(body).not.toContain('leaky internal detail')
      expect(body).not.toContain('deadbeef')
      if (status === 503) expect(response.headers.get('Retry-After')).toBe('2')
      else expect(response.headers.get('Retry-After')).toBeNull()
    }
  })

  test('handoffRoute passes a successful response straight through', async () => {
    const response = await handoffRoute(async () => new Response('ok', { status: 200 }))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })
})
