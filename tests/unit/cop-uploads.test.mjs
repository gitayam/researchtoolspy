/**
 * COP uploads and image metadata (managed migration 0023).
 *
 * - functions/api/_shared/image-sanitize.ts: the type comes from magic bytes; JPEG
 *   loses EXIF/GPS, XMP, IPTC, comments and trailing data but keeps Orientation;
 *   PNG loses tEXt/eXIf; WebP loses EXIF/XMP (and its VP8X flags); GIF loses
 *   comments; an image that can't be walked is refused, not stored as is.
 * - POST /api/cop/:id/uploads: editors and the bot; bytes beat the declared type;
 *   SVG/HTML refused; stored under cop/<session>/… without metadata; optional
 *   evidence item with tags.
 * - GET /api/cop/:id/uploads/:id (collaborators) and the share route (live share
 *   with the evidence panel) serve inert; another session's upload is 404; the
 *   public /api/uploads/[[key]] route can't serve cop/ keys.
 * - The drop-form upload route stores clean bytes too.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATTACKER_SESSION, b64, cop, events, fixture, jpegExifTags, jpegWithMetadata, leaksMetadata, mod, publicCall,
  SESSION, setupInputSuite, SHARE_EXPIRED, SHARE_NO_FEED, SHARE_TOKEN, DROP_TOKEN,
} from './cop-input-harness.mjs'
import { GIF_COMMENT, JPEG_PLAIN, JPEG_PROGRESSIVE, PNG_META, WEBP_META } from './fixtures/images.mjs'

setupInputSuite(['serviceAuth', 'copCaller', 'middleware', 'sanitize', 'uploads', 'upload', 'publicUpload', 'servePublic', 'surveyUpload'])

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')
const HTML = new TextEncoder().encode('<!doctype html><script>alert(1)</script>')

// ── Sanitizer ─────────────────────────────────────────────────────

test('magic bytes decide the type; SVG and HTML are not images', () => {
  const { sniffFileType } = mod('sanitize')
  assert.equal(sniffFileType(b64(JPEG_PLAIN)), 'image/jpeg')
  assert.equal(sniffFileType(b64(PNG_META)), 'image/png')
  assert.equal(sniffFileType(b64(WEBP_META)), 'image/webp')
  assert.equal(sniffFileType(b64(GIF_COMMENT)), 'image/gif')
  assert.equal(sniffFileType(new TextEncoder().encode('%PDF-1.7\n')), 'application/pdf')
  assert.equal(sniffFileType(SVG), null)
  assert.equal(sniffFileType(HTML), null)
})

test('JPEG: GPS, XMP, IPTC, comments and trailing data go; Orientation stays (baseline and progressive)', () => {
  const { sanitizeImage } = mod('sanitize')
  for (const [name, base] of [['baseline', JPEG_PLAIN], ['progressive', JPEG_PROGRESSIVE]]) {
    const input = jpegWithMetadata(b64(base), { orientation: 6 })
    assert.ok(leaksMetadata(input), `${name}: the fixture carries the planted metadata`)
    assert.deepEqual(jpegExifTags(input), [[0x0112, 0x8825]], `${name}: input has Orientation and GPSInfo`)
    const out = sanitizeImage(input, 'image/jpeg')
    assert.equal(out.ok, true, name)
    assert.equal(out.width, 16)
    assert.equal(out.height, 8)
    assert.equal(out.orientation, 6)
    assert.equal(leaksMetadata(out.bytes), false, `${name}: no planted metadata left`)
    assert.deepEqual(jpegExifTags(out.bytes), [[0x0112]], `${name}: only Orientation is left`)
    assert.deepEqual([...out.bytes.subarray(-2)], [0xff, 0xd9], `${name}: ends at EOI`)
  }
  // Orientation 1 needs no Exif block at all.
  const upright = mod('sanitize').sanitizeImage(jpegWithMetadata(b64(JPEG_PLAIN), { orientation: 1 }), 'image/jpeg')
  assert.deepEqual(jpegExifTags(upright.bytes), [])
})

test('PNG, WebP and GIF lose their metadata blocks and still parse', () => {
  const { sanitizeImage } = mod('sanitize')
  const chunks = (b) => {
    const out = []
    for (let i = 8; i + 8 <= b.length;) {
      const n = (b[i] << 24 >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
      out.push(Buffer.from(b.subarray(i + 4, i + 8)).toString('latin1'))
      i += 12 + n
    }
    return out
  }
  const png = sanitizeImage(b64(PNG_META), 'image/png')
  assert.deepEqual(chunks(b64(PNG_META)), ['IHDR', 'tEXt', 'eXIf', 'IDAT', 'IEND'])
  assert.deepEqual(chunks(png.bytes), ['IHDR', 'IDAT', 'IEND'])
  assert.equal(leaksMetadata(png.bytes), false)

  const riff = (b) => {
    const out = []
    for (let i = 12; i + 8 <= b.length;) {
      const n = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)
      out.push(Buffer.from(b.subarray(i, i + 4)).toString('latin1'))
      i += 8 + n + (n & 1)
    }
    return out
  }
  const webp = sanitizeImage(b64(WEBP_META), 'image/webp')
  assert.deepEqual(riff(b64(WEBP_META)), ['VP8X', 'VP8 ', 'EXIF', 'XMP '])
  assert.deepEqual(riff(webp.bytes), ['VP8X', 'VP8 '])
  assert.equal(webp.bytes[20] & 0x0c, 0, 'VP8X EXIF/XMP flags cleared')
  const size = webp.bytes[4] | (webp.bytes[5] << 8) | (webp.bytes[6] << 16) | (webp.bytes[7] << 24)
  assert.equal(size, webp.bytes.length - 8, 'RIFF size rewritten')
  assert.equal(webp.width, 4)

  const gif = sanitizeImage(b64(GIF_COMMENT), 'image/gif')
  assert.ok(leaksMetadata(b64(GIF_COMMENT)))
  assert.equal(gif.ok, true)
  assert.equal(leaksMetadata(gif.bytes), false)
  assert.equal(gif.bytes.at(-1), 0x3b)
})

test('an image that cannot be walked is refused, not passed through', () => {
  const { sanitizeImage } = mod('sanitize')
  const jpeg = b64(JPEG_PLAIN)
  assert.equal(sanitizeImage(jpeg.subarray(0, 300), 'image/jpeg').ok, false, 'truncated JPEG')
  const broken = new Uint8Array(jpeg)
  broken[2] = 0x00
  assert.equal(sanitizeImage(broken, 'image/jpeg').ok, false, 'marker structure broken')
  const png = new Uint8Array(b64(PNG_META))
  png.set(Buffer.from('ZZZZ'), 8 + 25 + 4) // rename the tEXt chunk (after the 25-byte IHDR) to an unknown critical chunk
  assert.equal(sanitizeImage(png, 'image/png').ok, false, 'unknown critical PNG chunk')
  assert.equal(sanitizeImage(b64(GIF_COMMENT).subarray(0, 20), 'image/gif').ok, false, 'truncated GIF')
})

// ── Upload route ──────────────────────────────────────────────────

const upload = (env, who, raw, { session = SESSION, query = '', headers = {} } = {}) =>
  cop(env, 'POST', `/api/cop/${session}/uploads${query}`, {
    who, raw, headers: { 'Content-Type': 'application/octet-stream', ...headers },
    handler: mod('uploads'), params: { id: session },
  })

test('upload: editors and the bot only', async () => {
  const { env, r2 } = await fixture()
  const jpeg = jpegWithMetadata(b64(JPEG_PLAIN))
  assert.equal((await upload(env, undefined, jpeg)).status, 401)
  assert.equal((await upload(env, 'viewer', jpeg)).status, 403)
  assert.equal((await upload(env, 'attacker', jpeg)).status, 403)
  assert.equal(r2.objects.size, 0)
  assert.equal((await upload(env, 'editor', jpeg)).status, 201)
  assert.equal((await upload(env, 'service', jpeg)).status, 201)
})

test('upload: the bytes decide the type and lose their metadata before R2', async () => {
  const { db, env, r2 } = await fixture()
  const jpeg = jpegWithMetadata(b64(JPEG_PLAIN))
  // Declared as a PNG with a .png name: stored as the JPEG it is.
  const res = await upload(env, 'owner', jpeg, { headers: { 'Content-Type': 'image/png', 'X-File-Name': '../../evil.png' } })
  assert.equal(res.status, 201)
  const { upload: up } = await res.json()
  assert.equal(up.content_type, 'image/jpeg')
  assert.equal(up.width, 16)
  assert.equal(up.url, `/api/cop/${SESSION}/uploads/${up.id}`)
  const row = db.prepare('SELECT r2_key, content_type, original_name, source_channel FROM cop_uploads WHERE id = ?').get(up.id)
  assert.match(row.r2_key, new RegExp(`^cop/${SESSION}/[0-9a-f-]{36}$`))
  assert.equal(row.original_name, 'evil.png')
  assert.equal(row.source_channel, 'web')
  const stored = r2.objects.get(row.r2_key)
  assert.equal(stored.httpMetadata.contentType, 'image/jpeg')
  assert.equal(leaksMetadata(stored.bytes), false)
  assert.deepEqual(jpegExifTags(stored.bytes), [[0x0112]])
  assert.deepEqual(events(db, 'upload').map((e) => e.entity_id), [up.id])
})

test('upload: SVG, HTML and unknown files are refused; an unparsable image is refused', async () => {
  const { env, r2 } = await fixture()
  for (const raw of [SVG, HTML, new TextEncoder().encode('just text')]) {
    const res = await upload(env, 'owner', raw, { headers: { 'Content-Type': 'image/svg+xml' } })
    assert.equal(res.status, 415)
    assert.equal((await res.json()).code, 'UNSUPPORTED_FILE')
  }
  const res = await upload(env, 'owner', b64(JPEG_PLAIN).subarray(0, 300))
  assert.equal(res.status, 422)
  assert.equal((await res.json()).code, 'UNREADABLE_IMAGE')
  assert.equal(r2.objects.size, 0)
})

test('upload: multipart with evidence and tags files an unverified evidence item', async () => {
  const { db, env } = await fixture({ channel: true })
  const form = new FormData()
  form.append('file', new File([jpegWithMetadata(b64(JPEG_PLAIN))], 'IMG_0001.jpg', { type: 'image/jpeg' }))
  form.append('evidence', '1')
  form.append('tags', 'crowd, #Gare du Nord')
  const res = await cop(env, 'POST', `/api/cop/${SESSION}/uploads`, { who: 'service', raw: form, handler: mod('uploads'), params: { id: SESSION } })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.deepEqual(body.evidence.tags, ['crowd', 'Gare du Nord'])
  const ev = db.prepare('SELECT title, evidence_type, credibility, source_url, source_channel, workspace_id FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(body.evidence.id)
  assert.equal(ev.evidence_type, 'image')
  assert.equal(ev.credibility, 'unverified')
  assert.equal(ev.source_url, body.upload.url)
  assert.equal(ev.source_channel, 'signal')
  assert.equal(ev.workspace_id, 'ws-owner')
  assert.match(ev.title, /^Photo: IMG_0001\.jpg$/)
  const tagSources = db.prepare("SELECT DISTINCT source FROM cop_item_tags WHERE target_type = 'evidence'").all().map((r) => r.source)
  assert.deepEqual(tagSources, ['chat'])
})

test('upload: without migration 0023 or without R2 the route says so', async () => {
  const noTable = await fixture({ tags: false })
  const a = await upload(noTable.env, 'owner', b64(JPEG_PLAIN))
  assert.equal(a.status, 503)
  assert.equal((await a.json()).code, 'UPLOADS_UNAVAILABLE')
  assert.equal(noTable.r2.objects.size, 0, 'bytes removed again when the row cannot be written')
  const noR2 = await fixture({ r2: false })
  const b = await upload(noR2.env, 'owner', b64(JPEG_PLAIN))
  assert.equal(b.status, 503)
})

// ── Serving ───────────────────────────────────────────────────────

async function stored(env) {
  const res = await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)))
  return (await res.json()).upload
}

const getUpload = (env, who, id, session = SESSION) =>
  cop(env, 'GET', `/api/cop/${session}/uploads/${id}`, { who, handler: mod('upload'), params: { id: session, uploadId: id } })

test('serving: collaborators read; strangers and other sessions do not; headers are inert', async () => {
  const { env } = await fixture()
  const up = await stored(env)
  const res = await getUpload(env, 'viewer', up.id)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(res.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox")
  assert.equal(res.headers.get('Content-Disposition'), 'inline')
  assert.equal(leaksMetadata(new Uint8Array(await res.arrayBuffer())), false)
  assert.equal((await getUpload(env, 'attacker', up.id)).status, 403)
  // The attacker's own session cannot reach the Paris upload by id.
  assert.equal((await getUpload(env, 'attacker', up.id, ATTACKER_SESSION)).status, 404)
})

test('serving: a PDF is a download', async () => {
  const { env } = await fixture()
  const res = await upload(env, 'owner', new TextEncoder().encode('%PDF-1.4\n%%EOF\n'))
  const { upload: up } = await res.json()
  const served = await getUpload(env, 'owner', up.id)
  assert.equal(served.headers.get('Content-Type'), 'application/pdf')
  assert.match(served.headers.get('Content-Disposition'), /^attachment; filename="upl-[0-9a-f-]+\.pdf"$/)
})

test('serving through a share: only a live share that shows the evidence feed', async () => {
  const { db, env } = await fixture()
  const up = await stored(env)
  const viaShare = (token, id = up.id) =>
    publicCall(env, mod('publicUpload'), 'GET', `/api/cop/public/${token}/uploads/${id}`, { params: { token, uploadId: id } })
  const ok = await viaShare(SHARE_TOKEN)
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox")
  assert.equal((await viaShare(SHARE_NO_FEED)).status, 404)
  assert.equal((await viaShare(SHARE_EXPIRED)).status, 404)
  assert.equal((await viaShare('not-a-token')).status, 404)
  assert.equal((await viaShare(SHARE_TOKEN, 'upl-attacker')).status, 404)
  db.prepare("UPDATE cop_sessions SET status = 'ARCHIVED' WHERE id = ?").run(SESSION)
  assert.equal((await viaShare(SHARE_TOKEN)).status, 404)
})

test('the public /api/uploads route cannot serve COP upload keys', async () => {
  const { db, env } = await fixture()
  const up = await stored(env)
  const key = db.prepare('SELECT r2_key FROM cop_uploads WHERE id = ?').get(up.id).r2_key
  const res = await publicCall(env, mod('servePublic'), 'GET', `/api/uploads/${key}`, { params: { key: key.split('/') } })
  assert.equal(res.status, 404)
})

// ── Drop-form uploads ─────────────────────────────────────────────

test('the drop-form upload route stores clean bytes under the sniffed type', async () => {
  const { env, r2 } = await fixture()
  env.TURNSTILE_SECRET = 'set'
  env.BOT_INTAKE_API_KEY = 'bot-key-0000000000000000'
  // The trusted bot passes the Turnstile gate, so the test reaches storage.
  const form = new FormData()
  form.append('files', new File([jpegWithMetadata(b64(JPEG_PLAIN))], 'tip.png', { type: 'image/png' }))
  const res = await publicCall(env, mod('surveyUpload'), 'POST', `/api/surveys/public/${DROP_TOKEN}/upload`, {
    raw: form, headers: { Authorization: 'Bearer bot-key-0000000000000000' }, params: { token: DROP_TOKEN },
  })
  assert.equal(res.status, 201, await res.clone().text())
  const { files } = await res.json()
  assert.equal(files[0].type, 'image/jpeg')
  const object = r2.objects.get(files[0].key)
  assert.equal(object.httpMetadata.contentType, 'image/jpeg')
  assert.equal(leaksMetadata(object.bytes), false)
})

test('the public /api/uploads route cleans older stored images (Orientation kept) and never serves an unparsable one raw', async () => {
  const { env, r2 } = await fixture()
  // Stored before uploads were cleaned at write time.
  await r2.put('uploads/srv-paris/old-photo.jpg', jpegWithMetadata(b64(JPEG_PLAIN), { orientation: 6 }), { httpMetadata: { contentType: 'image/jpeg' } })
  await r2.put('uploads/srv-paris/old-broken.jpg', jpegWithMetadata(b64(JPEG_PLAIN)).subarray(0, 400), { httpMetadata: { contentType: 'image/jpeg' } })
  const serve = (key) => publicCall(env, mod('servePublic'), 'GET', `/api/uploads/${key}`, { params: { key: key.split('/') } })
  const ok = await serve('uploads/srv-paris/old-photo.jpg')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox")
  const bytes = new Uint8Array(await ok.arrayBuffer())
  assert.equal(leaksMetadata(bytes), false)
  assert.deepEqual(jpegExifTags(bytes), [[0x0112]], 'portrait photos stay upright')
  const broken = await serve('uploads/srv-paris/old-broken.jpg')
  assert.equal(broken.status, 415)
  assert.equal(leaksMetadata(new Uint8Array(await broken.arrayBuffer())), false)
})
