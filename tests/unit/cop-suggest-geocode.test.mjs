/**
 * POST /api/cop/:id/suggest and GET /api/cop/:id/geocode.
 *
 * - suggest: prefixes, links and coordinates are decided in code (no model call);
 *   only unprefixed text reaches the model; tags are only the session's own; places
 *   only ones the text names; coordinates/links in a model reply are dropped; the
 *   model call is charged and refused without KV to count with.
 * - geocode: coordinates need no lookup; a place goes to Nominatim with the COP's
 *   bias and the OSM credit; an ambiguous place is rewritten once by the model; the
 *   kill switch and the app-wide cap answer 503; only the allowed hosts are called.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cop, fixture, jsonResponse, mod, scriptFetch, SESSION, setupInputSuite } from './cop-input-harness.mjs'

setupInputSuite(['serviceAuth', 'copCaller', 'middleware', 'copSuggest', 'suggest', 'geocode', 'itemTags'])

const ALLOWED_HOSTS = new Set(['nominatim.openstreetmap.org', 'gateway.ai.cloudflare.com'])
const hostCalls = (log, host) => log.filter((e) => e.host === host)

const PLACES = {
  'gare du nord': [{ name: 'Gare du Nord', display_name: 'Gare du Nord, Paris, France', lat: '48.8809', lon: '2.3553', importance: 0.7 }],
  'the stadium': [
    { name: 'Stadium A', display_name: 'Stadium, Lyon, France', lat: '45.76', lon: '4.83', importance: 0.4 },
    { name: 'Stadium B', display_name: 'Stadium, Marseille, France', lat: '43.27', lon: '5.39', importance: 0.41 },
  ],
  'stade de france, saint-denis': [{ name: 'Stade de France', display_name: 'Stade de France, Saint-Denis, France', lat: '48.9245', lon: '2.3601', importance: 0.8 }],
}

function upstreams({ ai = {} } = {}) {
  return scriptFetch(async (url, init) => {
    if (url.hostname === 'nominatim.openstreetmap.org') return jsonResponse(PLACES[url.searchParams.get('q')] ?? [])
    if (url.hostname === 'gateway.ai.cloudflare.com') {
      const endpoint = JSON.parse(init.headers['cf-aig-metadata'] ?? '{}').endpoint
      const reply = ai[endpoint]
      if (reply === undefined) return jsonResponse({ error: 'no scripted reply' }, 500)
      return jsonResponse({ choices: [{ message: { content: typeof reply === 'string' ? reply : JSON.stringify(reply) } }] })
    }
    return jsonResponse({ error: 'not scripted' }, 599)
  })
}

const suggest = (env, who, body) =>
  cop(env, 'POST', `/api/cop/${SESSION}/suggest`, { who, body, handler: mod('suggest'), params: { id: SESSION } })
const geocode = (env, who, query) =>
  cop(env, 'GET', `/api/cop/${SESSION}/geocode${query}`, { who, handler: mod('geocode'), params: { id: SESSION } })

async function withVocabulary(env, names) {
  await cop(env, 'POST', `/api/cop/${SESSION}/item-tags`, {
    who: 'owner', body: { target_type: 'marker', target_id: 'mkr-paris', tags: names }, handler: mod('itemTags'), params: { id: SESSION },
  })
}

test('suggest: prefixes, links and coordinates are decided without a model call', async () => {
  const { env } = await fixture({ ai: true })
  await withVocabulary(env, ['protest', 'transport'])
  const log = upstreams()
  try {
    for (const [text, kind] of [
      ['rfi!!: who blocked the A1?', 'rfi'],
      ['task: check the north gate', 'task'],
      ['t: 2026-10-23 march started', 'timeline'],
      ['maybe: they will move at noon', 'hypothesis'],
      ['nai: 48.88,2.35 north gate', 'marker'],
      ['crowd at 48.8809, 2.3553 #protest', 'marker'],
      ['video https://example.org/clip #Transport', 'evidence'],
      ['note: https://example.org', 'note'],
    ]) {
      const res = await suggest(env, 'editor', { text })
      assert.equal(res.status, 200, text)
      const body = await res.json()
      assert.equal(body.kind.value, kind, text)
      assert.equal(body.ai_status, 'not_needed', text)
    }
    const tagged = await (await suggest(env, 'editor', { text: 'video https://example.org/clip #Transport #unknown' })).json()
    assert.deepEqual(tagged.tags, ['transport'], 'only vocabulary hashtags, in its spelling')
    assert.equal(log.length, 0, 'no outbound call at all')
  } finally {
    log.restore()
  }
})

test('suggest: unprefixed text gets one model call; tags outside the vocabulary and invented places are dropped', async () => {
  const { env } = await fixture({ ai: true })
  await withVocabulary(env, ['protest', 'transport'])
  const log = upstreams({
    ai: {
      'cop-suggest': {
        kind: 'rfi',
        confidence: 0.8,
        tags: ['#Protest', 'secret-new-tag', 'transport'],
        places: [
          { text: 'Gare du Nord', query: 'Gare du Nord, Paris' },
          { text: 'Lyon', query: 'Lyon' },
          { text: 'north gate', query: '48.8809, 2.3553' },
          { text: 'Gare du Nord', query: 'https://evil.example' },
        ],
      },
    },
  })
  try {
    const res = await suggest(env, 'editor', { text: 'is anyone at Gare du Nord near the north gate?' })
    const body = await res.json()
    assert.deepEqual(body.kind, { value: 'rfi', confidence: 0.8 })
    assert.deepEqual(body.tags, ['protest', 'transport'])
    assert.deepEqual(body.places, [{ text: 'Gare du Nord', query: 'Gare du Nord, Paris' }])
    assert.equal(body.ai_status, 'used')
    assert.equal(hostCalls(log, 'gateway.ai.cloudflare.com').length, 1)
    const prompt = JSON.parse(hostCalls(log, 'gateway.ai.cloudflare.com')[0].body).messages[1].content
    assert.match(prompt, /<untrusted_content>[\s\S]*Gare du Nord[\s\S]*<\/untrusted_content>/)
    for (const entry of log) assert.ok(ALLOWED_HOSTS.has(entry.host), entry.host)
  } finally {
    log.restore()
  }
})

test('suggest: a junk or hostile model reply yields nothing it did not earn', async () => {
  const { env } = await fixture({ ai: true })
  await withVocabulary(env, ['protest'])
  for (const reply of ['not json', { kind: 'delete_everything', tags: 'protest', places: 'Paris' }, ['rfi']]) {
    const log = upstreams({ ai: { 'cop-suggest': reply } })
    try {
      const body = await (await suggest(env, 'editor', { text: 'something happened near the river' })).json()
      assert.equal(body.kind, null, JSON.stringify(reply))
      assert.deepEqual(body.tags, [])
      assert.deepEqual(body.places, [])
    } finally {
      log.restore()
    }
  }
})

test('suggest: the model call is charged; no KV to count with means no model call', async () => {
  const { env } = await fixture({ ai: true, kv: false })
  const log = upstreams({ ai: { 'cop-suggest': { kind: 'rfi', confidence: 1, tags: [], places: [] } } })
  try {
    const body = await (await suggest(env, 'editor', { text: 'what is happening at the river?' })).json()
    assert.equal(body.ai_status, 'unavailable')
    assert.equal(body.kind, null)
    assert.equal(log.length, 0)
  } finally {
    log.restore()
  }
  const limited = await fixture({ ai: true })
  const calls = upstreams({ ai: { 'cop-suggest': { kind: 'note', confidence: 0.5, tags: [], places: [] } } })
  try {
    let last
    for (let i = 0; i < 61; i++) last = await (await suggest(limited.env, 'editor', { text: `free text ${i}` })).json()
    assert.equal(last.ai_status, 'rate_limited')
    assert.equal(hostCalls(calls, 'gateway.ai.cloudflare.com').length, 60)
  } finally {
    calls.restore()
  }
})

test('suggest: editors and the bot; viewers and strangers are refused; size bounded', async () => {
  const { env } = await fixture()
  assert.equal((await suggest(env, 'viewer', { text: 'rfi: x' })).status, 403)
  assert.equal((await suggest(env, 'attacker', { text: 'rfi: x' })).status, 403)
  assert.equal((await suggest(env, 'service', { text: 'rfi: x' })).status, 200)
  assert.equal((await suggest(env, 'editor', { text: 'x'.repeat(2001) })).status, 400)
  assert.equal((await suggest(env, 'editor', { text: '  ' })).status, 400)
})

test('geocode: coordinates need no lookup; a place goes to Nominatim with the COP bias and the OSM credit', async () => {
  const { env } = await fixture()
  const log = upstreams()
  try {
    const typed = await (await geocode(env, 'service', '?q=48.88,2.355')).json()
    assert.deepEqual(typed.results[0], { display_name: '48.88000, 2.35500', lat: 48.88, lon: 2.355, importance: 1 })
    assert.equal(log.length, 0)

    const res = await geocode(env, 'service', '?q=Gare%20du%20Nord')
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.results[0].display_name, 'Gare du Nord, Paris, France')
    assert.equal(body.geocoder_attribution, '© OpenStreetMap contributors')
    assert.equal(body.resolution.ai_used, false)
    const url = new URL(hostCalls(log, 'nominatim.openstreetmap.org')[0].url)
    assert.ok(url.searchParams.get('viewbox'), 'biased to the COP center')
    assert.equal(hostCalls(log, 'nominatim.openstreetmap.org')[0].headers['user-agent'], 'ResearchTools-COP/1.0 (+https://researchtools.net)')
  } finally {
    log.restore()
  }
})

test('geocode: an ambiguous place is rewritten once by the model with COP context', async () => {
  const { env } = await fixture({ ai: true })
  const log = upstreams({ ai: { 'cop-webcams-place': { query: 'Stade de France, Saint-Denis', country_code: 'FR' } } })
  try {
    const body = await (await geocode(env, 'editor', '?q=the%20stadium')).json()
    assert.equal(body.results[0].display_name, 'Stade de France, Saint-Denis, France')
    assert.deepEqual(
      { ai_used: body.resolution.ai_used, query: body.resolution.query },
      { ai_used: true, query: 'Stade de France, Saint-Denis' },
    )
    assert.equal(hostCalls(log, 'gateway.ai.cloudflare.com').length, 1)
    assert.equal(new URL(hostCalls(log, 'nominatim.openstreetmap.org')[1].url).searchParams.get('countrycodes'), 'fr')
  } finally {
    log.restore()
  }
})

test('geocode: not found is 422; the kill switch and the app-wide cap are 503', async () => {
  const { env, kv } = await fixture()
  const log = upstreams()
  try {
    const missing = await geocode(env, 'editor', '?q=nowhere%20at%20all')
    assert.equal(missing.status, 422)
    assert.equal((await missing.json()).code, 'PLACE_NOT_FOUND')

    await kv.put('geocoder:disabled', '1')
    const off = await geocode(env, 'editor', '?q=somewhere%20else')
    assert.equal(off.status, 503)
    assert.equal((await off.json()).code, 'GEOCODER_UNAVAILABLE')
    await kv.delete('geocoder:disabled')

    await kv.put(`quota:geocoder:global:${Math.floor(Date.now() / 60_000)}`, '30', { expirationTtl: 120 })
    const capped = await geocode(env, 'editor', '?q=another%20place')
    assert.equal(capped.status, 503)
  } finally {
    log.restore()
  }
})

test('geocode: viewers and strangers are refused; the per-caller quota answers 429', async () => {
  const { env } = await fixture()
  assert.equal((await geocode(env, 'viewer', '?q=Paris')).status, 403)
  assert.equal((await geocode(env, 'attacker', '?q=Paris')).status, 403)
  const log = upstreams()
  try {
    let last
    for (let i = 0; i < 31; i++) last = await geocode(env, 'editor', `?q=gare%20du%20nord`)
    assert.equal(last.status, 429)
  } finally {
    log.restore()
  }
})
