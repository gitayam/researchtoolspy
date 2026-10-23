/**
 * Where a COP map opens (src/components/cop/cop-map-view.ts): a stored center wins; a
 * session without one fits its own content and never the external feeds.
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
let view

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rt-cop-map-view-'))
  try {
    const outfile = join(dir, 'view.mjs')
    await build({ entryPoints: [join(ROOT, 'src/components/cop/cop-map-view.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' })
    view = await import(outfile)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

const point = (lon, lat) => ({ geometry: { type: 'Point', coordinates: [lon, lat] } })
const external = new Set(['acled', 'gdelt'])
const own = (id) => !external.has(id)

test('a stored center counts; null, missing, NaN and 0,0 do not', () => {
  assert.equal(view.hasStoredView({ center_lat: 48.86, center_lon: 2.29 }), true)
  assert.equal(view.hasStoredView({ center_lat: null, center_lon: null }), false)
  assert.equal(view.hasStoredView({}), false)
  assert.equal(view.hasStoredView({ center_lat: Number.NaN, center_lon: 2 }), false)
  assert.equal(view.hasStoredView({ center_lat: 0, center_lon: 0 }), false)
})

test('the COP\'s own content decides the bounds; ACLED and GDELT never do', () => {
  const layers = {
    'cop-markers': { features: [point(2.3601, 48.9245), point(2.2945, 48.8584)] },
    webcams: { features: [point(2.2968, 48.8655)] },
    acled: { features: [point(-74.0, 40.7), point(139.7, 35.7)] },
    gdelt: { features: [point(30.5, 50.4)] },
  }
  const bounds = view.contentBounds(layers, own)
  assert.deepEqual(bounds, { west: 2.2945, south: 48.8584, east: 2.3601, north: 48.9245 })
  assert.equal(view.contentBounds({ acled: layers.acled }, own), null, 'external only: no content of its own')
})

test('one place opens at street level; several fit with padding, never closer than street level', () => {
  const one = view.openingView({ west: 2.2968, south: 48.8655, east: 2.2968, north: 48.8655 })
  assert.deepEqual(one, { kind: 'point', center: [2.2968, 48.8655], zoom: view.CONTENT_MAX_ZOOM })
  const many = view.openingView({ west: 2.2945, south: 48.8584, east: 2.3601, north: 48.9245 })
  assert.equal(many.kind, 'bounds')
  assert.equal(many.maxZoom, view.CONTENT_MAX_ZOOM)
  assert.deepEqual(many.bounds, [[2.2945, 48.8584], [2.3601, 48.9245]])
})

test('lines and polygons count; invalid coordinates are skipped', () => {
  const layers = {
    'user-drawings': {
      features: [
        { geometry: { type: 'LineString', coordinates: [[2.3, 48.85], [2.35, 48.87]] } },
        { geometry: { type: 'Polygon', coordinates: [[[2.28, 48.84], [2.29, 48.84], [2.29, 48.85], [2.28, 48.84]]] } },
        { geometry: { type: 'Point', coordinates: [500, 95] } },
        { geometry: null },
      ],
    },
  }
  assert.deepEqual(view.contentBounds(layers, own), { west: 2.28, south: 48.84, east: 2.35, north: 48.87 })
  assert.equal(view.boundsKey({ west: 2.28, south: 48.84, east: 2.35, north: 48.87 }), '2.28000,48.84000,2.35000,48.87000')
})
