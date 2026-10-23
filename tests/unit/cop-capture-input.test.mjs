/**
 * COP capture input (src/lib/cop-capture.ts, src/lib/photo-gps.ts,
 * src/components/cop/tags/tag-names.ts): the pure parts of the capture bar.
 *
 * - `#tags`: a trailing run is removed, inline ones keep their word, URL
 *   fragments and C# are left alone, numbers are not tags.
 * - Several pasted lines split into one capture per line.
 * - The free kind hint for plain text.
 * - Tag names follow the server's rules; filters match any/all.
 * - A JPEG's EXIF GPS is read (both byte orders) and anything malformed is null.
 *
 * The real modules are bundled with esbuild (with the app's `@/` path alias).
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
const ENTRIES = {
  capture: 'src/lib/cop-capture.ts',
  gps: 'src/lib/photo-gps.ts',
  tags: 'src/components/cop/tags/tag-names.ts',
}
const built = {}

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-capture-'))
  try {
    for (const [name, entry] of Object.entries(ENTRIES)) {
      const outfile = join(dir, `${name}.mjs`)
      await build({
        entryPoints: [join(ROOT, entry)],
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'es2022',
        outfile,
        tsconfig: join(ROOT, 'tsconfig.app.json'),
        logLevel: 'silent',
      })
      built[name] = await import(outfile)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── #tags ──────────────────────────────────────────────────────────

test('extractHashtags: a trailing run of tags leaves the text, ~credibility stays', () => {
  const { extractHashtags } = built.capture
  assert.deepEqual(extractHashtags('convoy at the north gate #bridge #convoy ~probable'), {
    text: 'convoy at the north gate ~probable',
    tags: ['bridge', 'convoy'],
  })
  assert.deepEqual(extractHashtags('convoy at the gate #bridge ~probable #convoy'), {
    text: 'convoy at the gate ~probable',
    tags: ['bridge', 'convoy'],
  })
})

test('extractHashtags: an inline tag keeps its word', () => {
  const { extractHashtags } = built.capture
  assert.deepEqual(extractHashtags('#convoy left at 9 from the depot'), {
    text: 'convoy left at 9 from the depot',
    tags: ['convoy'],
  })
})

test('extractHashtags: URL fragments, C#, numbers and lone # are not tags', () => {
  const { extractHashtags } = built.capture
  for (const text of ['see https://example.com/page#section', 'written in C# mostly', '#1 priority today', 'issue # 4']) {
    assert.deepEqual(extractHashtags(text), { text, tags: [] }, text)
  }
})

test('extractHashtags: trailing punctuation, Unicode, duplicates and the cap', () => {
  const { extractHashtags } = built.capture
  assert.deepEqual(extractHashtags('seen near #Saint-Denis.'), { text: 'seen near', tags: ['Saint-Denis'] })
  assert.deepEqual(extractHashtags('crowd #émeute #Paris #paris'), { text: 'crowd', tags: ['émeute', 'Paris'] })
  const many = Array.from({ length: 14 }, (_, i) => `#t${i}a`).join(' ')
  assert.equal(extractHashtags(`x ${many}`).tags.length, 10)
})

test('parseCapture carries #tags for every kind except a form', () => {
  const { parseCapture } = built.capture
  const rfi = parseCapture('rfi!: who controls the bridge? #bridge')
  assert.equal(rfi.kind, 'rfi')
  assert.equal(rfi.priority, 'high')
  assert.equal(rfi.body, 'who controls the bridge?')
  assert.deepEqual(rfi.tags, ['bridge'])

  const url = parseCapture('https://example.com/article #paris')
  assert.equal(url.kind, 'url')
  assert.deepEqual(url.tags, ['paris'])

  assert.equal(parseCapture('survey: Witness form #x').tags, undefined)
  assert.equal(parseCapture('#paris'), null)
  assert.equal(parseCapture('rfi: #bridge'), null)

  const credible = parseCapture('two trucks at the gate #convoy ~confirmed')
  assert.equal(credible.credibility, 'confirmed')
  assert.equal(credible.body, 'two trucks at the gate')
  assert.deepEqual(credible.tags, ['convoy'])
})

test('parseCapture marks plain text as not explicit, a prefix as explicit', () => {
  const { parseCapture } = built.capture
  assert.equal(parseCapture('the gate is shut').explicit, false)
  assert.equal(parseCapture('https://example.com/x').explicit, false)
  assert.equal(parseCapture('note: the gate is shut').explicit, true)
  assert.equal(parseCapture('task: check the gate').explicit, true)
})

// ── Several lines ──────────────────────────────────────────────────

test('splitCaptureLines: one capture per line, bullets and blanks removed', () => {
  const { splitCaptureLines } = built.capture
  assert.deepEqual(splitCaptureLines('- a\n\n* b\r\n1. rfi: c?\n  d  \n• e\n2) f'), ['a', 'b', 'rfi: c?', 'd', 'e', 'f'])
  assert.deepEqual(splitCaptureLines('single line'), ['single line'])
})

// ── Kind hints ─────────────────────────────────────────────────────

test('localKindHint reads questions, instructions and timed events', () => {
  const { localKindHint, withKindPrefix } = built.capture
  assert.equal(localKindHint('who controls the bridge'), 'rfi')
  assert.equal(localKindHint('the bridge is open?'), 'rfi')
  assert.equal(localKindHint('check the north gate'), 'task')
  assert.equal(localKindHint('14:05 convoy left the depot'), 'timeline')
  assert.equal(localKindHint('2026-10-23 march began'), 'timeline')
  assert.equal(localKindHint('convoy left the depot'), null)
  assert.equal(withKindPrefix('  check the gate ', 'task'), 'task: check the gate')
  assert.equal(withKindPrefix('just a note', 'note'), 'just a note')
})

// ── Tag names ──────────────────────────────────────────────────────

test('tag names follow the server rules; filters match any or all', () => {
  const { isValidTagName, uniqueTagNames, matchesTagFilter, tagPalette, TAG_PALETTE } = built.tags
  assert.equal(isValidTagName('north gate'), true)
  assert.equal(isValidTagName('Saint-Denis_2.0'), true)
  assert.equal(isValidTagName('a/b'), false)
  assert.equal(isValidTagName('<b>'), false)
  assert.equal(isValidTagName(' '), false)
  assert.equal(isValidTagName('x'.repeat(41)), false)
  assert.deepEqual(uniqueTagNames(['Paris', ' paris ', 'a/b', 'Bridge']), ['Paris', 'Bridge'])
  assert.equal(matchesTagFilter(['Paris', 'bridge'], ['BRIDGE']), true)
  assert.equal(matchesTagFilter(['Paris'], ['paris', 'bridge'], 'all'), false)
  assert.equal(matchesTagFilter(['Paris'], []), true)
  // A stored colour is used only when it is a palette name.
  assert.equal(tagPalette('x', 'amber'), 'amber')
  assert.ok(TAG_PALETTE.includes(tagPalette('x', 'red; background:url(x)')))
  assert.equal(tagPalette('Paris', null), tagPalette('paris', null))
})

// ── Photo GPS ──────────────────────────────────────────────────────

/** A minimal JPEG whose EXIF carries a GPS position. */
function jpegWithGps({ lat, lon, little = true, zeroDen = false, latRef, lonRef }) {
  const tiff = new Uint8Array(128)
  const dv = new DataView(tiff.buffer)
  const u16 = (at, v) => dv.setUint16(at, v, little)
  const u32 = (at, v) => dv.setUint32(at, v, little)
  tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d], 0)
  u16(2, 42)
  u32(4, 8)
  // IFD0: one entry, the GPS IFD pointer (LONG) -> 26
  u16(8, 1)
  u16(10, 0x8825); u16(12, 4); u32(14, 1); u32(18, 26)
  u32(22, 0)
  // GPS IFD at 26: four entries, then rationals at 80 and 104
  u16(26, 4)
  const entry = (i, tag, type, count) => { const e = 28 + i * 12; u16(e, tag); u16(e + 2, type); u32(e + 4, count); return e + 8 }
  const latRefAt = entry(0, 1, 2, 2); tiff[latRefAt] = (latRef ?? (lat < 0 ? 'S' : 'N')).charCodeAt(0)
  u32(entry(1, 2, 5, 3), 80)
  const lonRefAt = entry(2, 3, 2, 2); tiff[lonRefAt] = (lonRef ?? (lon < 0 ? 'W' : 'E')).charCodeAt(0)
  u32(entry(3, 4, 5, 3), 104)
  u32(76, 0)
  const dms = (at, value) => {
    const v = Math.abs(value)
    const d = Math.floor(v)
    const m = Math.floor((v - d) * 60)
    const s = Math.round(((v - d) * 60 - m) * 60 * 1000)
    u32(at, d); u32(at + 4, 1); u32(at + 8, m); u32(at + 12, 1); u32(at + 16, s); u32(at + 20, zeroDen ? 0 : 1000)
  }
  dms(80, lat)
  dms(104, lon)
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0]
  const size = 2 + exif.length + tiff.length
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, size >> 8, size & 0xff, ...exif, ...tiff, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9])
}

test('parseJpegGps reads a JPEG EXIF position in both byte orders', () => {
  const { parseJpegGps } = built.gps
  for (const little of [true, false]) {
    const pos = parseJpegGps(jpegWithGps({ lat: 48.858417, lon: 2.2945, little }))
    assert.ok(pos, `byte order ${little ? 'II' : 'MM'}`)
    assert.ok(Math.abs(pos.lat - 48.858417) < 1e-4, String(pos.lat))
    assert.ok(Math.abs(pos.lon - 2.2945) < 1e-4, String(pos.lon))
  }
  const south = parseJpegGps(jpegWithGps({ lat: -33.8568, lon: -151.2153 }))
  assert.ok(south.lat < 0 && south.lon < 0)
})

test('parseJpegGps: no EXIF, malformed or meaningless positions are null', () => {
  const { parseJpegGps } = built.gps
  assert.equal(parseJpegGps(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null) // PNG
  assert.equal(parseJpegGps(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02])), null) // no EXIF
  const good = jpegWithGps({ lat: 48.8584, lon: 2.2945 })
  assert.equal(parseJpegGps(good.subarray(0, 60)), null) // truncated
  assert.equal(parseJpegGps(jpegWithGps({ lat: 48.8584, lon: 2.2945, zeroDen: true })), null)
  assert.equal(parseJpegGps(jpegWithGps({ lat: 0, lon: 0 })), null)
  assert.equal(parseJpegGps(jpegWithGps({ lat: 48.8584, lon: 2.2945, latRef: 'X' })), null)
  // A huge offset in the GPS pointer must not throw.
  const bad = jpegWithGps({ lat: 48.8584, lon: 2.2945 })
  bad[10 + 10 + 8] = 0xff; bad[10 + 10 + 9] = 0xff
  assert.equal(parseJpegGps(bad), null)
})
