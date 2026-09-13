import { test, expect } from '@playwright/test'
import { loadTimelineRevisions, openTimelineRevision, type TimelineRevisionSummary } from '../../../src/lib/timeline-durable'
import { encodeCursor, hashContent } from '../../../functions/api/_shared/timeline-artifact-contract'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'

const artifactId = 'timeline_history_test'
const identity = { principalId: 1, workspaceId: 'history-private', headers: { 'X-User-Hash': 'history-human' } }
const signal = () => new AbortController().signal
const summary = (sequence: number): TimelineRevisionSummary => ({ revisionId: `rev_${sequence}`, sequence, parentRevisionIds: sequence ? [`rev_${sequence - 1}`] : [], objectCount: sequence ? 1 : 0, changeCount: sequence ? 1 : 0, contentHash: 'a'.repeat(64), createdBy: 1, createdAt: '2026-09-12T12:00:00.000Z' })
const cursor = (before: number, overrides = {}) => encodeCursor({ v: 1, sort: 'sequence-desc', artifactId, headRevisionId: 'rev_22', before, ...overrides })
const page = (revisions = [summary(22), summary(21)], nextCursor: string | null = cursor(21)) => ({ schemaVersion: 'timeline-revision-page.v1', artifactId, headRevisionId: 'rev_22', revisions, nextCursor })
async function mocked<T>(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, body: () => Promise<T>) {
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init)) as typeof fetch
  try { return await body() } finally { globalThis.fetch = original }
}
const reply = (value: unknown, etag = '"rev_22"') => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', ETag: etag } })

test.describe('timeline history client contracts @smoke', () => {
  test('pages use opaque pinned cursor and never fetch a current head', async () => {
    const urls: string[] = []
    await mocked(url => { urls.push(url); return reply(urls.length === 1 ? page() : page([summary(20), summary(19)], cursor(19))) }, async () => {
      const first = await loadTimelineRevisions(artifactId, identity, signal())
      const second = await loadTimelineRevisions(artifactId, identity, signal(), first)
      expect(second.headRevisionId).toBe('rev_22')
      expect(second.revisions.map(r => r.sequence)).toEqual([20, 19])
      expect(new URL(urls[0], 'https://test').pathname).toBe(`/api/timelines/${artifactId}/revisions`)
      expect(new URL(urls[0], 'https://test').searchParams.get('limit')).toBe('20')
      expect(new URL(urls[1], 'https://test').searchParams.get('cursor')).toBe(first.nextCursor)
      expect(urls).toHaveLength(2)
    })
  })
  test('rejects unknown fields, bad metadata, repeated IDs, wrong order and ETags', async () => {
    const cases: unknown[] = [
      { ...page(), extra: true }, { ...page(), artifactId: 'other' },
      page([{ ...summary(22), extra: true } as never], null),
      page([{ ...summary(22), createdAt: 'yesterday' }], null),
      page([{ ...summary(22), sequence: 22.5 }], null),
      page([{ ...summary(22), contentHash: 'not-a-hash' }], null),
      page([summary(21), summary(22)], null), page([summary(22), summary(22)], null),
    ]
    for (const value of cases) await mocked(() => reply(value), async () => { await expect(loadTimelineRevisions(artifactId, identity, signal())).rejects.toThrow() })
    await mocked(() => reply(page(), '"other"'), async () => { await expect(loadTimelineRevisions(artifactId, identity, signal())).rejects.toThrow() })
  })
  test('rejects cursor binding violations, repeated page and changed pinned head', async () => {
    for (const nextCursor of ['not-base64', 'x'.repeat(1025), cursor(21, { artifactId: 'other' }), cursor(21, { headRevisionId: 'rev_other' }), cursor(20), cursor(21, { extra: true })]) {
      await mocked(() => reply(page(undefined, nextCursor)), async () => { await expect(loadTimelineRevisions(artifactId, identity, signal())).rejects.toThrow() })
    }
    for (const second of [page(), { ...page([summary(20)], cursor(20, { headRevisionId: 'rev_23' })), headRevisionId: 'rev_23' }]) {
      let count = 0
      await mocked(() => ++count === 1 ? reply(page()) : reply(second, `"${second.headRevisionId}"`), async () => {
        const first = await loadTimelineRevisions(artifactId, identity, signal())
        await expect(loadTimelineRevisions(artifactId, identity, signal(), first)).rejects.toThrow()
      })
    }
  })
  test('rejects oversized response and refuses exhausted pagination without fetching', async () => {
    await mocked(() => reply({ ...page(), padding: 'x'.repeat(5 * 1024 * 1024) }), async () => { await expect(loadTimelineRevisions(artifactId, identity, signal())).rejects.toThrow() })
    let count = 0
    await mocked(() => { count++; return reply(page([summary(22), summary(0)], null)) }, async () => {
      const first = await loadTimelineRevisions(artifactId, identity, signal())
      await expect(loadTimelineRevisions(artifactId, identity, signal(), first)).rejects.toThrow()
      expect(count).toBe(1)
    })
  })
  test('opens only pinned objects and validates payload and manifest hashes', async () => {
    const snapshot = decodeTimelineWorkspace(JSON.stringify({ schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-11T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Historical snapshot' }, analystWorkspace: { mode: 'robust', events: [], questions: [], hypotheses: [] } }))
    const manifest = { objectId: 'browser-workspace', kind: 'timeline-workspace.v1', tombstone: false, versionId: 'version_old', contentHash: await hashContent({ schemaVersion: 'timeline-workspace.v1', tombstone: false, payload: snapshot }) }
    const revision = { ...summary(4), contentHash: await hashContent([manifest]) }
    const objects = { schemaVersion: 'timeline-object-page.v1', artifactId, revisionId: revision.revisionId, nextCursor: null, objects: [{ ...manifest, payload: snapshot }] }
    const urls: string[] = []
    await mocked(url => { urls.push(url); return reply(objects, '"rev_4"') }, async () => { expect(await openTimelineRevision(artifactId, revision, identity, signal())).toEqual(snapshot) })
    expect(urls).toHaveLength(1)
    const url = new URL(urls[0], 'https://test');expect(url.pathname).toBe(`/api/timelines/${artifactId}/objects`);expect(url.searchParams.get('revisionId')).toBe('rev_4');expect(url.searchParams.get('limit')).toBe('1')
    for (const bad of [
      { ...objects, revisionId: 'rev_5' },
      { ...objects, objects: [{ ...manifest, payload: { ...snapshot, exportedAt: '2026-09-12T12:00:00.000Z' } }] },
      { ...objects, objects: [{ ...manifest, versionId: 'version_wrong', payload: snapshot }] },
      { ...objects, nextCursor: 'unexpected' },
      { ...objects, objects: [] },
      { ...objects, objects: [{ ...manifest, tombstone: true, payload: snapshot }] },
      { ...objects, objects: [...objects.objects, { ...manifest, objectId: 'another', payload: snapshot }] },
    ]) {
      const requests: string[] = []
      await mocked(url => { requests.push(url); return reply(bad, '"rev_4"') }, async () => { await expect(openTimelineRevision(artifactId, revision, identity, signal())).rejects.toThrow() })
      expect(requests).toHaveLength(1);expect(new URL(requests[0], 'https://test').pathname).toBe(`/api/timelines/${artifactId}/objects`)
    }
    for (const objectCount of [0, 2]) {
      let requests = 0
      await mocked(() => { requests++; return reply(objects, '"rev_4"') }, async () => { await expect(openTimelineRevision(artifactId, { ...revision, objectCount }, identity, signal())).rejects.toThrow() })
      expect(requests).toBe(0)
    }
  })
})
