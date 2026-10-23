/**
 * A research COP keeps a photo's location for its team (decision 2026-10-23) and never
 * gives it to anyone else.
 *
 * - functions/api/_shared/photo-location.ts + image-sanitize.ts sanitizeImageVariants:
 *   the TEAM copy of a JPEG/PNG/WebP keeps GPS position, capture time and Orientation
 *   and nothing else (no make/model, artist/copyright/owner, serials, maker note, IFD1
 *   thumbnail, XMP, IPTC); the PUBLIC copy keeps only Orientation. Position from XMP
 *   when the Exif block has none. 0,0, out-of-range, hemisphere-less, void and
 *   zero-denominator positions are ignored.
 * - POST /api/cop/:id/uploads (editors, the bot): both copies stored (r2_key public,
 *   team_r2_key team, managed migration 0029), the position on the row, ONE possible
 *   "Photo location" marker (PHOTO_GPS) per evidence item.
 * - Collaborators are served the team copy; a share link only ever the public one.
 * - An unconfirmed photo marker is the team's only: not on the share map layer, the CoT
 *   share feed, a public session's markers list or changelog; shown once CONFIRMED.
 * - Drop-form tips: the stored answer keeps the team copy, ingest places a 'drop' photo
 *   marker, the public results route re-cleans images, a reject takes it all back.
 * - Old uploads (stripped, no team copy) and a server without 0029 keep working.
 * - Team evidence list carries photo_location; nobody else's does. The chat feed labels
 *   the marker "photo location" without coordinates.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  b64, cop, DROP_TOKEN, ENTRIES, fixture, migration, mod, publicCall, SESSION, setupInputSuite, SHARE_TOKEN,
} from './cop-input-harness.mjs'
import { JPEG_PLAIN, PNG_META, WEBP_META } from './fixtures/images.mjs'
import {
  buildTiff, exifBlocks, gpsIfd, jpegWith, leaksIdentifying, phoneTiff, pngChunks, pngWith, readTiff, tiffPosition,
  webpChunks, webpWith, xmpWithGps,
} from './fixtures/photo-exif.mjs'

Object.assign(ENTRIES, {
  photoLocation: 'functions/api/_shared/photo-location.ts',
  copRecords: 'functions/api/_shared/cop-records.ts',
  layerMarkers: 'functions/api/cop/[id]/layers/markers.ts',
  cot: 'functions/api/cop/[id]/cot.ts',
  markers: 'functions/api/cop/[id]/markers.ts',
  markerChangelog: 'functions/api/cop/[id]/marker-changelog.ts',
  evidence: 'functions/api/cop/[id]/evidence.ts',
  surveyResults: 'functions/api/surveys/public/[token]/results.ts',
  chatFeedLib: 'functions/api/_shared/cop-chat-feed.ts',
})
setupInputSuite([
  'serviceAuth', 'copCaller', 'middleware', 'sanitize', 'photoLocation', 'copRecords', 'copIngest', 'uploads', 'upload',
  'publicUpload', 'submissions', 'dropSubmit', 'layerMarkers', 'cot', 'markers', 'markerChangelog', 'evidence',
  'surveyResults', 'chatFeedLib',
])

const LAT = 48.8583
const LON = 2.2945
const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps

/** Clean base images to splice metadata into. */
const bases = () => {
  const { sanitizeImage } = mod('sanitize')
  return {
    jpeg: b64(JPEG_PLAIN),
    png: sanitizeImage(b64(PNG_META), 'image/png').bytes,
    webp: sanitizeImage(b64(WEBP_META), 'image/webp').bytes,
  }
}

const phonePhoto = (type, options = {}) => {
  const base = bases()
  const tiff = 'tiff' in options ? options.tiff : phoneTiff(options)
  if (type === 'image/png') return pngWith(base.png, { tiff, xmp: options.xmp })
  if (type === 'image/webp') return webpWith(base.webp, { tiff, xmp: options.xmp })
  return jpegWith(base.jpeg, { tiff, xmp: options.xmp })
}

/** Asserts a team copy holds exactly the kept fields and the public copy none of them. */
function assertVariants(type, input, out, { orientation = 6 } = {}) {
  assert.equal(out.ok, true, `${type}: ${out.reason}`)
  assert.deepEqual(leaksIdentifying(input).length > 0, true, `${type}: the fixture carries identifying fields`)
  for (const [name, bytes] of [['public', out.bytes], ['team', out.teamBytes]]) {
    assert.deepEqual(leaksIdentifying(bytes), [], `${type} ${name}: no make, model, owner, serial, maker note or thumbnail`)
    assert.equal(Buffer.from(bytes).includes(Buffer.from('xmpmeta')), false, `${type} ${name}: no XMP`)
    assert.equal(Buffer.from(bytes).includes(Buffer.from('IPTC')), false, `${type} ${name}: no IPTC`)
  }
  // Public: no position and no capture time anywhere.
  for (const block of exifBlocks(out.bytes, type)) {
    const t = readTiff(block)
    assert.equal(t.gps, null, `${type} public: no GPS IFD`)
    assert.equal(t.exif, null, `${type} public: no Exif IFD (capture time)`)
  }
  // Team: one Exif block, IFD0 = Orientation + the two pointers, no IFD1 (thumbnail).
  const blocks = exifBlocks(out.teamBytes, type)
  assert.equal(blocks.length, 1, `${type} team: one Exif block`)
  const t = readTiff(blocks[0])
  const expectIfd0 = orientation !== 1 ? [0x0112, 0x8769, 0x8825] : [0x8769, 0x8825]
  assert.deepEqual([...t.ifd0.keys()].sort((a, b) => a - b), expectIfd0, `${type} team: IFD0 tags`)
  if (orientation !== 1) assert.equal(t.ifd0.get(0x0112).values[0], orientation)
  assert.equal(t.ifd1, null, `${type} team: no IFD1 thumbnail`)
  assert.deepEqual([...t.exif.keys()].sort((a, b) => a - b), [0x9003, 0x9011], `${type} team: only capture time in the Exif IFD`)
  assert.equal(t.exif.get(0x9003).values, '2026:10:23 10:15:00')
  assert.equal(t.exif.get(0x9011).values, '+02:00')
  assert.deepEqual([...t.gps.keys()].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6], `${type} team: only position tags in the GPS IFD`)
  const pos = tiffPosition(blocks[0])
  assert.ok(near(pos.lat, LAT, 1e-4) && near(pos.lon, LON, 1e-4), `${type} team: position kept (${pos.lat}, ${pos.lon})`)
  assert.ok(near(pos.alt, 35.5, 0.01), `${type} team: altitude kept`)
  // Both copies are still images the sanitizer can walk, at the same size.
  const { sanitizeImage } = mod('sanitize')
  const again = sanitizeImage(out.teamBytes, type)
  assert.equal(again.ok, true, `${type} team copy parses`)
  assert.equal(again.width, out.width)
}

// ── Sanitizer: the two copies ────────────────────────────────────────

test('JPEG: the team copy keeps GPS, capture time and Orientation only; the public copy only Orientation', () => {
  const { sanitizeImageVariants } = mod('sanitize')
  for (const le of [false, true]) {
    const input = phonePhoto('image/jpeg', { le })
    const out = sanitizeImageVariants(input, 'image/jpeg')
    assertVariants('image/jpeg', input, out)
    assert.ok(near(out.location.gps.lat, LAT, 1e-4) && near(out.location.gps.lon, LON, 1e-4))
    assert.equal(out.location.gps.alt, 35.5)
    // The public copy is exactly what the plain sanitizer makes.
    assert.deepEqual(Buffer.from(out.bytes), Buffer.from(mod('sanitize').sanitizeImage(input, 'image/jpeg').bytes))
    const pub = exifBlocks(out.bytes, 'image/jpeg').map((b) => [...readTiff(b).ifd0.keys()])
    assert.deepEqual(pub, [[0x0112]], 'public JPEG keeps Orientation only')
  }
  assert.equal(mod('photoLocation').capturedAtIso(sanitizeImageVariants(phonePhoto('image/jpeg'), 'image/jpeg').location), '2026-10-23T10:15:00+02:00')
})

test('PNG and WebP: the team copy keeps GPS, capture time and Orientation only; the public copy none of it', () => {
  const { sanitizeImageVariants } = mod('sanitize')
  const png = phonePhoto('image/png')
  const pngOut = sanitizeImageVariants(png, 'image/png')
  assertVariants('image/png', png, pngOut)
  assert.deepEqual(pngChunks(pngOut.bytes), ['IHDR', 'IDAT', 'IEND'])
  assert.deepEqual(pngChunks(pngOut.teamBytes), ['IHDR', 'eXIf', 'IDAT', 'IEND'])

  const webp = phonePhoto('image/webp')
  const webpOut = sanitizeImageVariants(webp, 'image/webp')
  assertVariants('image/webp', webp, webpOut)
  assert.deepEqual(webpChunks(webpOut.bytes), ['VP8X', 'VP8 '])
  assert.deepEqual(webpChunks(webpOut.teamBytes), ['VP8X', 'VP8 ', 'EXIF'])
  const team = Buffer.from(webpOut.teamBytes)
  assert.equal(team[20] & 0x08, 0x08, 'VP8X EXIF flag set on the team copy')
  assert.equal(team[20] & 0x04, 0, 'no XMP flag')
  assert.equal(team.readUInt32LE(4), team.length - 8, 'RIFF size rewritten')

  // A simple-format WebP (no VP8X) gets one, with the canvas size and the EXIF flag.
  const clean = Buffer.from(bases().webp)
  const vp8 = clean.subarray(12 + 8 + clean.readUInt32LE(16))
  const exif = Buffer.from(phoneTiff())
  const exifChunk = Buffer.concat([Buffer.from('EXIF'), Buffer.from(Uint32Array.of(exif.length).buffer), exif, exif.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)])
  const body = Buffer.concat([Buffer.from('WEBP'), vp8, exifChunk])
  const simple = Buffer.concat([Buffer.from('RIFF'), Buffer.from(Uint32Array.of(body.length).buffer), body])
  assert.deepEqual(webpChunks(simple), ['VP8 ', 'EXIF'])
  const simpleOut = sanitizeImageVariants(simple, 'image/webp')
  assert.deepEqual(webpChunks(simpleOut.teamBytes), ['VP8X', 'VP8 ', 'EXIF'])
  const t = Buffer.from(simpleOut.teamBytes)
  assert.equal(t[20], 0x08, 'only the EXIF flag')
  assert.equal(t.readUIntLE(24, 3) + 1, simpleOut.width)
  assert.equal(t.readUIntLE(27, 3) + 1, simpleOut.height)
  assert.equal(mod('sanitize').sanitizeImage(simpleOut.teamBytes, 'image/webp').ok, true)
  assert.ok(tiffPosition(exifBlocks(simpleOut.teamBytes, 'image/webp')[0]))
})

test('a position only in XMP is read and kept as Exif; the XMP itself (and its creator) goes', () => {
  const { sanitizeImageVariants } = mod('sanitize')
  const input = jpegWith(b64(JPEG_PLAIN), { tiff: null, xmp: xmpWithGps() })
  const out = sanitizeImageVariants(input, 'image/jpeg')
  assert.equal(out.ok, true)
  assert.ok(near(out.location.gps.lat, 48 + 51.5 / 60) && near(out.location.gps.lon, 2 + 17.67 / 60), JSON.stringify(out.location))
  assert.equal(out.location.dateTimeOriginal, '2026:10:23 10:15:00')
  assert.equal(out.location.offsetTimeOriginal, '+02:00')
  const pos = tiffPosition(exifBlocks(out.teamBytes, 'image/jpeg')[0])
  assert.ok(near(pos.lat, 48 + 51.5 / 60, 1e-5) && near(pos.lon, 2 + 17.67 / 60, 1e-5))
  assert.deepEqual(leaksIdentifying(out.teamBytes), [])
  // The same from a PNG iTXt and a WebP "XMP " chunk.
  for (const [type, bytes] of [['image/png', phonePhoto('image/png', { tiff: null, xmp: xmpWithGps() })], ['image/webp', phonePhoto('image/webp', { tiff: null, xmp: xmpWithGps() })]]) {
    const v = sanitizeImageVariants(bytes, type)
    assert.ok(v.location.gps && near(v.location.gps.lat, 48 + 51.5 / 60), `${type}: ${JSON.stringify(v.location)}`)
    assert.ok(tiffPosition(exifBlocks(v.teamBytes, type)[0]), `${type}: kept as Exif`)
    assert.deepEqual(leaksIdentifying(v.teamBytes), [], type)
  }
  // Exif wins over XMP when both have a position.
  const both = sanitizeImageVariants(jpegWith(b64(JPEG_PLAIN), { tiff: phoneTiff(), xmp: xmpWithGps({ lat: '10,0N', lon: '10,0E' }) }), 'image/jpeg')
  assert.ok(near(both.location.gps.lat, LAT, 1e-4))
})

test('implausible positions are ignored: 0,0, out of range, no hemisphere, void, zero denominator, minutes ≥ 60', () => {
  const { readPhotoLocation } = mod('photoLocation')
  const { sanitizeImageVariants } = mod('sanitize')
  const bad = {
    'zero zero': gpsIfd({ lat: 0, lon: 0 }),
    'latitude 91': { ...gpsIfd({ lat: 10, lon: 10 }), 0x0002: [5, [[91, 1], [0, 1], [0, 1]]] },
    'longitude 181': { ...gpsIfd({ lat: 10, lon: 10 }), 0x0004: [5, [[181, 1], [0, 1], [0, 1]]] },
    'no latitude ref': gpsIfd({ lat: LAT, lon: LON, latRef: null }),
    'bad ref': gpsIfd({ lat: LAT, lon: LON, latRef: 'X' }),
    'void fix': gpsIfd({ lat: LAT, lon: LON, status: 'V' }),
    'zero denominator': { ...gpsIfd({ lat: LAT, lon: LON }), 0x0002: [5, [[48, 0], [51, 1], [30, 1]]] },
    'minutes 75': { ...gpsIfd({ lat: LAT, lon: LON }), 0x0002: [5, [[48, 1], [75, 1], [0, 1]]] },
    'latitude as one rational': { ...gpsIfd({ lat: LAT, lon: LON }), 0x0002: [5, [[48, 1]]] },
  }
  for (const [name, gps] of Object.entries(bad)) {
    const input = jpegWith(b64(JPEG_PLAIN), { tiff: phoneTiff({ gps }), xmp: null })
    assert.equal(readPhotoLocation(input, 'image/jpeg').gps, null, name)
    const out = sanitizeImageVariants(input, 'image/jpeg')
    assert.equal(out.location.gps, null, name)
    // Capture time is still kept; no GPS IFD is written.
    assert.equal(readTiff(exifBlocks(out.teamBytes, 'image/jpeg')[0]).gps, null, `${name}: no GPS in the team copy`)
  }
  // A photo with neither position nor time has no team copy at all.
  const bare = sanitizeImageVariants(jpegWith(b64(JPEG_PLAIN), { tiff: phoneTiff({ gps: null, time: false }), xmp: null }), 'image/jpeg')
  assert.equal(bare.teamBytes, null)
  // Broken metadata never breaks the upload: no location, both copies fine.
  const garbage = jpegWith(b64(JPEG_PLAIN), { tiff: Uint8Array.from([0x4d, 0x4d, 0, 42, 0xff, 0xff, 0xff, 0xff]), xmp: '<x exif:GPSLatitude="999,0N"/>' })
  const g = sanitizeImageVariants(garbage, 'image/jpeg')
  assert.equal(g.ok, true)
  assert.equal(g.location.gps, null)
  assert.equal(g.teamBytes, null)
  // An out-of-range date is no capture time.
  const badTime = buildTiff({ ifd0: { 0x0112: [3, 1] }, exif: { 0x9003: [2, '2026:02:30 10:15:00'] } })
  assert.equal(readPhotoLocation(jpegWith(b64(JPEG_PLAIN), { tiff: badTime, xmp: null }), 'image/jpeg').dateTimeOriginal, null)
})

// ── Upload route, serving and the marker ─────────────────────────────

async function photoFixture(options = {}) {
  const f = await fixture({ channel: true, ...options })
  f.db.exec(migration('0025_cop_upload_documents.sql'))
  if (options.photoLocation !== false) f.db.exec(migration('0029_cop_photo_location.sql'))
  return f
}

const uploadPhoto = (env, who, bytes, { evidence = true, evidenceId, name = 'IMG_0001.jpg', type = 'image/jpeg' } = {}) => {
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  if (evidence) form.append('evidence', '1')
  if (evidenceId) form.append('evidence_id', String(evidenceId))
  return cop(env, 'POST', `/api/cop/${SESSION}/uploads`, { who, raw: form, handler: mod('uploads'), params: { id: SESSION } })
}

const getUpload = (env, who, id) =>
  cop(env, 'GET', `/api/cop/${SESSION}/uploads/${id}`, { who, handler: mod('upload'), params: { id: SESSION, uploadId: id } })
const viaShare = (env, id) =>
  publicCall(env, mod('publicUpload'), 'GET', `/api/cop/public/${SHARE_TOKEN}/uploads/${id}`, { params: { token: SHARE_TOKEN, uploadId: id } })
const photoMarkers = (db) => db.prepare("SELECT * FROM cop_markers WHERE source_type = 'PHOTO_GPS' ORDER BY created_at").all()

test('upload: both copies stored, the position on the row, one possible "Photo location" marker for the evidence', async () => {
  const { db, env, r2 } = await photoFixture()
  const res = await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))
  assert.equal(res.status, 201, await res.clone().text())
  const body = await res.json()
  assert.equal(body.upload.location_kept, true)
  assert.match(body.evidence.photo_marker_id, /^mkr-/)
  const row = db.prepare('SELECT r2_key, team_r2_key, gps_lat, gps_lon, gps_alt, captured_at FROM cop_uploads WHERE id = ?').get(body.upload.id)
  assert.equal(row.team_r2_key, `${row.r2_key}.team`)
  assert.ok(near(row.gps_lat, LAT, 1e-4) && near(row.gps_lon, LON, 1e-4))
  assert.equal(row.gps_alt, 35.5)
  assert.equal(row.captured_at, '2026-10-23T10:15:00+02:00')
  const pub = r2.objects.get(row.r2_key).bytes
  const team = r2.objects.get(row.team_r2_key).bytes
  assert.equal(exifBlocks(pub, 'image/jpeg').some((b) => readTiff(b).gps), false, 'r2_key holds no position')
  assert.ok(tiffPosition(exifBlocks(team, 'image/jpeg')[0]), 'team_r2_key holds the position')
  assert.deepEqual(leaksIdentifying(team), [])

  const [marker] = photoMarkers(db)
  assert.equal(marker.id, body.evidence.photo_marker_id)
  assert.equal(marker.confidence, 'POSSIBLE')
  assert.equal(marker.label, 'Photo location')
  assert.equal(marker.source_id, String(body.evidence.id))
  assert.equal(marker.source_channel, 'web')
  assert.ok(near(marker.lat, LAT, 1e-4) && near(marker.lon, LON, 1e-4))
  const ev = db.prepare('SELECT description FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(String(body.evidence.id))
  assert.match(ev.description, /kept for the team only/)
  assert.doesNotMatch(ev.description, /48\.|2\.29/, 'no coordinates in the evidence text')
})

test('serving: collaborators get the team copy; a share link only the stripped copy', async () => {
  const { env } = await photoFixture()
  const { upload } = await (await uploadPhoto(env, 'service', phonePhoto('image/jpeg'))).json()
  const team = new Uint8Array(await (await getUpload(env, 'viewer', upload.id)).arrayBuffer())
  assert.ok(tiffPosition(exifBlocks(team, 'image/jpeg')[0]), 'a viewer (collaborator) gets the position')
  const shared = await viaShare(env, upload.id)
  assert.equal(shared.status, 200)
  const pub = new Uint8Array(await shared.arrayBuffer())
  assert.equal(exifBlocks(pub, 'image/jpeg').some((b) => readTiff(b).gps || readTiff(b).exif), false, 'no position or time through a share')
  assert.deepEqual(leaksIdentifying(pub), [])
  assert.notDeepEqual(Buffer.from(pub), Buffer.from(team))
})

test('one photo-location marker per evidence item', async () => {
  const { db, env } = await photoFixture()
  const first = await (await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))).json()
  // Another GPS photo attached to the same item: no second marker.
  const again = await uploadPhoto(env, 'editor', phonePhoto('image/png'), { evidence: false, evidenceId: first.evidence.id, name: 'b.png', type: 'image/png' })
  assert.equal(again.status, 201, await again.clone().text())
  assert.equal((await again.json()).evidence.photo_marker_id, null)
  assert.equal(photoMarkers(db).length, 1)
  // The helper itself refuses a second one, and the 0029 index backs it up.
  const { copSessionScope, insertCopMarkerOnce } = mod('copRecords')
  const scope = await copSessionScope(env.DB, SESSION)
  const input = { lat: 1, lon: 1, label: 'x', description: null, confidence: 'POSSIBLE', rationale: null, sourceType: 'PHOTO_GPS', sourceId: String(first.evidence.id), sourceChannel: 'web', createdBy: 1 }
  assert.equal(await insertCopMarkerOnce(env.DB, scope, input), null)
  assert.throws(() => db.prepare(`INSERT INTO cop_markers (id, cop_session_id, uid, lat, lon, created_by, source_type, source_id)
    VALUES ('mkr-dupe', ?, 'u', 1, 1, 1, 'PHOTO_GPS', ?)`).run(SESSION, String(first.evidence.id)), /UNIQUE/)
  // A photo without a usable position places none.
  const none = await (await uploadPhoto(env, 'editor', phonePhoto('image/jpeg', { tiff: phoneTiff({ gps: gpsIfd({ lat: 0, lon: 0 }) }) }))).json()
  assert.equal(none.evidence.photo_marker_id, null)
  assert.equal(none.upload.location_kept, false)
  assert.equal(photoMarkers(db).length, 1)
})

test('an unconfirmed photo marker is the team\'s only: share map, CoT share feed, public-session readers', async () => {
  const { db, env } = await photoFixture()
  const { evidence } = await (await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))).json()
  const markerId = evidence.photo_marker_id
  db.prepare("UPDATE cop_sessions SET active_layers = '[\"cop-markers\"]' WHERE id = ?").run(SESSION)
  db.prepare("UPDATE cop_shares SET visible_panels = '[\"map\",\"evidence\"]' WHERE share_token = ?").run(SHARE_TOKEN)

  const shareLayer = async () => (await (await publicCall(env, mod('layerMarkers'), 'GET', `/api/cop/${SESSION}/layers/markers?share=${SHARE_TOKEN}`, { params: { id: SESSION } })).json())
  const teamLayer = async () => (await (await publicCall(env, mod('layerMarkers'), 'GET', `/api/cop/${SESSION}/layers/markers`, { params: { id: SESSION }, headers: { Authorization: 'Bearer session-viewer' } })).json())
  // The CoT route reads the session's bbox and rolling window (production columns).
  db.exec(`ALTER TABLE cop_sessions ADD COLUMN bbox_min_lat REAL; ALTER TABLE cop_sessions ADD COLUMN bbox_min_lon REAL;
    ALTER TABLE cop_sessions ADD COLUMN bbox_max_lat REAL; ALTER TABLE cop_sessions ADD COLUMN bbox_max_lon REAL;
    ALTER TABLE cop_sessions ADD COLUMN rolling_hours INTEGER;`)
  const cotShare = async () => {
    const res = await publicCall(env, mod('cot'), 'GET', `/api/cop/${SESSION}/cot?token=${SHARE_TOKEN}`, { params: { id: SESSION } })
    const xml = await res.text()
    assert.equal(res.status, 200, xml)
    assert.ok(xml.includes('uid-paris'), 'positive control: other markers are in the CoT share feed')
    return xml
  }
  const markerIds = (fc) => fc.features.map((f) => f.properties.id)

  assert.ok(markerIds(await teamLayer()).includes(markerId), 'collaborators see it')
  assert.ok(!markerIds(await shareLayer()).includes(markerId), 'a share link does not')
  assert.ok(markerIds(await shareLayer()).includes('mkr-paris'), 'other markers still show on the share')
  const uid = db.prepare('SELECT uid FROM cop_markers WHERE id = ?').get(markerId).uid
  assert.ok(!(await cotShare()).includes(uid), 'nor the CoT share feed')

  // A public session: anonymous layer readers and signed-in non-collaborators.
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const anonLayer = await (await publicCall(env, mod('layerMarkers'), 'GET', `/api/cop/${SESSION}/layers/markers`, { params: { id: SESSION } })).json()
  assert.ok(!markerIds(anonLayer).includes(markerId), 'an anonymous reader of a public session does not')
  assert.ok(markerIds(anonLayer).includes('mkr-paris'), 'positive control: the anonymous reader gets other markers')
  const list = await (await cop(env, 'GET', `/api/cop/${SESSION}/markers`, { who: 'attacker', handler: mod('markers'), params: { id: SESSION } })).json()
  assert.ok(list.markers.some((m) => m.id === 'mkr-paris'), 'positive control: a non-collaborator reads the list')
  assert.ok(!list.markers.some((m) => m.id === markerId), 'a signed-in non-collaborator does not')
  const logRes = await cop(env, 'GET', `/api/cop/${SESSION}/marker-changelog?marker_id=${markerId}`, { who: 'attacker', handler: mod('markerChangelog'), params: { id: SESSION } })
  assert.equal(logRes.status, 200)
  assert.deepEqual((await logRes.json()).changelog, [], 'nor its changelog (which holds the position)')
  const teamLog = await (await cop(env, 'GET', `/api/cop/${SESSION}/marker-changelog?marker_id=${markerId}`, { who: 'viewer', handler: mod('markerChangelog'), params: { id: SESSION } })).json()
  assert.equal(teamLog.changelog.length, 1)
  db.prepare('UPDATE cop_sessions SET is_public = 0 WHERE id = ?').run(SESSION)

  // PROBABLE is not confirmed; CONFIRMED by an editor shows it.
  for (const [confidence, shown] of [['PROBABLE', false], ['CONFIRMED', true]]) {
    const put = await cop(env, 'PUT', `/api/cop/${SESSION}/markers`, { who: 'editor', body: { id: markerId, confidence }, handler: mod('markers'), params: { id: SESSION } })
    assert.equal(put.status, 200)
    env.CACHE.store.clear()
    assert.equal(markerIds(await shareLayer()).includes(markerId), shown, `${confidence}: on the share map`)
    assert.equal((await cotShare()).includes(uid), shown, `${confidence}: in the CoT share feed`)
  }
})

test('evidence list: collaborators get photo_location; a public session\'s other readers do not', async () => {
  const { db, env } = await photoFixture()
  const { evidence } = await (await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))).json()
  const list = async (who) => (await (await cop(env, 'GET', `/api/cop/${SESSION}/evidence`, { who, handler: mod('evidence'), params: { id: SESSION } })).json()).evidence
  const mine = (await list('viewer')).find((e) => String(e.id) === String(evidence.id))
  assert.equal(mine.photo_location.marker_id, evidence.photo_marker_id)
  assert.ok(near(mine.photo_location.lat, LAT, 1e-4))
  assert.equal(mine.photo_location.confirmed, false)
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  const theirs = await list('attacker')
  const item = theirs.find((e) => String(e.id) === String(evidence.id))
  assert.ok(item, 'the item itself is listed')
  assert.equal('photo_location' in item, false)
  assert.doesNotMatch(JSON.stringify(theirs), /48\.858|2\.294/, 'no coordinates anywhere in their list')
})

test('chat feed: a photo marker is labelled "photo location", titled with its label, no coordinates', async () => {
  const { db, env } = await photoFixture()
  await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))
  const marker = photoMarkers(db)[0]
  const feed = await mod('chatFeedLib').listChatFeed(env.DB, { sessionId: SESSION, workspaceId: 'ws-owner' }, '0', 50, null)
  assert.equal(feed.ok, true, JSON.stringify(feed))
  const item = feed.items.find((i) => i.kind === 'marker' && i.entity_id === marker.id)
  assert.ok(item, JSON.stringify(feed.items))
  assert.equal(item.title, 'Photo location')
  assert.ok(item.labels.includes('photo location'), JSON.stringify(item.labels))
  assert.doesNotMatch(JSON.stringify(feed), /48\.858|2\.294/)
})

// ── Older uploads and an older schema ────────────────────────────────

test('uploads stored before this change (no team copy) are served to the team and the share alike; a row\'s team copy only to the team', async () => {
  const { db, env, r2 } = await photoFixture()
  const variants = mod('sanitize').sanitizeImageVariants(phonePhoto('image/jpeg'), 'image/jpeg')
  const stripped = variants.bytes
  const insert = db.prepare(`INSERT INTO cop_uploads (id, cop_session_id, r2_key, team_r2_key, content_type, bytes) VALUES (?, ?, ?, ?, 'image/jpeg', ?)`)
  // Stored before this change: one stripped object, no team copy.
  await r2.put(`cop/${SESSION}/old`, stripped, { httpMetadata: { contentType: 'image/jpeg' } })
  insert.run('upl-old', SESSION, `cop/${SESSION}/old`, null, stripped.length)
  for (const res of [await getUpload(env, 'viewer', 'upl-old'), await viaShare(env, 'upl-old')]) {
    assert.equal(res.status, 200)
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), Buffer.from(stripped))
  }
  // Stored since: the team copy goes to collaborators only.
  await r2.put(`cop/${SESSION}/new`, stripped, { httpMetadata: { contentType: 'image/jpeg' } })
  await r2.put(`cop/${SESSION}/new.team`, variants.teamBytes, { httpMetadata: { contentType: 'image/jpeg' } })
  insert.run('upl-new', SESSION, `cop/${SESSION}/new`, `cop/${SESSION}/new.team`, stripped.length)
  assert.deepEqual(Buffer.from(await (await getUpload(env, 'viewer', 'upl-new')).arrayBuffer()), Buffer.from(variants.teamBytes))
  assert.deepEqual(Buffer.from(await (await viaShare(env, 'upl-new')).arrayBuffer()), Buffer.from(stripped))
  // A team copy that has gone missing falls back to the stripped one (never the reverse).
  await r2.delete(`cop/${SESSION}/new.team`)
  assert.deepEqual(Buffer.from(await (await getUpload(env, 'viewer', 'upl-new')).arrayBuffer()), Buffer.from(stripped))
})

test('before migration 0029: the upload works as before (stripped copy only) and the marker is still placed', async () => {
  const { db, env, r2 } = await photoFixture({ photoLocation: false })
  const res = await uploadPhoto(env, 'editor', phonePhoto('image/jpeg'))
  assert.equal(res.status, 201, await res.clone().text())
  const body = await res.json()
  assert.equal(body.upload.location_kept, false)
  assert.equal(r2.objects.size, 1, 'the team copy was removed again')
  const [only] = [...r2.objects.values()]
  assert.equal(exifBlocks(only.bytes, 'image/jpeg').some((b) => readTiff(b).gps), false)
  assert.match(body.evidence.photo_marker_id, /^mkr-/)
  assert.equal(photoMarkers(db).length, 1)
  assert.equal((await getUpload(env, 'viewer', body.upload.id)).status, 200)
  assert.equal((await viaShare(env, body.upload.id)).status, 200)
})

// ── Drop-form tips ───────────────────────────────────────────────────

const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`

test('drop-form tip: the stored answer keeps the team copy, ingest places a drop photo marker, public results get no position', async () => {
  const { db, env, r2 } = await photoFixture()
  const photo = phonePhoto('image/jpeg')
  const res = await publicCall(env, mod('dropSubmit'), 'POST', `/api/surveys/public/${DROP_TOKEN}/drop-submit`, {
    params: { token: DROP_TOKEN },
    body: { form_data: { what: 'Crowd at the gate', photo: dataUrl('image/jpeg', photo) } },
  })
  const body = await res.json()
  assert.equal(body.ok, true, JSON.stringify(body))
  assert.ok(body.ingested?.evidence_id, 'auto-ingested')

  // The stored row: GPS and time kept, identifying fields gone.
  const row = db.prepare("SELECT id, form_data FROM survey_responses WHERE survey_id = 'srv-paris'").get()
  const stored = Buffer.from(JSON.parse(row.form_data).photo.split(',')[1], 'base64')
  assert.deepEqual(leaksIdentifying(stored), [])
  assert.ok(tiffPosition(exifBlocks(stored, 'image/jpeg')[0]), 'the team keeps the position')

  // Ingest: both copies, a POSSIBLE drop marker from the photo.
  const upload = db.prepare('SELECT id, r2_key, team_r2_key FROM cop_uploads WHERE evidence_id = ?').get(String(body.ingested.evidence_id))
  assert.ok(upload.team_r2_key)
  assert.ok(tiffPosition(exifBlocks(r2.objects.get(upload.team_r2_key).bytes, 'image/jpeg')[0]))
  const [marker] = photoMarkers(db)
  assert.equal(marker.source_channel, 'drop')
  assert.equal(marker.source_id, String(body.ingested.evidence_id))
  assert.equal(marker.confidence, 'POSSIBLE')

  // The public results route (its token is on every share) re-cleans the image.
  const results = await (await publicCall(env, mod('surveyResults'), 'GET', `/api/surveys/public/${DROP_TOKEN}/results`, { params: { token: DROP_TOKEN } })).json()
  const shown = Buffer.from(results.results[0].data.photo.split(',')[1], 'base64')
  assert.equal(exifBlocks(shown, 'image/jpeg').some((b) => readTiff(b).gps || readTiff(b).exif), false, 'no position or time in public results')
  assert.equal(results.results[0].data.what, 'Crowd at the gate')

  // A reviewer's reject takes back the marker and both copies.
  const reject = await cop(env, 'PUT', `/api/cop/${SESSION}/submissions`, {
    who: 'owner', body: { id: row.id, status: 'rejected' }, handler: mod('submissions'), params: { id: SESSION },
  })
  assert.equal(reject.status, 200, await reject.clone().text())
  assert.equal(photoMarkers(db).length, 0)
  assert.equal(r2.objects.has(upload.r2_key), false)
  assert.equal(r2.objects.has(upload.team_r2_key), false)
})

test('surveys and intake forms still strip a photo completely (only the drop form keeps its location)', async () => {
  const { sanitizeFormDataFiles } = mod('copIngest')
  const schema = [{ name: 'photo', type: 'file', label: 'Photo' }]
  const formData = { photo: dataUrl('image/jpeg', phonePhoto('image/jpeg')) }
  const plain = await sanitizeFormDataFiles(formData, schema)
  const bytes = Buffer.from(plain.formData.photo.split(',')[1], 'base64')
  assert.equal(exifBlocks(bytes, 'image/jpeg').some((b) => readTiff(b).gps || readTiff(b).exif), false)
  const kept = await sanitizeFormDataFiles(formData, schema, { keepLocation: true })
  assert.ok(tiffPosition(exifBlocks(Buffer.from(kept.formData.photo.split(',')[1], 'base64'), 'image/jpeg')[0]))
})
