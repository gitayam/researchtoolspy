/**
 * Answering questions on a public COP share (src/components/cop/shell/share-answers.ts):
 *   - yes/no questions (Is/Are/Was/… Should, any case) get the quick choices;
 *   - a choice becomes the answer's first word;
 *   - after a send, the next question is an open one, key first, fewest answers;
 *   - a draft per question survives in sessionStorage, and broken storage never throws;
 *   - a failed send says what failed (429: the link's limit).
 *
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
  const dir = mkdtempSync(join(tmpdir(), 'rt-share-answers-'))
  try {
    const outfile = join(dir, 'share-answers.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/components/cop/shell/share-answers.ts')],
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

class MemoryStore {
  constructor() { this.map = new Map() }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const throwing = {
  getItem() { throw new Error('SecurityError') },
  setItem() { throw new Error('QuotaExceededError') },
  removeItem() { throw new Error('SecurityError') },
}

test('isYesNoQuestion: every listed opening word, any case', () => {
  const openings = ['Is', 'Are', 'Was', 'Were', 'Did', 'Does', 'Do', 'Has', 'Have', 'Had', 'Can', 'Could', 'Will', 'Would', 'Should']
  for (const word of openings) {
    assert.equal(mod.isYesNoQuestion(`${word} the bridge open?`), true, word)
    assert.equal(mod.isYesNoQuestion(`${word.toLowerCase()} the bridge open?`), true, word.toLowerCase())
    assert.equal(mod.isYesNoQuestion(`${word.toUpperCase()} THE BRIDGE OPEN?`), true, word.toUpperCase())
  }
})

test('isYesNoQuestion: negative contractions, leading quotes and spaces', () => {
  for (const q of ["Isn't the stadium closed?", 'Didn’t the police clear it?', "Won't they reopen?", "Can't we see it?", 'Cannot anyone confirm?', "Doesn't it?", "Don't they?", '  "Is it on?"', '(Was it cancelled?)']) {
    assert.equal(mod.isYesNoQuestion(q), true, q)
  }
})

test('isYesNoQuestion: other questions and look-alike words get no chips', () => {
  for (const q of [
    'Where are the teams staying before and after the game ?',
    'any of the official warnings that have gone out, who put them out, when , and how/where',
    'Isolated incidents near gate B?',
    'Canada border crossings open?',
    'William Street closed?',
    'Island ferry running?',
    'Dozens of police at the station?',
    'Area around the stadium cleared?',
    'Hadrian’s wall closed?',
    'What time does the match start?',
    'Who is organising the march?',
    '',
    null,
    undefined,
  ]) {
    assert.equal(mod.isYesNoQuestion(q), false, String(q))
  }
})

test('composeAnswerText: the choice is the first word; details are optional', () => {
  assert.equal(mod.composeAnswerText('Yes', ''), 'Yes')
  assert.equal(mod.composeAnswerText('Not sure', '   '), 'Not sure')
  assert.equal(mod.composeAnswerText('Partly', '  only one lane is open '), 'Partly — only one lane is open')
  assert.equal(mod.composeAnswerText(null, '  Seen at 14:10  '), 'Seen at 14:10')
  assert.equal(mod.composeAnswerText(null, ''), '')
})

test('pickNextQuestion: open before answered, key first, fewest answers, list order; never the current one', () => {
  const q = (id, status, isKey, answerCount) => ({ id, status, isKey, answerCount })
  const list = [
    q('a', 'open', false, 0),
    q('b', 'open', true, 2),
    q('c', 'open', true, 0),
    q('d', 'answered', true, 0),
    q('e', 'closed', true, 0),
    q('f', 'accepted', true, 0),
    q('g', 'open', true, 0),
  ]
  assert.equal(mod.pickNextQuestion(list, null).id, 'c')
  assert.equal(mod.pickNextQuestion(list, 'c').id, 'g')
  assert.equal(mod.pickNextQuestion(list.filter((x) => x.id !== 'g'), 'c').id, 'b')
  // With no key question open, the open non-key one comes before an answered key one.
  assert.equal(mod.pickNextQuestion([q('a', 'open', false, 3), q('d', 'answered', true, 0)], null).id, 'a')
  // Only answered ones left: still offered (the server takes more answers), fewest first.
  assert.equal(mod.pickNextQuestion([q('x', 'answered', false, 4), q('y', 'answered', false, 1), q('z', 'closed', false, 0)], 'w').id, 'y')
  assert.equal(mod.pickNextQuestion([q('a', 'open', true, 0)], 'a'), null)
  assert.equal(mod.pickNextQuestion([q('e', 'closed', true, 0), q('f', 'accepted', false, 0)], null), null)
  assert.equal(mod.pickNextQuestion([], null), null)
})

test('drafts: one per question, round-trips, an empty draft removes the key', () => {
  const store = new MemoryStore()
  assert.deepEqual(mod.readAnswerDraft(store, 'rfi-1'), { choice: null, details: '', source: '' })
  mod.writeAnswerDraft(store, 'rfi-1', { choice: 'Partly', details: 'one lane', source: 'https://example.org/a' })
  mod.writeAnswerDraft(store, 'rfi-2', { choice: null, details: 'other', source: '' })
  assert.deepEqual(mod.readAnswerDraft(store, 'rfi-1'), { choice: 'Partly', details: 'one lane', source: 'https://example.org/a' })
  assert.deepEqual(mod.readAnswerDraft(store, 'rfi-2'), { choice: null, details: 'other', source: '' })
  assert.notEqual(mod.answerDraftKey('rfi-1'), mod.answerDraftKey('rfi-2'))
  mod.writeAnswerDraft(store, 'rfi-1', { choice: null, details: '  ', source: '' })
  assert.equal(store.getItem(mod.answerDraftKey('rfi-1')), null)
  mod.clearAnswerDraft(store, 'rfi-2')
  assert.equal(store.map.size, 0)
})

test('drafts: the key carries the question id only, never the share token', () => {
  assert.equal(mod.answerDraftKey('rfi-abc'), 'rt:cop-answer-draft:v1:rfi-abc')
})

test('drafts: tampered or broken storage reads as an empty or cleaned draft and never throws', () => {
  const store = new MemoryStore()
  store.setItem(mod.answerDraftKey('r'), '{not json')
  assert.deepEqual(mod.readAnswerDraft(store, 'r'), { choice: null, details: '', source: '' })
  store.setItem(mod.answerDraftKey('r'), JSON.stringify({ choice: 'Maybe', details: 42, source: 'x'.repeat(5000) }))
  const draft = mod.readAnswerDraft(store, 'r')
  assert.equal(draft.choice, null)
  assert.equal(draft.details, '')
  assert.equal(draft.source.length, mod.SOURCE_MAX)
  assert.deepEqual(mod.readAnswerDraft(throwing, 'r'), { choice: null, details: '', source: '' })
  assert.deepEqual(mod.readAnswerDraft(null, 'r'), { choice: null, details: '', source: '' })
  assert.doesNotThrow(() => mod.writeAnswerDraft(throwing, 'r', { choice: 'Yes', details: '', source: '' }))
  assert.doesNotThrow(() => mod.clearAnswerDraft(throwing, 'r'))
  assert.equal(mod.readAnswerName(throwing), '')
  assert.doesNotThrow(() => mod.writeAnswerName(throwing, 'Sam'))
})

test('name: kept per tab, capped, cleared when blank', () => {
  const store = new MemoryStore()
  mod.writeAnswerName(store, 'Sam')
  assert.equal(mod.readAnswerName(store), 'Sam')
  mod.writeAnswerName(store, 'x'.repeat(300))
  assert.equal(mod.readAnswerName(store).length, mod.NAME_MAX)
  mod.writeAnswerName(store, '   ')
  assert.equal(store.getItem(mod.ANSWER_NAME_KEY), null)
})

test('isValidSourceLink: empty or http(s) only', () => {
  assert.equal(mod.isValidSourceLink(''), true)
  assert.equal(mod.isValidSourceLink('  https://example.org/x '), true)
  assert.equal(mod.isValidSourceLink('http://example.org'), true)
  assert.equal(mod.isValidSourceLink('javascript:alert(1)'), false)
  assert.equal(mod.isValidSourceLink('example.org/page'), false)
  assert.equal(mod.isValidSourceLink(`https://example.org/${'a'.repeat(2100)}`), false)
})

test('answerErrorMessage: 429 is the link limit; others say what failed', () => {
  assert.equal(mod.answerErrorMessage(429, 'Too many answers from this address; try again later'), 'Too many answers on this link right now. Try again later.')
  assert.equal(mod.answerErrorMessage(429), mod.RATE_LIMITED_MESSAGE)
  assert.match(mod.answerErrorMessage(null), /no response from the server/)
  assert.equal(mod.answerErrorMessage(400, 'Answer text is required'), 'Not sent: Answer text is required.')
  assert.equal(mod.answerErrorMessage(400, ''), 'Not sent: the answer was refused.')
  assert.match(mod.answerErrorMessage(403), /no longer takes answers/)
  assert.match(mod.answerErrorMessage(404), /no longer on this link/)
  assert.match(mod.answerErrorMessage(410), /no longer taking answers/)
  assert.match(mod.answerErrorMessage(503), /unavailable right now/)
  assert.match(mod.answerErrorMessage(500), /error 500/)
})
