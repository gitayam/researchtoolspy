import { test, expect } from '@playwright/test'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import { prepareTimelineSave, openTimelineRevision, type TimelineRevisionSummary } from '../../../src/lib/timeline-durable'
import { canonicalJson, hashContent, validArtifactPayload } from '../../../functions/api/_shared/timeline-artifact-contract'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

function snapshot(interval = true): TimelineWorkspaceExport {
  return decodeTimelineWorkspace(JSON.stringify({
    schemaVersion: interval ? 'timeline-workspace.v2' : 'timeline-workspace.v1',
    exportedAt: '2026-09-14T12:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Private interval history' },
    analystWorkspace: { mode: 'basic', events: [{ id: 'repairs', title: 'Repairs', description: 'Recorded work period',
      category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false,
      eventDate: '2026-09-10', eventTime: '09:00', datePrecision: 'day',
      ...(interval ? { recordedEnd: { date: '2026-09-10', time: '17:30:59' } } : {}),
    }], questions: [], hypotheses: [] },
  }))
}

test.describe('Durable interval client contracts @smoke', () => {
  test('prepared requests retain exact endpoint precision and remain frozen across open edits', () => {
    const original = snapshot(), before = canonicalJson(original), attempt = prepareTimelineSave(original)
    const body = attempt.body, key = attempt.commitKey
    original.analystWorkspace.events[0].recordedEnd!.time = '18:00'
    expect(canonicalJson(attempt.snapshot)).toBe(before)
    expect(attempt.body).toBe(body)
    expect(attempt.commitKey).toBe(key)
    expect(JSON.parse(body).changes).toEqual([{ op: 'put', objectId: 'browser-workspace', kind: 'timeline-workspace.v2', payload: attempt.snapshot }])
    const single = prepareTimelineSave(snapshot(false))
    expect(JSON.parse(single.body).changes[0].kind).toBe('timeline-workspace.v1')
    expect(single.snapshot.analystWorkspace.events[0]).not.toHaveProperty('recordedEnd')
  })

  test('matching versions are required and UTF-8 snapshot limits still apply before upload', () => {
    const interval = snapshot(), legacy = snapshot(false)
    expect(validArtifactPayload('timeline-workspace.v2', interval)).toBe(true)
    expect(validArtifactPayload('timeline-workspace.v1', legacy)).toBe(true)
    for (const [kind, value] of [['timeline-workspace.v1', interval], ['timeline-workspace.v2', legacy], ['timeline-workspace.v3', interval]]) {
      expect(validArtifactPayload(kind, value)).toBe(false)
    }
    const tooLarge = snapshot()
    tooLarge.analystWorkspace.events = Array.from({ length: 20 }, (_, i) => ({ ...tooLarge.analystWorkspace.events[0], id: `event-${i}`, description: 'é'.repeat(2000) }))
    expect(() => decodeTimelineWorkspace(JSON.stringify(tooLarge))).not.toThrow()
    expect(new TextEncoder().encode(canonicalJson(tooLarge)).byteLength).toBeGreaterThan(60 * 1024)
    expect(validArtifactPayload('timeline-workspace.v2', tooLarge)).toBe(false)
    expect(() => prepareTimelineSave(tooLarge)).toThrow(/60 KiB/)
  })

  test('pinned v1 and v2 history reads preserve their own format and verify both hashes', async () => {
    const originalFetch = globalThis.fetch
    try {
      for (const interval of [false, true]) {
        const payload = snapshot(interval), kind = payload.schemaVersion
        const manifest = { objectId: 'browser-workspace', versionId: 'version_old', kind, tombstone: false, contentHash: await hashContent({ schemaVersion: kind, tombstone: false, payload }) }
        const revision: TimelineRevisionSummary = { revisionId: 'rev_old', sequence: 1, parentRevisionIds: ['rev_initial'], objectCount: 1, changeCount: 1, contentHash: await hashContent([manifest]), createdBy: 1, createdAt: '2026-09-14T12:00:00.000Z' }
        let corrupt: 'none' | 'payload' | 'revision' = 'none'
        const requested: string[] = []
        globalThis.fetch = (async (url: string | URL | Request) => {
          requested.push(String(url))
          const value = structuredClone(payload)
          if (corrupt === 'payload') value.analystWorkspace.events[0].title = 'Altered after hashing'
          return new Response(JSON.stringify({ schemaVersion: 'timeline-object-page.v1', artifactId: 'timeline_fixture', revisionId: 'rev_old', nextCursor: null, objects: [{ ...manifest, payload: value }] }), { headers: { 'Content-Type': 'application/json', ETag: '"rev_old"' } })
        }) as typeof fetch
        const read = () => openTimelineRevision('timeline_fixture', corrupt === 'revision' ? { ...revision, contentHash: '0'.repeat(64) } : revision, { principalId: 1, workspaceId: 'workspace_fixture', headers: { 'X-User-Hash': 'synthetic-owner-hash' } }, new AbortController().signal)
        expect(await read()).toEqual(payload)
        corrupt = 'payload'; await expect(read()).rejects.toThrow(/content check/)
        corrupt = 'revision'; await expect(read()).rejects.toThrow(/revision check/)
        expect(requested).toHaveLength(3)
        expect(requested.every(url => url.endsWith('/objects?revisionId=rev_old&limit=1'))).toBe(true)
      }
    } finally { globalThis.fetch = originalFetch }
  })
})
