/**
 * src/lib/cop-archive-link.ts: the evidence card's link to an item's original.
 *
 * - A Silo original and a PeerTube video are linked with their own labels, https only.
 * - A held item, an unknown kind, a non-https or credentialed URL get no link.
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
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-archive-ui-'))
  try {
    const outfile = join(dir, 'archive.mjs')
    await build({
      entryPoints: [join(ROOT, 'src/lib/cop-archive-link.ts')],
      bundle: true, format: 'esm', platform: 'node', target: 'es2022', outfile,
      tsconfig: join(ROOT, 'tsconfig.app.json'), logLevel: 'silent',
    })
    mod = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a Silo original and a PeerTube video each get their link and label', () => {
  const silo = mod.archiveLinkFor({ archived_in: 'silo', archive_url: 'https://irregulars.io/files/breakout/4212', held: false })
  assert.equal(silo.href, 'https://irregulars.io/files/breakout/4212')
  assert.equal(silo.label, 'Original in Silo — room members')
  assert.match(silo.hint, /!linkme/)
  const video = mod.archiveLinkFor({ archived_in: 'peertube', archive_url: 'https://videos.irregularchat.com/w/abc' })
  assert.equal(video.label, 'Video on PeerTube')
})

test('no link for a held item, an unknown kind, or anything but a plain https URL', () => {
  const base = { archived_in: 'silo', archive_url: 'https://irregulars.io/files/breakout/1' }
  assert.equal(mod.archiveLinkFor({ ...base, held: true }), null)
  assert.equal(mod.isHeld({ held: true }), true)
  assert.equal(mod.archiveLinkFor({ ...base, archived_in: 'upload' }), null)
  for (const href of ['javascript:alert(1)', 'http://irregulars.io/files/breakout/1', 'https://u:p@irregulars.io/x', 'not a url', 42, null]) {
    assert.equal(mod.archiveLinkFor({ ...base, archive_url: href }), null, String(href))
  }
  assert.equal(mod.archiveLinkFor(null), null)
  assert.equal(mod.archiveLinkFor({}), null)
})
