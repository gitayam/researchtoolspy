import { timelineDatePrecision } from './timeline-contract'
import { decodeTimelineWorkspace } from '../../../src/lib/timeline-workspace-codec'
import type { TimelineWorkspaceExport } from '../../../src/types/timeline-workspace'

export const ARTIFACT_LIMITS = { requestBytes: 65536, changes: 10, objects: 1000, pageSize: 100 } as const
export type ArtifactErrorCode = 'invalid_request' | 'authentication_required' | 'human_identity_required' | 'not_found' | 'access_denied' | 'precondition_required' | 'stale_revision' | 'idempotency_conflict' | 'object_conflict' | 'limit_exceeded' | 'datastore_unavailable'
export class ArtifactError extends Error {
  constructor(public readonly code: ArtifactErrorCode, public readonly status: number) { super(code); this.name = 'ArtifactError' }
}
export interface CandidatePayload { title: string; description: string | null; eventDate?: string; datePrecision?: 'year' | 'month' | 'day' }
export type ArtifactKind = 'event-candidate.v1' | 'timeline-workspace.v1'
export const WORKSPACE_SNAPSHOT_MAX_BYTES = 60 * 1024
export type ArtifactChange = { op: 'put'; objectId: string; kind: 'event-candidate.v1'; payload: CandidatePayload } | { op: 'put'; objectId: string; kind: 'timeline-workspace.v1'; payload: TimelineWorkspaceExport } | { op: 'delete'; objectId: string }
export interface CreateArtifact { schemaVersion: 'timeline-artifact-create.v1'; workspaceId: string; title: string }
export interface CommitArtifact { schemaVersion: 'timeline-artifact-commit.v1'; changes: ArtifactChange[] }
export interface ManifestEntry { objectId: string; versionId: string; kind: ArtifactKind; tombstone: boolean; contentHash: string }
export interface ArtifactDocument {
  schemaVersion: 'timeline-artifact.v1'; artifactId: string; workspaceId: string; title: string; branch: 'main';
  revisionId: string; sequence: number; objectCount: number; contentHash: string; createdBy: number; createdAt: string
}
export function validArtifactDocument(v: unknown): v is ArtifactDocument {
  if (!isRecord(v) || Object.keys(v).sort().join(',') !== 'artifactId,branch,contentHash,createdAt,createdBy,objectCount,revisionId,schemaVersion,sequence,title,workspaceId') return false
  return v.schemaVersion === 'timeline-artifact.v1' && isObjectId(v.artifactId) && isObjectId(v.revisionId) && isWorkspaceId(v.workspaceId)
    && title(v.title) && v.branch === 'main' && Number.isSafeInteger(v.sequence) && Number(v.sequence)>=0
    && Number.isSafeInteger(v.objectCount) && Number(v.objectCount)>=0 && Number(v.objectCount)<=ARTIFACT_LIMITS.objects
    && typeof v.contentHash==='string' && /^[a-f0-9]{64}$/.test(v.contentHash)
    && Number.isSafeInteger(v.createdBy) && Number(v.createdBy)>0
    && typeof v.createdAt==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.createdAt)
    && Number.isFinite(Date.parse(v.createdAt)) && new Date(v.createdAt).toISOString()===v.createdAt
}
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isObjectId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v)
export const isStableObjectId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(v)
export const isWorkspaceId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key))
const title = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200
export function validCandidate(v: unknown): v is CandidatePayload {
  return isRecord(v) && keys(v, ['title', 'description', 'eventDate', 'datePrecision']) && title(v.title)
    && (v.description === null || (typeof v.description === 'string' && v.description.length <= 2000))
    && (v.eventDate === undefined && v.datePrecision === undefined || (timelineDatePrecision(v.eventDate) !== null && timelineDatePrecision(v.eventDate) === v.datePrecision))
}
/** Validate with the same codec as local import; retain the submitted shape and hash. */
export function validArtifactPayload(kind: unknown, payload: unknown): boolean {
  if (kind === 'event-candidate.v1') return validCandidate(payload)
  if (kind !== 'timeline-workspace.v1') return false
  try {
    const serialized = canonicalJson(payload)
    if (new TextEncoder().encode(serialized).byteLength > WORKSPACE_SNAPSHOT_MAX_BYTES) return false
    decodeTimelineWorkspace(serialized)
    return true
  } catch { return false }
}
export function parseCreate(v: unknown): CreateArtifact {
  if (!isRecord(v) || !keys(v, ['schemaVersion', 'workspaceId', 'title']) || v.schemaVersion !== 'timeline-artifact-create.v1' || !isWorkspaceId(v.workspaceId) || !title(v.title)) throw new ArtifactError('invalid_request', 400)
  return v as unknown as CreateArtifact
}
export function parseCommit(v: unknown): CommitArtifact {
  if (!isRecord(v) || !keys(v, ['schemaVersion', 'changes']) || v.schemaVersion !== 'timeline-artifact-commit.v1' || !Array.isArray(v.changes) || v.changes.length < 1 || v.changes.length > ARTIFACT_LIMITS.changes) throw new ArtifactError('invalid_request', 400)
  const seen = new Set<string>()
  for (const c of v.changes) {
    if (!isRecord(c) || !isStableObjectId(c.objectId) || seen.has(c.objectId)) throw new ArtifactError('invalid_request', 400)
    seen.add(c.objectId)
    if (c.op === 'delete' && keys(c, ['op', 'objectId'])) continue
    if (c.op !== 'put' || !keys(c, ['op', 'objectId', 'kind', 'payload']) || !validArtifactPayload(c.kind,c.payload)) throw new ArtifactError('invalid_request', 400)
  }
  return v as unknown as CommitArtifact
}
export function idempotencyKey(request: Request): string {
  const key = request.headers.get('Idempotency-Key')
  if (!key || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(key)) throw new ArtifactError('invalid_request', 400)
  return key
}
export function expectedHead(request: Request): string {
  const value = request.headers.get('If-Match')
  if (value === null) throw new ArtifactError('precondition_required', 428)
  const match = /^"([A-Za-z0-9][A-Za-z0-9_-]{0,63})"$/.exec(value)
  if (!match) throw new ArtifactError('invalid_request', 400)
  return match[1]
}
export async function boundedBody(request: Request): Promise<unknown> {
  const length = request.headers.get('Content-Length')
  if (length && /^\d+$/.test(length) && Number(length) > ARTIFACT_LIMITS.requestBytes) { void request.body?.cancel().catch(() => {}); throw new ArtifactError('limit_exceeded', 413) }
  if (!request.body) throw new ArtifactError('invalid_request', 400)
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
  let bytes = 0, text = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > ARTIFACT_LIMITS.requestBytes) throw new ArtifactError('limit_exceeded', 413)
      text += decoder.decode(chunk.value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } catch (error) {
    void reader.cancel().catch(() => {})
    if (error instanceof ArtifactError) throw error
    throw new ArtifactError('invalid_request', 400)
  } finally { reader.releaseLock() }
}
/** Canonical JSON: sorted keys, array order retained, no undefined/nonfinite numbers. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  throw new ArtifactError('invalid_request', 400)
}
export async function hashContent(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function encodeCursor(value: Record<string, unknown>): string { return btoa(canonicalJson(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
export function decodeCursor(value: string): Record<string, unknown> {
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new ArtifactError('invalid_request', 400)
  try { const decoded = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/'))); if (isRecord(decoded)) return decoded } catch { /* invalid cursor */ }
  throw new ArtifactError('invalid_request', 400)
}
export function pageQuery(request: Request, allowed: string[]): { query: URLSearchParams; limit: number } {
  const query = new URL(request.url).searchParams
  for (const key of query.keys()) if (!allowed.includes(key) || query.getAll(key).length !== 1) throw new ArtifactError('invalid_request', 400)
  const raw = query.get('limit') ?? '50'
  if (!/^[1-9]\d{0,2}$/.test(raw) || Number(raw) > ARTIFACT_LIMITS.pageSize) throw new ArtifactError('invalid_request', 400)
  return { query, limit: Number(raw) }
}
export function artifactResponse(body: unknown, status = 200, revisionId?: string): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Authorization, X-User-Hash, X-Workspace-ID', ...(revisionId ? { ETag: `"${revisionId}"` } : {}) } })
}
export async function artifactRoute(action: () => Promise<Response>): Promise<Response> {
  try { return await action() } catch (error) {
    const known = error instanceof ArtifactError ? error : new ArtifactError('datastore_unavailable', 503)
    return artifactResponse({ schemaVersion: 'timeline-artifact-error.v1', requestId: `req-${crypto.randomUUID()}`, error: { code: known.code, retryable: known.status === 503 } }, known.status)
  }
}
