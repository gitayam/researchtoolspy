/** Run only in the qualified credential-free, network-disabled release validator. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, stat, mkdir, writeFile, realpath } from 'node:fs/promises'
import { dirname, resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Miniflare, Response as MFResponse } from 'miniflare'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = resolve(root, 'dist')
const workerPath = resolve(dist, '_worker.js/index.js')
const migrationDirectory = resolve(root, 'schema/managed-migrations')
const outputDirectory = '/results'
const manifestPath = resolve(outputDirectory, 'release-schema-manifest.json')
const pendingName = '0011_timeline_foundation.sql'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const quote = value => `"${String(value).replaceAll('"', '""')}"`
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

/** Lexical SQL splitter: quoted/commented semicolons and trigger BEGIN/CASE survive. */
function statements(sql) {
  const result = []
  let start = 0, token = '', words = [], trigger = false, depth = 0, quoted = '', lineComment = false, blockComment = false
  const flush = () => {
    if (!token) return
    const word = token.toUpperCase()
    words.push(word)
    if (words[0] === 'CREATE' && word === 'TRIGGER') trigger = true
    if (trigger && (word === 'BEGIN' || word === 'CASE')) depth++
    if (trigger && word === 'END') depth--
    token = ''
  }
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1]
    if (lineComment) { if (c === '\n') lineComment = false; continue }
    if (blockComment) { if (c === '*' && next === '/') { blockComment = false; i++ }; continue }
    if (quoted) { if (c === quoted) { if (next === quoted && quoted !== ']') i++; else quoted = '' }; continue }
    if (c === '-' && next === '-') { flush(); lineComment = true; i++; continue }
    if (c === '/' && next === '*') { flush(); blockComment = true; i++; continue }
    if (['\'', '"', '`', '['].includes(c)) { flush(); quoted = c === '[' ? ']' : c; continue }
    if (/[A-Za-z_]/.test(c)) { token += c; continue }
    flush()
    if (c === ';' && (!trigger || depth === 0)) {
      if (words.length) result.push({ sql: sql.slice(start, i + 1).trim(), words })
      start = i + 1; words = []; trigger = false; depth = 0
    }
  }
  flush()
  assert(!quoted && !blockComment && depth === 0, 'Unterminated SQL in release input')
  if (words.length) result.push({ sql: sql.slice(start).trim(), words })
  return result
}
function appliedNames(input) {
  // Supports a plain names array, {name} rows, and Wrangler's results envelope.
  if (Array.isArray(input)) return input.flatMap(appliedNames)
  if (typeof input === 'string') return [input]
  if (input && typeof input === 'object' && Array.isArray(input.results)) return appliedNames(input.results)
  if (input && typeof input === 'object' && typeof input.name === 'string') return [input.name]
  throw new Error('Migration inventory must contain actual applied names, not pending/status output')
}
async function inputFile(environmentName, maxBytes) {
  const path = process.env[environmentName]
  assert(path, `${environmentName} is required`)
  const metadata = await stat(path)
  assert(metadata.isFile() && metadata.size > 0 && metadata.size <= maxBytes, `${environmentName} must be a bounded nonempty file`)
  return await readFile(path)
}
async function collectManifest(db, tableNames) {
  const tables = []
  for (const name of tableNames) {
    const table = await db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").bind(name).first()
    assert(table?.sql, `Missing affected table ${name}`)
    const columns = (await db.prepare(`PRAGMA table_info(${quote(name)})`).all()).results
    const foreignKeys = (await db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all()).results
    const indexRows = (await db.prepare(`PRAGMA index_list(${quote(name)})`).all()).results
    const indexes = []
    for (const index of indexRows.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const definition = await db.prepare("SELECT sql FROM sqlite_schema WHERE type='index' AND name=?").bind(index.name).first()
      indexes.push({ name: index.name, unique: index.unique, origin: index.origin, partial: index.partial, columns: (await db.prepare(`PRAGMA index_info(${quote(index.name)})`).all()).results, sql: definition?.sql ?? null })
    }
    const triggers = (await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND tbl_name=? ORDER BY name").bind(name).all()).results
    tables.push({ name, sql: table.sql, columns, foreignKeys, indexes, triggers })
  }
  return tables
}
async function seedRow(db, table, values) {
  const columns = (await db.prepare(`PRAGMA table_info(${quote(table)})`).all()).results
  assert(columns.length, `Production schema is missing ${table}`)
  for (const column of columns) {
    const supplied = Object.hasOwn(values, column.name)
    assert(supplied || !column.notnull || column.dflt_value !== null || (column.pk && column.type.toUpperCase() === 'INTEGER'), `Synthetic seed needs an explicit value for ${table}.${column.name}`)
  }
  const selected = columns.filter(column => Object.hasOwn(values, column.name)).map(column => column.name)
  await db.prepare(`INSERT INTO ${quote(table)} (${selected.map(quote).join(',')}) VALUES (${selected.map(() => '?').join(',')})`).bind(...selected.map(name => values[name])).run()
}
const token = { owner: 'synthetic-release-owner-hash-001', viewer: 'synthetic-release-viewer-hash-002', other: 'synthetic-release-other-hash-003' }
async function seed(db) {
  const now = '2026-09-11T00:00:00.000Z'
  for (const [index, name] of ['owner', 'viewer', 'other'].entries()) await seedRow(db, 'users', {
    id: 880001 + index, username: `timeline_release_${name}`, email: `timeline-release-${name}@example.invalid`, full_name: `Synthetic release ${name}`, hashed_password: 'SYNTHETIC_NOT_FOR_LOGIN', user_hash: token[name], account_hash: null, is_active: 1, is_verified: 1, role: 'researcher', created_at: now, updated_at: now,
  })
  await seedRow(db, 'workspaces', { id: 'release-workspace-a', name: 'Synthetic release A', description: 'Disposable schema rehearsal', owner_id: 880001, type: 'PERSONAL', is_public: 0, allow_cloning: 0, created_at: now, updated_at: now })
  await seedRow(db, 'workspaces', { id: 'release-workspace-b', name: 'Synthetic release B', description: 'Disposable schema rehearsal', owner_id: 880003, type: 'PERSONAL', is_public: 0, allow_cloning: 0, created_at: now, updated_at: now })
  await seedRow(db, 'workspace_members', { id: 'release-viewer-membership', workspace_id: 'release-workspace-a', user_id: 880002, role: 'VIEWER', joined_at: now, created_at: now, updated_at: now })
}
function assertArtifact(body) {
  assert.equal(body?.schemaVersion, 'timeline-artifact.v1')
  assert.match(body.artifactId, /^timeline_[A-Za-z0-9_-]+$/)
  assert.match(body.revisionId, /^rev_[A-Za-z0-9_-]+$/)
  assert.equal(body.workspaceId, 'release-workspace-a')
  assert.equal(body.branch, 'main')
  assert.equal(body.createdBy, 880001)
  assert(Number.isSafeInteger(body.sequence) && body.sequence >= 0)
  assert(Number.isSafeInteger(body.objectCount) && body.objectCount >= 0 && body.objectCount <= 1000)
  assert.match(body.contentHash, /^[a-f0-9]{64}$/)
  assert.equal(new Date(body.createdAt).toISOString(), body.createdAt)
}
async function save(receipt) { await writeFile(manifestPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 }) }

let mf, receipt, stage = 'read-inputs', outboundAttempts = 0
try {
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  const schemaBytes = await inputFile('TIMELINE_RELEASE_SCHEMA', 32 * 1024 * 1024)
  const inventoryBytes = await inputFile('TIMELINE_RELEASE_MIGRATIONS', 1024 * 1024)
  const applied = appliedNames(JSON.parse(inventoryBytes.toString('utf8')))
  assert.equal(new Set(applied).size, applied.length, 'Duplicate applied migration names')
  assert(applied.every(name => /^[A-Za-z0-9_.-]+\.sql$/.test(name)), 'Invalid applied migration name')
  const localNames = (await readdir(migrationDirectory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()
  const pending = localNames.filter(name => !applied.includes(name))
  assert.deepEqual(pending, [pendingName], 'Release must rehearse exactly the reviewed pending 0011 migration')
  const migrationBytes = await readFile(resolve(migrationDirectory, pendingName))
  const workerBytes = await readFile(workerPath)
  const indexBytes = await readFile(resolve(dist, 'index.html'))
  const expectedTables = [...migrationBytes.toString('utf8').matchAll(/CREATE TABLE (timeline_[a-z_]+)/g)].map(match => match[1]).sort()
  assert.equal(expectedTables.length, 9, 'Unexpected affected table inventory in pending migration')
  receipt = {
    schemaVersion: 'timeline-release-schema-manifest.v1',
    schemaOnly: true,
    schemaSha256: sha256(schemaBytes), appliedInventorySha256: sha256(inventoryBytes),
    appliedMigrationNames: applied.slice().sort(), pendingMigrations: [{ name: pendingName, sha256: sha256(migrationBytes) }],
    compiledWorker: { entrypoint: 'dist/_worker.js/index.js', sha256: sha256(workerBytes) },
    staticIndexSha256: sha256(indexBytes), compatibilityDate: '2025-09-30', compatibilityFlags: ['nodejs_compat'],
    importedStatements: 0, skippedSchemaDirectives: [], tables: [],
    schemaRehearsal: 'pending', compiledHttpGate: 'pending', staticGate: 'pending', checks: [],
    limitation: 'Production schema only, seeded synthetic principals; no production rows, credentials, network, application deployment, or production mutation. ASSETS is a confined local filesystem stand-in, not the Cloudflare edge asset service.',
  }
  const staticRoot = await realpath(dist)
  const staticService = async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new MFResponse('Method not allowed', { status: 405 })
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    if (/^\/(?:api(?:\/|$)|_worker\.js(?:\/|$)|_routes\.json|_headers|_redirects)/.test(pathname)) return new MFResponse('Not found', { status: 404 })
    let path = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (path !== staticRoot && !path.startsWith(`${staticRoot}${sep}`)) return new MFResponse('Not found', { status: 404 })
    try { if (!(await stat(path)).isFile()) path = resolve(dist, 'index.html') } catch { if (extname(path)) return new MFResponse('Not found', { status: 404 }); path = resolve(dist, 'index.html') }
    const resolved = await realpath(path)
    if (!resolved.startsWith(`${staticRoot}${sep}`)) return new MFResponse('Not found', { status: 404 })
    const data = await readFile(resolved)
    const mime = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(path)] ?? 'application/octet-stream'
    return new MFResponse(request.method === 'HEAD' ? null : data, { headers: { 'Content-Type': mime } })
  }
  stage = 'start-compiled-worker'
  mf = new Miniflare({
    modules: true, scriptPath: workerPath, modulesRoot: dirname(workerPath),
    compatibilityDate: receipt.compatibilityDate, compatibilityFlags: receipt.compatibilityFlags,
    d1Databases: { DB: 'timeline-production-schema-rehearsal' },
    serviceBindings: { ASSETS: staticService },
    outboundService: async () => { outboundAttempts++; return new MFResponse('External network disabled in release rehearsal', { status: 502 }) },
    bindings: { ENVIRONMENT: 'production', COMMUNITY_INTEGRATIONS_ENABLED: 'false', ENABLE_AI_FEATURES: 'false' },
  })
  const db = await mf.getD1Database('DB')
  stage = 'import-production-schema'
  for (const statement of statements(schemaBytes.toString('utf8'))) {
    const [first, second] = statement.words
    if (['BEGIN', 'COMMIT', 'END'].includes(first)) { receipt.skippedSchemaDirectives.push(first); continue }
    if (first === 'PRAGMA' && ['FOREIGN_KEYS', 'DEFER_FOREIGN_KEYS'].includes(second)) { receipt.skippedSchemaDirectives.push(`${first} ${second}`); continue }
    // A schema export must not contain rows, DELETEs or arbitrary executable SQL.
    assert(first === 'CREATE' && ['TABLE', 'INDEX', 'UNIQUE', 'TRIGGER', 'VIEW', 'VIRTUAL'].includes(second), `Schema-only input contains unsupported ${first} ${second ?? ''}`)
    await db.prepare(statement.sql).run()
    receipt.importedStatements++
  }
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name LIKE 'timeline_%'").first()).n, 0, 'Production export already contains timeline schema despite pending tracker state')
  stage = 'apply-pending-0011'
  for (const statement of statements(migrationBytes.toString('utf8'))) await db.prepare(statement.sql).run()
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [], 'Imported schema has foreign-key violations')
  receipt.tables = await collectManifest(db, expectedTables)
  assert(receipt.tables.every(table => table.columns.length && table.foreignKeys.length && table.triggers.length), 'Incomplete affected-schema manifest')
  receipt.schemaRehearsal = 'passed'
  receipt.checks.push('schema-only export imported', 'actual pending migration applied', 'foreign_key_check clean', 'affected columns/foreign keys/indexes/triggers recorded')
  await save(receipt)

  stage = 'seed-synthetic-humans'
  await seed(db)
  const request = async (path, { method = 'GET', body, key, etag, user = 'owner', extraHeaders = {} } = {}) => {
    const response = await mf.dispatchFetch(`https://researchtools.example${path}`, {
      method, headers: { ...(user ? { 'X-User-Hash': token[user] } : {}), 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}), ...(etag ? { 'If-Match': etag } : {}), ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
    })
    const text = await response.text()
    let json
    try { json = JSON.parse(text) } catch { /* Static or incorrectly routed response; caller asserts. */ }
    return { status: response.status, headers: response.headers, text, json }
  }
  const error = (result, status, code) => { assert.equal(result.status, status); assert.equal(result.json?.schemaVersion, 'timeline-artifact-error.v1'); assert.equal(result.json.error.code, code); assert.equal(typeof result.json.error.retryable, 'boolean'); assert(!/INSERT|SELECT|SQLITE|D1_ERROR/.test(result.text), 'Internal SQL leaked') }
  const createBody = { schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'release-workspace-a', title: 'Production-schema rehearsal' }
  const payload = { schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'event:release.001', kind: 'event-candidate.v1', payload: { title: 'Synthetic candidate', description: null, eventDate: '2026-09', datePrecision: 'month' } }] }
  stage = 'compiled-http-create-auth'
  error(await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001', user: null }), 401, 'authentication_required')
  error(await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001', extraHeaders: { Authorization: 'Bearer rt_svc_synthetic_rejected' } }), 403, 'human_identity_required')
  const create = await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001' })
  assert.equal(create.status, 201); assertArtifact(create.json)
  assert.equal(create.json.sequence, 0); assert.equal(create.json.objectCount, 0)
  assert.equal(create.headers.get('etag'), `"${create.json.revisionId}"`)
  const artifactPath = `/api/timelines/${create.json.artifactId}`
  error(await request(artifactPath, { user: 'other' }), 404, 'not_found')
  assert.equal((await request(artifactPath, { user: 'viewer' })).status, 200)
  error(await request(artifactPath, { method: 'PATCH', body: payload, key: 'release-viewer-key1', etag: create.headers.get('etag'), user: 'viewer' }), 404, 'not_found')
  stage = 'compiled-http-commit-replay-history'
  const first = await request(artifactPath, { method: 'PATCH', body: payload, key: 'release-commit-001', etag: create.headers.get('etag') })
  assert.equal(first.status, 200); assertArtifact(first.json); assert.equal(first.json.sequence, 1); assert.equal(first.json.objectCount, 1)
  const nextPayload = { ...payload, changes: [{ ...payload.changes[0], payload: { ...payload.changes[0].payload, title: 'Revised synthetic candidate' } }] }
  const next = await request(artifactPath, { method: 'PATCH', body: nextPayload, key: 'release-commit-002', etag: first.headers.get('etag') })
  assert.equal(next.status, 200); assertArtifact(next.json)
  const retry = await request(artifactPath, { method: 'PATCH', body: payload, key: 'release-commit-001', etag: create.headers.get('etag') })
  assert.equal(retry.status, 200); assert.equal(retry.text, first.text); assert.equal(retry.headers.get('etag'), first.headers.get('etag'))
  const createRetry = await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001' })
  assert.equal(createRetry.status, 201); assert.equal(createRetry.text, create.text)
  error(await request(artifactPath, { method: 'PATCH', body: nextPayload, key: 'release-commit-001', etag: create.headers.get('etag') }), 409, 'idempotency_conflict')
  error(await request(artifactPath, { method: 'PATCH', body: payload, key: 'release-stale-0001', etag: create.headers.get('etag') }), 412, 'stale_revision')
  const before = await request(`${artifactPath}/objects?revisionId=${first.json.revisionId}`)
  assert.equal(before.status, 200); assert.equal(before.json.schemaVersion, 'timeline-object-page.v1')
  assert.equal(before.json.objects[0].payload.title, 'Synthetic candidate'); assert.equal(before.json.objects[0].payload.datePrecision, 'month')
  const detail = await request(`${artifactPath}/revisions/${first.json.revisionId}`)
  assert.equal(detail.status, 200); assert.equal(detail.json.schemaVersion, 'timeline-revision.v1')
  assert.equal(sha256(canonical(detail.json.manifest)), detail.json.contentHash)
  assert.deepEqual(detail.json.parentRevisionIds, [create.json.revisionId])
  const history = await request(`${artifactPath}/revisions?limit=1`)
  assert.equal(history.status, 200); assert.equal(history.json.schemaVersion, 'timeline-revision-page.v1'); assert(history.json.nextCursor)
  const historyNext = await request(`${artifactPath}/revisions?cursor=${history.json.nextCursor}`)
  assert.equal(historyNext.status, 200); assert.equal(historyNext.json.headRevisionId, next.json.revisionId)
  assert.deepEqual(historyNext.json.revisions.map(row => row.sequence), [1, 0])
  assert.equal((await db.prepare('SELECT count(*) AS n FROM timeline_revisions').first()).n, 3)

  stage = 'production-schema-atomic-rollback'
  const countBefore = (await db.prepare('SELECT count(*) AS n FROM timeline_revisions').first()).n
  const failureRevision = 'rev_release_rollback'
  await assert.rejects(db.batch([
    db.prepare('INSERT INTO timeline_revisions VALUES (?,?,?,?,?,1,1,?,?,?)').bind('release-workspace-a', create.json.artifactId, failureRevision, 3, next.json.revisionId, '0'.repeat(64), 880001, '2026-09-11T00:00:00.000Z'),
    db.prepare('INSERT INTO timeline_revision_parents VALUES (?,?,?,?,0)').bind('release-workspace-a', create.json.artifactId, failureRevision, next.json.revisionId),
    db.prepare('INSERT INTO timeline_artifacts SELECT * FROM timeline_artifacts WHERE id=?').bind(create.json.artifactId),
  ]), /timeline_immutable/)
  assert.equal((await db.prepare('SELECT count(*) AS n FROM timeline_revisions').first()).n, countBefore)
  assert.equal((await db.prepare('SELECT count(*) AS n FROM timeline_revision_parents WHERE revision_id=?').bind(failureRevision).first()).n, 0)
  assert.equal((await request(artifactPath)).headers.get('etag'), next.headers.get('etag'))
  await assert.rejects(db.prepare('INSERT OR REPLACE INTO timeline_revisions SELECT * FROM timeline_revisions LIMIT 1').run(), /timeline_immutable/)
  await db.prepare("UPDATE workspaces SET is_public=1 WHERE id='release-workspace-a'").run()
  error(await request(artifactPath), 404, 'not_found')
  error(await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001' }), 403, 'access_denied')
  await db.prepare("UPDATE workspaces SET is_public=0 WHERE id='release-workspace-a'").run()
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
  receipt.compiledHttpGate = 'passed'
  receipt.checks.push('compiled Pages create/commit routes', 'human/service/viewer/cross-workspace authorization', 'exact replay after later revision', 'idempotency conflict and stale head', 'pinned object/history reads and manifest hash', 'real D1 partial-batch rollback', 'immutable replacement rejected', 'privacy change reauthorizes read/replay')
  await save(receipt)

  stage = 'compiled-static-fallback'
  const home = await request('/', { user: null })
  assert.equal(home.status, 200); assert.equal(sha256(home.text), sha256(indexBytes))
  const timeline = await request('/dashboard/tools/timeline', { user: null })
  assert.equal(timeline.status, 200); assert.equal(sha256(timeline.text), sha256(indexBytes))
  const assetPath = /(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/.exec(indexBytes.toString('utf8'))?.[1]
  assert(assetPath, 'Built index did not reference a testable asset')
  const asset = await request(assetPath, { user: null })
  assert.equal(asset.status, 200); assert.equal(sha256(asset.text), sha256(await readFile(resolve(dist, `.${assetPath}`))))
  assert.equal(outboundAttempts, 0, 'Compiled worker attempted an external fetch instead of local routing/bindings')
  receipt.staticGate = 'passed'; receipt.externalOutboundAttempts = outboundAttempts
  receipt.checks.push('compiled Pages ASSETS fallback matches built index and referenced static asset')
  await save(receipt)
  console.log(JSON.stringify({ result: 'passed', schemaRehearsal: receipt.schemaRehearsal, compiledHttpGate: receipt.compiledHttpGate, staticGate: receipt.staticGate, affectedTables: receipt.tables.length, manifest: manifestPath }))
} catch (error) {
  if (receipt) { receipt.failure = { stage, message: String(error?.message ?? error).slice(0, 1000) }; await save(receipt) }
  console.error(`Timeline release verification failed at ${stage}: ${String(error?.message ?? error).slice(0, 500)}`)
  process.exitCode = 1
} finally { if (mf) await mf.dispose() }
