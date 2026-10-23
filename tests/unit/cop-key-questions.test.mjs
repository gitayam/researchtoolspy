/**
 * Key questions are starred RFIs (src/components/cop/shell/key-questions.ts).
 *
 * A COP's key questions are a list of strings on the session; RFIs are separate
 * rows. The shared view and the workspace list key questions first, starred:
 *   - with a server that reports `is_key`, exactly the RFIs it stars;
 *   - before that, an RFI whose text matches a key question (ignoring case,
 *     spacing and trailing punctuation);
 *   - key questions no RFI tracks yet are listed once, as untracked.
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
  const dir = mkdtempSync(join(tmpdir(), 'rt-key-questions-'))
  try {
    const outfile = join(dir, 'key-questions.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/components/cop/shell/key-questions.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      outfile,
      logLevel: 'silent',
    })
    mod = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const rfi = (id, question, extra = {}) => ({ id, question, ...extra })

test('without server stars, an RFI matching a key question is starred; the rest are untracked', () => {
  const { splitKeyQuestions } = mod
  const rfis = [
    rfi('r1', 'Who is organising the march?'),
    rfi('r2', 'Is the stadium closed'),
    rfi('r3', 'What time does the match start?'),
  ]
  const keyQuestions = ['  who is organising   the march ', 'Is the stadium closed?', 'Where will the fan zone be?', 'Where will the fan zone be']
  const split = splitKeyQuestions(rfis, keyQuestions)
  assert.equal(split.serverStars, false)
  assert.deepEqual(split.key.map((r) => r.id), ['r1', 'r2'])
  assert.deepEqual(split.others.map((r) => r.id), ['r3'])
  // Listed once, in its first spelling.
  assert.deepEqual(split.untracked, ['Where will the fan zone be?'])
})

test('with server stars, is_key decides, whatever the text', () => {
  const { splitKeyQuestions } = mod
  const rfis = [
    rfi('r1', 'Who is organising the march?', { is_key: 0 }),
    rfi('r2', 'Unrelated but starred', { is_key: 1 }),
    rfi('r3', 'Also starred', { is_key: true }),
  ]
  const split = splitKeyQuestions(rfis, ['Who is organising the march?'])
  assert.equal(split.serverStars, true)
  assert.deepEqual(split.key.map((r) => r.id), ['r2', 'r3'])
  assert.deepEqual(split.others.map((r) => r.id), ['r1'])
  // An RFI with the same text tracks it, starred or not.
  assert.deepEqual(split.untracked, [])
})

test('empty, blank and missing key questions are ignored', () => {
  const { splitKeyQuestions } = mod
  const split = splitKeyQuestions([rfi('r1', 'Anything?')], ['', '   ', null])
  assert.deepEqual(split.key, [])
  assert.deepEqual(split.untracked, [])
  assert.deepEqual(splitKeyQuestions([], undefined).untracked, [])
})
