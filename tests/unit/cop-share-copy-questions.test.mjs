/**
 * Copying questions on a public COP share (src/components/cop/shell/copy-questions.ts):
 *   - a question's Copy puts exactly its text on the clipboard: trimmed, no star, no
 *     priority or status;
 *   - Copy all is a header line and the open questions, key ones first, numbered, one
 *     per line, and nothing else;
 *   - copying tries the Clipboard API, then the textarea fallback, and reports a
 *     failure instead of throwing;
 *   - a failed copy tells the visitor how to copy it themselves.
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
  const dir = mkdtempSync(join(tmpdir(), 'rt-copy-questions-'))
  try {
    const outfile = join(dir, 'copy-questions.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/components/cop/shell/copy-questions.ts')],
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

const rfi = (question, status = 'open') => ({ id: question, question, status, priority: 'high' })

test('questionCopyText: the question as written, trimmed; nothing else', () => {
  assert.equal(mod.questionCopyText('  Is the Stade de France perimeter closed?  '), 'Is the Stade de France perimeter closed?')
  assert.equal(mod.questionCopyText('where are the teams staying before and after the game ?'), 'where are the teams staying before and after the game ?')
  // Line breaks inside the question stay: the copy is the question, not a reformatted one.
  assert.equal(mod.questionCopyText('\nLine one\nline two\n'), 'Line one\nline two')
  assert.equal(mod.questionCopyText(''), '')
  assert.equal(mod.questionCopyText(null), '')
  assert.equal(mod.questionCopyText(undefined), '')
  assert.equal(mod.questionCopyText(42), '')
})

test('openQuestionLines: open questions only, key first, then untracked key ones, then the others', () => {
  const lines = mod.openQuestionLines({
    key: [rfi('Key open A?'), rfi('Key answered?', 'answered'), rfi('Key open B?')],
    untracked: ['Untracked key?'],
    others: [rfi('Other closed?', 'closed'), rfi('Other open?'), rfi('Other accepted?', 'accepted')],
  })
  assert.deepEqual(lines, ['Key open A?', 'Key open B?', 'Untracked key?', 'Other open?'])
})

test('openQuestionLines: one line each, no duplicates, no blanks', () => {
  const lines = mod.openQuestionLines({
    key: [rfi('  Any crowd build-up\nat Porte de la Chapelle?  '), rfi('   ')],
    others: [rfi('any crowd build-up at Porte de la Chapelle'), rfi('Was\tthe   fan zone moved?')],
  })
  assert.deepEqual(lines, ['Any crowd build-up at Porte de la Chapelle?', 'Was the fan zone moved?'])
  assert.deepEqual(mod.openQuestionLines({ key: [], others: [] }), [])
  assert.deepEqual(mod.openQuestionLines({ key: [rfi('Closed?', 'closed')], untracked: [], others: [] }), [])
})

test('formatOpenQuestions: header line, then "1. …" per question, nothing else', () => {
  const text = mod.formatOpenQuestions('France NFL Overwatch', ['Is the perimeter closed?', 'Where are the teams staying?'])
  assert.equal(text, 'Open questions — France NFL Overwatch\n1. Is the perimeter closed?\n2. Where are the teams staying?')
  assert.equal(text.endsWith('\n'), false)
})

test('formatOpenQuestions: a COP name on one line; no name, just the header; no questions, nothing', () => {
  assert.equal(mod.formatOpenQuestions('  France\n NFL  ', ['Q?']), 'Open questions — France NFL\n1. Q?')
  assert.equal(mod.formatOpenQuestions('', ['Q?']), 'Open questions\n1. Q?')
  assert.equal(mod.formatOpenQuestions(null, ['Q?']), 'Open questions\n1. Q?')
  assert.equal(mod.formatOpenQuestions('France NFL Overwatch', []), '')
})

test('formatOpenQuestions: numbering keeps counting past 9', () => {
  const lines = Array.from({ length: 11 }, (_, i) => `Question ${i + 1}?`)
  const text = mod.formatOpenQuestions('X', lines)
  assert.equal(text.split('\n').length, 12)
  assert.equal(text.split('\n')[11], '11. Question 11?')
})

test('copyText: the Clipboard API when it works; the fallback is not used', async () => {
  const written = []
  let legacyCalls = 0
  const ok = await mod.copyText('Q?', {
    clipboard: { writeText: async (t) => { written.push(t) } },
    legacyCopy: () => { legacyCalls += 1; return true },
  })
  assert.equal(ok, true)
  assert.deepEqual(written, ['Q?'])
  assert.equal(legacyCalls, 0)
})

test('copyText: a refused Clipboard API (no permission) falls back to the textarea copy', async () => {
  const legacy = []
  const ok = await mod.copyText('Q?', {
    clipboard: { writeText: async () => { throw new DOMException('Write permission denied.', 'NotAllowedError') } },
    legacyCopy: (t) => { legacy.push(t); return true },
  })
  assert.equal(ok, true)
  assert.deepEqual(legacy, ['Q?'])
})

test('copyText: no Clipboard API (insecure context) uses the fallback straight away', async () => {
  const legacy = []
  assert.equal(await mod.copyText('Q?', { clipboard: null, legacyCopy: (t) => { legacy.push(t); return true } }), true)
  assert.equal(await mod.copyText('Q?', { clipboard: {}, legacyCopy: (t) => { legacy.push(t); return true } }), true)
  assert.deepEqual(legacy, ['Q?', 'Q?'])
})

test('copyText: both failing reports false and never throws', async () => {
  const refused = { writeText: async () => { throw new Error('denied') } }
  assert.equal(await mod.copyText('Q?', { clipboard: refused, legacyCopy: () => false }), false)
  assert.equal(await mod.copyText('Q?', { clipboard: refused, legacyCopy: () => { throw new Error('execCommand') } }), false)
  assert.equal(await mod.copyText('Q?', { clipboard: null, legacyCopy: null }), false)
  assert.equal(await mod.copyText('Q?', {}), false)
  // Nothing to copy is not a success.
  let calls = 0
  assert.equal(await mod.copyText('', { clipboard: { writeText: async () => { calls += 1 } } }), false)
  assert.equal(calls, 0)
})

test('copyHint: press and hold on touch screens, the shortcut with a mouse', () => {
  assert.equal(mod.copyHint({ coarsePointer: true, apple: true }), 'Press and hold to copy.')
  assert.equal(mod.copyHint({ coarsePointer: true, apple: false }), 'Press and hold to copy.')
  assert.equal(mod.copyHint({ coarsePointer: false, apple: true }), 'Press ⌘C to copy.')
  assert.equal(mod.copyHint({ coarsePointer: false, apple: false }), 'Press Ctrl+C to copy.')
})

test('copyNotice: what the live region says after a copy', () => {
  const hint = 'Press and hold to copy.'
  assert.equal(mod.copyNotice({ what: 'question', ok: true, hint }), 'Question copied.')
  assert.equal(mod.copyNotice({ what: 'all', ok: true, count: 4, hint }), 'Copied 4 open questions.')
  assert.equal(mod.copyNotice({ what: 'all', ok: true, count: 1, hint }), 'Copied 1 open question.')
  assert.equal(mod.copyNotice({ what: 'question', ok: false, hint }), "Couldn't copy automatically. The question is selected. Press and hold to copy.")
  assert.equal(mod.copyNotice({ what: 'all', ok: false, count: 4, hint }), "Couldn't copy automatically. The questions are selected in a text box. Press and hold to copy.")
})
