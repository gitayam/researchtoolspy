import { decodeTimelineWorkspace } from './timeline-workspace-codec'
import type { TimelineWorkspaceExport } from '@/types/timeline-workspace'
import { canonicalJson, decodeCursor, hashContent, isObjectId, validArtifactDocument, type ArtifactDocument } from '../../functions/api/_shared/timeline-artifact-contract'

export const SNAPSHOT_BYTES = 60 * 1024
const OBJECT_ID = 'browser-workspace'
export type DurableDocument = ArtifactDocument
export interface DurableIdentity { principalId: number; workspaceId: string; headers: Record<string, string> }
export interface TimelineRevisionSummary {
  revisionId: string
  sequence: number
  parentRevisionIds: string[]
  objectCount: number
  changeCount: number
  contentHash: string
  createdBy: number
  createdAt: string
}
export interface TimelineRevisionPage {
  headRevisionId: string
  revisions: TimelineRevisionSummary[]
  nextCursor: string | null
}
export interface SaveAttempt {
  snapshot: TimelineWorkspaceExport
  createKey: string
  commitKey: string
  artifact?: DurableDocument
  body: string
  identityBinding?: string
}
export class DurableTimelineError extends Error {
  readonly status: number
  constructor(message: string, status = 0) { super(message); this.name = 'DurableTimelineError'; this.status = status }
}
export const snapshotIdentity = (snapshot: TimelineWorkspaceExport) => canonicalJson(JSON.parse(JSON.stringify({ source: snapshot.source, analystWorkspace: snapshot.analystWorkspace })))

export function prepareTimelineSave(snapshot: TimelineWorkspaceExport, artifact?: DurableDocument): SaveAttempt {
  const decoded = decodeTimelineWorkspace(JSON.stringify(snapshot))
  if (new TextEncoder().encode(canonicalJson(decoded)).byteLength > SNAPSHOT_BYTES) throw new DurableTimelineError('Workspace saving supports timelines up to 60 KiB. Keep editing locally or export JSON; nothing has been uploaded.')
  const body = JSON.stringify({ schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: OBJECT_ID, kind: 'timeline-workspace.v1', payload: decoded }] })
  if (new TextEncoder().encode(body).byteLength > 65536) throw new DurableTimelineError('This timeline is too large to save. Export JSON to keep the complete workspace.')
  const title = decoded.analystWorkspace.narrative?.title || (decoded.source.schemaVersion === 'timeline-manual.v1' ? decoded.source.title : decoded.source.article.title)
  if (!title?.trim() || title.length > 200) throw new DurableTimelineError('Use a timeline title of 1–200 characters before saving.')
  return { snapshot: decoded, artifact, body, createKey: `browser-create-${crypto.randomUUID()}`, commitKey: `browser-save-${crypto.randomUUID()}` }
}
async function request(path: string, identity: DurableIdentity, signal: AbortSignal, init: RequestInit = {}) {
  if (!identity.workspaceId || identity.workspaceId === '1' || (!identity.headers.Authorization && !identity.headers['X-User-Hash']) || identity.headers['X-Guest-Session']) throw new DurableTimelineError('Sign in and choose a private workspace to save or open timelines.', 401)
  const response = await fetch(path, { ...init, signal, redirect: 'error', credentials: 'same-origin', headers: { ...identity.headers, 'Content-Type': 'application/json', 'X-Workspace-ID': identity.workspaceId, ...init.headers } })
  if (!response.ok) {
    const messages: Record<number, string> = { 401: 'Your session has expired. Sign in again; your open timeline is unchanged.', 403: 'You no longer have access to this private workspace.', 404: 'This saved timeline is unavailable or you do not have permission.', 409: 'This save conflicts with the stored timeline. Reopen the saved version or save a separate copy.', 412: 'Someone saved a newer revision. Your edits are still open. Export them before reopening the saved version, or save a separate copy.', 413: 'This timeline exceeds the workspace saving limit. Export JSON to keep it.' }
    void response.body?.cancel().catch(() => {})
    throw new DurableTimelineError(messages[response.status] || 'The workspace could not be reached. Retry the same save; your edits are still open.', response.status)
  }
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body) { void response.body?.cancel().catch(() => {}); throw new DurableTimelineError('The server returned an unreadable response. Your timeline is unchanged.') }
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let text = '', count = 0
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      count += value.byteLength
      if (count > 128 * 1024) throw new DurableTimelineError('The saved timeline response is too large.')
      text += decoder.decode(value, { stream: true })
    }
    return { body: JSON.parse(text + decoder.decode()) as unknown, etag: response.headers.get('etag') }
  } catch (error) { void reader.cancel().catch(() => {}); throw error } finally { reader.releaseLock() }
}
function metadata(value: unknown, etag: string | null, workspaceId: string, artifactId?: string): DurableDocument {
  if (!validArtifactDocument(value) || value.workspaceId !== workspaceId || (artifactId && value.artifactId !== artifactId) || etag !== `"${value.revisionId}"`) throw new DurableTimelineError('The saved timeline response did not match this workspace. Your timeline is unchanged.')
  return value
}
export async function saveTimelineAttempt(attempt: SaveAttempt, identity: DurableIdentity, signal: AbortSignal): Promise<DurableDocument> {
  if (!Number.isSafeInteger(identity.principalId) || identity.principalId <= 0) throw new DurableTimelineError('Sign in before saving.', 401)
  const binding = canonicalJson({ workspaceId: identity.workspaceId, principalId: identity.principalId })
  if (attempt.identityBinding && attempt.identityBinding !== binding) throw new DurableTimelineError('Your sign-in or workspace changed. Reopen the saved timeline before saving again.', 401)
  attempt.identityBinding = binding
  if (!attempt.artifact) {
    const title = attempt.snapshot.analystWorkspace.narrative?.title || (attempt.snapshot.source.schemaVersion === 'timeline-manual.v1' ? attempt.snapshot.source.title : attempt.snapshot.source.article.title)
    const reply = await request('/api/timelines', identity, signal, { method: 'POST', headers: { 'Idempotency-Key': attempt.createKey }, body: JSON.stringify({ schemaVersion: 'timeline-artifact-create.v1', workspaceId: identity.workspaceId, title }) })
    const artifact = metadata(reply.body, reply.etag, identity.workspaceId)
    if (artifact.sequence !== 0 || artifact.objectCount !== 0) throw new DurableTimelineError('The server did not return an empty new timeline.')
    attempt.artifact = artifact
  }
  if (attempt.artifact.workspaceId !== identity.workspaceId) throw new DurableTimelineError('Choose the original workspace before retrying this save.')
  const reply = await request(`/api/timelines/${attempt.artifact.artifactId}`, identity, signal, { method: 'PATCH', headers: { 'Idempotency-Key': attempt.commitKey, 'If-Match': `"${attempt.artifact.revisionId}"` }, body: attempt.body })
  const saved = metadata(reply.body, reply.etag, identity.workspaceId, attempt.artifact.artifactId)
  if (saved.sequence !== attempt.artifact.sequence + 1 || saved.objectCount !== 1) throw new DurableTimelineError('The saved revision did not match this save. Retry to recover its result.')
  return saved
}
export function savedTimelineLink(artifact: DurableDocument): string {
  return `${window.location.origin}/dashboard/tools/timeline?saved=${encodeURIComponent(artifact.artifactId)}&workspace=${encodeURIComponent(artifact.workspaceId)}`
}
export function parseSavedTimelineLink(value: string): { artifactId: string; workspaceId?: string } {
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin || url.pathname !== '/dashboard/tools/timeline') throw new Error()
    const artifactId = url.searchParams.get('saved')
    if (!isObjectId(artifactId)) throw new Error()
    return { artifactId, workspaceId: url.searchParams.get('workspace') || undefined }
  } catch { throw new DurableTimelineError('Paste a saved timeline link from this site.') }
}
export async function openSavedTimeline(artifactId: string, identity: DurableIdentity, signal: AbortSignal): Promise<{ artifact: DurableDocument; snapshot: TimelineWorkspaceExport }> {
  if (!isObjectId(artifactId)) throw new DurableTimelineError('The saved timeline link is invalid.')
  const reply = await request(`/api/timelines/${artifactId}`, identity, signal)
  const artifact = metadata(reply.body, reply.etag, identity.workspaceId, artifactId)
  const snapshot = await readBrowserSnapshot(artifactId, artifact, identity, signal)
  return { artifact, snapshot }
}
async function readBrowserSnapshot(artifactId: string, revision: { revisionId: string; objectCount: number; contentHash: string }, identity: DurableIdentity, signal: AbortSignal): Promise<TimelineWorkspaceExport> {
  if (revision.objectCount !== 1) throw new DurableTimelineError('This artifact does not contain a complete browser timeline.')
  const objects = await request(`/api/timelines/${artifactId}/objects?revisionId=${encodeURIComponent(revision.revisionId)}&limit=1`, identity, signal)
  const page = objects.body as { schemaVersion?: unknown; artifactId?: unknown; revisionId?: unknown; nextCursor?: unknown; objects?: Array<Record<string, unknown>> }
  if (!page || !exactKeys(page, ['schemaVersion', 'artifactId', 'revisionId', 'nextCursor', 'objects']) || page.schemaVersion !== 'timeline-object-page.v1' || page.artifactId !== artifactId || page.revisionId !== revision.revisionId || objects.etag !== `"${revision.revisionId}"` || page.nextCursor !== null || !Array.isArray(page.objects) || page.objects.length !== 1) throw new DurableTimelineError('The saved timeline returned an incomplete or mismatched revision.')
  const item = page.objects[0]
  if (!item || item.objectId !== OBJECT_ID || item.kind !== 'timeline-workspace.v1' || item.tombstone !== false || !isObjectId(item.versionId)) throw new DurableTimelineError('This artifact does not contain a supported browser timeline.')
  const snapshot = decodeTimelineWorkspace(JSON.stringify(item.payload))
  if (new TextEncoder().encode(canonicalJson(snapshot)).byteLength > SNAPSHOT_BYTES || await hashContent({ schemaVersion: item.kind, tombstone: false, payload: item.payload }) !== item.contentHash) throw new DurableTimelineError('The saved timeline failed its content check.')
  const { payload: _payload, ...manifest } = item
  if (Object.keys(manifest).sort().join(',') !== 'contentHash,kind,objectId,tombstone,versionId' || await hashContent([manifest]) !== revision.contentHash) throw new DurableTimelineError('The saved timeline failed its revision check.')
  return snapshot
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)))
}
function invalidHistory(): never { throw new DurableTimelineError('The saved revision history is incomplete or mismatched. Refresh history to try again.') }
function validSummary(value: unknown): value is TimelineRevisionSummary {
  if (!exactKeys(value, ['revisionId', 'sequence', 'parentRevisionIds', 'objectCount', 'changeCount', 'contentHash', 'createdBy', 'createdAt'])) return false
  if (!isObjectId(value.revisionId) || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 0
    || !Number.isSafeInteger(value.objectCount) || Number(value.objectCount) < 0 || Number(value.objectCount) > 1000
    || !Number.isSafeInteger(value.changeCount) || Number(value.changeCount) < 0 || Number(value.changeCount) > 10
    || !Number.isSafeInteger(value.createdBy) || Number(value.createdBy) <= 0
    || typeof value.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.contentHash)
    || !Array.isArray(value.parentRevisionIds) || value.parentRevisionIds.length !== (value.sequence === 0 ? 0 : 1)
    || value.parentRevisionIds.some(parent => !isObjectId(parent) || parent === value.revisionId)
    || typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)) return false
  const date = new Date(value.createdAt)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.createdAt) return false
  return value.sequence === 0 ? value.objectCount === 0 && value.changeCount === 0 : Number(value.changeCount) > 0
}
function validateRevisionPage(value: unknown, artifactId: string): asserts value is TimelineRevisionPage {
  if (!exactKeys(value, ['headRevisionId', 'revisions', 'nextCursor']) || !isObjectId(value.headRevisionId)
    || !Array.isArray(value.revisions) || value.revisions.length < 1 || value.revisions.length > 20) invalidHistory()
  const seen = new Set<string>()
  let previousSequence: number | undefined
  for (const revision of value.revisions) {
    if (!validSummary(revision) || seen.has(revision.revisionId) || (previousSequence !== undefined && revision.sequence >= previousSequence)) invalidHistory()
    seen.add(revision.revisionId); previousSequence = revision.sequence
  }
  if (value.nextCursor !== null) {
    if (typeof value.nextCursor !== 'string') invalidHistory()
    let cursor: Record<string, unknown>
    try { cursor = decodeCursor(value.nextCursor) } catch { invalidHistory() }
    if (!exactKeys(cursor, ['v', 'sort', 'artifactId', 'headRevisionId', 'before']) || cursor.v !== 1 || cursor.sort !== 'sequence-desc'
      || cursor.artifactId !== artifactId || cursor.headRevisionId !== value.headRevisionId || cursor.before !== previousSequence
      || !Number.isSafeInteger(cursor.before) || Number(cursor.before) <= 0) invalidHistory()
  } else if (previousSequence !== 0) invalidHistory()
}
export async function loadTimelineRevisions(artifactId: string, identity: DurableIdentity, signal: AbortSignal, previous?: TimelineRevisionPage): Promise<TimelineRevisionPage> {
  if (!isObjectId(artifactId)) invalidHistory()
  if (previous !== undefined) {
    validateRevisionPage(previous, artifactId)
    if (previous.nextCursor === null) invalidHistory()
  }
  const cursor = previous ? `&cursor=${encodeURIComponent(previous.nextCursor!)}` : ''
  const reply = await request(`/api/timelines/${artifactId}/revisions?limit=20${cursor}`, identity, signal)
  if (!exactKeys(reply.body, ['schemaVersion', 'artifactId', 'headRevisionId', 'revisions', 'nextCursor']) || reply.body.schemaVersion !== 'timeline-revision-page.v1' || reply.body.artifactId !== artifactId) invalidHistory()
  const page = { headRevisionId: reply.body.headRevisionId, revisions: reply.body.revisions, nextCursor: reply.body.nextCursor }
  validateRevisionPage(page, artifactId)
  if (reply.etag !== `"${page.headRevisionId}"`) invalidHistory()
  if (previous) {
    const last = previous.revisions[previous.revisions.length - 1].sequence
    const seen = new Set(previous.revisions.map(revision => revision.revisionId))
    if (page.headRevisionId !== previous.headRevisionId || page.nextCursor === previous.nextCursor || page.revisions.some(revision => revision.sequence >= last || seen.has(revision.revisionId))) invalidHistory()
  } else if (page.revisions[0].revisionId !== page.headRevisionId) invalidHistory()
  return page
}
export async function openTimelineRevision(artifactId: string, revision: TimelineRevisionSummary, identity: DurableIdentity, signal: AbortSignal): Promise<TimelineWorkspaceExport> {
  if (!isObjectId(artifactId) || !validSummary(revision)) invalidHistory()
  return readBrowserSnapshot(artifactId, revision, identity, signal)
}
