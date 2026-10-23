/**
 * COP tags (managed migration 0023) and the evidence-tags workspace fix.
 *
 * - Names: trimmed, '#' dropped, ≤ 40 characters, one tag per lower-cased name.
 * - item-tags: the target must belong to the session (evidence: its workspace),
 *   checked in SQL for every target type; another session's item is 404.
 * - Viewers read; editors and the bot write; strangers do neither; bulk is for people.
 * - COP_SERVICE_ROUTES admits exactly the tag routes the bot calls.
 * - evidence-tags.ts: every call is scoped to the session's workspace.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATTACKER_SESSION, cop, events, fixture, mod, SESSION, setupInputSuite } from './cop-input-harness.mjs'

setupInputSuite(['serviceAuth', 'copCaller', 'middleware', 'copTags', 'tags', 'itemTags', 'bulk', 'evidenceTags'])

const tagsCall = (env, method, who, body, session = SESSION) =>
  cop(env, method, `/api/cop/${session}/tags`, { who, body, handler: mod('tags'), params: { id: session } })
const itemTags = (env, method, who, body, { session = SESSION, query = '' } = {}) =>
  cop(env, method, `/api/cop/${session}/item-tags${query}`, { who, body, handler: mod('itemTags'), params: { id: session } })
const bulk = (env, who, body) =>
  cop(env, 'POST', `/api/cop/${SESSION}/item-tags/bulk`, { who, body, handler: mod('bulk'), params: { id: SESSION } })

test('tag names: trimmed, "#" dropped, one tag per lower-cased name, bounded', () => {
  const { cleanTagName, hashtagsIn } = mod('copTags')
  assert.equal(cleanTagName('  #Gare   du Nord '), 'Gare du Nord')
  assert.equal(cleanTagName('x'.repeat(41)), null)
  assert.equal(cleanTagName('<script>'), null)
  assert.equal(cleanTagName('a/b'), null)
  assert.equal(cleanTagName(''), null)
  assert.equal(cleanTagName('Saint-Denis_2.0'), 'Saint-Denis_2.0')
  assert.deepEqual(hashtagsIn('crowd at #GareDuNord, #protest #Protest and C#sharp'), ['GareDuNord', 'protest'])
})

test('POST /tags: an existing name in any case answers 200 with that tag; viewers cannot add', async () => {
  const { db, env } = await fixture()
  const first = await tagsCall(env, 'POST', 'editor', { name: '#Protest', color: '#FF0000', category: 'chat' })
  assert.equal(first.status, 201)
  const { tag } = await first.json()
  assert.equal(tag.name, 'Protest')
  assert.equal(tag.color, '#ff0000')
  const again = await tagsCall(env, 'POST', 'owner', { name: 'protest' })
  assert.equal(again.status, 200)
  assert.equal((await again.json()).tag.id, tag.id)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_tags').get().n, 1)
  assert.equal((await tagsCall(env, 'POST', 'viewer', { name: 'x' })).status, 403)
  assert.equal((await tagsCall(env, 'POST', 'attacker', { name: 'x' })).status, 403)
  assert.equal((await tagsCall(env, 'POST', 'editor', { name: 'bad/name' })).status, 400)
  const list = await tagsCall(env, 'GET', 'viewer')
  assert.equal(list.status, 200)
  assert.deepEqual((await list.json()).tags.map((t) => t.name), ['Protest'])
  assert.equal((await tagsCall(env, 'GET', 'attacker')).status, 403)
})

test('item-tags: every target type must belong to this session (another session\'s item is 404)', async () => {
  const { db, env } = await fixture()
  const types = {
    evidence: ['1', '2'], marker: ['mkr-paris', 'mkr-attacker'], rfi: ['rfi-paris', 'rfi-attacker'],
    task: ['tsk-paris', 'tsk-attacker'], timeline: ['tle-paris', 'tle-attacker'], claim: ['clm-paris', 'clm-attacker'],
    hypothesis: ['hyp-paris', 'hyp-attacker'], persona: ['per-paris', 'per-attacker'], asset: ['ast-paris', 'ast-attacker'],
    webcam: ['cam-paris', 'cam-attacker'], upload: ['upl-paris', 'upl-attacker'], submission: ['sub-paris', 'sub-attacker'],
  }
  for (const [type, [own, foreign]] of Object.entries(types)) {
    const ok = await itemTags(env, 'POST', 'editor', { target_type: type, target_id: own, tags: ['watch'] })
    assert.equal(ok.status, 200, type)
    assert.deepEqual((await ok.json()).tags, ['watch'])
    const refused = await itemTags(env, 'POST', 'editor', { target_type: type, target_id: foreign, tags: ['watch'] })
    assert.equal(refused.status, 404, `${type}: another session's item`)
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_item_tags WHERE target_id LIKE '%attacker%' OR target_id = '2'").get().n, 0)
  // The attacker, an editor on their own session, cannot reach Paris items through it.
  const cross = await itemTags(env, 'POST', 'attacker', { target_type: 'evidence', target_id: '1', tags: ['pwned'] }, { session: ATTACKER_SESSION })
  assert.equal(cross.status, 404)
})

test('item-tags: list, filter by type and tag, remove; events for the change feed', async () => {
  const { db, env } = await fixture()
  await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['crowd', 'Protest'] })
  await itemTags(env, 'POST', 'editor', { target_type: 'rfi', target_id: 'rfi-paris', tags: ['protest'] })
  const all = await (await itemTags(env, 'GET', 'viewer')).json()
  assert.deepEqual(all.items, [
    { target_type: 'marker', target_id: 'mkr-paris', tags: ['crowd', 'Protest'] },
    { target_type: 'rfi', target_id: 'rfi-paris', tags: ['Protest'] },
  ])
  const byTag = await (await itemTags(env, 'GET', 'viewer', undefined, { query: '?tag=%23PROTEST' })).json()
  assert.equal(byTag.items.length, 2)
  const byType = await (await itemTags(env, 'GET', 'viewer', undefined, { query: '?target_type=rfi' })).json()
  assert.deepEqual(byType.items.map((i) => i.target_id), ['rfi-paris'])
  assert.equal((await itemTags(env, 'GET', 'viewer', undefined, { query: '?target_type=users' })).status, 400)

  const removed = await itemTags(env, 'DELETE', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tag: 'CROWD' })
  assert.deepEqual((await removed.json()).tags, ['Protest'])
  assert.equal((await itemTags(env, 'DELETE', 'viewer', { target_type: 'marker', target_id: 'mkr-paris', tag: 'Protest' })).status, 403)
  const kinds = events(db, 'tag').map((e) => e.event_type)
  assert.ok(kinds.includes('tag.created') && kinds.includes('tag.applied') && kinds.includes('tag.removed'))
})

test('item-tags limits: ≤ 10 tags a call; the same tag twice links once', async () => {
  const { db, env } = await fixture()
  const many = Array.from({ length: 11 }, (_, i) => `t${i}`)
  assert.equal((await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: many })).status, 400)
  await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['a', 'A', '#a'] })
  await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['a'] })
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_item_tags').get().n, 1)
  assert.equal((await itemTags(env, 'POST', 'editor', { target_type: 'marker', target_id: 'mkr-paris', tags: ['ok', 'bad/name'] })).status, 400)
})

test('bulk: people only, ≤ 100 targets, foreign targets skipped untouched', async () => {
  const { db, env } = await fixture()
  const targets = [
    { target_type: 'marker', target_id: 'mkr-paris' },
    { target_type: 'marker', target_id: 'mkr-attacker' },
    { target_type: 'evidence', target_id: '1' },
  ]
  const res = await bulk(env, 'editor', { targets, add: ['night'] })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.items.map((i) => [i.target_id, i.tags]), [['mkr-paris', ['night']], ['1', ['night']]])
  assert.deepEqual(body.skipped, [{ target_type: 'marker', target_id: 'mkr-attacker' }])
  const removed = await (await bulk(env, 'editor', { targets: targets.slice(0, 1), remove: ['night'] })).json()
  assert.deepEqual(removed.items[0].tags, [])
  assert.equal((await bulk(env, 'editor', { targets: Array.from({ length: 101 }, () => targets[0]), add: ['x'] })).status, 400)
  assert.equal((await bulk(env, 'viewer', { targets, add: ['x'] })).status, 403)
  assert.equal((await bulk(env, 'service', { targets, add: ['x'] })).status, 403)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_item_tags WHERE target_id = 'mkr-attacker'").get().n, 0)
})

test('the bot tags through its allow-list; its tags are marked as from chat', async () => {
  const { db, env } = await fixture()
  const res = await itemTags(env, 'POST', 'service', { target_type: 'marker', target_id: 'mkr-paris', tags: ['#protest'], source: 'user' })
  assert.equal(res.status, 200)
  assert.equal(db.prepare('SELECT source FROM cop_item_tags').get().source, 'chat')
  assert.equal((await itemTags(env, 'GET', 'service')).status, 200)
  assert.equal((await tagsCall(env, 'GET', 'service')).status, 200)
  assert.equal((await itemTags(env, 'DELETE', 'service', { target_type: 'marker', target_id: 'mkr-paris', tag: 'protest' })).status, 200)
  // A session not shared with the bot is refused before the handler.
  assert.equal((await itemTags(env, 'POST', 'service', { target_type: 'marker', target_id: 'mkr-attacker', tags: ['x'] }, { session: ATTACKER_SESSION })).status, 403)
})

test('COP_SERVICE_ROUTES admits exactly the routes the bot calls', () => {
  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  for (const [method, path] of [
    ['GET', '/api/cop/cop-x/tags'], ['POST', '/api/cop/cop-x/tags'],
    ['GET', '/api/cop/cop-x/item-tags'], ['POST', '/api/cop/cop-x/item-tags'], ['DELETE', '/api/cop/cop-x/item-tags'],
    ['POST', '/api/cop/cop-x/suggest'], ['GET', '/api/cop/cop-x/geocode'], ['POST', '/api/cop/cop-x/uploads'],
    ['GET', '/api/cop/cop-x/rfis'],
  ]) assert.equal(allowed(method, path), true, `${method} ${path}`)
  for (const [method, path] of [
    ['POST', '/api/cop/cop-x/item-tags/bulk'], ['GET', '/api/cop/cop-x/uploads/upl-1'], ['DELETE', '/api/cop/cop-x/tags'],
    ['GET', '/api/cop/cop-x/suggest'], ['POST', '/api/cop/cop-x/geocode'], ['PUT', '/api/cop/cop-x/item-tags'],
    ['DELETE', '/api/cop/cop-x/uploads'], ['POST', '/api/cop/public/tags'], ['GET', '/api/cop/sessions/tags'],
    ['POST', '/api/cop/cop-x/evidence-tags'], ['PUT', '/api/cop/cop-x/submissions'],
  ]) assert.equal(allowed(method, path), false, `${method} ${path}`)
})

// ── evidence-tags.ts: workspace scope ─────────────────────────────

const evidenceTags = (env, method, who, { body, query = '', session = SESSION } = {}) =>
  cop(env, method, `/api/cop/${session}/evidence-tags${query}`, { who, body, handler: mod('evidenceTags'), params: { id: session } })

test('evidence-tags: another workspace\'s evidence can be neither read nor tagged by id', async () => {
  const { db, env } = await fixture()
  db.prepare("INSERT INTO cop_evidence_tags (id, evidence_id, tag_category, tag_value, created_by) VALUES ('etg-secret', '1', 'location', 'safe house', 1)").run()
  // The attacker owns their own session (a different workspace) and asks for Paris evidence 1 through it.
  const read = await evidenceTags(env, 'GET', 'attacker', { query: '?evidence_id=1', session: ATTACKER_SESSION })
  assert.equal(read.status, 404)
  assert.equal(JSON.stringify(await read.json()).includes('safe house'), false)
  const write = await evidenceTags(env, 'POST', 'attacker', {
    session: ATTACKER_SESSION, body: { evidence_id: '1', tag_category: 'x', tag_value: 'planted' },
  })
  assert.equal(write.status, 404)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_evidence_tags WHERE tag_value = 'planted'").get().n, 0)
  const del = await evidenceTags(env, 'DELETE', 'attacker', { query: '?tag_id=etg-secret', session: ATTACKER_SESSION })
  assert.equal(del.status, 200)
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_evidence_tags WHERE id = 'etg-secret'").get().n, 1)

  // Paris collaborators still use it: viewers read, editors write.
  const own = await evidenceTags(env, 'GET', 'viewer', { query: '?evidence_id=1' })
  assert.equal(own.status, 200)
  assert.equal((await own.json()).tags.length, 1)
  assert.equal((await evidenceTags(env, 'POST', 'viewer', { body: { evidence_id: '1', tag_category: 'x', tag_value: 'y' } })).status, 403)
  assert.equal((await evidenceTags(env, 'POST', 'editor', { body: { evidence_id: '1', tag_category: 'x', tag_value: 'y' } })).status, 201)
})
