/**
 * COP webcams Phase 2 (managed migration 0021).
 *
 * - Adding a Windy camera takes its position, title, live player and status from
 *   Windy; a definite "no such camera" or a withdrawn one is refused; Windy being
 *   down or unconfigured leaves the Phase 1 add working.
 * - GET /api/cop/:id/webcams/nearby: auth, the no-key 503, the center (point, place,
 *   page address, session center), the ambiguity rule and the model's place query,
 *   rejection of junk model output, the per-caller quota, caching.
 * - The geocoder follows the Nominatim usage policy: app-wide cap, kill switch,
 *   normalised and negative caching, attribution.
 * - PATCH scoping and estimate-bearing (model names the landmark, geocoder places it,
 *   arithmetic gives the bearing).
 * - Outbound requests go only to api.windy.com, nominatim.openstreetmap.org and the
 *   AI gateway; a page given as from_url is never fetched.
 * - Everything still works without migration 0021.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addCam,
  as,
  cop,
  countCams,
  fixture,
  jsonResponse,
  mod,
  NO_CENTER_SESSION,
  OTHER_SESSION,
  scriptFetch,
  SERVICE_AUTH,
  SERVICE_SESSION,
  SESSION,
  setupWebcamSuite,
  WINDY_ID,
  YT_ID,
} from './cop-webcams-harness.mjs'

setupWebcamSuite()

// ── Canned upstreams ──────────────────────────────────────────────

const STADE_ID = '1600000001'
const WITHDRAWN_ID = '1500000002'
const NOWHERE_ID = '1400000003'
const MISSING_ID = '1999999999'

const WINDY_CAMS = {
  [WINDY_ID]: {
    webcamId: Number(WINDY_ID),
    title: 'Paris: CESE - Eiffel Tower',
    status: 'active',
    viewCount: 1000,
    lastUpdatedOn: '2026-10-22T10:00:00.000Z',
    location: { latitude: 48.8655, longitude: 2.2968, city: 'Paris', region: 'Île-de-France', country: 'France', continent: 'Europe' },
    player: {
      live: `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/live`,
      day: `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day`,
    },
    urls: { detail: `https://www.windy.com/webcams/${WINDY_ID}`, provider: 'https://www.lecese.fr/' },
    images: { current: { preview: `https://imgproxy.windy.com/_/preview/${WINDY_ID}.jpg?token=t1`, thumbnail: 'javascript:alert(1)' } },
    categories: [{ id: 'city', name: 'City' }, { id: 'building<script>', name: 'x' }],
  },
  [STADE_ID]: {
    webcamId: Number(STADE_ID),
    title: 'Saint-Denis: Stade de France',
    status: 'inactive',
    location: { latitude: 48.9245, longitude: 2.3602, city: 'Saint-Denis', region: 'Île-de-France', country: 'France' },
    // A live link for another camera is not this camera's live player.
    player: {
      day: `https://webcams.windy.com/webcams/public/embed/player/${STADE_ID}/day`,
      live: `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/live`,
    },
    urls: { provider: 'http://insecure.example.org/' },
    images: { current: { preview: 'https://evil.example.com/preview.jpg' } },
  },
  [WITHDRAWN_ID]: {
    webcamId: Number(WITHDRAWN_ID),
    title: 'Withdrawn camera',
    status: 'disabled',
    location: { latitude: 48.87, longitude: 2.3 },
  },
  [NOWHERE_ID]: { webcamId: Number(NOWHERE_ID), title: 'No location', status: 'active' },
}

const PLACES = {
  'stade de france': [{ name: 'Stade de France', display_name: 'Stade de France, Saint-Denis, Île-de-France, France', lat: '48.9245', lon: '2.3602', importance: 0.6 }],
  'saint-denis': [
    { name: 'Saint-Denis', display_name: 'Saint-Denis, Seine-Saint-Denis, Île-de-France, France', lat: '48.9362', lon: '2.3574', importance: 0.55 },
    { name: 'Saint-Denis', display_name: 'Saint-Denis, Réunion, France', lat: '-20.8789', lon: '55.4481', importance: 0.6 },
  ],
  'saint-denis, seine-saint-denis': [{ name: 'Saint-Denis', display_name: 'Saint-Denis, Seine-Saint-Denis, Île-de-France, France', lat: '48.9362', lon: '2.3574', importance: 0.55 }],
  'eiffel tower, paris': [
    { name: 'Eiffel Tower', display_name: 'Eiffel Tower, Paris, France', lat: '48.8584', lon: '2.2945', importance: 0.8 },
  ],
  'far landmark': [{ name: 'Far', display_name: 'Far landmark', lat: '49.5', lon: '2.29', importance: 0.5 }],
}

/** A scripted upstream: Windy, Nominatim and the AI gateway. `ai` maps an endpoint to the model's JSON reply. */
function upstreams({ ai = {}, windyStatus = null, nominatimStatus = null } = {}) {
  return scriptFetch(async (url, init) => {
    if (url.hostname === 'api.windy.com') {
      if (windyStatus) return jsonResponse({ message: 'error' }, windyStatus)
      const one = /^\/webcams\/api\/v3\/webcams\/(\d+)$/.exec(url.pathname)
      if (one) return WINDY_CAMS[one[1]] ? jsonResponse(WINDY_CAMS[one[1]]) : jsonResponse({ message: 'Not found' }, 404)
      if (url.pathname === '/webcams/api/v3/webcams') {
        const ids = url.searchParams.get('webcamIds')
        const cams = ids
          ? ids.split(',').map((id) => WINDY_CAMS[id]).filter((c) => c && c.status === 'active')
          : Object.values(WINDY_CAMS)
        return jsonResponse({ total: cams.length, webcams: cams })
      }
    }
    if (url.hostname === 'nominatim.openstreetmap.org') {
      if (nominatimStatus) return jsonResponse([], nominatimStatus)
      return jsonResponse(PLACES[url.searchParams.get('q')] ?? [])
    }
    if (url.hostname === 'gateway.ai.cloudflare.com') {
      const endpoint = JSON.parse(init.headers['cf-aig-metadata'] ?? '{}').endpoint
      const reply = ai[endpoint]
      if (reply === undefined) return jsonResponse({ error: 'no scripted reply' }, 500)
      return jsonResponse({ choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } }] })
    }
    return jsonResponse({ error: 'not scripted' }, 599)
  })
}

const ALLOWED_HOSTS = new Set(['api.windy.com', 'nominatim.openstreetmap.org', 'gateway.ai.cloudflare.com'])
function assertOnlyAllowedHosts(log) {
  for (const entry of log) assert.ok(ALLOWED_HOSTS.has(entry.host), `unexpected outbound host ${entry.host}`)
}
const hostCalls = (log, host) => log.filter((e) => e.host === host)

const nearby = (env, who, query = '', session = SESSION) =>
  cop(env, 'GET', `/api/cop/${session}/webcams/nearby${query}`, {
    headers: who === 'service' ? SERVICE_AUTH : who ? as(who) : {},
    handler: mod('nearby'),
    params: { id: session },
  })
const patchCam = (env, who, camId, body, session = SESSION) =>
  cop(env, 'PATCH', `/api/cop/${session}/webcams/${camId}`, {
    headers: who === 'service' ? SERVICE_AUTH : as(who), body, handler: mod('webcam'), params: { id: session, camId },
  })
const estimate = (env, who, camId, session = SESSION) =>
  cop(env, 'POST', `/api/cop/${session}/webcams/${camId}/estimate-bearing`, {
    headers: who === 'service' ? SERVICE_AUTH : as(who), body: {}, handler: mod('estimate'), params: { id: session, camId },
  })

async function withUpstreams(options, fn) {
  const log = upstreams(options)
  try {
    return await fn(log)
  } finally {
    log.restore()
  }
}

// ── Geometry ──────────────────────────────────────────────────────

test('bearing and distance: Palais d\'Iéna to the Eiffel Tower is about 192°, 0.8 km', () => {
  const { initialBearingDeg, distanceKm } = mod('discovery')
  assert.equal(initialBearingDeg(48.8655, 2.2968, 48.8584, 2.2945), 192)
  assert.ok(Math.abs(distanceKm(48.8655, 2.2968, 48.8584, 2.2945) - 0.81) < 0.02)
  assert.equal(initialBearingDeg(0, 0, 1, 0), 0)
  assert.equal(initialBearingDeg(0, 0, 0, 1), 90)
  assert.equal(initialBearingDeg(0, 0, -1, 0), 180)
  assert.equal(initialBearingDeg(0, 0, 0, -1), 270)
})

// ── Outbound requests ─────────────────────────────────────────────

test('outbound: exact hosts only, redirects are not followed, the body is capped, slow calls time out', async () => {
  const { getOutboundJson } = mod('outbound')
  const hosts = new Set(['api.windy.com'])
  const log = scriptFetch(async (url) => {
    if (url.pathname === '/redirect') return new Response(null, { status: 302, headers: { Location: 'https://evil.example.com/' } })
    if (url.pathname === '/big') return new Response('x'.repeat(5000))
    if (url.pathname === '/slow') return new Promise(() => {})
    return jsonResponse({ ok: true })
  })
  try {
    for (const bad of ['https://api.windy.com.evil.example/x', 'http://api.windy.com/x', 'https://api.windy.com:8443/x', 'https://user@api.windy.com/x']) {
      assert.equal((await getOutboundJson(bad, { allowedHosts: hosts })).reason, 'host', bad)
    }
    assert.equal(log.length, 0)
    const redirected = await getOutboundJson('https://api.windy.com/redirect', { allowedHosts: hosts })
    assert.equal(redirected.reason, 'redirect')
    assert.equal(log.length, 1)
    assert.equal(log[0].redirect, 'manual')
    assert.equal((await getOutboundJson('https://api.windy.com/big', { allowedHosts: hosts, maxBytes: 100 })).reason, 'too_large')
    const slow = scriptFetch((url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    assert.equal((await getOutboundJson('https://api.windy.com/slow', { allowedHosts: hosts, timeoutMs: 20 })).reason, 'timeout')
    slow.restore()
    assert.equal((await getOutboundJson('https://api.windy.com/ok', { allowedHosts: hosts })).ok, false) // refused: fetch is guarded again
  } finally {
    log.restore()
  }
})

// ── Adding a Windy camera ─────────────────────────────────────────

test('adding a Windy camera fills position, title, live player, operator page and status from Windy', async () => {
  const { db, env } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    const res = await addCam(env, 'editor', { url: `windy:${WINDY_ID}` })
    assert.equal(res.status, 201)
    const { webcam } = await res.json()
    assert.equal(webcam.label, 'Paris: CESE - Eiffel Tower')
    assert.equal(webcam.lat, 48.8655)
    assert.equal(webcam.lon, 2.2968)
    assert.equal(webcam.position_source, 'windy')
    assert.equal(webcam.delivery, 'live')
    assert.equal(webcam.embed_url, `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/live`)
    assert.equal(webcam.source_url, 'https://www.lecese.fr/')
    assert.equal(webcam.windy_status, 'active')
    assert.ok(webcam.status_checked_at)
    assert.equal(webcam.attribution, 'Webcams provided by windy.com')
    assert.equal(log.length, 1)
    assert.equal(log[0].headers['x-windy-api-key'], 'test-windy-key')
    assert.match(log[0].url, /^https:\/\/api\.windy\.com\/webcams\/api\/v3\/webcams\/1706619137\?/)
    assertOnlyAllowedHosts(log)
    assert.equal(db.prepare('SELECT position_source FROM cop_webcams').get().position_source, 'windy')

    // Facts are cached: re-adding after removal asks Windy nothing.
    assert.equal((await cop(env, 'DELETE', `/api/cop/${SESSION}/webcams/${webcam.id}`, { headers: as('editor'), handler: mod('webcam'), params: { id: SESSION, camId: webcam.id } })).status, 200)
    assert.equal((await addCam(env, 'editor', { url: `windy:${WINDY_ID}`, label: 'Mine', lat: 48.8656, lon: 2.2969, bearing_deg: 190 })).status, 201)
    assert.equal(log.length, 1)
    const kept = db.prepare('SELECT label, lat, position_source, bearing_source FROM cop_webcams WHERE archived_at IS NULL').get()
    assert.deepEqual({ ...kept }, { label: 'Mine', lat: 48.8656, position_source: 'user', bearing_source: 'user' })
  })
})

test('Windy says no: an unknown id or a withdrawn camera is refused with a code, and nothing is stored', async () => {
  const { db, env } = await fixture({ windyKey: true })
  await withUpstreams({}, async () => {
    const missing = await addCam(env, 'owner', { url: `windy:${MISSING_ID}` })
    assert.equal(missing.status, 422)
    assert.equal((await missing.json()).code, 'WEBCAM_NOT_FOUND')
    const withdrawn = await addCam(env, 'owner', { url: `windy:${WITHDRAWN_ID}` })
    assert.equal(withdrawn.status, 422)
    assert.equal((await withdrawn.json()).code, 'WEBCAM_UNAVAILABLE')
    // Inactive is shown, with its status.
    const inactive = await addCam(env, 'owner', { url: `windy:${STADE_ID}` })
    assert.equal(inactive.status, 201)
    const { webcam } = await inactive.json()
    assert.equal(webcam.windy_status, 'inactive')
    assert.equal(webcam.delivery, 'timelapse')
    assert.equal(webcam.source_url, null) // http operator page is not passed on
  })
  assert.equal(countCams(db), 1)
})

test('Windy down or unconfigured: the camera is added as in Phase 1', async () => {
  const down = await fixture({ windyKey: true })
  await withUpstreams({ windyStatus: 500 }, async (log) => {
    const res = await addCam(down.env, 'owner', { url: `windy:${WINDY_ID}` })
    assert.equal(res.status, 201)
    const { webcam } = await res.json()
    assert.equal(webcam.label, `Windy webcam ${WINDY_ID}`)
    assert.equal(webcam.delivery, 'timelapse')
    assert.equal(webcam.lat, null)
    assert.equal(webcam.windy_status, null)
    assert.equal(log.length, 1)
  })
  assert.match(down.db.prepare("SELECT message FROM event_logs WHERE level = 'warn'").get().message, /Windy lookup failed/)

  const noKey = await fixture()
  const log = upstreams()
  try {
    const res = await addCam(noKey.env, 'owner', { url: `windy:${WINDY_ID}` })
    assert.equal(res.status, 201)
    assert.equal(log.length, 0)
  } finally {
    log.restore()
  }
})

test('a page that is not a camera answers WEBCAM_UNSUPPORTED_LINK; malformed or unsafe links WEBCAM_INVALID', async () => {
  const { env } = await fixture()
  const code = async (url) => (await (await addCam(env, 'owner', { url, label: 'x' })).json()).code
  assert.equal(await code('https://www.meteocanada.com/europe/france/ile-de-france/seine-saint-denis/saint-denis/webcam'), 'WEBCAM_UNSUPPORTED_LINK')
  assert.equal(await code('rtsp://cams.example.org/stream'), 'WEBCAM_INVALID')
  assert.equal(await code('https://192.168.1.10/cam.jpg'), 'WEBCAM_INVALID')
  assert.equal(await code('https://www.insecam.org/en/view/1/'), 'WEBCAM_INVALID')
  assert.equal(await code('https://www.youtube.com/@channel/live'), 'WEBCAM_INVALID')
  assert.equal(await code('https://localhost/page'), 'WEBCAM_INVALID')
})

// ── Nearby ────────────────────────────────────────────────────────

test('nearby: owner, editor and the bot service; not a viewer, a stranger or anonymous', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async () => {
    assert.equal((await nearby(env, null, '?lat=48.86&lon=2.29')).status, 401)
    assert.equal((await nearby(env, 'viewer', '?lat=48.86&lon=2.29')).status, 403)
    assert.equal((await nearby(env, 'stranger', '?lat=48.86&lon=2.29')).status, 403)
    assert.equal((await nearby(env, 'editor', '?lat=48.86&lon=2.29')).status, 200)
    assert.equal((await nearby(env, 'owner', '?lat=48.86&lon=2.29')).status, 200)
    assert.equal((await nearby(env, 'service', '?lat=48.86&lon=2.29', SERVICE_SESSION)).status, 200)
    // A session not shared with the service is refused before the handler.
    assert.equal((await nearby(env, 'service', '?lat=48.86&lon=2.29')).status, 403)
  })
})

test('nearby without a Windy key: 503 WEBCAM_DISCOVERY_UNAVAILABLE, logged, nothing contacted', async () => {
  const { db, env } = await fixture({ ai: true })
  const log = upstreams()
  try {
    const res = await nearby(env, 'owner', '?place=Stade%20de%20France')
    assert.equal(res.status, 503)
    assert.equal((await res.json()).code, 'WEBCAM_DISCOVERY_UNAVAILABLE')
    assert.equal(log.length, 0)
  } finally {
    log.restore()
  }
  assert.match(db.prepare("SELECT message FROM event_logs WHERE level = 'error'").get().message, /WINDY_WEBCAMS_API_KEY/)
})

test('nearby by point: active cameras first, then by distance; safe previews only; pinned ones marked', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    await addCam(env, 'owner', { url: `windy:${WINDY_ID}` })
    const res = await nearby(env, 'editor', '?lat=48.9245&lon=2.3602&radius_km=10&limit=50')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(body.center, { lat: 48.9245, lon: 2.3602, label: null, source: 'query' })
    assert.equal(body.resolution, null)
    assert.equal('geocoder_attribution' in body, false)
    assert.equal(body.attribution, 'Webcams provided by windy.com')
    assert.equal(body.attribution_url, 'https://www.windy.com/webcams')
    assert.equal(body.radius_km, 10)
    // No location (NOWHERE) and withdrawn (disabled) cameras are left out; the inactive
    // Stade camera is the closest but sorts after the active one.
    assert.deepEqual(body.webcams.map((w) => w.windy_id), [WINDY_ID, STADE_ID])
    const byId = Object.fromEntries(body.webcams.map((w) => [w.windy_id, w]))
    assert.equal(byId[WINDY_ID].on_session, true)
    assert.equal(byId[STADE_ID].on_session, false)
    assert.equal(byId[WINDY_ID].live, true)
    assert.equal(byId[STADE_ID].live, false)
    assert.equal(byId[WINDY_ID].delivery, 'live')
    assert.equal(byId[WINDY_ID].preview_url, `https://imgproxy.windy.com/_/preview/${WINDY_ID}.jpg?token=t1`)
    assert.equal(byId[STADE_ID].preview_url, null) // not a windy.com host
    assert.equal(byId[WINDY_ID].detail_url, `https://www.windy.com/webcams/${WINDY_ID}`)
    assert.deepEqual(byId[WINDY_ID].categories, ['city'])
    assert.equal(byId[STADE_ID].distance_km, 0)
    assert.ok(!(NOWHERE_ID in byId))
    const nearbyCall = hostCalls(log, 'api.windy.com').at(-1)
    assert.equal(new URL(nearbyCall.url).searchParams.get('nearby'), '48.92450,2.36020,10')
    assertOnlyAllowedHosts(log)
  })
})

test('nearby: the same search within 8 minutes is answered from cache; bad parameters are refused', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    assert.equal((await nearby(env, 'owner', '?lat=48.86&lon=2.29')).status, 200)
    assert.equal((await nearby(env, 'owner', '?lat=48.8601&lon=2.2899')).status, 200)
    assert.equal(hostCalls(log, 'api.windy.com').length, 1)
    for (const q of ['?lat=48.86', '?lat=91&lon=2', '?lat=x&lon=2', '?radius_km=0', '?radius_km=51', '?radius_km=2.5', '?limit=0', `?place=${'x'.repeat(121)}`]) {
      const res = await nearby(env, 'owner', q)
      assert.equal(res.status, 400, q)
      assert.equal((await res.json()).code, 'WEBCAM_INVALID', q)
    }
  })
})

test('nearby by session center, and 400 WEBCAM_NO_CENTER for a session without one', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async () => {
    const res = await nearby(env, 'owner')
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).center, { lat: 48.86, lon: 2.29, label: null, source: 'session' })
    const none = await nearby(env, 'owner', '', NO_CENTER_SESSION)
    assert.equal(none.status, 400)
    assert.equal((await none.json()).code, 'WEBCAM_NO_CENTER')
  })
})

test('nearby by place: a clear name is geocoded without the model, with OSM attribution', async () => {
  const { env } = await fixture({ windyKey: true, ai: true })
  await withUpstreams({}, async (log) => {
    const res = await nearby(env, 'owner', '?place=Stade%20de%20France')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.center.source, 'place')
    assert.equal(body.center.lat, 48.9245)
    assert.deepEqual(body.resolution, {
      input: 'Stade de France', query: 'Stade de France',
      display_name: 'Stade de France, Saint-Denis, Île-de-France, France', ai_used: false, ambiguous: false,
    })
    assert.equal(body.geocoder_attribution, '© OpenStreetMap contributors')
    assert.equal(body.geocoder_attribution_url, 'https://www.openstreetmap.org/copyright')
    assert.equal(hostCalls(log, 'gateway.ai.cloudflare.com').length, 0)
    const geo = hostCalls(log, 'nominatim.openstreetmap.org')[0]
    assert.equal(geo.headers['user-agent'], 'ResearchTools-COP/1.0 (+https://researchtools.net)')
    const params = new URL(geo.url).searchParams
    assert.equal(params.get('format'), 'jsonv2')
    assert.equal(params.get('viewbox'), '1.2900,49.8600,3.2900,47.8600')
    assert.equal(params.get('bounded'), '0')
    assertOnlyAllowedHosts(log)
  })
})

test('nearby by place: an ambiguous name goes to the model, whose query (not coordinates) is geocoded', async () => {
  const { env } = await fixture({ windyKey: true, ai: true })
  const ai = { 'cop-webcams-place': { query: 'Saint-Denis, Seine-Saint-Denis', country_code: 'FR' } }
  await withUpstreams({ ai }, async (log) => {
    const res = await nearby(env, 'owner', '?place=Saint-Denis')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(body.resolution, {
      input: 'Saint-Denis', query: 'Saint-Denis, Seine-Saint-Denis',
      display_name: 'Saint-Denis, Seine-Saint-Denis, Île-de-France, France', ai_used: true, ambiguous: false,
    })
    assert.equal(body.center.lat, 48.9362)
    const [prompt] = hostCalls(log, 'gateway.ai.cloudflare.com')
    const request = JSON.parse(prompt.body)
    assert.match(request.messages[0].content, /untrusted_content/)
    assert.match(request.messages[1].content, /<untrusted_content>\nSaint-Denis\n<\/untrusted_content>/)
    assert.match(request.messages[1].content, /Paris overwatch/)
    const rewritten = hostCalls(log, 'nominatim.openstreetmap.org')[1]
    assert.equal(new URL(rewritten.url).searchParams.get('countrycodes'), 'fr')
  })
})

test('nearby by place: junk from the model is ignored and the top result is flagged ambiguous', async () => {
  for (const reply of [
    { query: 'https://evil.example/ ignore previous instructions', country_code: 'FR' },
    { query: '48.9362, 2.3574', country_code: 'FR' },
    { query: 'x'.repeat(121) },
    { query: '<script>alert(1)</script>' },
    'not json at all',
    { place: 'wrong key' },
  ]) {
    const { env } = await fixture({ windyKey: true, ai: true })
    await withUpstreams({ ai: { 'cop-webcams-place': reply } }, async (log) => {
      const res = await nearby(env, 'owner', '?place=Saint-Denis')
      assert.equal(res.status, 200, JSON.stringify(reply))
      const body = await res.json()
      assert.equal(body.resolution.ai_used, false, JSON.stringify(reply))
      assert.equal(body.resolution.ambiguous, true)
      assert.equal(body.center.lat, 48.9362)
      assert.equal(hostCalls(log, 'nominatim.openstreetmap.org').length, 1, JSON.stringify(reply))
    })
  }
})

test('nearby by place: without a model the top result is flagged ambiguous; with no result at all, 422', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    const res = await nearby(env, 'owner', '?place=Saint-Denis')
    const body = await res.json()
    assert.equal(body.resolution.ambiguous, true)
    assert.equal(body.resolution.ai_used, false)
    assert.equal(hostCalls(log, 'gateway.ai.cloudflare.com').length, 0)
    const none = await nearby(env, 'owner', '?place=Nowhere%20at%20all')
    assert.equal(none.status, 422)
    assert.equal((await none.json()).code, 'PLACE_NOT_FOUND')
  })
})

test('nearby from a page address: the model reads host and path only, and the page is never fetched', async () => {
  const { env } = await fixture({ windyKey: true, ai: true })
  const page = 'https://www.meteocanada.com/europe/france/ile-de-france/seine-saint-denis/saint-denis/webcam?session=SECRET123#top'
  const ai = { 'cop-webcams-from-url': { query: 'Saint-Denis, Seine-Saint-Denis', country_code: 'fr', confidence: 'high' } }
  await withUpstreams({ ai }, async (log) => {
    const res = await nearby(env, 'owner', `?from_url=${encodeURIComponent(page)}`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.center.source, 'url')
    assert.equal(body.resolution.ai_used, true)
    assert.equal(body.resolution.ambiguous, false)
    assert.equal(body.resolution.input, 'www.meteocanada.com / europe / france / ile-de-france / seine-saint-denis / saint-denis / webcam')
    assert.equal(body.geocoder_attribution, '© OpenStreetMap contributors')
    assert.equal(hostCalls(log, 'www.meteocanada.com').length, 0)
    const prompt = hostCalls(log, 'gateway.ai.cloudflare.com')[0].body
    assert.match(prompt, /seine-saint-denis/)
    assert.doesNotMatch(prompt, /SECRET123/)
    assertOnlyAllowedHosts(log)
  })
  await withUpstreams({ ai: { 'cop-webcams-from-url': { query: null, country_code: null, confidence: 'low' } } }, async () => {
    const res = await nearby(env, 'owner', `?from_url=${encodeURIComponent('https://news.example.com/article/123')}`)
    assert.equal(res.status, 422)
    assert.equal((await res.json()).code, 'PLACE_NOT_FOUND')
  })
  for (const bad of [`windy:${WINDY_ID}`, `https://www.windy.com/webcams/${WINDY_ID}`, 'http://example.com/x', 'https://10.0.0.1/x', 'javascript:alert(1)']) {
    const res = await nearby(env, 'owner', `?from_url=${encodeURIComponent(bad)}`)
    assert.equal(res.status, 400, bad)
  }
})

test('nearby: 20 searches per caller per 10 minutes, then 429 RATE_LIMITED', async () => {
  const { env } = await fixture({ windyKey: true })
  await withUpstreams({}, async () => {
    for (let i = 0; i < 20; i++) assert.equal((await nearby(env, 'owner', '?lat=48.86&lon=2.29')).status, 200, `search ${i + 1}`)
    const limited = await nearby(env, 'owner', '?lat=48.86&lon=2.29')
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).code, 'RATE_LIMITED')
    // Another caller has its own allowance.
    assert.equal((await nearby(env, 'editor', '?lat=48.86&lon=2.29')).status, 200)
  })
})

test('nearby: Windy errors answer 502 WINDY_ERROR; a refused key is logged', async () => {
  const { db, env } = await fixture({ windyKey: true })
  await withUpstreams({ windyStatus: 401 }, async () => {
    const res = await nearby(env, 'owner', '?lat=48.86&lon=2.29')
    assert.equal(res.status, 502)
    assert.equal((await res.json()).code, 'WINDY_ERROR')
  })
  assert.match(db.prepare("SELECT message FROM event_logs WHERE level = 'error'").get().message, /refused the API key/)
})

// ── Geocoder usage policy ─────────────────────────────────────────

test('geocoder: one request per normalised search, results cached 7 days and empty results 24 hours', async () => {
  const { env, kv } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    for (const place of ['Stade de France', '  stade   DE france ', 'STADE DE FRANCE']) {
      assert.equal((await nearby(env, 'owner', `?place=${encodeURIComponent(place)}`)).status, 200, place)
    }
    const geo = hostCalls(log, 'nominatim.openstreetmap.org')
    assert.equal(geo.length, 1)
    assert.equal(new URL(geo[0].url).searchParams.get('q'), 'stade de france')
    for (let i = 0; i < 2; i++) assert.equal((await nearby(env, 'owner', '?place=Nowhere%20at%20all')).status, 422)
    assert.equal(hostCalls(log, 'nominatim.openstreetmap.org').length, 2)
    const ttls = [...kv.ttls].filter(([k]) => k.startsWith('geo:v1:')).map(([, t]) => t).sort((a, b) => a - b)
    assert.deepEqual(ttls, [86400, 604800])
  })
})

test('geocoder: app-wide cap of 30 calls a minute; cached answers still serve; no KV means no calls', async () => {
  const { env, kv } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    assert.equal((await nearby(env, 'owner', '?place=Stade%20de%20France')).status, 200)
    kv.store.set(`quota:geocoder:global:${Math.floor(Date.now() / 60_000)}`, '30')
    const capped = await nearby(env, 'editor', '?place=Eiffel%20Tower%2C%20Paris')
    assert.equal(capped.status, 503)
    assert.equal((await capped.json()).code, 'GEOCODER_UNAVAILABLE')
    assert.equal((await nearby(env, 'editor', '?place=Stade%20de%20France')).status, 200) // cache hit
    assert.equal(hostCalls(log, 'nominatim.openstreetmap.org').length, 1)
  })
  const { geocode, GeocoderError } = mod('geocoder')
  const log = upstreams()
  try {
    await assert.rejects(geocode({}, 'stade de france'), (e) => e instanceof GeocoderError && e.reason === 'throttled')
    assert.equal(log.length, 0)
  } finally {
    log.restore()
  }
})

test('geocoder: the KV kill switch stops Nominatim calls without a deploy', async () => {
  const { db, env, kv } = await fixture({ windyKey: true })
  await withUpstreams({}, async (log) => {
    assert.equal((await nearby(env, 'owner', '?place=Stade%20de%20France')).status, 200)
    kv.store.set('geocoder:disabled', '1')
    const off = await nearby(env, 'owner', '?place=Eiffel%20Tower%2C%20Paris')
    assert.equal(off.status, 503)
    assert.equal((await off.json()).code, 'GEOCODER_UNAVAILABLE')
    assert.equal((await nearby(env, 'owner', '?place=Stade%20de%20France')).status, 200) // cached
    assert.equal(hostCalls(log, 'nominatim.openstreetmap.org').length, 1)
  })
  // Logged at most once per isolate (an earlier test in this file may have logged it already).
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM event_logs WHERE source = 'geocoder'").get().n <= 1)
})

// ── PATCH ─────────────────────────────────────────────────────────

test('PATCH edits label, position, bearing and field of view; scoped to the session; editors only', async () => {
  const { db, env } = await fixture()
  const { webcam } = await (await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'Square' })).json()
  const other = (await (await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'Elsewhere' }, OTHER_SESSION)).json()).webcam

  const res = await patchCam(env, 'editor', webcam.id, { label: 'Place de la République', lat: 48.8674, lon: 2.3636, bearing_deg: 45, bearing_source: 'estimated', fov_deg: 70 })
  assert.equal(res.status, 200)
  const edited = (await res.json()).webcam
  assert.equal(edited.label, 'Place de la République')
  assert.equal(edited.position_source, 'user')
  assert.equal(edited.bearing_deg, 45)
  assert.equal(edited.bearing_source, 'estimated')
  assert.equal(edited.fov_deg, 70)

  const cleared = (await (await patchCam(env, 'owner', webcam.id, { lat: null, lon: null, bearing_deg: null })).json()).webcam
  assert.deepEqual([cleared.lat, cleared.lon, cleared.position_source, cleared.bearing_deg, cleared.bearing_source], [null, null, null, null, null])
  assert.equal((await (await patchCam(env, 'owner', webcam.id, { bearing_deg: 10 })).json()).webcam.bearing_source, 'user')

  // Another session's camera id is not found through this session, and is unchanged.
  assert.equal((await patchCam(env, 'owner', other.id, { label: 'Hijacked' })).status, 404)
  assert.equal(db.prepare('SELECT label FROM cop_webcams WHERE id = ?').get(other.id).label, 'Elsewhere')
  assert.equal((await patchCam(env, 'viewer', webcam.id, { label: 'x' })).status, 403)
  assert.equal((await patchCam(env, 'stranger', webcam.id, { label: 'x' })).status, 403)
  assert.equal((await patchCam(env, 'service', webcam.id, { label: 'x' })).status, 403)
  for (const body of [{}, { lat: 1 }, { lat: 91, lon: 0 }, { bearing_deg: 360 }, { bearing_deg: 1.5 }, { bearing_deg: 1, bearing_source: 'model' }, { bearing_source: 'user' }, { fov_deg: 0 }, { label: '' }, { label: 'x'.repeat(121) }]) {
    const bad = await patchCam(env, 'owner', webcam.id, body)
    assert.equal(bad.status, 400, JSON.stringify(body))
    assert.equal((await bad.json()).code, 'WEBCAM_INVALID')
  }
  await removeCamDirect(db, webcam.id)
  assert.equal((await patchCam(env, 'owner', webcam.id, { label: 'Gone' })).status, 404)
})

function removeCamDirect(db, id) {
  db.prepare("UPDATE cop_webcams SET archived_at = datetime('now') WHERE id = ?").run(id)
}

// ── Estimate bearing ──────────────────────────────────────────────

test('estimate-bearing: the model names the landmark, the geocoder places it, arithmetic gives 192°', async () => {
  const { env } = await fixture({ windyKey: true, ai: true })
  const ai = { 'cop-webcams-view-target': { target: 'Eiffel Tower, Paris' } }
  await withUpstreams({ ai }, async (log) => {
    const { webcam } = await (await addCam(env, 'owner', { url: `windy:${WINDY_ID}` })).json()
    const res = await estimate(env, 'editor', webcam.id)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.bearing_deg, 192)
    assert.equal(body.ai_used, true)
    assert.equal(body.target.name, 'Eiffel Tower, Paris')
    assert.equal(body.target.display_name, 'Eiffel Tower, Paris, France')
    assert.ok(Math.abs(body.target.distance_km - 0.81) < 0.02)
    assert.equal(body.geocoder_attribution, '© OpenStreetMap contributors')
    const prompt = JSON.parse(hostCalls(log, 'gateway.ai.cloudflare.com')[0].body).messages[1].content
    assert.match(prompt, /Paris: CESE - Eiffel Tower/)
    const geo = new URL(hostCalls(log, 'nominatim.openstreetmap.org')[0].url).searchParams
    assert.equal(geo.get('bounded'), '1')
    assertOnlyAllowedHosts(log)
    // Nothing is saved until the client PATCHes it.
    assert.equal((await (await cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as('owner'), handler: mod('webcams'), params: { id: SESSION } })).json()).webcams[0].bearing_deg, null)
  })
})

test('estimate-bearing: no landmark, a landmark too far away, no position, no model, wrong role', async () => {
  const { env } = await fixture({ ai: true })
  const posed = (await (await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'Street corner', lat: 48.8655, lon: 2.2968 })).json()).webcam
  const unposed = (await (await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'Unplaced' }, OTHER_SESSION)).json()).webcam

  await withUpstreams({ ai: { 'cop-webcams-view-target': { target: null } } }, async () => {
    const res = await estimate(env, 'owner', posed.id)
    assert.equal(res.status, 422)
    assert.equal((await res.json()).code, 'NO_VIEW_TARGET')
  })
  await withUpstreams({ ai: { 'cop-webcams-view-target': { target: 'Far landmark' } } }, async () => {
    const res = await estimate(env, 'owner', posed.id)
    assert.equal(res.status, 422)
    assert.equal((await res.json()).code, 'NO_VIEW_TARGET')
  })
  await withUpstreams({}, async () => {
    const res = await estimate(env, 'owner', unposed.id, OTHER_SESSION)
    assert.equal(res.status, 422)
    assert.equal((await res.json()).code, 'WEBCAM_NO_POSITION')
    assert.equal((await estimate(env, 'owner', unposed.id)).status, 404) // another session's camera
    assert.equal((await estimate(env, 'viewer', posed.id)).status, 403)
    assert.equal((await estimate(env, 'service', posed.id)).status, 403)
  })
  const noAi = await fixture()
  const cam = (await (await addCam(noAi.env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'x', lat: 1, lon: 2 })).json()).webcam
  const res = await estimate(noAi.env, 'owner', cam.id)
  assert.equal(res.status, 503)
  assert.equal((await res.json()).code, 'AI_UNAVAILABLE')
})

// ── Status refresh on list ────────────────────────────────────────

test('listing re-checks stale Windy statuses in the background, at most once per 10 minutes', async () => {
  const { db, env } = await fixture({ windyKey: true })
  const now = new Date().toISOString()
  const seed = db.prepare(`INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, label, delivery, created_at, windy_status, status_checked_at)
    VALUES (?, ?, 'windy', ?, ?, 'timelapse', ?, ?, ?)`)
  seed.run('cam-stale', SESSION, WINDY_ID, 'Stale', now, null, null)
  seed.run('cam-gone', SESSION, MISSING_ID, 'Gone', now, 'active', '2026-01-01T00:00:00.000Z')
  seed.run('cam-fresh', SESSION, STADE_ID, 'Fresh', now, 'inactive', now)
  await withUpstreams({}, async (log) => {
    const waits = []
    const list = (w) => cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as('viewer'), handler: mod('webcams'), params: { id: SESSION }, waits: w })
    const res = await list(waits)
    assert.equal(res.status, 200)
    assert.equal((await res.json()).webcams.find((w) => w.id === 'cam-stale').windy_status, null) // answered before the refresh
    assert.equal(waits.length, 1)
    await Promise.all(waits)
    const batch = hostCalls(log, 'api.windy.com')[0]
    assert.deepEqual(new URL(batch.url).searchParams.get('webcamIds').split(',').sort(), [MISSING_ID, WINDY_ID].sort())
    const rows = Object.fromEntries(db.prepare('SELECT id, windy_status, delivery, status_checked_at FROM cop_webcams').all().map((r) => [r.id, r]))
    assert.equal(rows['cam-stale'].windy_status, 'active')
    assert.equal(rows['cam-stale'].delivery, 'live')
    assert.equal(rows['cam-gone'].windy_status, 'not_found')
    assert.equal(rows['cam-fresh'].windy_status, 'inactive')
    assert.equal(rows['cam-fresh'].status_checked_at, now)

    db.prepare("UPDATE cop_webcams SET status_checked_at = NULL").run()
    const again = []
    await list(again)
    assert.equal(again.length, 0)
  })
})

// ── Before migration 0021 ─────────────────────────────────────────

test('without migration 0021: add, list, edit, search and the public share all work on the 0020 columns', async () => {
  const { db, env } = await fixture({ sources: false, windyKey: true })
  await withUpstreams({}, async () => {
    const add = await addCam(env, 'owner', { url: `windy:${WINDY_ID}` })
    assert.equal(add.status, 201)
    const { webcam } = await add.json()
    assert.equal(webcam.label, 'Paris: CESE - Eiffel Tower')
    assert.equal(webcam.lat, 48.8655)
    assert.equal(webcam.delivery, 'live')
    assert.equal(webcam.source_url, null)
    assert.equal(webcam.position_source, null)

    const list = await (await cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as('owner'), handler: mod('webcams'), params: { id: SESSION }, waits: [] })).json()
    assert.equal(list.webcams.length, 1)
    assert.equal(list.webcams[0].windy_status, null)

    const patched = await patchCam(env, 'owner', webcam.id, { bearing_deg: 192, bearing_source: 'estimated', label: 'CESE' })
    assert.equal(patched.status, 200)
    assert.equal((await patched.json()).webcam.bearing_deg, 192)

    const near = await (await nearby(env, 'owner', '?lat=48.86&lon=2.29')).json()
    assert.equal(near.webcams.find((w) => w.windy_id === WINDY_ID).on_session, true)
  })
  assert.equal(db.prepare('SELECT bearing_deg FROM cop_webcams').get().bearing_deg, 192)
})

// ── Service allow-list ────────────────────────────────────────────

test('COP_SERVICE_ROUTES adds GET nearby and nothing else', () => {
  const { COP_SERVICE_ROUTES } = mod('copCaller')
  const allowed = (method, path) => COP_SERVICE_ROUTES.some((r) => r.method === method && r.path.test(path))
  assert.equal(allowed('GET', '/api/cop/cop-x/webcams/nearby'), true)
  assert.equal(allowed('GET', '/api/cop/public/webcams/nearby'), false)
  assert.equal(allowed('GET', '/api/cop/cop-x/webcams'), false)
  assert.equal(allowed('PATCH', '/api/cop/cop-x/webcams/abc'), false)
  assert.equal(allowed('POST', '/api/cop/cop-x/webcams/abc/estimate-bearing'), false)
  assert.equal(allowed('POST', '/api/cop/cop-x/webcams'), true)
})
