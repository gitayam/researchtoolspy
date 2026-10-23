/**
 * Spend limits around COP webcam discovery (Windy, Nominatim, the model), and the
 * smaller fixes from the Phase 2 security review.
 *
 * - Windy: an app-wide per-minute cap that fails closed, a 1-hour cache of "no such
 *   camera", and the caller's quota charged by an add that would ask Windy.
 * - Quotas count the caller AND the CF-Connecting-IP (never X-Forwarded-For); the
 *   bot service, which serves every room, gets a larger allowance; without KV every
 *   spend-guarding quota refuses.
 * - The background status refresh does nothing before migration 0021, and a failed
 *   lookup is stamped so it is not retried every window.
 * - A model's place query may not carry coordinates in any common spelling.
 * - A page address loses its query string and fragment before it is searched.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addCam,
  as,
  cop,
  fixture,
  jsonResponse,
  mod,
  scriptFetch,
  SERVICE_AUTH,
  SERVICE_SESSION,
  SESSION,
  setupWebcamSuite,
  WINDY_ID,
  YT_ID,
} from './cop-webcams-harness.mjs'

setupWebcamSuite()

const CESE = {
  webcamId: Number(WINDY_ID),
  title: 'Paris: CESE - Eiffel Tower',
  status: 'active',
  location: { latitude: 48.8655, longitude: 2.2968, city: 'Paris', country: 'France' },
  player: { day: `https://webcams.windy.com/webcams/public/embed/player/${WINDY_ID}/day` },
}

/** Windy knows only the CESE camera; everything else is 404. Nearby lists it. */
function windyFetch({ status = null } = {}) {
  return scriptFetch(async (url) => {
    if (url.hostname !== 'api.windy.com') return jsonResponse({ error: 'not scripted' }, 599)
    if (status) return jsonResponse({ message: 'error' }, status)
    const one = /^\/webcams\/api\/v3\/webcams\/(\d+)$/.exec(url.pathname)
    if (one) return one[1] === WINDY_ID ? jsonResponse(CESE) : jsonResponse({ message: 'Not found' }, 404)
    return jsonResponse({ total: 1, webcams: [CESE] })
  })
}

const windyCalls = (log) => log.filter((e) => e.host === 'api.windy.com').length
const unknownId = (i) => String(1000000000 + i)
const minute = () => Math.floor(Date.now() / 60_000)
const nearby = (env, headers, query = '?lat=48.86&lon=2.29', session = SESSION) =>
  cop(env, 'GET', `/api/cop/${session}/webcams/nearby${query}`, { headers, handler: mod('nearby'), params: { id: session } })

async function within(log, fn) {
  try {
    return await fn()
  } finally {
    log.restore()
  }
}

// ── Windy spend ───────────────────────────────────────────────────

test('25 POSTs with unknown Windy ids make at most 20 Windy fetches; the rest are refused 429', async () => {
  const { db, env } = await fixture({ windyKey: true })
  const log = windyFetch()
  await within(log, async () => {
    const codes = []
    for (let i = 0; i < 25; i++) {
      const res = await addCam(env, 'editor', { url: `windy:${unknownId(i)}` })
      codes.push(`${res.status} ${(await res.json()).code}`)
    }
    assert.ok(windyCalls(log) <= 20, `${windyCalls(log)} Windy fetches`)
    assert.deepEqual(codes.slice(0, 20), Array(20).fill('422 WEBCAM_NOT_FOUND'))
    assert.deepEqual(codes.slice(20), Array(5).fill('429 RATE_LIMITED'))
  })
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cop_webcams').get().n, 0)
})

test("Windy's 404 is cached for an hour: the same unknown id twice is one fetch", async () => {
  const { env, kv } = await fixture({ windyKey: true })
  const log = windyFetch()
  await within(log, async () => {
    for (let i = 0; i < 3; i++) {
      const res = await addCam(env, 'owner', { url: `windy:${unknownId(7)}` })
      assert.equal(res.status, 422)
      assert.equal((await res.json()).code, 'WEBCAM_NOT_FOUND')
    }
    assert.equal(windyCalls(log), 1)
    assert.equal(kv.ttls.get(`windy:cam:v1:${unknownId(7)}`), 3600)
  })
})

test('two users together cannot exceed the app-wide Windy cap of 60 calls a minute', async () => {
  const { env, kv } = await fixture({ windyKey: true })
  // Seed this minute and the next, so the test holds across a minute boundary.
  for (const m of [minute(), minute() + 1]) kv.store.set(`quota:windy:global:${m}`, '58')
  const log = windyFetch()
  await within(log, async () => {
    assert.equal((await nearby(env, as('owner'), '?lat=48.861&lon=2.29')).status, 200)
    assert.equal((await nearby(env, as('editor'), '?lat=48.862&lon=2.29')).status, 200)
    for (const who of ['owner', 'editor']) {
      const res = await nearby(env, as(who), `?lat=48.87${who.length}&lon=2.29`)
      assert.equal(res.status, 503, who)
      assert.equal((await res.json()).code, 'WEBCAM_DISCOVERY_UNAVAILABLE')
    }
    // An add under the cap goes ahead without Windy's details.
    const add = await addCam(env, 'owner', { url: `windy:${WINDY_ID}` })
    assert.equal(add.status, 201)
    assert.equal((await add.json()).webcam.label, `Windy webcam ${WINDY_ID}`)
    assert.equal(windyCalls(log), 2)
  })
})

test('the Windy client itself refuses to call without KV to count with', async () => {
  const { windyCamera, windyNearby, WindyError } = mod('windy')
  const env = { WINDY_WEBCAMS_API_KEY: 'test-windy-key' }
  const log = windyFetch()
  await within(log, async () => {
    await assert.rejects(windyCamera(env, WINDY_ID), (e) => e instanceof WindyError && e.kind === 'throttled')
    await assert.rejects(windyNearby(env, 48.86, 2.29, 5, 20), (e) => e instanceof WindyError && e.kind === 'throttled')
    assert.equal(windyCalls(log), 0)
  })
})

test('without KV the Windy, geocoder and AI quotas all refuse, and nothing is contacted', async () => {
  const { env } = await fixture({ windyKey: true, ai: true, kv: false })
  const log = scriptFetch(async () => jsonResponse({ error: 'should not be called' }, 599))
  await within(log, async () => {
    const search = await nearby(env, as('owner'))
    assert.equal(search.status, 503)
    assert.equal((await search.json()).code, 'WEBCAM_DISCOVERY_UNAVAILABLE')
    const place = await nearby(env, as('owner'), '?place=Stade%20de%20France')
    assert.equal(place.status, 503)

    // An add still works, as in Phase 1: Windy is not asked.
    const add = await addCam(env, 'owner', { url: `windy:${WINDY_ID}` })
    assert.equal(add.status, 201)
    assert.equal((await add.json()).webcam.label, `Windy webcam ${WINDY_ID}`)

    const { webcam } = await (await addCam(env, 'owner', { url: `https://youtu.be/${YT_ID}`, label: 'Square', lat: 48.86, lon: 2.29 })).json()
    const estimate = await cop(env, 'POST', `/api/cop/${SESSION}/webcams/${webcam.id}/estimate-bearing`, {
      headers: as('owner'), body: {}, handler: mod('estimate'), params: { id: SESSION, camId: webcam.id },
    })
    assert.equal(estimate.status, 503)
    assert.equal(log.length, 0)
  })
})

test('quotas count the caller and the CF-Connecting-IP; X-Forwarded-For changes nothing', async () => {
  const { env } = await fixture({ windyKey: true })
  const ip = (addr, extra = {}) => ({ 'CF-Connecting-IP': addr, ...extra })
  const log = windyFetch()
  await within(log, async () => {
    // One person's allowance: 20.
    for (let i = 0; i < 20; i++) {
      const res = await nearby(env, { ...as('owner'), ...ip('203.0.113.7', { 'X-Forwarded-For': `198.51.100.${i}` }) })
      assert.equal(res.status, 200, `owner search ${i + 1}`)
    }
    const spoofed = await nearby(env, { ...as('owner'), ...ip('203.0.113.8', { 'X-Forwarded-For': '192.0.2.1' }) })
    assert.equal(spoofed.status, 429) // a new address does not reset the person's allowance

    // One address's allowance: 30. The second account behind the same address gets the rest.
    let ok = 0
    for (let i = 0; i < 12; i++) {
      if ((await nearby(env, { ...as('editor'), ...ip('203.0.113.7') })).status === 200) ok++
    }
    assert.equal(ok, 10)
    // The same account from another address still has its own allowance left.
    assert.equal((await nearby(env, { ...as('editor'), ...ip('198.51.100.20') })).status, 200)
  })
})

test('the bot service, which serves every room, gets 60 searches per 10 minutes', async () => {
  const { env } = await fixture({ windyKey: true })
  const log = windyFetch()
  await within(log, async () => {
    for (let i = 0; i < 60; i++) {
      const res = await nearby(env, { ...SERVICE_AUTH, 'CF-Connecting-IP': '192.0.2.50' }, '?lat=48.86&lon=2.29', SERVICE_SESSION)
      assert.equal(res.status, 200, `service search ${i + 1}`)
    }
    const limited = await nearby(env, { ...SERVICE_AUTH, 'CF-Connecting-IP': '192.0.2.50' }, '?lat=48.86&lon=2.29', SERVICE_SESSION)
    assert.equal(limited.status, 429)
  })
})

// ── Status refresh ────────────────────────────────────────────────

const list = (env, waits) =>
  cop(env, 'GET', `/api/cop/${SESSION}/webcams`, { headers: as('viewer'), handler: mod('webcams'), params: { id: SESSION }, waits })

test('status refresh does nothing before migration 0021', async () => {
  const { db, env, kv } = await fixture({ windyKey: true, sources: false })
  db.prepare(`INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, label, delivery, created_by, created_at)
    VALUES ('c1', ?, 'windy', ?, 'x', 'timelapse', 1, '2026-01-01')`).run(SESSION, WINDY_ID)
  const log = windyFetch()
  await within(log, async () => {
    for (let round = 0; round < 2; round++) {
      const waits = []
      assert.equal((await list(env, waits)).status, 200)
      await Promise.all(waits)
      kv.store.clear() // the next 10-minute window
    }
    assert.equal(windyCalls(log), 0)
  })
})

test('a failed status lookup is stamped, so the next window does not ask Windy again', async () => {
  const { db, env, kv } = await fixture({ windyKey: true })
  db.prepare(`INSERT INTO cop_webcams (id, cop_session_id, provider, provider_ref, label, delivery, created_by, created_at)
    VALUES ('c1', ?, 'windy', ?, 'x', 'timelapse', 1, '2026-01-01')`).run(SESSION, WINDY_ID)
  const log = windyFetch({ status: 500 })
  await within(log, async () => {
    const waits = []
    await list(env, waits)
    await Promise.all(waits)
    const calls = windyCalls(log)
    assert.ok(calls >= 1)
    const row = db.prepare('SELECT windy_status, status_checked_at FROM cop_webcams').get()
    assert.equal(row.windy_status, null)
    assert.ok(row.status_checked_at, 'stamped')
    for (const key of [...kv.store.keys()]) if (key.startsWith('windy:refresh:')) kv.store.delete(key)
    const again = []
    await list(env, again)
    await Promise.all(again)
    assert.equal(windyCalls(log), calls)
  })
})

// ── Model output ──────────────────────────────────────────────────

test('a model place query may not carry coordinates in any common spelling', () => {
  const { cleanModelQuery } = mod('webcamAi')
  for (const coords of [
    '48.85, 2.29', '48.8584, 2.2945', '48.8584 2.2945', 'N 48.8584 E 2.2945', '48°51′30″N 2°17′40″E',
    '48 51 30 N', '48,8584', 'Paris 48.85', 'lat 48; lon 2.29', '48;02',
  ]) {
    assert.equal(cleanModelQuery(coords), null, coords)
  }
  for (const place of ['Pier 39, San Francisco', 'Terminal 2E, Charles de Gaulle', 'Stade de France, Saint-Denis', 'Route 66', '10 Downing Street, London']) {
    assert.equal(cleanModelQuery(place), place, place)
  }
})

// ── Page addresses ────────────────────────────────────────────────

test('a page address is searched without its query string or fragment', () => {
  const { pageAddressForSearch } = mod('pageAddress')
  assert.equal(
    pageAddressForSearch('https://www.meteocanada.com/europe/france/saint-denis/webcam?session=SECRET#top'),
    'https://www.meteocanada.com/europe/france/saint-denis/webcam',
  )
  assert.equal(pageAddressForSearch('not a url'), null)
  assert.equal(pageAddressForSearch('javascript:alert(1)'), null)
})

test('server side, the camera check and the prompt both ignore the query string and fragment', () => {
  const { pageAddressHint } = mod('discovery')
  assert.equal(
    pageAddressHint('https://news.example.com/paris/live?utm=SECRET#cam'),
    'news.example.com / paris / live',
  )
  // A camera link stays refused whichever way it is read.
  assert.equal(pageAddressHint(`https://www.youtube.com/watch?v=${YT_ID}`), null)
  assert.equal(pageAddressHint(`https://www.windy.com/webcams/${WINDY_ID}?x=1#y`), null)
})
