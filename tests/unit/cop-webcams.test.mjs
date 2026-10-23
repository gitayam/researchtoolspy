/**
 * COP webcams (managed migration 0020).
 *
 * - functions/api/_shared/webcam-url.ts accepts Windy, YouTube and allow-listed
 *   image/HLS links, refuses everything else, and derives the embed URL itself.
 * - POST/GET /api/cop/:id/webcams and DELETE /api/cop/:id/webcams/:camId: a
 *   viewer cannot write, an editor or the owner can, a service only through the
 *   COP_SERVICE_ROUTES allow-list.
 * - The webcams layer and the public share expose webcams only to a share that
 *   shows the `cams` panel (and, for the layer, has `webcams` switched on).
 * - Every route tolerates the table being absent.
 *
 * The fixture (real bundled modules, node:sqlite behind a D1 shim with the real
 * migrations, fake KV, guarded fetch) is in cop-webcams-harness.mjs. Phase 2
 * (Windy facts, discovery, PATCH, direction estimates) is cop-webcams-discovery.test.mjs.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addCam,
  as,
  cop,
  countCams,
  fixture,
  mod,
  OTHER_SESSION,
  PARIS_CAM,
  removeCam,
  ROOT,
  SERVICE_AUTH,
  SESSION,
  setupWebcamSuite,
  WINDY_ID,
  YT_ID,
} from './cop-webcams-harness.mjs'

setupWebcamSuite()

// ── URL validation ────────────────────────────────────────────────

const ACCEPTED = [
  [`https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day`, 'windy', WINDY_ID, 'timelapse'],
  [`https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/live`, 'windy', WINDY_ID, 'timelapse'],
  [`https://www.windy.com/webcams/${WINDY_ID}`, 'windy', WINDY_ID, 'timelapse'],
  [`https://windy.com/webcams/${WINDY_ID}/`, 'windy', WINDY_ID, 'timelapse'],
  [`https://www.windy.com/-Webcams-France-Ile-de-France-Paris/webcams/${WINDY_ID}`, 'windy', WINDY_ID, 'timelapse'],
  [`windy:${WINDY_ID}`, 'windy', WINDY_ID, 'timelapse'],
  [`https://www.youtube.com/watch?v=${YT_ID}&t=10`, 'youtube', YT_ID, 'live'],
  [`https://m.youtube.com/watch?v=${YT_ID}`, 'youtube', YT_ID, 'live'],
  [`https://youtu.be/${YT_ID}?si=abc`, 'youtube', YT_ID, 'live'],
  [`https://www.youtube.com/live/${YT_ID}?feature=share`, 'youtube', YT_ID, 'live'],
  [`https://www.youtube.com/embed/${YT_ID}`, 'youtube', YT_ID, 'live'],
  [`https://www.youtube.com/shorts/${YT_ID}`, 'youtube', YT_ID, 'live'],
  ['https://weathercam.digitraffic.fi/C1451601.jpg', 'image', null, 'snapshot'],
  ['https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.06514.jpg', 'image', null, 'snapshot'],
  ['https://cwwp2.dot.ca.gov/data/d1/cctv/image/sr20atsr1lookingeast/sr20atsr1lookingeast.jpg', 'image', null, 'snapshot'],
  ['https://wzmedia.dot.ca.gov/D3/5_Pocket_Rd_OC_SAC5_SB.stream/playlist.m3u8', 'hls', null, 'live'],
]

const REJECTED = [
  // A page that embeds a camera is not the camera: point the analyst at the Windy link.
  ['https://www.meteocanada.com/europe/france/ile-de-france/seine-saint-denis/saint-denis/webcam', /windy/i],
  [`http://www.windy.com/webcams/${WINDY_ID}`, /https/i],
  ['rtsp://cams.example.org/stream1', /RTSP/],
  ['rtmp://cams.example.org/live', /RTMP/],
  ['javascript:alert(1)', /https/i],
  ['https://192.168.1.10/image.jpg', /IP address/],
  ['https://[::1]/image.jpg', /IP address/],
  ['https://0x7f.1/image.jpg', /IP address/],
  ['https://2130706433/image.jpg', /IP address/],
  ['https://user:pw@weathercam.digitraffic.fi/C1451601.jpg', /username or password/],
  ['https://weathercam.digitraffic.fi:8443/C1451601.jpg', /standard https port/],
  ['https://weathercam.digitraffic.fi/axis-cgi/jpg/image.cgi', /camera device/],
  ['https://weathercam.digitraffic.fi/cgi-bin/camera.jpg', /camera device/],
  ['https://weathercam.digitraffic.fi/video.mjpg', /camera device/],
  ['https://weathercam.digitraffic.fi/snapshot.cgi?x=.jpg', /camera device/],
  ['https://weathercam.digitraffic.fi/video.cgi', /camera device/],
  ['https://weathercam.digitraffic.fi/%61xis-cgi/x.jpg', /camera device/],
  ['https://www.insecam.org/en/view/123456/', /unsecured/],
  ['https://insecam.org./view/1', /unsecured/],
  ['https://opentopia.com/webcam/1', /unsecured/],
  ['https://s3-eu-west-1.amazonaws.com/some-other-bucket/cam.jpg', /supported camera source/],
  ['https://evil.example.com/cam.jpg', /supported camera source/],
  ['https://evil.example.com/live.m3u8', /HLS/],
  ['https://weathercam.digitraffic.fi/C1451601.html', /\.jpg/],
  ['https://www.youtube.com/watch?v=short', /11-character/],
  ['https://www.youtube.com/@somechannel/live', /video link/],
  ['https://www.windy.com/webcams/not-a-number', /windy\.com\/webcams/],
  ['https://webcams.windy.com/webcams/public/embed/player/abc/day', /windy\.com\/webcams/],
  ['windy:12', /6 to 12 digits/],
  ['', /required/],
]

test('webcam links: accepted forms reduce to provider, id and delivery', () => {
  const { parseWebcamUrl } = mod('webcamUrl')
  for (const [url, provider, ref, delivery] of ACCEPTED) {
    const r = parseWebcamUrl(url)
    assert.equal(r.ok, true, `${url}: ${r.error}`)
    assert.equal(r.cam.provider, provider, url)
    assert.equal(r.cam.provider_ref, ref, url)
    assert.equal(r.cam.delivery, delivery, url)
  }
})

test('webcam links: rejected forms say why', () => {
  const { parseWebcamUrl } = mod('webcamUrl')
  for (const [url, message] of REJECTED) {
    const r = parseWebcamUrl(url)
    assert.equal(r.ok, false, `${url} should be refused`)
    assert.match(r.error, message, url)
  }
})

test('webcam links: the embed URL is derived from the id, never taken from the link', () => {
  const { parseWebcamUrl, webcamEmbedUrl, WINDY_ATTRIBUTION } = mod('webcamUrl')
  const windy = parseWebcamUrl(`https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/month?evil=1`)
  assert.equal(webcamEmbedUrl('windy', windy.cam.provider_ref), `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day`)
  assert.equal(windy.cam.page_url, `https://www.windy.com/webcams/${WINDY_ID}`)
  assert.equal(windy.cam.attribution, WINDY_ATTRIBUTION)
  assert.equal(webcamEmbedUrl('youtube', YT_ID), `https://www.youtube-nocookie.com/embed/${YT_ID}`)
  assert.equal(webcamEmbedUrl('youtube', 'x"><script>'), null)
  assert.equal(webcamEmbedUrl('windy', '1/../../evil'), null)
  assert.equal(webcamEmbedUrl('image', 'anything'), null)
})

test('webcam links: COP_WEBCAM_EXTRA_HOSTS adds exact hosts, never IPs or camera directories', () => {
  const { parseWebcamUrl, parseExtraHosts } = mod('webcamUrl')
  assert.equal(parseWebcamUrl('https://cams.example.org/a.jpg').ok, false)
  const extra = 'cams.example.org, streams.example.net/live/ ,10.0.0.1,insecam.org,not a host'
  assert.equal(parseWebcamUrl('https://cams.example.org/a.jpg', extra).ok, true)
  assert.equal(parseWebcamUrl('https://sub.cams.example.org/a.jpg', extra).ok, false)
  assert.equal(parseWebcamUrl('https://streams.example.net/live/x.m3u8', extra).cam.provider, 'hls')
  assert.equal(parseWebcamUrl('https://streams.example.net/other/x.m3u8', extra).ok, false)
  assert.deepEqual(parseExtraHosts(extra).map((r) => r.host), ['cams.example.org', 'streams.example.net'])
  // A prefix written without its trailing slash still matches whole path segments only.
  assert.equal(parseWebcamUrl('https://streams.example.net/feeds/x.m3u8', 'streams.example.net/feeds').ok, true)
  assert.equal(parseWebcamUrl('https://streams.example.net/feeds-other/x.m3u8', 'streams.example.net/feeds').ok, false)
})


// ── Routes ────────────────────────────────────────────────────────

test('a viewer or a stranger cannot add or remove webcams; the owner and an editor can', async () => {
  const { db, env } = await fixture()
  assert.equal((await addCam(env, 'viewer')).status, 403)
  assert.equal((await addCam(env, 'stranger')).status, 403)
  assert.equal((await cop(env, 'POST', `/api/cop/${SESSION}/webcams`, { body: PARIS_CAM, handler: mod('webcams'), params: { id: SESSION } })).status, 401)
  assert.equal(countCams(db), 0)

  const byEditor = await addCam(env, 'editor')
  assert.equal(byEditor.status, 201)
  const { webcam } = await byEditor.json()
  assert.equal(webcam.provider, 'windy')
  assert.equal(webcam.embed_url, `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day`)
  assert.equal(webcam.attribution, 'Webcams provided by windy.com')
  assert.equal(webcam.delivery, 'timelapse')
  assert.equal('created_by' in webcam, false)
  assert.equal(db.prepare('SELECT created_by FROM cop_webcams').get().created_by, 2)
  assert.equal((await addCam(env, 'owner', { ...PARIS_CAM, url: `https://youtu.be/${YT_ID}` })).status, 201)

  assert.equal((await removeCam(env, 'viewer', webcam.id)).status, 403)
  assert.equal(countCams(db), 2)
  assert.equal((await removeCam(env, 'editor', webcam.id)).status, 200)
  assert.equal((await removeCam(env, 'editor', webcam.id)).status, 404)
  assert.equal(countCams(db), 1)
})

test('a webcam id from another session is not found', async () => {
  const { db, env } = await fixture()
  const { webcam } = await (await addCam(env, 'owner', PARIS_CAM, OTHER_SESSION)).json()
  assert.equal((await removeCam(env, 'editor', webcam.id, SESSION)).status, 404)
  assert.equal(countCams(db), 1)
})

test('POST validates the link, label and position', async () => {
  const { db, env } = await fixture()
  const refused = async (body) => {
    const res = await addCam(env, 'owner', { ...PARIS_CAM, ...body })
    assert.equal(res.status, 400, JSON.stringify(body))
    return (await res.json()).error
  }
  assert.match(await refused({ url: 'https://www.meteocanada.com/europe/france/ile-de-france/seine-saint-denis/saint-denis/webcam' }), /windy/i)
  await refused({ label: 'x'.repeat(121) })
  // A Windy camera may leave its label blank (Windy's title fills it); others may not.
  await refused({ url: `https://youtu.be/${YT_ID}`, label: '   ' })
  await refused({ lat: 91 })
  await refused({ lon: -181 })
  await refused({ lat: undefined })
  await refused({ bearing_deg: 360 })
  await refused({ bearing_deg: 12.5 })
  await refused({ fov_deg: 0 })
  await refused({ url: 'https://weathercam.digitraffic.fi/C1451601.jpg', refresh_s: 10 })
  assert.equal(countCams(db), 0)

  const image = await addCam(env, 'owner', { url: 'https://weathercam.digitraffic.fi/C1451601.jpg', label: 'Road cam' })
  assert.equal(image.status, 201)
  const { webcam } = await image.json()
  assert.equal(webcam.refresh_s, 60)
  assert.equal(webcam.delivery, 'snapshot')
  assert.equal(webcam.embed_url, null)
  assert.equal(webcam.lat, null)
})

test('a source with a required credit keeps it whatever the caller sends', async () => {
  const { env } = await fixture()
  const add = async (body) => (await (await addCam(env, 'owner', { label: 'Cam', ...body })).json()).webcam
  const road = await add({ url: 'https://weathercam.digitraffic.fi/C0150200.jpg', attribution: 'Verified live feed' })
  assert.equal(road.attribution, 'Fintraffic / digitraffic.fi, CC BY 4.0')
  const windy = await add({ url: `windy:${WINDY_ID}`, attribution: 'Verified live feed' })
  assert.equal(windy.attribution, 'Webcams provided by windy.com')
  const youtube = await add({ url: `https://youtu.be/${YT_ID}`, attribution: 'Channel: City of Paris' })
  assert.equal(youtube.attribution, 'Channel: City of Paris')
})

test('a camera already on the session answers 409 WEBCAM_DUPLICATE until it is removed', async () => {
  const { db, env } = await fixture()
  const first = await (await addCam(env, 'owner')).json()
  for (const url of [`windy:${WINDY_ID}`, `https://www.windy.com/webcams/${WINDY_ID}`]) {
    const again = await addCam(env, 'editor', { ...PARIS_CAM, url, label: 'Same camera, new label' })
    assert.equal(again.status, 409, url)
    assert.equal((await again.json()).code, 'WEBCAM_DUPLICATE')
  }
  assert.equal(countCams(db), 1)
  // The same camera on another session is a different pin.
  assert.equal((await addCam(env, 'owner', PARIS_CAM, OTHER_SESSION)).status, 201)

  assert.equal((await removeCam(env, 'owner', first.webcam.id)).status, 200)
  assert.equal((await addCam(env, 'owner')).status, 201)
})

test('a full session answers 409 WEBCAM_LIMIT and stores nothing', async () => {
  const { db, env } = await fixture()
  const MAX_WEBCAMS_PER_SESSION = 200 // functions/api/_shared/cop-webcams.ts
  const seed = db.prepare(
    "INSERT INTO cop_webcams (id, cop_session_id, provider, image_url, label, delivery) VALUES (?, ?, 'image', ?, 'Seed', 'snapshot')"
  )
  for (let i = 0; i < MAX_WEBCAMS_PER_SESSION; i++) {
    seed.run(`seed-${i}`, SESSION, `https://weathercam.digitraffic.fi/C${i}.jpg`)
  }
  const full = await addCam(env, 'owner')
  assert.equal(full.status, 409)
  assert.equal((await full.json()).code, 'WEBCAM_LIMIT')
  assert.equal(countCams(db), MAX_WEBCAMS_PER_SESSION)

  db.prepare("UPDATE cop_webcams SET archived_at = datetime('now') WHERE id = 'seed-0'").run()
  assert.equal((await addCam(env, 'owner')).status, 201)
})

test('GET lists explicit fields for any collaborator, nothing for a stranger', async () => {
  const { env } = await fixture()
  await addCam(env, 'owner')
  const list = (who) => cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as(who), handler: mod('webcams'), params: { id: SESSION } })
  const res = await list('viewer')
  assert.equal(res.status, 200)
  const { webcams } = await res.json()
  assert.equal(webcams.length, 1)
  assert.deepEqual(Object.keys(webcams[0]).sort(), [
    'attribution', 'bearing_deg', 'bearing_source', 'created_at', 'delivery', 'embed_url', 'fov_deg', 'id',
    'image_url', 'label', 'lat', 'lon', 'page_url', 'position_source', 'provider', 'provider_ref', 'refresh_s',
    'source_url', 'status_checked_at', 'stream_url', 'windy_status',
  ])
  assert.equal((await list('stranger')).status, 403)
})

test('a service adds webcams through the allow-list, and cannot list or delete them', async () => {
  const { env } = await fixture()
  const add = await cop(env, 'POST', '/api/cop/cop-service-own/webcams', {
    headers: SERVICE_AUTH, body: PARIS_CAM, handler: mod('webcams'), params: { id: 'cop-service-own' },
  })
  assert.equal(add.status, 201)
  const { webcam } = await add.json()
  const list = await cop(env, 'GET', '/api/cop/cop-service-own/webcams', {
    headers: SERVICE_AUTH, handler: mod('webcams'), params: { id: 'cop-service-own' },
  })
  assert.equal(list.status, 403)
  const del = await cop(env, 'DELETE', `/api/cop/cop-service-own/webcams/${webcam.id}`, {
    headers: SERVICE_AUTH, handler: mod('webcam'), params: { id: 'cop-service-own', camId: webcam.id },
  })
  assert.equal(del.status, 403)
  // Not shared with the service: refused before the handler.
  const foreign = await cop(env, 'POST', `/api/cop/${SESSION}/webcams`, {
    headers: SERVICE_AUTH, body: PARIS_CAM, handler: mod('webcams'), params: { id: SESSION },
  })
  assert.equal(foreign.status, 403)
})

test('COP_SERVICE_ROUTES admits POST webcams only (the bot never reads them)', () => {
  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('POST', '/api/cop/cop-x/webcams'), true)
  assert.equal(allowed('GET', '/api/cop/cop-x/webcams'), false)
  assert.equal(allowed('DELETE', '/api/cop/cop-x/webcams/abc'), false)
  assert.equal(allowed('POST', '/api/cop/public/webcams'), false)
})

// ── Layer and share ───────────────────────────────────────────────

async function seedShare(db, token, panels) {
  db.prepare(`INSERT INTO cop_shares (id, cop_session_id, share_token, visible_panels, created_at)
    VALUES (?, ?, ?, ?, ?)`).run(`share-${token}`, SESSION, token, JSON.stringify(panels), new Date().toISOString())
}

const layerGet = (env, query, headers = {}) => mod('layer').onRequestGet({
  request: new Request(`https://researchtools.test/api/cop/${SESSION}/layers/webcams${query}`, { headers }),
  env, params: { id: SESSION }, data: {},
})

test('shareMayReadLayer: webcams need the cams panel and the webcams layer', () => {
  const { shareMayReadLayer } = mod('copShare')
  const url = new URL('https://researchtools.test/')
  const on = { status: 'ACTIVE', active_layers: '["webcams"]' }
  const off = { status: 'ACTIVE', active_layers: '["markers"]' }
  assert.equal(shareMayReadLayer(on, 'webcams', ['map'], url), false)
  assert.equal(shareMayReadLayer(off, 'webcams', ['map', 'cams'], url), false)
  assert.equal(shareMayReadLayer({ ...on, status: 'ARCHIVED' }, 'webcams', ['map', 'cams'], url), false)
  assert.equal(shareMayReadLayer(on, 'webcams', ['map', 'cams'], url), true)
})

test('the webcams layer: points and view cones, readable through a share only with the cams panel', async () => {
  const { db, env } = await fixture()
  await addCam(env, 'owner')
  await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'No position' })
  await seedShare(db, 'tok-map', ['map'])
  await seedShare(db, 'tok-cams', ['map', 'cams'])

  assert.equal((await layerGet(env, '?share=tok-map')).status, 401)
  const viaShare = await layerGet(env, '?share=tok-cams')
  assert.equal(viaShare.status, 200)
  const fc = await viaShare.json()
  assert.deepEqual(fc.features.map((f) => [f.geometry.type, f.properties.kind]), [['Point', 'webcam'], ['Polygon', 'view_cone']])
  assert.deepEqual(fc.features[0].geometry.coordinates, [2.2969, 48.8656])
  const ring = fc.features[1].geometry.coordinates[0]
  assert.deepEqual(ring[0], ring[ring.length - 1])
  assert.equal(JSON.stringify(fc).includes('created_by'), false)

  db.prepare(`UPDATE cop_sessions SET active_layers = '["markers"]' WHERE id = ?`).run(SESSION)
  assert.equal((await layerGet(env, '?share=tok-cams')).status, 401)
  assert.equal((await layerGet(env, '', as('viewer'))).status, 200)
})

test('POST /shares accepts the cams panel', async () => {
  const { db, env } = await fixture()
  const res = await cop(env, 'POST', `/api/cop/${SESSION}/shares`, {
    headers: as('owner'), body: { visible_panels: ['map', 'cams', 'bogus'] }, handler: mod('shares'), params: { id: SESSION },
  })
  assert.equal(res.status, 201)
  assert.deepEqual(JSON.parse(db.prepare('SELECT visible_panels FROM cop_shares').get().visible_panels), ['map', 'cams'])
})

test('the public share returns webcams only with the cams panel, without who added them', async () => {
  const { db, env } = await fixture()
  await addCam(env, 'owner')
  await seedShare(db, 'tok-map', ['map', 'event'])
  await seedShare(db, 'tok-cams', ['map', 'cams'])
  const view = async (token) => (await mod('publicShare').onRequestGet({ env, params: { token }, request: new Request('https://researchtools.test/') })).json()
  assert.equal('webcams' in (await view('tok-map')), false)
  const { webcams } = await view('tok-cams')
  assert.equal(webcams.length, 1)
  assert.equal(webcams[0].embed_url, `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day`)
  assert.equal('created_by' in webcams[0], false)
})

// ── Before managed migration 0020 ─────────────────────────────────

test('without the cop_webcams table: writes answer 503, reads are empty', async () => {
  const { db, env } = await fixture({ webcamsTable: false })
  const add = await addCam(env, 'owner')
  assert.equal(add.status, 503)
  assert.equal((await add.json()).code, 'WEBCAMS_UNAVAILABLE')
  const del = await removeCam(env, 'owner', 'any-id')
  assert.equal(del.status, 503)

  const list = await cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as('owner'), handler: mod('webcams'), params: { id: SESSION } })
  assert.equal(list.status, 200)
  assert.deepEqual(await list.json(), { webcams: [] })

  const layer = await layerGet(env, '', as('owner'))
  assert.equal(layer.status, 200)
  assert.deepEqual(await layer.json(), { type: 'FeatureCollection', features: [] })

  await seedShare(db, 'tok-cams', ['map', 'cams'])
  const shared = await mod('publicShare').onRequestGet({ env, params: { token: 'tok-cams' }, request: new Request('https://researchtools.test/') })
  assert.equal(shared.status, 200)
  assert.deepEqual((await shared.json()).webcams, [])
})

// ── public/_headers: the COP policy stays in step with the global one ──

function headerRules() {
  const rules = []
  for (const line of readFileSync(join(ROOT, 'public/_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), lines: [] })
    else rules.at(-1).lines.push(line.trim())
  }
  return rules
}

function cspOf(rule) {
  const value = rule.lines.find((l) => l.startsWith('Content-Security-Policy:')).slice('Content-Security-Policy:'.length)
  return Object.fromEntries(value.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]))
}

test('_headers: COP pages replace the global policy with a copy that only adds the player and stream hosts', () => {
  const { HLS_HOSTS } = mod('webcamUrl')
  const rules = headerRules()
  const globalAt = rules.findIndex((r) => r.pattern === '/*')
  const global = cspOf(rules[globalAt])
  for (const pattern of ['/dashboard/cop/*', '/public/cop/*']) {
    const at = rules.findIndex((r) => r.pattern === pattern)
    assert.ok(at > globalAt, `${pattern} must come after /*`)
    const rule = rules[at]
    // Only the policy is detached, and before it is set; the other security headers stay.
    assert.deepEqual(rule.lines.filter((l) => l.startsWith('!')), ['! Content-Security-Policy'], pattern)
    assert.ok(rule.lines.indexOf('! Content-Security-Policy') < rule.lines.findIndex((l) => l.startsWith('Content-Security-Policy:')))
    assert.equal(rule.lines.filter((l) => l.startsWith('Content-Security-Policy:')).length, 1)

    const cop = cspOf(rule)
    const extra = {
      'frame-src': ['https://webcams.windy.com', 'https://www.youtube-nocookie.com'],
      'connect-src': HLS_HOSTS.map((h) => `https://${h.host}`),
      'media-src': ["'self'", 'blob:', ...HLS_HOSTS.map((h) => `https://${h.host}`)],
    }
    assert.deepEqual(Object.keys(cop).sort(), [...new Set([...Object.keys(global), ...Object.keys(extra)])].sort(), pattern)
    for (const [directive, values] of Object.entries(cop)) {
      const base = global[directive] ?? []
      assert.deepEqual(values.filter((v) => !base.includes(v)).sort(), (extra[directive] ?? []).filter((v) => !base.includes(v)).sort(), `${pattern} ${directive} adds`)
      assert.deepEqual(base.filter((v) => !values.includes(v)), [], `${pattern} ${directive} drops`)
    }
  }
  for (const header of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.ok(rules[globalAt].lines.some((l) => l.startsWith(`${header}:`)), header)
  }
})
