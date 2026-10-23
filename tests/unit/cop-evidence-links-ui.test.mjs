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

// ── Team votes and ranking ──────────────────────────────────────────

const filed = (id, up, down, created_at) => ({ id, up, down, created_at })

test('rankFiled: score (up − down) first, then the newest; ties keep their order', () => {
  const items = [
    filed('old-liked', 3, 1, '2026-10-20T08:00:00Z'),
    filed('new-unvoted', 0, 0, '2026-10-23T09:00:00Z'),
    filed('disliked', 0, 2, '2026-10-23T10:00:00Z'),
    filed('newer-liked', 2, 0, '2026-10-22T08:00:00Z'),
    filed('older-unvoted', 1, 1, '2026-10-21T08:00:00Z'),
    filed('no-date', 0, 0, ''),
  ]
  assert.deepEqual(mod.rankFiled(items, (i) => i.created_at).map((i) => i.id), [
    'newer-liked', 'old-liked', 'new-unvoted', 'older-unvoted', 'no-date', 'disliked',
  ])
  // Items from an older server (no counts) rank by date only, and the input is left as it was.
  const plain = [{ id: 'a', created_at: '2026-10-01T00:00:00Z' }, { id: 'b', created_at: '2026-10-02T00:00:00Z' }]
  assert.deepEqual(mod.rankFiled(plain, (i) => i.created_at).map((i) => i.id), ['b', 'a'])
  assert.deepEqual(plain.map((i) => i.id), ['a', 'b'])
})

test('nextVote and applyVote: a press toggles, switching moves the count, counts never go negative', () => {
  assert.equal(mod.nextVote(0, 1), 1)
  assert.equal(mod.nextVote(1, 1), 0)
  assert.equal(mod.nextVote(1, -1), -1)
  assert.equal(mod.nextVote(-1, -1), 0)
  const item = { up: 2, down: 1, my_vote: 0 }
  assert.deepEqual(mod.applyVote(item, 1), { up: 3, down: 1, my_vote: 1 })
  assert.deepEqual(mod.applyVote({ up: 3, down: 1, my_vote: 1 }, -1), { up: 2, down: 2, my_vote: -1 })
  assert.deepEqual(mod.applyVote({ up: 2, down: 2, my_vote: -1 }, 0), { up: 2, down: 1, my_vote: 0 })
  assert.deepEqual(mod.applyVote({ up: 0, down: 0, my_vote: 1 }, 0), { up: 0, down: 0, my_vote: 0 })
})

test('normalizeLink: votes default to none; junk counts and votes are dropped', () => {
  const base = { id: 'evl-1', evidence_id: '7', target_type: 'rfi', target_id: 'q1', relation: 'supports' }
  assert.deepEqual(mod.normalizeLink(base), { ...base, note: null, created_at: '', up: 0, down: 0, my_vote: 0 })
  const odd = mod.normalizeLink({ ...base, up: -3, down: '9', my_vote: 2 })
  assert.deepEqual([odd.up, odd.down, odd.my_vote], [0, 0, 0])
  const real = mod.normalizeLink({ ...base, up: 4, down: 1, my_vote: -1 })
  assert.deepEqual([real.up, real.down, real.my_vote], [4, 1, -1])
})

test('voteErrorMessage: says why the vote was not saved', () => {
  assert.match(mod.voteErrorMessage({ status: 503, code: 'EVIDENCE_VOTES_UNAVAILABLE', error: null }), /isn’t available/)
  assert.match(mod.voteErrorMessage({ status: 403, code: null, error: null }), /team can vote/)
  assert.match(mod.voteErrorMessage({ status: 404, code: 'LINK_NOT_FOUND', error: null }), /isn’t filed here/)
  assert.match(mod.voteErrorMessage({ status: 0, code: null, error: null }), /wasn’t saved/)
})

// ── The evidence form's question checklist ─────────────────────────

test('question checklist: tick adds "supports", tick again removes, never more than 5', () => {
  let picks = []
  picks = mod.togglePick(picks, 'q1')
  picks = mod.togglePick(picks, 'q2')
  assert.deepEqual(picks, [{ id: 'q1', relation: 'supports' }, { id: 'q2', relation: 'supports' }])
  picks = mod.togglePick(picks, 'q1')
  assert.deepEqual(picks.map((p) => p.id), ['q2'])
  for (const id of ['q3', 'q4', 'q5', 'q6', 'q7']) picks = mod.togglePick(picks, id)
  assert.equal(mod.MAX_QUESTIONS_PER_TIP, 5)
  assert.deepEqual(picks.map((p) => p.id), ['q2', 'q3', 'q4', 'q5', 'q6'])
  // At the limit, unticking still works.
  assert.deepEqual(mod.togglePick(picks, 'q4').map((p) => p.id), ['q2', 'q3', 'q5', 'q6'])
})

test('question checklist: each ticked question keeps its own relation', () => {
  const picks = mod.setPickRelation(mod.setPickRelation([{ id: 'q1', relation: 'supports' }, { id: 'q2', relation: 'supports' }], 'q2', 'contradicts'), 'q1', 'context')
  assert.deepEqual(picks, [{ id: 'q1', relation: 'context' }, { id: 'q2', relation: 'contradicts' }])
  assert.deepEqual(mod.setPickRelation(picks, 'q9', 'supports'), picks)
})

test('question checklist: "+ Add evidence" ticks only an offered question; a reloaded list keeps what it still offers', () => {
  assert.deepEqual(mod.preselectPicks('q2', ['q1', 'q2']), [{ id: 'q2', relation: 'supports' }])
  assert.deepEqual(mod.preselectPicks('q9', ['q1', 'q2']), [])
  assert.deepEqual(mod.preselectPicks(null, ['q1']), [])
  const picks = [{ id: 'q1', relation: 'context' }, { id: 'gone', relation: 'supports' }]
  assert.deepEqual(mod.keepOffered(picks, ['q1', 'q2']), [{ id: 'q1', relation: 'context' }])
  assert.equal(mod.filedUnderLabel(1), 'Filed under:')
  assert.equal(mod.filedUnderLabel(3), 'Filed under 3 questions:')
})
