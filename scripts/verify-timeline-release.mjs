/** Run only in the qualified credential-free, network-disabled release validator. */
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
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
async function catalog(db) {
  return (await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()).results
}
async function preservedRows(db, tableNames) {
  const result = {}
  for (const table of tableNames) result[table] = (await db.prepare(`SELECT * FROM ${quote(table)}`).all()).results.sort((a, b) => canonical(a).localeCompare(canonical(b)))
  return result
}
async function rehearseMigration(db, migrationStatements, migrationName, tableNames) {
  const before = await catalog(db)
  const trackerBefore = (await db.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results
  const rowsBefore = await preservedRows(db, tableNames)
  const batch = () => [...migrationStatements.map(({ sql }) => db.prepare(sql)), db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(migrationName)]
  // Fail after all DDL and tracker insertion, proving their shared transaction rolls back.
  await assert.rejects(db.batch([...batch(), db.prepare("SELECT json('deliberately invalid migration rehearsal JSON')")]), /malformed JSON/i)
  assert.deepEqual(await catalog(db), before, 'Failed migration retained catalog objects')
  assert.deepEqual((await db.prepare('SELECT * FROM d1_migrations ORDER BY id').all()).results, trackerBefore, 'Failed migration retained tracker row')
  assert.deepEqual(await preservedRows(db, tableNames), rowsBefore, 'Failed migration changed immutable history or synthetic rows')
  await db.batch(batch())
  assert.deepEqual(await preservedRows(db, tableNames), rowsBefore, 'Migration rewrote immutable history or synthetic rows')
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
}
async function request(path, { method = 'GET', body, key, etag, user = 'owner', extraHeaders = {}, worker = mf } = {}) {
  const response = await worker.dispatchFetch(`https://researchtools.example${path}`, {
    method, headers: { ...(user ? { 'X-User-Hash': token[user] } : {}), 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}), ...(etag ? { 'If-Match': etag } : {}), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual',
  })
  const text = await response.text()
  let json
  try { json = JSON.parse(text) } catch { /* Caller checks status and representation. */ }
  return { status: response.status, headers: response.headers, text, json }
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

let mf, referenceMf, receipt, stage = 'read-inputs', outboundAttempts = 0
try {
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  const schemaBytes = await inputFile('TIMELINE_RELEASE_SCHEMA', 32 * 1024 * 1024)
  const inventoryBytes = await inputFile('TIMELINE_RELEASE_MIGRATIONS', 1024 * 1024)
  const applied = appliedNames(JSON.parse(inventoryBytes.toString('utf8')))
  assert.equal(new Set(applied).size, applied.length, 'Duplicate applied migration names')
  assert(applied.every(name => /^[A-Za-z0-9_.-]+\.sql$/.test(name)), 'Invalid applied migration name')
  const localNames = (await readdir(migrationDirectory)).filter(name => /^\d+.*\.sql$/.test(name)).sort()
  assert(applied.every(name => localNames.includes(name)), 'Production inventory has unknown migration names')
  const pending = localNames.filter(name => !applied.includes(name))
  const migrationName = '0015_timeline_workspace_intervals.sql'
  assert.equal(localNames.length, 15, 'Release must contain exactly the managed 0001–0015 chain')
  assert(localNames.every((name, index) => name.startsWith(`${String(index + 1).padStart(4, '0')}_`)), 'Managed migration prefix is not contiguous')
  assert.equal(localNames.at(-1), migrationName)
  const alreadyApplied = applied.includes(migrationName)
  assert.deepEqual(applied.slice().sort(), alreadyApplied ? localNames : localNames.slice(0, -1), 'Production inventory must be the exact 0014 or 0015 prefix')
  assert.deepEqual(pending, alreadyApplied ? [] : [migrationName], 'Only the durable interval migration may be pending')
  const migrationBytes = await readFile(resolve(migrationDirectory, migrationName))
  const migrationStatements = statements(migrationBytes.toString('utf8'))
  assert.equal(migrationStatements.length, 19, '0015 must retain the reviewed atomic two-table reconstruction and eight guards')
  const previousMigrationBytes = await readFile(resolve(migrationDirectory, '0012_timeline_workspace_snapshots.sql'))
  const changedDefinitions = new Set(['timeline_objects', 'timeline_object_versions', 'timeline_version_kind'])
  const definitionName = sql => /\bCREATE\s+(?:TABLE|TRIGGER)\s+(timeline_[a-z_]+)\b/i.exec(sql)?.[1]
  const priorDefinitions = new Map(statements(previousMigrationBytes.toString('utf8')).filter(item => changedDefinitions.has(definitionName(item.sql))).map(item => [definitionName(item.sql), item.sql]))
  assert.equal(priorDefinitions.size, 3)
  const workerBytes = await readFile(workerPath)
  const indexBytes = await readFile(resolve(dist, 'index.html'))
  const expectedTables = [...(await readFile(resolve(migrationDirectory, '0011_timeline_foundation.sql'), 'utf8')).matchAll(/CREATE TABLE (timeline_[a-z_]+)/g)].map(match => match[1]).sort()
  expectedTables.push('integration_clients', 'integration_client_tokens', 'integration_client_token_scopes', 'content_analysis', 'content_chunks', 'timeline_presentations'); expectedTables.sort()
  assert.equal(expectedTables.length, 15, 'Unexpected affected table inventory')
  receipt = {
    schemaVersion: 'timeline-release-schema-manifest.v1',
    schemaOnly: true,
    schemaSha256: sha256(schemaBytes), appliedInventorySha256: sha256(inventoryBytes),
    appliedMigrationNames: applied.slice().sort(), pendingMigrations: pending,
    migration: { name: migrationName, sha256: sha256(migrationBytes), bytes: migrationBytes.length, mode: alreadyApplied ? 'already-applied' : 'production-prefix-upgrade', appliedDuringRehearsal: [], rollback: 'pending', referencePriorDefinitions: { migration: '0012_timeline_workspace_snapshots.sql', sha256: sha256(previousMigrationBytes), names: [...changedDefinitions] } },
    compiledWorker: { entrypoint: 'dist/_worker.js/index.js', sha256: sha256(workerBytes) },
    staticIndexSha256: sha256(indexBytes), compatibilityDate: '2025-09-30', compatibilityFlags: ['nodejs_compat'],
    importedStatements: 0, skippedSchemaDirectives: [], tables: [],
    schemaRehearsal: 'pending', compiledHttpGate: 'pending', sharingHttpGate: 'pending', linkPreviewHttpGate: 'pending', durableIntervalHttpGate: 'pending', staticGate: 'pending', checks: [],
    limitation: 'Production schema only, seeded synthetic principals; no production rows, credentials, network, application deployment, or production mutation. ASSETS is a confined local filesystem stand-in, not the Cloudflare edge asset service.',
  }
  const staticRoot = await realpath(dist)
  let assetFailure = ''
  const assetObservations = []
  const staticService = async request => {
    assetObservations.push({ mode: assetFailure, path: new URL(request.url).pathname })
    if (assetFailure === 'truncated') return new MFResponse('<!doctype html><html><head><title>Partial asset</title>', { headers: { 'Content-Type': 'text/html' } })
    if (assetFailure === 'status') return new MFResponse('Synthetic asset failure', { status: 503 })
    if (assetFailure === 'stream') {
      let sent = false
      return new MFResponse(new ReadableStream({ pull(controller) {
        if (!sent) { sent = true; controller.enqueue(new TextEncoder().encode('<!doctype html><html><head><title>Partial asset</title>')) }
        else controller.error(new Error('Synthetic asset stream failure'))
      } }), { headers: { 'Content-Type': 'text/html' } })
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new MFResponse('Method not allowed', { status: 405 })
    const pathname = decodeURIComponent(new URL(request.url).pathname)
    if (/^\/(?:api(?:\/|$)|_worker\.js(?:\/|$)|_routes\.json|_headers|_redirects)/.test(pathname)) return new MFResponse('Not found', { status: 404 })
    let path = resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (path !== staticRoot && !path.startsWith(`${staticRoot}${sep}`)) return new MFResponse('Not found', { status: 404 })
    try { if (!(await stat(path)).isFile()) path = resolve(dist, 'index.html') } catch { if (extname(path)) return new MFResponse('Not found', { status: 404 }); path = resolve(dist, 'index.html') }
    const resolved = await realpath(path)
    if (!resolved.startsWith(`${staticRoot}${sep}`)) return new MFResponse('Not found', { status: 404 })
    const data = await readFile(resolved)
    const mime = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(path)] ?? 'application/octet-stream'
    return new MFResponse(request.method === 'HEAD' ? null : data, { headers: { 'Content-Type': mime } })
  }
  stage = 'start-compiled-worker'
  const workerOptions = {
    modules: true, scriptPath: workerPath, modulesRoot: dirname(workerPath),
    compatibilityDate: receipt.compatibilityDate, compatibilityFlags: receipt.compatibilityFlags,
    serviceBindings: { ASSETS: staticService },
    outboundService: async () => { outboundAttempts++; return new MFResponse('External network disabled in release rehearsal', { status: 502 }) },
    bindings: { ENVIRONMENT: 'production', COMMUNITY_INTEGRATIONS_ENABLED: 'true', INTEGRATION_TOKEN_HASH_KEY: 'synthetic-release-hmac-key-not-production-0001', ENABLE_AI_FEATURES: 'false' },
  }
  mf = new Miniflare({ ...workerOptions, d1Databases: { DB: 'timeline-production-schema-rehearsal' } })
  referenceMf = new Miniflare({ ...workerOptions, d1Databases: { DB: 'timeline-migration-reference' } })
  const db = await mf.getD1Database('DB')
  const reference = await referenceMf.getD1Database('DB')
  stage = 'import-production-schema'
  const importSchema = async (target, restorePriorDefinitions) => {
   const restored = new Set()
   for (const statement of statements(schemaBytes.toString('utf8'))) {
    const [first, second] = statement.words
    if (['BEGIN', 'COMMIT', 'END'].includes(first)) { if (!restorePriorDefinitions) receipt.skippedSchemaDirectives.push(first); continue }
    if (first === 'PRAGMA' && ['FOREIGN_KEYS', 'DEFER_FOREIGN_KEYS'].includes(second)) { if (!restorePriorDefinitions) receipt.skippedSchemaDirectives.push(`${first} ${second}`); continue }
    // Cloudflare's schema-only export resets empty AUTOINCREMENT metadata.
    // Skip only this exact directive; never admit arbitrary top-level DML.
    if (/^DELETE FROM sqlite_sequence;?$/.test(statement.sql)) { if (!restorePriorDefinitions) receipt.skippedSchemaDirectives.push('DELETE FROM sqlite_sequence'); continue }
    // A schema export must not contain rows, DELETEs or arbitrary executable SQL.
    assert(first === 'CREATE' && ['TABLE', 'INDEX', 'UNIQUE', 'TRIGGER', 'VIEW', 'VIRTUAL'].includes(second), `Schema-only input contains unsupported ${first} ${second ?? ''}`)
    const name = definitionName(statement.sql)
    const replace = restorePriorDefinitions && priorDefinitions.has(name)
    if (replace) restored.add(name)
    await target.prepare(replace ? priorDefinitions.get(name) : statement.sql).run()
    if (!restorePriorDefinitions) receipt.importedStatements++
   }
   if (restorePriorDefinitions) assert.equal(restored.size, 3, 'Export is missing one of the exact reconstruction seams')
  }
  await importSchema(db, false)
  // An isolated copy of the actual export substitutes ONLY the two old table
  // definitions and old kind trigger from actual 0012 bytes. This supplies a
  // 0014 reference even when the provided inventory already contains 0015.
  await importSchema(reference, true)
  assert.equal((await db.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='table' AND name LIKE 'timeline_%'").first()).n, 10, 'Export must contain exactly the ten deployed timeline tables')
  const allTableNames = expectedTables
  const priorTables = await collectManifest(db, allTableNames)
  receipt.priorCatalogSha256 = sha256(canonical(priorTables))
  receipt.priorTables = priorTables
  stage = 'rehearse-workspace-interval-migration'
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [], 'Imported schema has foreign-key violations')
  // Schema-only exports have no tracker data: seed only the separately captured inventory.
  assert.equal((await db.prepare('SELECT count(*) AS n FROM d1_migrations').first()).n, 0)
  await db.batch(applied.slice().sort().map(name => db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(name)))
  await seed(db)
  await seed(reference)
  await reference.batch(localNames.slice(0, -1).map(name => reference.prepare('INSERT INTO d1_migrations(name) VALUES (?)').bind(name)))
  const migrationSnapshot = { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-14T00:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Retained before reconstruction' }, analystWorkspace: { mode: 'robust', events: [{ id: 'migration:event.1', title: 'Original single date', description: 'Preserve complete prior payload', eventDate: '2026-09-14', datePrecision: 'day', eventTime: '10:15', category: 'event', importance: 'normal', origin: 'analyst', assessment: 'unreviewed', analystNote: '', modified: false }], questions: [], hypotheses: [], narrative: { title: 'Migration history', framing: '', question: '', intendedUse: '', scope: '', timezone: '', dataThrough: '', chapters: [] } } }
  const migrationCreate = await request('/api/timelines', { method: 'POST', key: 'migration-history-create01', body: { schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'release-workspace-a', title: 'Immutable pre-migration history' } })
  assert.equal(migrationCreate.status, 201)
  const migrationPath = `/api/timelines/${migrationCreate.json.artifactId}`
  const migrationCommit = { method: 'PATCH', key: 'migration-history-commit01', etag: migrationCreate.headers.get('etag'), body: { schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'browser-workspace', kind: 'timeline-workspace.v1', payload: migrationSnapshot }] } }
  const migrationSaved = await request(migrationPath, migrationCommit)
  assert.equal(migrationSaved.status, 200)
  const migrationPinnedPath = `${migrationPath}/objects?revisionId=${migrationSaved.json.revisionId}`
  const migrationPinned = await request(migrationPinnedPath)
  const migrationRevision = await request(`${migrationPath}/revisions/${migrationSaved.json.revisionId}`)
  assert.equal(migrationPinned.status, 200); assert.equal(migrationRevision.status, 200)
  assert.deepEqual(migrationPinned.json.objects[0].payload, migrationSnapshot)
  assert.equal(migrationPinned.json.objects[0].contentHash, sha256(canonical({ schemaVersion: 'timeline-workspace.v1', tombstone: false, payload: migrationSnapshot })))
  assert.equal(sha256(canonical(migrationRevision.json.manifest)), migrationSaved.json.contentHash)
  const rowTables = [...allTableNames, 'users', 'workspaces', 'workspace_members']
  const originalRows = await preservedRows(db, rowTables)
  // Seed the isolated prefix through the compiled API too: directly copying
  // published rows would bypass the history triggers' insertion-order contract.
  const referenceCreate = await request('/api/timelines', { worker: referenceMf, method: 'POST', key: 'migration-history-create01', body: { schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'release-workspace-a', title: 'Immutable pre-migration history' } })
  assert.equal(referenceCreate.status, 201)
  const referenceSaved = await request(`/api/timelines/${referenceCreate.json.artifactId}`, { ...migrationCommit, worker: referenceMf, etag: referenceCreate.headers.get('etag') })
  assert.equal(referenceSaved.status, 200)
  const catalogBefore = await catalog(db)
  const referenceBefore = await catalog(reference)
  const allowedChange = row => (row.type === 'table' && ['timeline_objects','timeline_object_versions'].includes(row.name)) || (row.type === 'trigger' && row.name === 'timeline_version_kind')
  assert.deepEqual(catalogBefore.filter(row => !allowedChange(row)), referenceBefore.filter(row => !allowedChange(row)), 'Reference import changed unrelated production catalog')
  if (!alreadyApplied) assert.deepEqual(catalogBefore, referenceBefore, 'Provided 0014 schema differs from accepted prior kind definitions')
  await rehearseMigration(reference, migrationStatements, migrationName, rowTables)
  if (!alreadyApplied) {
    await rehearseMigration(db, migrationStatements, migrationName, rowTables)
    receipt.migration.appliedDuringRehearsal = [migrationName]
  }
  receipt.migration.rollback = alreadyApplied ? 'passed-on-isolated-reference; production-schema-already-applied' : 'passed-on-production-schema-prefix-and-isolated-reference'
  const catalogAfter = await catalog(db)
  assert.deepEqual(catalogAfter.filter(row => !allowedChange(row)), catalogBefore.filter(row => !allowedChange(row)), '0015 changed an unrelated catalog definition')
  assert.deepEqual(catalogAfter, await catalog(reference), '0015 result differs from actual SQL reference; unexpected objects or backups remain')
  assert.deepEqual(await preservedRows(db, rowTables), originalRows, '0015 changed original rows or immutable history bytes')
  receipt.tables = await collectManifest(db, allTableNames)
  for (const table of receipt.tables) {
    const before = priorTables.find(item => item.name === table.name)
    assert.deepEqual(table.columns, before.columns); assert.deepEqual(table.foreignKeys, before.foreignKeys); assert.deepEqual(table.indexes, before.indexes)
  }
  assert.equal((await request(migrationPinnedPath)).text, migrationPinned.text)
  assert.equal((await request(`${migrationPath}/revisions/${migrationSaved.json.revisionId}`)).text, migrationRevision.text)
  assert.equal((await request(migrationPath, migrationCommit)).text, migrationSaved.text, '0015 changed persisted idempotent replay')
  receipt.migration.preservedRowsSha256 = sha256(canonical(originalRows))
  receipt.migration.preservedPinnedResponseSha256 = sha256(migrationPinned.text)
  receipt.migration.preservedReplayResponseSha256 = sha256(migrationSaved.text)
  receipt.migration.postRehearsalAppliedNames = (await db.prepare('SELECT name FROM d1_migrations ORDER BY name').all()).results.map(row => row.name)
  assert.deepEqual(receipt.migration.postRehearsalAppliedNames, localNames)
  receipt.catalogPreservation = 'passed'
  assert(receipt.tables.every(table => table.columns.length && table.foreignKeys.length), 'Incomplete affected-schema manifest')
  receipt.schemaRehearsal = 'passed'
  receipt.checks.push('schema-only export imported; captured migration inventory seeded separately', alreadyApplied ? 'actual 0015 bytes and tracker atomic rollback/retry on populated isolated 0014 reference; provided already-applied schema matched without reapplying' : 'actual 0015 bytes and tracker atomic rollback/retry on populated production-prefix and isolated actual-schema reference', 'only two kind CHECK definitions and workspace-family trigger may change; all 15 table columns/foreign keys/indexes and unrelated catalog preserved', 'preexisting v1 payload/revision/manifest/replay bytes preserved', 'foreign_key_check clean', 'all 15 affected columns/foreign keys/indexes/triggers recorded')
  await save(receipt)

  stage = 'seed-synthetic-humans'
  const error = (result, status, code) => { assert.equal(result.status, status); assert.equal(result.json?.schemaVersion, 'timeline-artifact-error.v1'); assert.equal(result.json.error.code, code); assert.equal(typeof result.json.error.retryable, 'boolean'); assert(!/INSERT|SELECT|SQLITE|D1_ERROR/.test(result.text), 'Internal SQL leaked') }
  const exerciseWorkspaceFamily = async (path, initial, original, send, keyPrefix) => {
    const interval = structuredClone(original)
    interval.schemaVersion = 'timeline-workspace.v2'
    Object.assign(interval.analystWorkspace.events[0], { eventDate: '2026-09-14', datePrecision: 'day', eventTime: '10:15:30', recordedEnd: { date: '2026-09-14', precision: 'day', time: '11:45:59' } })
    const bodyFor = value => ({ schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'browser-workspace', kind: value.schemaVersion, payload: value }] })
    const options = { method: 'PATCH', key: `${keyPrefix}-v2`, etag: initial.headers.get('etag'), body: bodyFor(interval) }
    const saved = await send(path, options)
    assert.equal(saved.status, 200); assert.equal(saved.json.sequence, initial.json.sequence + 1)
    const single = await send(path, { method: 'PATCH', key: `${keyPrefix}-v1`, etag: saved.headers.get('etag'), body: bodyFor(original) })
    assert.equal(single.status, 200); assert.equal(single.json.sequence, saved.json.sequence + 1)
    const rows = []
    for (const [version, payload, parent] of [[initial, original, null], [saved, interval, initial], [single, original, saved]]) {
      const objects = await send(`${path}/objects?revisionId=${version.json.revisionId}`)
      const revision = await send(`${path}/revisions/${version.json.revisionId}`)
      assert.equal(objects.status, 200); assert.equal(revision.status, 200)
      assert.equal(objects.json.objects.length, 1)
      const object = objects.json.objects[0]
      assert.equal(object.objectId, 'browser-workspace'); assert.equal(object.kind, payload.schemaVersion)
      assert.deepEqual(object.payload, payload)
      assert.equal(object.contentHash, sha256(canonical({ schemaVersion: payload.schemaVersion, tombstone: false, payload })))
      assert.equal(revision.json.manifest[0].kind, payload.schemaVersion)
      assert.equal(sha256(canonical(revision.json.manifest)), version.json.contentHash)
      if (parent) assert.deepEqual(revision.json.parentRevisionIds, [parent.json.revisionId])
      rows.push({ revisionId: version.json.revisionId, kind: object.kind, objectHash: object.contentHash, revisionHash: version.json.contentHash })
    }
    assert.equal(rows[0].objectHash, rows[2].objectHash, 'Returning to v1 must preserve its exact payload hash')
    assert.equal((await send(path, options)).text, saved.text, 'A v2 retry after a later v1 must return its original response')
    const artifactId = initial.json.artifactId
    assert.equal((await db.prepare("SELECT kind FROM timeline_objects WHERE artifact_id=? AND id='browser-workspace'").bind(artifactId).first()).kind, 'timeline-workspace.v1', 'Creation kind must remain immutable')
    const count = (await db.prepare('SELECT count(*) AS n FROM timeline_revisions WHERE artifact_id=?').bind(artifactId).first()).n
    error(await send(path, { ...options, key: `${keyPrefix}-mismatch`, etag: single.headers.get('etag'), body: { ...bodyFor(interval), changes: [{ ...bodyFor(interval).changes[0], kind: 'timeline-workspace.v1' }] } }), 400, 'invalid_request')
    error(await send(path, { ...options, key: `${keyPrefix}-unknown`, etag: single.headers.get('etag'), body: { ...bodyFor(interval), changes: [{ ...bodyFor(interval).changes[0], kind: 'timeline-workspace.v3' }] } }), 400, 'invalid_request')
    error(await send(path, { ...options, key: `${keyPrefix}-candidate`, etag: single.headers.get('etag'), body: { schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'browser-workspace', kind: 'event-candidate.v1', payload: { title: 'Different family', description: null, eventDate: '2026-09-14', datePrecision: 'day' } }] } }), 409, 'object_conflict')
    assert.equal((await db.prepare('SELECT count(*) AS n FROM timeline_revisions WHERE artifact_id=?').bind(artifactId).first()).n, count)
    return { interval, saved, single, rows, options }
  }
  stage = 'compiled-human-workspace-intervals'
  const humanFamily = await exerciseWorkspaceFamily(migrationPath, migrationSaved, migrationSnapshot, request, 'release-human-family')
  receipt.durableIntervalHistory = { human: humanFamily.rows }
  assert.equal((await request(migrationPinnedPath)).text, migrationPinned.text)
  assert.equal((await request(migrationPath, migrationCommit)).text, migrationSaved.text)
  error(await request(migrationPath, { ...humanFamily.options, key: 'release-family-viewer', user: 'viewer', etag: humanFamily.single.headers.get('etag') }), 404, 'not_found')
  error(await request(migrationPath, { ...humanFamily.options, key: 'release-family-other', user: 'other', etag: humanFamily.single.headers.get('etag') }), 404, 'not_found')
  receipt.checks.push('compiled human v1→v2→v1 full snapshot roundtrip, seconds-bearing recorded end, pinned kind/hash/parent history, stale-head exact replay, immutable creation kind and fail-closed mismatched/unknown/candidate kinds')
  stage = 'compiled-sharing'
  const sharingHeaders = result => {
    assert.equal(result.headers.get('cache-control'), 'no-store')
    assert.equal(result.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(result.headers.get('x-robots-tag'), 'noindex,nofollow')
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
    for (const header of ['access-control-allow-origin','access-control-allow-credentials','access-control-allow-methods','access-control-allow-headers']) assert.equal(result.headers.get(header), null)
  }
  const sharingError = (result, status, code) => {
    assert.equal(result.status, status)
    assert.deepEqual(result.json, { schemaVersion: 'timeline-presentation-error.v1', error: { code } })
    sharingHeaders(result)
  }
  // Independent projection fixture includes a real interval, escaped text and no workspace.
  const presentation = {
    schemaVersion: 'timeline-presentation.v1', timeline: {
      scale: 'human', title: { text: { headline: 'Synthetic &amp; shared account', text: '<p>Explicit public projection only.</p>' }, unique_id: 'narrative-title', autolink: false },
      events: [{ start_date: { year: 2026, month: 9, day: 14, hour: 10, minute: 0 }, end_date: { year: 2026, month: 9, day: 14, hour: 11, minute: 30 }, text: { headline: 'Synthetic interval', text: '<p>Recorded range; &lt;untrusted&gt; remains text.</p>' }, unique_id: 'event-release%3Ainterval', display_date: '2026-09-14 10:00 – 2026-09-14 11:30', autolink: false }],
    },
  }
  const sharingPath = '/api/timeline-presentations'
  const sharingKey = '00000000-0000-4000-8000-000000000001'
  const publishOptions = { method: 'POST', body: presentation, key: sharingKey }
  sharingError(await request(sharingPath, { ...publishOptions, user: null }), 401, 'authentication_required')
  sharingError(await request(sharingPath, { user: null }), 401, 'authentication_required')
  sharingError(await request(sharingPath, { ...publishOptions, user: null, extraHeaders: { 'X-User-Hash': 'guest-session:synthetic-release-guest' } }), 401, 'authentication_required')
  for (const method of ['GET','POST','DELETE','OPTIONS']) sharingError(await request(sharingPath, { method, ...(method === 'POST' ? { body: presentation, key: sharingKey } : {}), extraHeaders: { Origin: 'https://untrusted.example' } }), 403, 'access_denied')
  const options = await request(sharingPath, { method: 'OPTIONS', user: null, extraHeaders: { Origin: 'https://researchtools.example' } })
  assert.equal(options.status, 204); sharingHeaders(options)
  assert.equal(options.headers.get('content-type'), null)
  sharingError(await request(sharingPath, { method: 'PUT' }), 405, 'method_not_allowed')
  sharingError(await request(sharingPath, { method: 'DELETE' }), 405, 'method_not_allowed')
  sharingError(await request(`${sharingPath}/${'a'.repeat(64)}`, publishOptions), 405, 'method_not_allowed')
  sharingError(await request(`${sharingPath}/invalid/nested`, { user: null }), 404, 'unavailable')
  sharingError(await request(sharingPath, { ...publishOptions, body: { ...presentation, analystWorkspace: { secret: 'must-not-publish' } } }), 400, 'invalid_request')
  sharingError(await request(sharingPath, { ...publishOptions, body: { ...presentation, timeline: { ...presentation.timeline, events: [{ ...presentation.timeline.events[0], text: { headline: '<img src=x onerror=alert(1)>', text: '' } }] } } }), 400, 'invalid_request')
  const published = await request(sharingPath, { ...publishOptions, extraHeaders: { Origin: 'https://researchtools.example' } })
  assert.equal(published.status, 201); sharingHeaders(published)
  assert.deepEqual(Object.keys(published.json).sort(), ['createdAt','revoked','schemaVersion','token'])
  assert.equal(published.json.schemaVersion, 'timeline-presentation-link.v1'); assert.equal(published.json.revoked, false)
  assert.match(published.json.token, /^[a-f0-9]{64}$/)
  assert.equal(new Date(published.json.createdAt).toISOString(), published.json.createdAt)
  const publicPresentationPath = `${sharingPath}/${published.json.token}`
  const publishedRows = (await db.prepare('SELECT * FROM timeline_presentations ORDER BY token').all()).results
  const publicRead = await request(publicPresentationPath, { user: null })
  assert.equal(publicRead.status, 200); sharingHeaders(publicRead); assert.deepEqual(publicRead.json, presentation)
  assert.equal(sha256(publicRead.text), publishedRows[0].payload_hash)
  assert.deepEqual((await db.prepare('SELECT * FROM timeline_presentations ORDER BY token').all()).results, publishedRows, 'Anonymous read mutated publication')
  // Exercise the actual compiled Pages route and HTMLRewriter, not a browser-only head mutation.
  const publicPagePath = `/present/${published.json.token}`
  const previewHeaders = result => {
    sharingHeaders(result)
    assert.match(result.headers.get('content-type'), /^text\/html/)
    for (const directive of ["script-src 'self';", "connect-src 'self';", "base-uri 'none'", "frame-src 'self'"]) assert(result.headers.get('content-security-policy').includes(directive))
  }
  const previewMeta = (html, attribute, key) => {
    const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).filter(tag => tag.includes(`${attribute}="${key}"`))
    assert.equal(tags.length, 1, `Expected one ${key} metadata tag`)
    const content = /\bcontent="([^"]*)"/.exec(tags[0]); assert(content)
    return content[1]
  }
  const publicPage = await request(publicPagePath, { user: null })
  assert.equal(publicPage.status, 200); previewHeaders(publicPage)
  assert.equal(previewMeta(publicPage.text, 'property', 'og:title'), 'Synthetic &amp; shared account')
  assert.match(previewMeta(publicPage.text, 'property', 'og:description'), /^1 event.*Explicit public projection only\./)
  assert.equal(previewMeta(publicPage.text, 'property', 'og:url'), `https://researchtools.example${publicPagePath}`)
  assert.equal(previewMeta(publicPage.text, 'property', 'og:image'), 'https://researchtools.example/timeline-share-card.png')
  assert.equal(previewMeta(publicPage.text, 'property', 'og:image:width'), '1200')
  assert.equal(previewMeta(publicPage.text, 'property', 'og:image:height'), '630')
  assert.equal(previewMeta(publicPage.text, 'property', 'og:image:type'), 'image/png')
  assert(previewMeta(publicPage.text, 'property', 'og:image:alt'))
  assert.equal(previewMeta(publicPage.text, 'name', 'twitter:card'), 'summary_large_image')
  assert.equal(previewMeta(publicPage.text, 'name', 'twitter:title'), previewMeta(publicPage.text, 'property', 'og:title'))
  assert.equal(previewMeta(publicPage.text, 'name', 'twitter:description'), previewMeta(publicPage.text, 'property', 'og:description'))
  assert.equal((publicPage.text.match(/<title>/g) || []).length, 1)
  assert.equal((publicPage.text.match(/rel="canonical"/g) || []).length, 1)
  assert(!publicPage.text.includes('og-default.png') && !publicPage.text.includes('Survey Drops'))
  assert(!publicPage.text.includes('Synthetic interval') && !publicPage.text.includes('Recorded range;'))
  assert.match(publicPage.text, /<noscript[\s>]/)
  for (const agent of ['Twitterbot/1.0', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0', 'Discordbot/2.0', 'WhatsApp/2.0']) {
    const bot = await request(publicPagePath, { user: null, extraHeaders: { 'User-Agent': agent, 'X-Forwarded-Host': 'untrusted.example', 'X-Forwarded-Proto': 'http' } })
    assert.equal(bot.status, 200); assert.equal(bot.text, publicPage.text); previewHeaders(bot)
  }
  for (const failure of ['status', 'stream', 'truncated']) {
    assetFailure = failure
    stage = 'compiled-preview-asset-' + failure
    const readsBefore = assetObservations.length
    try {
      const broken = await request(publicPagePath, { user: null })
      assert(assetObservations.slice(readsBefore).some(item => item.mode === failure && item.path === '/index.html'), 'Fault did not reach ASSETS binding: '+failure)
      assert.equal(broken.status, 503, `Asset ${failure} returned ${broken.status}, body length ${broken.text.length}`); previewHeaders(broken)
      assert(!broken.text.includes('Synthetic &amp; shared account') && !broken.text.includes('Explicit public projection only.') && !broken.text.includes('Partial asset'))
    } finally { assetFailure = '' }
  }
  stage = 'compiled-preview-lifecycle'
  const headPage = await request(publicPagePath, { method: 'HEAD', user: null })
  assert.equal(headPage.status, 200); assert.equal(headPage.text, ''); previewHeaders(headPage)
  const noPreview = async (path, status = 404, options = {}) => {
    const result = await request(path, { user: null, ...options }); assert.equal(result.status, status); previewHeaders(result)
    assert(!result.text.includes('Synthetic &amp; shared account') && !result.text.includes('Explicit public projection only.'))
    assert(!result.text.includes('og-default.png') && !result.text.includes('Survey Drops'))
    return result
  }
  for (const path of ['/present/invalid', `/present/${'0'.repeat(64)}`, publicPagePath+'?tracking=1', publicPagePath+'/extra', publicPagePath+'/']) await noPreview(path)
  await noPreview(publicPagePath, 405, { method: 'POST' })
  const previewImageBytes = await readFile(resolve(dist, 'timeline-share-card.png'))
  assert.equal(previewImageBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(previewImageBytes.readUInt32BE(16), 1200); assert.equal(previewImageBytes.readUInt32BE(20), 630)
  assert(previewImageBytes.length < 1000000)
  const previewImageResponse = await mf.dispatchFetch('https://researchtools.example/timeline-share-card.png')
  assert.equal(previewImageResponse.status, 200); assert.equal(previewImageResponse.headers.get('content-type'), 'image/png')
  assert.equal(sha256(Buffer.from(await previewImageResponse.arrayBuffer())), sha256(previewImageBytes))
  assert.deepEqual((await db.prepare('SELECT * FROM timeline_presentations ORDER BY token').all()).results, publishedRows, 'Metadata requests mutated publication')
  const replay = await request(sharingPath, publishOptions)
  assert.equal(replay.status, 200); sharingHeaders(replay); assert.deepEqual(replay.json, published.json)
  sharingError(await request(sharingPath, { ...publishOptions, body: { ...presentation, timeline: { ...presentation.timeline, title: { ...presentation.timeline.title, text: { headline: 'Changed', text: '' } } } } }), 409, 'idempotency_conflict')
  const links = await request(sharingPath)
  assert.equal(links.status, 200); sharingHeaders(links)
  assert.deepEqual(links.json, { schemaVersion: 'timeline-presentation-links.v1', links: [{ token: published.json.token, createdAt: published.json.createdAt, title: 'Synthetic & shared account' }] })
  assert.deepEqual((await request(sharingPath, { user: 'other' })).json.links, [])
  sharingError(await request(publicPresentationPath, { method: 'DELETE', user: 'other' }), 404, 'unavailable')
  sharingError(await request(`${sharingPath}/not-a-token`, { user: null }), 404, 'unavailable')
  sharingError(await request(`${sharingPath}/${'0'.repeat(64)}`, { user: null }), 404, 'unavailable')
  await db.prepare('UPDATE users SET is_active=0 WHERE id=880001').run()
  sharingError(await request(publicPresentationPath, { user: null }), 404, 'unavailable')
  await noPreview(publicPagePath)
  await db.prepare('UPDATE users SET is_active=1 WHERE id=880001').run()
  assert.equal((await request(publicPresentationPath, { user: null })).status, 200)
  for (let attempt = 0; attempt < 2; attempt++) {
    const revoked = await request(publicPresentationPath, { method: 'DELETE' })
    assert.equal(revoked.status, 204); assert.equal(revoked.text, ''); sharingHeaders(revoked)
  }
  sharingError(await request(publicPresentationPath, { user: null }), 404, 'unavailable')
  await noPreview(publicPagePath)
  assert.equal((await noPreview(publicPagePath, 404, { method: 'HEAD' })).text, '')
  sharingError(await request(sharingPath, publishOptions), 409, 'idempotency_conflict')
  const revokedRow = await db.prepare('SELECT payload,revoked_at FROM timeline_presentations WHERE token=?').bind(published.json.token).first()
  assert.equal(revokedRow.payload, null); assert.equal(typeof revokedRow.revoked_at, 'string')
  assert.deepEqual((await request(sharingPath)).json.links, [])
  for (let index = 1; index <= 20; index++) {
    const result = await request(sharingPath, { ...publishOptions, user: 'other', key: `00000000-0000-4000-8001-${String(index).padStart(12, '0')}` })
    assert.equal(result.status, 201)
  }
  sharingError(await request(sharingPath, { ...publishOptions, user: 'other', key: '00000000-0000-4000-8001-000000000021' }), 409, 'active_link_limit')
  assert.equal((await request(sharingPath, { user: 'other' })).json.links.length, 20)
  const originalRole = (await db.prepare('SELECT role FROM users WHERE id=880001').first()).role
  const safeProjection = structuredClone(presentation)
  safeProjection.timeline.title.text = { headline: '&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot;', text: '<p>&lt;/noscript&gt;&lt;script&gt;private-injection&lt;/script&gt;</p>' }
  const escapedLink = await request(sharingPath, { ...publishOptions, body: safeProjection, key: '00000000-0000-4000-8002-000000000001' })
  assert.equal(escapedLink.status, 201)
  const escapedPath = `/present/${escapedLink.json.token}`
  const escapedPage = await request(escapedPath, { user: null })
  assert.equal(escapedPage.status, 200); previewHeaders(escapedPage)
  assert.equal(previewMeta(escapedPage.text, 'property', 'og:title'), '&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot;')
  assert(!escapedPage.text.includes('<img src=x') && !escapedPage.text.includes('<script>private-injection') && !escapedPage.text.includes('</noscript><script>'))
  for (const role of ['guest', '   ']) {
    await db.prepare('UPDATE users SET role=? WHERE id=880001').bind(role).run()
    const denied = await noPreview(escapedPath)
    assert(!denied.text.includes('private-injection'))
  }
  await db.prepare('UPDATE users SET role=? WHERE id=880001').bind(originalRole).run()
  await assert.rejects(db.prepare("UPDATE users SET role='service' WHERE id=880001").run(), /service principals must be provisioned as new users/)
  assert.equal((await db.prepare('SELECT role FROM users WHERE id=880001').first()).role, originalRole)
  assert.equal((await request(escapedPath, { user: null })).status, 200)
  // Only synthetic isolated rows: prove a stored hash failure cannot populate HTML metadata.
  const corruptToken = 'c'.repeat(64)
  await db.prepare('INSERT INTO timeline_presentations(token,owner_id,request_key,payload_hash,payload,created_at) VALUES (?,880001,?,?,?,?)')
    .bind(corruptToken, 'synthetic-corrupt-preview', '0'.repeat(64), JSON.stringify(presentation), '2026-09-14T00:00:00.000Z').run()
  await noPreview(`/present/${corruptToken}`)
  receipt.checks.push('compiled preview encoded-markup injection, owner role loss, corrupt stored hash and failing/partial asset streams stay generic without published metadata')
  receipt.checks.push('compiled sharing strict projection/interval/escaped text, anonymous exact read, owner-only bounded list and revoke, replay/conflict, inactive-owner refusal, tombstone payload clearing, 20 active links, no-store and no CORS grants')
  stage = 'compiled-stored-source-import'
  const storedSource = JSON.parse(await readFile(resolve(root, 'tests/fixtures/timeline-stored-source.json'), 'utf8'))
  await seedRow(db, 'content_analysis', { id: storedSource.analysisId, user_id: 880001, workspace_id: 'release-workspace-a', url: storedSource.url, title: storedSource.title, extracted_text: storedSource.text, content_hash: sha256(storedSource.text), is_saved: 1, expires_at: null, processing_status: 'complete', created_at: '2026-09-11T00:00:00Z', updated_at: '2026-09-11T00:00:00Z' })
  const sourceRows = (await db.prepare('SELECT * FROM content_analysis ORDER BY id').all()).results
  const importBody = { schemaVersion: 'timeline-source-import-request.v1', workspaceId: 'release-workspace-a', analysisId: storedSource.analysisId, quote: storedSource.quote }
  const matched = await request('/api/timeline-source-import', { method: 'POST', body: importBody })
  assert.equal(matched.status, 200); assert.equal(matched.json.schemaVersion, 'timeline-source-import.v1')
  assert.equal(matched.json.contentHash, sha256(storedSource.text)); assert.equal(matched.json.quoteHash, sha256(storedSource.quote))
  assert.equal(matched.json.passage.quote, storedSource.quote)
  assert.equal(matched.json.start, storedSource.text.indexOf(storedSource.quote)); assert.equal(matched.json.end, matched.json.start + storedSource.quote.length)
  assert(matched.json.passage.locator.includes(matched.json.contentHash))
  error(await request('/api/timeline-source-import', { method: 'POST', body: importBody, user: null }), 401, 'authentication_required')
  error(await request('/api/timeline-source-import', { method: 'POST', body: importBody, user: 'viewer' }), 404, 'not_found')
  error(await request('/api/timeline-source-import', { method: 'POST', body: importBody, user: 'other' }), 404, 'not_found')
  error(await request('/api/timeline-source-import', { method: 'POST', body: { ...importBody, analysisId: storedSource.analysisId + 1 } }), 404, 'not_found')
  error(await request('/api/timeline-source-import', { method: 'POST', body: { ...importBody, expectedContentHash: '0'.repeat(64) } }), 412, 'stale_revision')
  assert.deepEqual((await db.prepare('SELECT * FROM content_analysis ORDER BY id').all()).results, sourceRows, 'Source resolver mutated stored content')
  receipt.checks.push('compiled stored-source owner/private-workspace authorization, exact Unicode passage/hash, stale refusal and zero source writes')
  const chunkFixture = JSON.parse(await readFile(resolve(root, 'tests/fixtures/timeline-chunked-source.json'), 'utf8'))
  const chunkText = chunkFixture.prefixUnit.repeat(chunkFixture.prefixRepeats) + chunkFixture.quote + chunkFixture.suffix
  await seedRow(db,'content_analysis',{id:chunkFixture.analysisId,user_id:880001,workspace_id:'release-workspace-a',url:chunkFixture.url,title:chunkFixture.title,extracted_text:chunkText.slice(0,102400)+'\n\n[Content truncated - see content_chunks table for full text]',content_hash:sha256(chunkText),is_saved:1,expires_at:null,processing_status:'complete',created_at:'2026-09-11T00:00:00Z',updated_at:'2026-09-11T00:00:00Z'})
  for(let start=0;start<chunkText.length;start+=51200){const chunk=chunkText.slice(start,start+51200);await seedRow(db,'content_chunks',{content_analysis_id:chunkFixture.analysisId,chunk_index:start/51200,chunk_size:chunk.length,chunk_hash:sha256(chunk),chunk_text:chunk,created_at:'2026-09-11T00:00:00Z'})}
  const chunkRows=(await db.prepare('SELECT * FROM content_chunks ORDER BY id').all()).results
  const chunkMatch=await request('/api/timeline-source-import',{method:'POST',body:{...importBody,analysisId:chunkFixture.analysisId,quote:chunkFixture.quote}})
  assert.equal(chunkMatch.status,200);assert.equal(chunkMatch.json.contentHash,sha256(chunkText));assert.equal(chunkMatch.json.start,112000);assert.equal(chunkMatch.json.passage.quote,chunkFixture.quote)
  assert.deepEqual((await db.prepare('SELECT * FROM content_chunks ORDER BY id').all()).results,chunkRows)
  await db.prepare('DELETE FROM content_chunks WHERE content_analysis_id=? AND chunk_index=2').bind(chunkFixture.analysisId).run()
  error(await request('/api/timeline-source-import',{method:'POST',body:{...importBody,analysisId:chunkFixture.analysisId,quote:chunkFixture.quote}}),400,'invalid_request')
  receipt.checks.push('compiled complete chunk integrity, quote beyond parent prefix, zero chunk writes and missing-chunk refusal')
  stage='compiled-recent-source-candidates'
  const candidatesBefore=(await db.prepare('SELECT * FROM content_analysis ORDER BY id').all()).results
  const candidatePath='/api/timeline-source-candidates?workspaceId=release-workspace-a'
  const candidates=await request(candidatePath)
  assert.equal(candidates.status,200);assert.equal(candidates.headers.get('cache-control'),'no-store')
  assert.deepEqual(candidates.json,{schemaVersion:'timeline-source-candidates.v1',workspaceId:'release-workspace-a',items:[{analysisId:chunkFixture.analysisId,title:chunkFixture.title},{analysisId:storedSource.analysisId,title:storedSource.title}]})
  error(await request(candidatePath,{user:null}),401,'authentication_required')
  error(await request(candidatePath,{user:'viewer'}),404,'not_found')
  error(await request(candidatePath,{user:'other'}),404,'not_found')
  error(await request(candidatePath+'&unexpected=1'),400,'invalid_request')
  assert.deepEqual((await db.prepare('SELECT * FROM content_analysis ORDER BY id').all()).results,candidatesBefore)
  receipt.checks.push('compiled owned recent metadata-only candidate list, current private write authorization, strict query, no-store and zero source writes; listing does not certify missing chunks')

  const createBody = { schemaVersion: 'timeline-artifact-create.v1', workspaceId: 'release-workspace-a', title: 'Production-schema rehearsal' }
  const payload = { schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'event:release.001', kind: 'event-candidate.v1', payload: { title: 'Synthetic candidate', description: null, eventDate: '2026-09', datePrecision: 'month' } }] }
  stage = 'compiled-http-create-auth'
  error(await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001', user: null }), 401, 'authentication_required')
  error(await request('/api/timelines', { method: 'POST', body: createBody, key: 'release-create-0001', extraHeaders: { Authorization: 'Bearer rt_svc_synthetic_rejected' } }), 401, 'authentication_required')
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
  assert.equal((await db.prepare('SELECT count(*) AS n FROM timeline_revisions WHERE artifact_id=?').bind(create.json.artifactId).first()).n, 3)

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
  stage = 'compiled-workspace-snapshot'
  const snapshot = { schemaVersion: 'timeline-workspace.v1', exportedAt: '2026-09-11T00:00:00.000Z', source: { schemaVersion: 'timeline-manual.v1', title: 'Complete workspace' }, analystWorkspace: { mode: 'robust', events: [{ id: 'event:unknown.1', title: 'Uncertain date', description: null, category: 'event', importance: 'normal', origin: 'analyst', assessment: 'disputed', analystNote: 'Keep uncertainty', modified: false, eventTime: '14:30:59' }], questions: [], hypotheses: [], narrative: { title: 'Complete account', framing: 'Preserve the whole workspace', question: '', intendedUse: '', scope: '', timezone: 'UTC', dataThrough: '', chapters: [] } } }
  snapshot.analystWorkspace.evidence = {"schemaVersion":"timeline-evidence.v1","sources":[{"id":"source:first","url":"https://example.test/first","title":"First report","publisher":"Fixture desk","publishedAt":"2026-09-01T10:00:00Z","retrievedAt":"2026-09-11T00:00:00Z"},{"id":"source:second","url":"https://other.example.test/second","title":"Conflicting report","publisher":"Other fixture desk"}],"assertions":[{"id":"assertion:first","sourceId":"source:first","claimText":"The source reported the meeting occurred in September.","temporalClaim":"September 2026","passage":{"id":"passage:first","quote":"The meeting took place in September.","locator":"paragraph 2"},"status":"active","derivesFrom":[],"reportedAt":"2026-09-01T10:00:00Z"},{"id":"assertion:contrary","sourceId":"source:second","claimText":"The second source reported October instead.","temporalClaim":"October 2026","passage":{"id":"passage:contrary","quote":"The meeting occurred in October.","locator":"paragraph 4"},"status":"active","derivesFrom":[]}],"links":[{"id":"link:support","eventId":"event:unknown.1","assertionId":"assertion:first","relation":"supports"},{"id":"link:contrary","eventId":"event:unknown.1","assertionId":"assertion:contrary","relation":"contradicts"}],"reviews":[]}
  snapshot.analystWorkspace.evidence.assertions[0].epistemicType = 'reported_claim'
  const assessedAssertion = snapshot.analystWorkspace.evidence.assertions[0]
  assessedAssertion.evaluation = {
    schemaVersion: 'timeline-source-evaluation.v1',
    ...Object.fromEntries(['access','reliability','credibility','currency','completeness','bias','deception'].map(key => [key, { value: 'unassessed', rationale: '' }])),
    access: { value: 'indirect', rationale: 'The synthetic report quotes an observer.' },
    reviewedAt: '2026-09-12T00:00:00Z',
    basis: canonical({ schemaVersion: 'timeline-source-evaluation-basis.v1', assertionId: assessedAssertion.id, assertions: [structuredClone(assessedAssertion)], sources: [snapshot.analystWorkspace.evidence.sources[0]] }),
  }
  snapshot.analystWorkspace.evidence.sources.push(matched.json.source)
  snapshot.analystWorkspace.evidence.assertions.push({ id: 'assertion:stored', sourceId: matched.json.source.id, claimText: 'The report describes a reopening.', temporalClaim: '', passage: matched.json.passage, status: 'active', derivesFrom: [] })
  snapshot.analystWorkspace.evidence.links.push({ id: 'link:stored', eventId: 'event:unknown.1', assertionId: 'assertion:stored', relation: 'context' })
  snapshot.analystWorkspace.evidence.sources.push(chunkMatch.json.source)
  snapshot.analystWorkspace.evidence.assertions.push({id:'assertion:chunked',sourceId:chunkMatch.json.source.id,claimText:'The longer stored report describes a reopening.',temporalClaim:'',passage:chunkMatch.json.passage,status:'active',derivesFrom:[]})
  snapshot.analystWorkspace.evidence.links.push({id:'link:chunked',eventId:'event:unknown.1',assertionId:'assertion:chunked',relation:'context'})
  const analysis = JSON.parse(await readFile(resolve(root, 'tests/fixtures/timeline-judgment-snapshot.json'), 'utf8'))
  analysis.judgments[0].contraryEvidenceRefs = ['assertion:contrary']
  analysis.reviews[0].basis = canonical(analysis.judgments[0])
  // Historical review basis remains the imported snapshot, even when inputs are stale.
  snapshot.analystWorkspace.analysis = analysis
  const snapshotCreate = await request('/api/timelines', { method: 'POST', body: { ...createBody, title: 'Browser workspace' }, key: 'release-snapshot-create01' })
  assert.equal(snapshotCreate.status, 201)
  const snapshotPath = `/api/timelines/${snapshotCreate.json.artifactId}`
  const snapshotBody = { schemaVersion: 'timeline-artifact-commit.v1', changes: [{ op: 'put', objectId: 'browser-workspace', kind: 'timeline-workspace.v1', payload: snapshot }] }
  const snapshotSave = await request(snapshotPath, { method: 'PATCH', body: snapshotBody, key: 'release-snapshot-commit01', etag: snapshotCreate.headers.get('etag') })
  assert.equal(snapshotSave.status, 200); assertArtifact(snapshotSave.json)
  const snapshotObjects = await request(`${snapshotPath}/objects?revisionId=${snapshotSave.json.revisionId}&limit=1`)
  assert.equal(snapshotObjects.status, 200); assert.deepEqual(snapshotObjects.json.objects[0].payload, snapshot)
  assert.equal(snapshotObjects.json.objects[0].contentHash, sha256(canonical({ schemaVersion: 'timeline-workspace.v1', tombstone: false, payload: snapshot })))
  const snapshotRetry = await request(snapshotPath, { method: 'PATCH', body: snapshotBody, key: 'release-snapshot-commit01', etag: snapshotCreate.headers.get('etag') })
  assert.equal(snapshotRetry.text, snapshotSave.text)
  const snapshotRevision = await request(`${snapshotPath}/revisions/${snapshotSave.json.revisionId}`)
  assert.equal(snapshotRevision.status, 200); assert.equal(sha256(canonical(snapshotRevision.json.manifest)), snapshotSave.json.contentHash)
  receipt.checks.push('compiled human classified source assertion/evaluation/judgment/dissent snapshot save/reopen/replay and manifest binding')
  stage = 'compiled-service-scopes'
  const serviceClient = 'release_service_client_01', serviceSecret = 'S'.repeat(43)
  const serviceHash = createHmac('sha256', 'synthetic-release-hmac-key-not-production-0001').update(`rt-service-token.v1\0${serviceClient}\0${serviceSecret}`).digest('hex')
  const serviceTokenId = 'release_service_token_000001'
  await seedRow(db, 'users', { id: 880010, username: `service_${serviceClient}`, email: `service+${serviceClient}@service.invalid`, full_name: 'Synthetic service', hashed_password: 'SERVICE_AUTH_DISABLED', user_hash: null, account_hash: null, oidc_sub: null, oidc_provider: null, oidc_email: null, is_active: 1, is_verified: 0, role: 'service' })
  await seedRow(db, 'workspaces', { id: 'release-service-workspace', name: 'Synthetic service', owner_id: 880010, type: 'TEAM', is_public: 0 })
  await seedRow(db, 'investigations', { id: 'release-service-investigation', workspace_id: 'release-service-workspace', created_by: 880010, title: 'Synthetic intake', status: 'active', type: 'general' })
  await seedRow(db, 'integration_clients', { id: serviceClient, community_id: 'release-community', workspace_id: 'release-service-workspace', intake_investigation_id: 'release-service-investigation', principal_user_id: 880010, environment: 'production', maximum_visibility: 'private', status: 'active' })
  await seedRow(db, 'integration_client_tokens', { id: serviceTokenId, client_id: serviceClient, slot: 'current', secret_hash: serviceHash, created_at: 1, not_before: 1, expires_at: 4000000000 })
  for (const scope of ['timeline.read', 'timeline.write']) await seedRow(db, 'integration_client_token_scopes', { token_id: serviceTokenId, scope })
  const serviceRequest = (path, options = {}) => request(path, { ...options, user: null, extraHeaders: { Authorization: `Bearer rt_svc_${serviceClient}.${serviceSecret}` } })
  sharingError(await serviceRequest(sharingPath, publishOptions), 403, 'human_identity_required')
  sharingError(await serviceRequest(sharingPath), 403, 'human_identity_required')
  receipt.sharingHttpGate = 'passed'
  receipt.checks.push('compiled sharing refuses a valid live scoped service credential')
  const discovery = await serviceRequest('/api/integrations/capabilities')
  assert.equal(discovery.status, 200); assert.equal(discovery.json.capabilities.timelineRead, true); assert.equal(discovery.json.capabilities.timelineWrite, true); assert.equal(discovery.json.contractVersions.timelineArtifact, 'timeline-artifact.v1')
  const serviceCreateBody = { ...createBody, workspaceId: 'release-service-workspace' }
  const serviceCreate = await serviceRequest('/api/timelines', { method: 'POST', body: serviceCreateBody, key: 'release-service-create01' })
  assert.equal(serviceCreate.status, 201); assert.equal(serviceCreate.json.createdBy, 880010)
  const servicePath = `/api/timelines/${serviceCreate.json.artifactId}`
  const serviceCommitOptions = { method: 'PATCH', body: snapshotBody, key: 'release-service-commit01', etag: serviceCreate.headers.get('etag') }
  const serviceSave = await serviceRequest(servicePath, serviceCommitOptions)
  assert.equal(serviceSave.status, 200)
  const serviceEvidence = await serviceRequest(`${servicePath}/objects?revisionId=${serviceSave.json.revisionId}`)
  assert.equal(serviceEvidence.status, 200); assert.deepEqual(serviceEvidence.json.objects[0].payload, snapshot)
  assert.equal((await serviceRequest(servicePath, serviceCommitOptions)).text, serviceSave.text)
  for (const suffix of ['', `/objects?revisionId=${serviceSave.json.revisionId}`, '/revisions', `/revisions/${serviceSave.json.revisionId}`]) assert.equal((await serviceRequest(servicePath + suffix)).status, 200)
  assert.equal((await serviceRequest(artifactPath)).status, 404)
  assert.equal((await request(servicePath)).status, 404)
  const serviceFamily = await exerciseWorkspaceFamily(servicePath, serviceSave, snapshot, serviceRequest, 'release-service-family')
  receipt.durableIntervalHistory.service = serviceFamily.rows
  await db.prepare('DELETE FROM integration_client_token_scopes WHERE token_id=? AND scope=?').bind(serviceTokenId, 'timeline.write').run()
  assert.equal((await serviceRequest(servicePath, serviceCommitOptions)).status, 403)
  assert.equal((await serviceRequest(servicePath, serviceFamily.options)).status, 403)
  assert.equal((await serviceRequest(servicePath)).status, 200)
  await db.prepare('UPDATE integration_client_tokens SET revoked_at=unixepoch() WHERE id=?').bind(serviceTokenId).run()
  assert.equal((await serviceRequest(servicePath)).status, 401)
  assert.equal((await serviceRequest(servicePath, serviceFamily.options)).status, 401)
  receipt.durableIntervalHttpGate = 'passed'
  receipt.checks.push('compiled scoped service v1→v2→v1 snapshot history/replay and exact payload/manifest hashes; write-scope removal and token revocation reject original v2 retries')
  receipt.checks.push('compiled scoped service classified source assertion/evaluation/judgment/dissent snapshot create/read/replay and discovery', 'independent write scope and fresh replay revocation', 'human/service workspace isolation')
  receipt.compiledHttpGate = 'passed'
  receipt.checks.push('compiled Pages create/commit routes', 'human/service/viewer/cross-workspace authorization', 'exact replay after later revision', 'idempotency conflict and stale head', 'pinned object/history reads and manifest hash', 'real D1 partial-batch rollback', 'immutable replacement rejected', 'privacy change reauthorizes read/replay')
  await save(receipt)

  stage = 'compiled-static-fallback'
  const home = await request('/', { user: null })
  assert.equal(home.status, 200); assert.equal(sha256(home.text), sha256(indexBytes))
  const timeline = await request('/dashboard/tools/timeline', { user: null })
  assert.equal(timeline.status, 200); assert.equal(sha256(timeline.text), sha256(indexBytes))
  const publicFallback = await request(`/present/${published.json.token}`, { user: null })
  assert.equal(publicFallback.status, 404); previewHeaders(publicFallback)
  assert(!publicFallback.text.includes('Synthetic &amp; shared account'))
  const mainAsset = /src="(\/assets\/[^"]+\.js)"/.exec(indexBytes.toString('utf8'))?.[1]
  assert(mainAsset && publicFallback.text.includes(mainAsset) && publicPage.text.includes(mainAsset), 'Metadata shell lost the SPA entry')
  receipt.linkPreviewHttpGate = 'passed'
  receipt.checks.push('compiled initial HTML preview metadata, crawler parity, escaping, exact GET/HEAD paths, origin binding, revoked/inactive refusal, privacy headers, noscript summary, preserved SPA entry and 1200x630 PNG bytes')
  const assetPath = /(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/.exec(indexBytes.toString('utf8'))?.[1]
  assert(assetPath, 'Built index did not reference a testable asset')
  const asset = await request(assetPath, { user: null })
  assert.equal(asset.status, 200); assert.equal(sha256(asset.text), sha256(await readFile(resolve(dist, `.${assetPath}`))))
  assert.equal(outboundAttempts, 0, 'Compiled worker attempted an external fetch instead of local routing/bindings')
  receipt.staticGate = 'passed'; receipt.externalOutboundAttempts = outboundAttempts
  receipt.checks.push('compiled Pages ASSETS fallback matches built index and referenced static asset')
  assert.deepEqual(await collectManifest(db, receipt.tables.map(table => table.name)), receipt.tables, 'Compiled route rehearsal changed the database catalog')
  assert.deepEqual(await catalog(db), catalogAfter, 'Compiled route rehearsal added or changed an unrelated catalog object')
  receipt.checks.push('all 15 source/chunk/timeline/credential/presentation table catalogs remain unchanged after compiled human/service/sharing and static routes')
  await save(receipt)
  console.log(JSON.stringify({ result: 'passed', schemaRehearsal: receipt.schemaRehearsal, compiledHttpGate: receipt.compiledHttpGate, staticGate: receipt.staticGate, affectedTables: receipt.tables.length, manifest: manifestPath }))
} catch (error) {
  if (receipt) { receipt.failure = { stage, message: String(error?.message ?? error).slice(0, 1000) }; await save(receipt) }
  console.error(`Timeline release verification failed at ${stage}: ${String(error?.message ?? error).slice(0, 500)}`)
  process.exitCode = 1
} finally { if (referenceMf) await referenceMf.dispose(); if (mf) await mf.dispose() }
