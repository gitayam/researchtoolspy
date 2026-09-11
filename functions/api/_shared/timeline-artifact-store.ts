import { requireTimelineHuman, requireTimelineWorkspace, type HumanPrincipal, type TimelineArtifactEnv } from './timeline-artifact-auth'
import { ARTIFACT_LIMITS, ArtifactError, artifactResponse, boundedBody, canonicalJson, decodeCursor, encodeCursor, expectedHead, hashContent, idempotencyKey, isObjectId, isStableObjectId, pageQuery, parseCommit, parseCreate, validCandidate, validArtifactDocument, type ArtifactDocument, type ManifestEntry } from './timeline-artifact-contract'

interface ArtifactRow { workspace_id: string; id: string; title: string; created_by: number; created_at: string; head_revision_id: string }
interface RevisionRow { id: string; sequence: number; expected_head: string | null; object_count: number; change_count: number; content_hash: string; created_by: number; created_at: string }
interface VersionRow { object_id: string; version_id: string; schema_version: 'event-candidate.v1'; tombstone: number; content_hash: string; payload_json: string | null }
interface ReplayRow { request_hash: string; response_json: string; response_status: number; artifact_id: string; revision_id: string }
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
const manifestEntry = (row: VersionRow): ManifestEntry => ({ objectId: row.object_id, versionId: row.version_id, kind: row.schema_version, tombstone: row.tombstone === 1, contentHash: row.content_hash })
const versionSelect = `SELECT m.object_id,m.version_id,v.schema_version,v.tombstone,v.content_hash,v.payload_json
 FROM timeline_revision_objects m JOIN timeline_object_versions v
 ON v.workspace_id=m.workspace_id AND v.artifact_id=m.artifact_id AND v.object_id=m.object_id AND v.id=m.version_id`

async function access(request: Request, env: TimelineArtifactEnv, principal: HumanPrincipal, artifactId: string, write: boolean): Promise<ArtifactRow> {
  if (!isObjectId(artifactId)) throw new ArtifactError('invalid_request', 400)
  const artifact = await env.DB.prepare(`SELECT a.*,b.head_revision_id FROM timeline_artifacts a JOIN timeline_lineage_branches b
    ON b.workspace_id=a.workspace_id AND b.artifact_id=a.id AND b.name='main' WHERE a.id=?`).bind(artifactId).first<ArtifactRow>()
  if (!artifact) throw new ArtifactError('not_found', 404)
  const headerWorkspace = request.headers.get('X-Workspace-ID')
  if (headerWorkspace !== null && headerWorkspace !== artifact.workspace_id) throw new ArtifactError('access_denied', 403)
  try { await requireTimelineWorkspace(env, principal, artifact.workspace_id, write) } catch (error) {
    if (error instanceof ArtifactError && error.status === 403) throw new ArtifactError('not_found', 404)
    throw error
  }
  return artifact
}
async function revision(env: TimelineArtifactEnv, artifact: ArtifactRow, revisionId: string): Promise<RevisionRow> {
  if (!isObjectId(revisionId)) throw new ArtifactError('invalid_request', 400)
  const row = await env.DB.prepare('SELECT * FROM timeline_revisions WHERE workspace_id=? AND artifact_id=? AND id=?').bind(artifact.workspace_id,artifact.id,revisionId).first<RevisionRow>()
  if (!row) throw new ArtifactError('not_found', 404)
  return row
}
async function rows(env: TimelineArtifactEnv, artifact: ArtifactRow, revisionId: string): Promise<VersionRow[]> {
  const result = await env.DB.prepare(`${versionSelect} WHERE m.workspace_id=? AND m.artifact_id=? AND m.revision_id=? ORDER BY m.object_id LIMIT 1001`).bind(artifact.workspace_id,artifact.id,revisionId).all<VersionRow>()
  if (result.results.length > ARTIFACT_LIMITS.objects) throw new ArtifactError('datastore_unavailable', 503)
  return result.results
}
function document(artifact: ArtifactRow, rev: RevisionRow): ArtifactDocument {
  const result: ArtifactDocument = { schemaVersion: 'timeline-artifact.v1', artifactId: artifact.id, workspaceId: artifact.workspace_id, title: artifact.title, branch: 'main', revisionId: rev.id, sequence: rev.sequence, objectCount: rev.object_count, contentHash: rev.content_hash, createdBy: artifact.created_by, createdAt: artifact.created_at }
  if (!validArtifactDocument(result)) throw new ArtifactError('datastore_unavailable',503)
  return result
}
async function replay(env: TimelineArtifactEnv, user: HumanPrincipal, workspace: string, resource: string, key: string, fingerprint: string): Promise<Response | null> {
  // POST/PATCH replays require current write permission, even when they no longer write.
  await requireTimelineWorkspace(env,user,workspace,true)
  const saved = await env.DB.prepare('SELECT request_hash,response_json,response_status,artifact_id,revision_id FROM timeline_idempotency WHERE workspace_id=? AND principal_id=? AND resource=? AND request_key=?').bind(workspace,user.userId,resource,key).first<ReplayRow>()
  if (!saved) return null
  if (saved.request_hash !== fingerprint) throw new ArtifactError('idempotency_conflict', 409)
  let body: unknown
  try { if (saved.response_json.length>16384) throw new Error(); body=JSON.parse(saved.response_json) } catch { throw new ArtifactError('datastore_unavailable',503) }
  if (!validArtifactDocument(body) || body.artifactId!==saved.artifact_id || body.workspaceId!==workspace || body.revisionId!==saved.revision_id || (resource!=='create' && body.artifactId!==resource) || saved.response_status!==(resource==='create'?201:200)) throw new ArtifactError('datastore_unavailable',503)
  const artifact = await env.DB.prepare('SELECT * FROM timeline_artifacts WHERE workspace_id=? AND id=?').bind(workspace,saved.artifact_id).first<ArtifactRow>()
  if (!artifact || canonicalJson(document(artifact,await revision(env,artifact,saved.revision_id)))!==canonicalJson(body)) throw new ArtifactError('datastore_unavailable',503)
  return artifactResponse(saved.response_json,saved.response_status,saved.revision_id)
}
function recordReplay(env: TimelineArtifactEnv, user: HumanPrincipal, workspace: string, resource: string, key: string, fingerprint: string, result: ArtifactDocument, status: number) {
  return env.DB.prepare('INSERT INTO timeline_idempotency VALUES (?,?,?,?,?,?,?,?,?,?)').bind(workspace,user.userId,resource,key,fingerprint,result.artifactId,result.revisionId,JSON.stringify(result),status,new Date().toISOString())
}
function mapWriteError(error: unknown): never {
  const text = String(error)
  if (text.includes('timeline_authorization_denied')) throw new ArtifactError('access_denied', 403)
  if (text.includes('timeline_stale_head')) throw new ArtifactError('stale_revision', 412)
  if (text.includes('timeline_object_deleted')) throw new ArtifactError('object_conflict', 409)
  throw new ArtifactError('datastore_unavailable', 503)
}

export async function createTimelineArtifact(request: Request, env: TimelineArtifactEnv): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  pageQuery(request,[])
  const input = parseCreate(await boundedBody(request))
  const key = idempotencyKey(request)
  const headerWorkspace = request.headers.get('X-Workspace-ID')
  if (headerWorkspace !== null && headerWorkspace !== input.workspaceId) throw new ArtifactError('access_denied',403)
  const fingerprint = await hashContent({ operation: 'create.v1', input })
  const previous = await replay(env,user,input.workspaceId,'create',key,fingerprint)
  if (previous) return previous
  const now = new Date().toISOString()
  const artifact: ArtifactRow = { workspace_id: input.workspaceId, id: uid('timeline'), title: input.title, created_by: user.userId, created_at: now, head_revision_id: uid('rev') }
  const rev: RevisionRow = { id: artifact.head_revision_id, sequence: 0, expected_head: null, object_count: 0, change_count: 0, content_hash: await hashContent([]), created_by: user.userId, created_at: now }
  const result = document(artifact,rev)
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO timeline_artifacts VALUES (?,?,?,?,?)').bind(artifact.workspace_id,artifact.id,artifact.title,user.userId,now),
      env.DB.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,0,NULL,0,0,?,?,?)').bind(artifact.workspace_id,artifact.id,rev.id,rev.content_hash,user.userId,now),
      env.DB.prepare("INSERT INTO timeline_lineage_branches VALUES (?,?,'main',?)").bind(artifact.workspace_id,artifact.id,rev.id),
      recordReplay(env,user,artifact.workspace_id,'create',key,fingerprint,result,201),
    ])
  } catch (error) {
    const concurrent = await replay(env,user,input.workspaceId,'create',key,fingerprint)
    if (concurrent) return concurrent
    mapWriteError(error)
  }
  return artifactResponse(result,201,rev.id)
}

export async function commitTimelineArtifact(request: Request, env: TimelineArtifactEnv, artifactId: string): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  pageQuery(request,[])
  const artifact = await access(request,env,user,artifactId,true)
  const input = parseCommit(await boundedBody(request))
  const key = idempotencyKey(request), expected = expectedHead(request)
  const fingerprint = await hashContent({ operation: 'commit.v1', artifactId, expectedHead: expected, input })
  const previous = await replay(env,user,artifact.workspace_id,artifactId,key,fingerprint)
  if (previous) return previous
  if (artifact.head_revision_id !== expected) throw new ArtifactError('stale_revision',412)
  const beforeRevision = await revision(env,artifact,expected)
  const original = await rows(env,artifact,expected)
  const manifest = new Map(original.map(row => [row.object_id,manifestEntry(row)]))
  const now = new Date().toISOString(), revisionId = uid('rev')
  const versionStatements: D1PreparedStatement[] = [], changeStatements: D1PreparedStatement[] = []
  for (const change of input.changes) {
    const before = manifest.get(change.objectId)
    if (before?.tombstone || (change.op === 'delete' && !before)) throw new ArtifactError('object_conflict',409)
    if (!before) versionStatements.push(env.DB.prepare('INSERT INTO timeline_objects VALUES (?,?,?,?,?,?)').bind(artifact.workspace_id,artifactId,change.objectId,'event-candidate.v1',user.userId,now))
    const tombstone = change.op === 'delete'
    const payload = change.op === 'put' ? change.payload : null
    const versionId = uid('version')
    const contentHash = await hashContent({ schemaVersion: 'event-candidate.v1', tombstone, payload })
    manifest.set(change.objectId,{ objectId: change.objectId, versionId, kind: 'event-candidate.v1', tombstone, contentHash })
    versionStatements.push(env.DB.prepare('INSERT INTO timeline_object_versions VALUES (?,?,?,?,?,?,?,?,?,?)').bind(artifact.workspace_id,artifactId,change.objectId,versionId,'event-candidate.v1',Number(tombstone),payload === null ? null : canonicalJson(payload),contentHash,user.userId,now))
    changeStatements.push(env.DB.prepare('INSERT INTO timeline_revision_changes VALUES (?,?,?,?,?,?,?)').bind(artifact.workspace_id,artifactId,revisionId,change.objectId,tombstone ? 'tombstone' : before ? 'revise' : 'create',before?.versionId ?? null,versionId))
  }
  if (manifest.size > ARTIFACT_LIMITS.objects) throw new ArtifactError('limit_exceeded',409)
  const entries = [...manifest.values()].sort((a,b) => a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0)
  const rev: RevisionRow = { id: revisionId, sequence: beforeRevision.sequence+1, expected_head: expected, object_count: entries.length, change_count: input.changes.length, content_hash: await hashContent(entries), created_by: user.userId, created_at: now }
  const result = document(artifact,rev)
  try {
    await env.DB.batch([
      // The trigger validates auth and expected head before any version/object writes.
      env.DB.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,?,?,?,?,?,?,?)').bind(artifact.workspace_id,artifactId,revisionId,rev.sequence,expected,rev.object_count,rev.change_count,rev.content_hash,user.userId,now),
      env.DB.prepare('INSERT INTO timeline_revision_parents VALUES (?,?,?,?,0)').bind(artifact.workspace_id,artifactId,revisionId,expected),
      ...versionStatements,
      // One bound JSON manifest avoids one statement per unchanged object.
      env.DB.prepare(`INSERT INTO timeline_revision_objects SELECT ?,?,?,json_extract(value,'$.objectId'),json_extract(value,'$.versionId') FROM json_each(?)`).bind(artifact.workspace_id,artifactId,revisionId,JSON.stringify(entries)),
      ...changeStatements,
      env.DB.prepare("UPDATE timeline_lineage_branches SET head_revision_id=? WHERE workspace_id=? AND artifact_id=? AND name='main'").bind(revisionId,artifact.workspace_id,artifactId),
      recordReplay(env,user,artifact.workspace_id,artifactId,key,fingerprint,result,200),
    ])
  } catch (error) {
    const concurrent = await replay(env,user,artifact.workspace_id,artifactId,key,fingerprint)
    if (concurrent) return concurrent
    // A UNIQUE sequence/no-replace guard may fire before the CAS trigger in a race.
    const current = await env.DB.prepare("SELECT head_revision_id FROM timeline_lineage_branches WHERE workspace_id=? AND artifact_id=? AND name='main'").bind(artifact.workspace_id,artifactId).first<{ head_revision_id: string }>()
    if (current && current.head_revision_id !== expected) throw new ArtifactError('stale_revision',412)
    mapWriteError(error)
  }
  return artifactResponse(result,200,revisionId)
}

export async function readTimelineArtifact(request: Request, env: TimelineArtifactEnv, artifactId: string): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  pageQuery(request,[])
  const artifact = await access(request,env,user,artifactId,false)
  const rev = await revision(env,artifact,artifact.head_revision_id)
  return artifactResponse(document(artifact,rev),200,rev.id)
}
function objectDocument(row: VersionRow) {
  let payload: unknown = null
  if (row.tombstone !== 1) {
    try { payload = JSON.parse(row.payload_json ?? '') } catch { throw new ArtifactError('datastore_unavailable',503) }
    if (!validCandidate(payload)) throw new ArtifactError('datastore_unavailable',503)
  }
  return { ...manifestEntry(row), payload }
}
export async function readTimelineObjects(request: Request, env: TimelineArtifactEnv, artifactId: string): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  const artifact = await access(request,env,user,artifactId,false)
  const { query,limit } = pageQuery(request,['limit','cursor','revisionId'])
  let revisionId = query.get('revisionId') ?? artifact.head_revision_id, after = ''
  if (query.has('cursor')) {
    const cursor = decodeCursor(query.get('cursor')!)
    if (Object.keys(cursor).sort().join(',') !== 'after,artifactId,revisionId,sort,v' || cursor.v !== 1 || cursor.sort !== 'object-id-asc' || cursor.artifactId !== artifactId || !isObjectId(cursor.revisionId) || !isStableObjectId(cursor.after) || (query.has('revisionId') && query.get('revisionId') !== cursor.revisionId)) throw new ArtifactError('invalid_request',400)
    revisionId = cursor.revisionId; after = cursor.after
  }
  await revision(env,artifact,revisionId)
  const result = await env.DB.prepare(`${versionSelect} WHERE m.workspace_id=? AND m.artifact_id=? AND m.revision_id=? AND m.object_id>? ORDER BY m.object_id LIMIT ?`).bind(artifact.workspace_id,artifactId,revisionId,after,limit+1).all<VersionRow>()
  const page = result.results.slice(0,limit)
  const nextCursor = result.results.length > limit ? encodeCursor({ v: 1, sort: 'object-id-asc', artifactId, revisionId, after: page[page.length-1].object_id }) : null
  return artifactResponse({ schemaVersion: 'timeline-object-page.v1', artifactId, revisionId, objects: page.map(objectDocument), nextCursor },200,revisionId)
}
export async function readTimelineRevisions(request: Request, env: TimelineArtifactEnv, artifactId: string): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  const artifact = await access(request,env,user,artifactId,false)
  const {query,limit} = pageQuery(request,['limit','cursor'])
  let pinnedHead = artifact.head_revision_id, before: number | undefined
  if (query.has('cursor')) {
    const cursor = decodeCursor(query.get('cursor')!)
    if (Object.keys(cursor).sort().join(',') !== 'artifactId,before,headRevisionId,sort,v' || cursor.v !== 1 || cursor.sort !== 'sequence-desc' || cursor.artifactId !== artifactId || !isObjectId(cursor.headRevisionId) || !Number.isSafeInteger(cursor.before) || Number(cursor.before)<0) throw new ArtifactError('invalid_request',400)
    pinnedHead=cursor.headRevisionId; before=Number(cursor.before)
  }
  const head = await revision(env,artifact,pinnedHead)
  if (before !== undefined && before>head.sequence) throw new ArtifactError('invalid_request',400)
  const result = await env.DB.prepare('SELECT * FROM timeline_revisions WHERE workspace_id=? AND artifact_id=? AND sequence<=? AND sequence<? ORDER BY sequence DESC LIMIT ?').bind(artifact.workspace_id,artifactId,head.sequence,before ?? head.sequence+1,limit+1).all<RevisionRow>()
  const page = result.results.slice(0,limit)
  return artifactResponse({ schemaVersion: 'timeline-revision-page.v1', artifactId, headRevisionId: pinnedHead, revisions: page.map(row => ({ revisionId: row.id, sequence: row.sequence, parentRevisionIds: row.expected_head ? [row.expected_head] : [], objectCount: row.object_count, changeCount: row.change_count, contentHash: row.content_hash, createdBy: row.created_by, createdAt: row.created_at })), nextCursor: result.results.length>limit ? encodeCursor({ v: 1, sort: 'sequence-desc', artifactId, headRevisionId: pinnedHead, before: page[page.length-1].sequence }) : null },200,pinnedHead)
}
export async function readTimelineRevision(request: Request, env: TimelineArtifactEnv, artifactId: string, revisionId: string): Promise<Response> {
  const user = await requireTimelineHuman(request,env)
  pageQuery(request,[])
  const artifact = await access(request,env,user,artifactId,false)
  const rev = await revision(env,artifact,revisionId)
  const manifest = (await rows(env,artifact,revisionId)).map(manifestEntry)
  if (manifest.length !== rev.object_count || await hashContent(manifest) !== rev.content_hash) throw new ArtifactError('datastore_unavailable',503)
  const changes = await env.DB.prepare('SELECT object_id,operation,before_version_id,after_version_id FROM timeline_revision_changes WHERE workspace_id=? AND artifact_id=? AND revision_id=? ORDER BY object_id LIMIT 11').bind(artifact.workspace_id,artifactId,revisionId).all<{ object_id: string; operation: string; before_version_id: string | null; after_version_id: string }>()
  if (changes.results.length !== rev.change_count) throw new ArtifactError('datastore_unavailable',503)
  return artifactResponse({ schemaVersion: 'timeline-revision.v1', artifactId, workspaceId: artifact.workspace_id, revisionId, sequence: rev.sequence, parentRevisionIds: rev.expected_head ? [rev.expected_head] : [], contentHash: rev.content_hash, createdBy: rev.created_by, createdAt: rev.created_at, manifest, changes: changes.results.map(row => ({ objectId: row.object_id, operation: row.operation, beforeVersionId: row.before_version_id, afterVersionId: row.after_version_id })) },200,revisionId)
}
