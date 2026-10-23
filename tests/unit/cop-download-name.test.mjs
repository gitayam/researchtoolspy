/**
 * Downloaded COP files are named from the title, with the extension the server gave the
 * stored type (src/lib/download-name.ts) — never one from the title or original name.
 * The client's allow-list stays equal to the server's DOWNLOAD_EXTENSIONS.
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
const mods = {}

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-download-name-'))
  try {
    for (const [name, entry] of [['client', 'src/lib/download-name.ts'], ['server', 'functions/api/_shared/document-sniff.ts']]) {
      const outfile = join(dir, `${name}.mjs`)
      await build({ entryPoints: [join(ROOT, entry)], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' })
      mods[name] = await import(outfile)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the client accepts exactly the extensions the server names files with', () => {
  assert.deepEqual([...mods.client.DOWNLOAD_EXTENSION_ALLOWLIST].sort(), [...new Set(Object.values(mods.server.DOWNLOAD_EXTENSIONS))].sort())
})

test('the extension comes from the server\'s Content-Disposition, and only from the allow-list', () => {
  const { extensionFromDisposition } = mods.client
  assert.equal(extensionFromDisposition('attachment; filename="upl-1234.docx"'), 'docx')
  assert.equal(extensionFromDisposition('attachment; filename="upl-1234.PDF"'), 'pdf')
  assert.equal(extensionFromDisposition('attachment; filename="upl-1234.exe"'), 'bin')
  assert.equal(extensionFromDisposition('inline'), 'bin')
  assert.equal(extensionFromDisposition(null), 'bin')
})

test('the title gives only the base name: its own extensions, paths and controls are dropped', () => {
  const { downloadName } = mods.client
  assert.equal(downloadName('Prefecture notice', 'pdf'), 'Prefecture notice.pdf')
  assert.equal(downloadName('report.exe', 'docx'), 'report.docx')
  assert.equal(downloadName('invoice.pdf.exe', 'txt'), 'invoice.txt')
  assert.equal(downloadName('../../evil.lnk', 'm4a'), 'evil.m4a')
  assert.equal(downloadName('a\u0000b', 'txt'), 'a b.txt')
  assert.equal(downloadName('', 'mp3'), 'file.mp3')
  assert.equal(downloadName('Notes', 'exe'), 'Notes.bin')
})
