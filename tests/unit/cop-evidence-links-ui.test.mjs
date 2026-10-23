/**
 * The pure parts of filing evidence under questions in the UI
 * (src/lib/cop-evidence-links.ts): the filing planner the feed's "File under question"
 * picker runs, grouping, the "Evidence for" filter, link input and error wording.
 *
 * The module is bundled with esbuild (with the app's `@/` path alias).
 * Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
let mod

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-links-ui-'))
  try {
    const outfile = join(dir, 'links.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/lib/cop-evidence-links.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      outfile,
      tsconfig: join(ROOT, 'tsconfig.app.json'),
      logLevel: 'silent',
    })
    mod = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const link = (evidence_id, target_id, relation = 'supports', target_type = 'rfi') => ({
  id: `evl-${evidence_id}-${target_id}`, evidence_id, target_type, target_id, relation, note: null, created_at: '2026-10-23T10:00:00Z',
})

test('planFiling: adds new questions, updates changed relations, removes unticked ones', () => {
  const current = [link('7', 'q1'), link('7', 'q2', 'context'), link('7', 'task-1', 'supports', 'task')]
  const plan = mod.planFiling(current, { q2: 'contradicts', q3: 'supports' })
  assert.deepEqual(plan.add, [{ targetId: 'q3', relation: 'supports' }])
  assert.deepEqual(plan.update, [{ targetId: 'q2', relation: 'contradicts' }])
  assert.deepEqual(plan.remove.map((l) => l.target_id), ['q1'])
  // Task filings are never touched by the question picker.
  assert.ok(!plan.remove.some((l) => l.target_type === 'task'))
})

test('planFiling: nothing to do when the choice matches what is filed', () => {
  const current = [link('7', 'q1', 'contradicts')]
  assert.deepEqual(mod.planFiling(current, { q1: 'contradicts' }), { add: [], update: [], remove: [] })
  assert.deepEqual(mod.planFiling([], {}), { add: [], update: [], remove: [] })
})

test('grouping and the "Evidence for" filter', () => {
  const links = [link('1', 'q1'), link('2', 'q1'), link('2', 'q2'), link('3', 'task-1', 'context', 'task')]
  const byTarget = mod.groupByTarget(links)
  assert.equal(byTarget.get(mod.targetKey('rfi', 'q1')).length, 2)
  assert.equal(byTarget.get(mod.targetKey('task', 'task-1')).length, 1)
  assert.equal(mod.groupByEvidence(links).get('2').length, 2)
  assert.deepEqual([...mod.evidenceIdsFor(links, 'rfi', 'q1')].sort(), ['1', '2'])
  assert.deepEqual([...mod.evidenceIdsFor(links, 'rfi', 'task-1')], [])
})

test('cleanLinkInput: http(s) only, a bare host becomes https', () => {
  assert.equal(mod.cleanLinkInput('https://example.org/a b'), 'https://example.org/a%20b')
  assert.equal(mod.cleanLinkInput('example.org/news'), 'https://example.org/news')
  assert.equal(mod.cleanLinkInput('  '), null)
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.org/x', 'file:///etc/passwd']) {
    assert.equal(mod.cleanLinkInput(bad), null, bad)
  }
})

test('linkErrorMessage: says what went wrong and what to do', () => {
  assert.match(mod.linkErrorMessage({ status: 503, code: 'EVIDENCE_LINKS_UNAVAILABLE', error: null }), /isn’t available/)
  assert.match(mod.linkErrorMessage({ status: 404, code: 'NOT_AVAILABLE', error: null }), /isn’t available/)
  assert.match(mod.linkErrorMessage({ status: 403, code: null, error: null }), /owner or an editor/)
  assert.match(mod.linkErrorMessage({ status: 403, code: 'NOT_OWN_LINK', error: null }), /person who filed it/)
  assert.match(mod.linkErrorMessage({ status: 404, code: 'TARGET_NOT_FOUND', error: null }), /question isn’t in this COP/)
  assert.match(mod.linkErrorMessage({ status: 0, code: null, error: null }), /connection/)
})
