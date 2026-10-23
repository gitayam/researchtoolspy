/**
 * The UI side of keeping a photo's location for the team (decision 2026-10-23).
 *
 * - src/lib/cop-photo-location.ts: the team evidence card's "Photo location" link is
 *   built only from a well-formed photo_location; it opens the map at that point.
 * - The anonymous tip form (PublicIntakeForm in drop mode) tells the tipster, before
 *   submit and beside every file input, that photos keep their location, and no longer
 *   promises that nothing identifying is recorded; IP, device and identity still aren't.
 * - The team's evidence feed renders it; the public share page never does.
 *
 * Modules are bundled with esbuild (the app's `@/` alias); the notice is rendered with
 * react-dom/server. Run: npm run test:unit
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const ROOT = new URL('../../', import.meta.url).pathname
let mod

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-photo-location-ui-'))
  try {
    const outfile = join(dir, 'ui.mjs')
    await build({
      stdin: {
        contents: [
          "export * from '@/lib/cop-photo-location'",
          "export * from '@/lib/tip-privacy'",
          "export { TipPhotoLocationNote } from '@/components/cop/TipPhotoLocationNote'",
          "export { CopPhotoLocationLink } from '@/components/cop/CopPhotoLocationLink'",
          "export { createElement } from 'react'",
          "export { renderToStaticMarkup } from 'react-dom/server'",
        ].join('\n'),
        resolveDir: ROOT,
        loader: 'ts',
      },
      bundle: true, format: 'esm', platform: 'node', target: 'es2022', outfile,
      tsconfig: join(ROOT, 'tsconfig.app.json'), jsx: 'automatic', logLevel: 'silent',
      // react-dom/server is CommonJS and requires Node built-ins.
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    })
    mod = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const source = (path) => readFileSync(join(ROOT, path), 'utf8')

test('the evidence card link comes only from a well-formed photo_location', () => {
  const ok = mod.photoLocationFor({ photo_location: { marker_id: 'mkr-1a2b3c4d5e6f', lat: 48.8583, lon: 2.2945, confirmed: false } })
  assert.deepEqual(ok, { markerId: 'mkr-1a2b3c4d5e6f', lat: 48.8583, lon: 2.2945, confirmed: false })
  for (const bad of [
    null, {}, { photo_location: null }, { photo_location: 'x' },
    { photo_location: { marker_id: 'mkr-1', lat: 91, lon: 0 } },
    { photo_location: { marker_id: 'mkr-1', lat: 1, lon: 181 } },
    { photo_location: { marker_id: 'mkr-1', lat: '48', lon: 2 } },
    { photo_location: { marker_id: '"><img src=x>', lat: 1, lon: 1 } },
    { photo_location: { lat: 1, lon: 1 } },
  ]) {
    assert.equal(mod.photoLocationFor(bad), null, JSON.stringify(bad))
  }
  assert.equal(mod.photoLocationLabel(ok).text, 'Photo location')
  assert.match(mod.photoLocationLabel(ok).title, /team only until confirmed/)
  assert.doesNotMatch(mod.photoLocationLabel({ ...ok, confirmed: true }).title, /team only/)
  // The link renders with an icon from the icon set (an svg), never an emoji.
  const html = mod.renderToStaticMarkup(mod.createElement(mod.CopPhotoLocationLink, { location: ok }))
  assert.match(html, /<svg[^>]*lucide/)
  assert.match(html, /Photo location/)
  assert.doesNotMatch(html, /\u{1F4CD}/u)
  assert.equal(mod.renderToStaticMarkup(mod.createElement(mod.CopPhotoLocationLink, { location: null })), '')
  // The team's evidence feed shows it; the public share page never does.
  assert.match(source('src/components/cop/CopEvidenceFeed.tsx'), /<CopPhotoLocationLink location=\{item\.photo_location\}/)
  assert.doesNotMatch(source('src/pages/PublicCopPage.tsx'), /photo_location|CopPhotoLocationLink|photoLocationFor/)
})

test('the link asks the workspace to open the map at the point, once', () => {
  mod.focusCopMap({ lat: 48.8583, lon: 2.2945, markerId: 'mkr-1' })
  assert.deepEqual(mod.takePendingMapFocus(), { lat: 48.8583, lon: 2.2945, markerId: 'mkr-1' })
  assert.equal(mod.takePendingMapFocus(), null)
  assert.equal(mod.COP_MAP_FOCUS_EVENT, 'cop:map-focus')
  // The workspace shows the map for it, and the map centres on it.
  assert.match(source('src/pages/CopWorkspacePage.tsx'), /addEventListener\(COP_MAP_FOCUS_EVENT, show\)/)
  assert.match(source('src/components/cop/CopMap.tsx'), /addEventListener\(COP_MAP_FOCUS_EVENT, onFocus\)/)
})

test('the tip form says photos keep their location, before submit and beside every file input', () => {
  // Where AND when: the team copy keeps position, altitude, date, time and time zone.
  assert.equal(
    mod.TIP_PHOTO_LOCATION_NOTICE,
    "Photos keep where and when they were taken (GPS position, altitude, date, time and time zone) so the team can place them on the map. Remove this from the photo first if you don't want to share it.",
  )
  // A screenshot has no GPS position but can still carry a date (XMP photoshop:DateCreated).
  assert.doesNotMatch(mod.TIP_PHOTO_LOCATION_HOWTO, /carries none|no metadata/)
  assert.match(mod.TIP_PHOTO_LOCATION_HOWTO, /screenshot/)
  assert.match(mod.TIP_PHOTO_LOCATION_HOWTO, /date/)
  // Still promised, and still true: IP, device and identity are not recorded.
  assert.match(mod.TIP_IDENTITY_PROMISE, /IP address/)
  assert.match(mod.TIP_IDENTITY_PROMISE, /device/)
  assert.match(mod.TIP_IDENTITY_PROMISE, /who you are/)
  const html = mod.renderToStaticMarkup(mod.createElement(mod.TipPhotoLocationNote, {}))
  assert.ok(html.includes('Photos keep where and when they were taken (GPS position, altitude, date, time and time zone)'), html)

  const form = source('src/components/cop/PublicIntakeForm.tsx')
  // The old promise was false once photos keep their location.
  assert.doesNotMatch(form, /anything else that identifies you/)
  // In the drop-mode banner, which is above the fields and the submit button.
  const banner = form.indexOf('Anonymous Tip Line')
  const bannerNote = form.indexOf('<TipPhotoLocationNote />', banner)
  assert.ok(banner > 0 && bannerNote > banner && bannerNote < form.indexOf('Submit Anonymously'), 'banner notice before submit')
  assert.ok(form.slice(banner, bannerNote).includes('{TIP_IDENTITY_PROMISE}'))
  // Beside every file input in drop mode.
  assert.match(form, /\{field\.type === 'file' && isDropMode && <TipPhotoLocationNote inline \/>\}/)
})
