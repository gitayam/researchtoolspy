/**
 * Photo metadata fixtures for the photo-location suite, written independently of the code
 * under test: a TIFF (Exif) writer and reader, and splicers that put an Exif block, XMP
 * and IPTC into real JPEG/PNG/WebP files.
 *
 * The "phone photo" carries what a phone writes and the team must NOT keep — make,
 * model, artist, copyright, camera owner, body serial, a maker note, an IFD1 thumbnail,
 * XMP creator, IPTC — next to what it keeps: GPS position, capture time, Orientation.
 */
import { Buffer } from 'node:buffer'

/** Strings planted in the fields that must never reach the team copy (or any copy). */
export const IDENTIFYING = ['TestCam', 'X100V', 'Alice Example', 'SERIAL-12345', 'MAKERNOTE-SECRET', 'THUMB-SECRET']

export const leaksIdentifying = (bytes) => {
  const raw = Buffer.from(bytes)
  return IDENTIFYING.filter((s) => raw.includes(Buffer.from(s)))
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

/**
 * A TIFF block from IFDs given as { tag: [type, values] } (ASCII as a string, RATIONAL as
 * [[n, d], …], BYTE/SHORT/LONG as numbers, UNDEFINED as a string). `ifd0` may hold the
 * special keys exif / gps / ifd1 (sub-IFDs); ifd1.thumbnail = bytes for JPEGInterchangeFormat.
 */
export function buildTiff({ le = false, ifd0 = {}, exif = null, gps = null, ifd1 = null } = {}) {
  const out = []
  const u16 = (v) => (le ? [v & 255, (v >> 8) & 255] : [(v >> 8) & 255, v & 255])
  const u32 = (v) => (le ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255] : [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255])
  const encode = (type, value) => {
    if (type === 2) return { count: Buffer.byteLength(value) + 1, data: [...Buffer.from(value, 'latin1'), 0] }
    if (type === 7) return { count: Buffer.byteLength(value), data: [...Buffer.from(value, 'latin1')] }
    if (type === 5) return { count: value.length, data: value.flatMap(([n, d]) => [...u32(n), ...u32(d)]) }
    const list = Array.isArray(value) ? value : [value]
    if (type === 1) return { count: list.length, data: list }
    if (type === 3) return { count: list.length, data: list.flatMap(u16) }
    return { count: list.length, data: list.flatMap(u32) }
  }
  // Layout pass: IFDs first, data after.
  const ifds = [['ifd0', ifd0], ['exif', exif], ['gps', gps], ['ifd1', ifd1]].filter(([, v]) => v)
  const size = (o) => 2 + Object.keys(o).filter((k) => k !== 'thumbnail').length * 12 + 4
  const counts = { ifd0: Object.keys(ifd0).length + (exif ? 1 : 0) + (gps ? 1 : 0) }
  let at = 8
  const offsets = {}
  for (const [name, entries] of ifds) {
    offsets[name] = at
    at += name === 'ifd0' ? 2 + counts.ifd0 * 12 + 4 : size(entries) + (name === 'ifd1' && entries.thumbnail ? 24 : 0)
  }
  let dataAt = at
  const data = []
  const write = (name, entries, next) => {
    const list = Object.entries(entries).filter(([k]) => k !== 'thumbnail').map(([tag, [type, value]]) => ({ tag: Number(tag), type, value }))
    if (name === 'ifd0' && exif) list.push({ tag: 0x8769, type: 4, value: offsets.exif })
    if (name === 'ifd0' && gps) list.push({ tag: 0x8825, type: 4, value: offsets.gps })
    if (name === 'ifd1' && entries.thumbnail) {
      list.push({ tag: 0x0201, type: 4, value: -1 }, { tag: 0x0202, type: 4, value: entries.thumbnail.length })
    }
    list.sort((a, b) => a.tag - b.tag)
    out.push(...u16(list.length))
    for (const e of list) {
      if (e.tag === 0x0201) {
        out.push(...u16(e.tag), ...u16(4), ...u32(1), ...u32(dataAt))
        data.push(...entries.thumbnail)
        dataAt += entries.thumbnail.length
        continue
      }
      const { count, data: bytes } = encode(e.type, e.value)
      out.push(...u16(e.tag), ...u16(e.type), ...u32(count))
      if (TYPE_SIZE[e.type] * count <= 4) {
        out.push(...bytes, ...new Array(4 - bytes.length).fill(0))
      } else {
        out.push(...u32(dataAt))
        data.push(...bytes)
        dataAt += bytes.length
        if (bytes.length & 1) { data.push(0); dataAt += 1 }
      }
    }
    out.push(...u32(next))
  }
  out.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8))
  write('ifd0', ifd0, ifd1 ? offsets.ifd1 : 0)
  if (exif) write('exif', exif, 0)
  if (gps) write('gps', gps, 0)
  if (ifd1) write('ifd1', ifd1, 0)
  while (out.length < at) out.push(0)
  return Uint8Array.from([...out, ...data])
}

/** Exif GPS IFD for a position given in degrees (refs from the sign unless overridden). */
export function gpsIfd({ lat, lon, alt = null, latRef, lonRef, status } = {}) {
  const dms = (v) => {
    const a = Math.abs(v)
    const d = Math.floor(a)
    const m = Math.floor((a - d) * 60)
    const s = Math.round(((a - d) * 60 - m) * 60 * 100)
    return [[d, 1], [m, 1], [s, 100]]
  }
  const g = {
    0x0000: [1, [2, 2, 0, 0]],
    0x0001: [2, latRef ?? (lat < 0 ? 'S' : 'N')],
    0x0002: [5, dms(lat)],
    0x0003: [2, lonRef ?? (lon < 0 ? 'W' : 'E')],
    0x0004: [5, dms(lon)],
    0x0010: [2, 'T'], // GPSImgDirectionRef: not something the team copy keeps
  }
  if (latRef === null) delete g[0x0001]
  if (lonRef === null) delete g[0x0003]
  if (alt !== null) {
    g[0x0005] = [1, alt < 0 ? 1 : 0]
    g[0x0006] = [5, [[Math.round(Math.abs(alt) * 10), 10]]]
  }
  if (status) g[0x0009] = [2, status]
  return g
}

/** What a phone writes: the GPS IFD given, and every identifying field. */
export function phoneTiff({ gps = gpsIfd({ lat: 48.8583, lon: 2.2945, alt: 35.5 }), orientation = 6, le = false, time = true } = {}) {
  return buildTiff({
    le,
    ifd0: {
      0x010f: [2, 'TestCam'],
      0x0110: [2, 'X100V'],
      0x0112: [3, orientation],
      0x0131: [2, 'Firmware 1.0'],
      0x013b: [2, 'Alice Example'],
      0x8298: [2, 'Alice Example'],
    },
    exif: {
      ...(time ? { 0x9003: [2, '2026:10:23 10:15:00'], 0x9011: [2, '+02:00'] } : {}),
      0x927c: [7, 'MAKERNOTE-SECRET'],
      0xa430: [2, 'Alice Example'],
      0xa431: [2, 'SERIAL-12345'],
    },
    gps,
    ifd1: { 0x0103: [3, 6], thumbnail: Buffer.from('THUMB-SECRET-THUMB-SECRET') },
  })
}

// ── Reading (independent of the code under test) ───────────────────

/** Every IFD of a TIFF block: { ifd0, exif, gps, ifd1 } as Map(tag → { type, count, values }). */
export function readTiff(tiff) {
  const b = Buffer.from(tiff)
  const le = b.toString('latin1', 0, 2) === 'II'
  const r16 = (i) => (le ? b.readUInt16LE(i) : b.readUInt16BE(i))
  const r32 = (i) => (le ? b.readUInt32LE(i) : b.readUInt32BE(i))
  const ifd = (off) => {
    const map = new Map()
    const n = r16(off)
    for (let k = 0; k < n; k++) {
      const e = off + 2 + k * 12
      const type = r16(e + 2)
      const count = r32(e + 4)
      const size = (TYPE_SIZE[type] ?? 1) * count
      const at = size <= 4 ? e + 8 : r32(e + 8)
      let values
      if (type === 2) values = b.toString('latin1', at, at + count).replace(/\0+$/, '')
      else if (type === 5) values = Array.from({ length: count }, (_, i) => r32(at + i * 8) / r32(at + i * 8 + 4))
      else if (type === 3) values = Array.from({ length: count }, (_, i) => r16(at + i * 2))
      else if (type === 4) values = Array.from({ length: count }, (_, i) => r32(at + i * 4))
      else values = [...b.subarray(at, at + count)]
      map.set(r16(e), { type, count, values })
    }
    return { map, next: r32(off + 2 + n * 12) }
  }
  const zero = ifd(r32(4))
  const out = { ifd0: zero.map, exif: null, gps: null, ifd1: zero.next ? ifd(zero.next).map : null }
  if (zero.map.has(0x8769)) out.exif = ifd(zero.map.get(0x8769).values[0]).map
  if (zero.map.has(0x8825)) out.gps = ifd(zero.map.get(0x8825).values[0]).map
  return out
}

const dmsValue = (v) => v[0] + v[1] / 60 + v[2] / 3600

/** The position in a TIFF block's GPS IFD, or null. */
export function tiffPosition(tiff) {
  const { gps } = readTiff(tiff)
  if (!gps || !gps.has(0x0002) || !gps.has(0x0004)) return null
  const lat = dmsValue(gps.get(0x0002).values) * (gps.get(0x0001)?.values === 'S' ? -1 : 1)
  const lon = dmsValue(gps.get(0x0004).values) * (gps.get(0x0003)?.values === 'W' ? -1 : 1)
  const alt = gps.has(0x0006) ? gps.get(0x0006).values[0] * (gps.get(0x0005)?.values[0] === 1 ? -1 : 1) : null
  return { lat, lon, alt }
}

/** The Exif TIFF blocks of an image (JPEG APP1, PNG eXIf, WebP EXIF), in order. */
export function exifBlocks(bytes, type) {
  const b = Buffer.from(bytes)
  const blocks = []
  if (type === 'image/jpeg') {
    let i = 2
    while (i + 4 <= b.length && b[i] === 0xff) {
      const code = b[i + 1]
      if (code === 0xda || code === 0xd9) break
      const len = b.readUInt16BE(i + 2)
      const payload = b.subarray(i + 4, i + 2 + len)
      if (code === 0xe1 && payload.toString('latin1', 0, 6) === 'Exif\0\0') blocks.push(payload.subarray(6))
      i += 2 + len
    }
  } else if (type === 'image/png') {
    for (let i = 8; i + 12 <= b.length;) {
      const n = b.readUInt32BE(i)
      if (b.toString('latin1', i + 4, i + 8) === 'eXIf') blocks.push(b.subarray(i + 8, i + 8 + n))
      i += 12 + n
    }
  } else if (type === 'image/webp') {
    for (let i = 12; i + 8 <= b.length;) {
      const n = b.readUInt32LE(i + 4)
      if (b.toString('latin1', i, i + 4) === 'EXIF') {
        const d = b.subarray(i + 8, i + 8 + n)
        blocks.push(d.toString('latin1', 0, 6) === 'Exif\0\0' ? d.subarray(6) : d)
      }
      i += 8 + n + (n & 1)
    }
  }
  return blocks
}

/** Chunk names of a PNG / RIFF chunk ids of a WebP, in order. */
export function pngChunks(bytes) {
  const b = Buffer.from(bytes)
  const out = []
  for (let i = 8; i + 12 <= b.length;) {
    const n = b.readUInt32BE(i)
    out.push(b.toString('latin1', i + 4, i + 8))
    i += 12 + n
  }
  return out
}

export function webpChunks(bytes) {
  const b = Buffer.from(bytes)
  const out = []
  for (let i = 12; i + 8 <= b.length;) {
    const n = b.readUInt32LE(i + 4)
    out.push(b.toString('latin1', i, i + 4))
    i += 8 + n + (n & 1)
  }
  return out
}

// ── Splicing into real images ───────────────────────────────────────

const segment = (code, payload) => {
  const p = Buffer.from(payload)
  return Buffer.concat([Buffer.from([0xff, code, (p.length + 2) >> 8, (p.length + 2) & 255]), p])
}

export const XMP_WITH_CREATOR = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description dc:creator="Alice Example" ' +
  'xmp:CreatorTool="TestCam X100V"/></rdf:RDF></x:xmpmeta>'

export function xmpWithGps({ lat = '48,51.5N', lon = '2,17.67E', date = '2026-10-23T10:15:00+02:00' } = {}) {
  return '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description dc:creator="Alice Example" ' +
    `exif:GPSLatitude="${lat}" exif:GPSLongitude="${lon}" exif:DateTimeOriginal="${date}"/></rdf:RDF></x:xmpmeta>`
}

/** A real JPEG with an Exif APP1 (the TIFF given), XMP, IPTC and a comment spliced in after SOI. */
export function jpegWith(base, { tiff = null, xmp = XMP_WITH_CREATOR } = {}) {
  return Uint8Array.from(Buffer.concat([
    Buffer.from(base.subarray(0, 2)),
    ...(tiff ? [segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(tiff)]))] : []),
    ...(xmp ? [segment(0xe1, Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(xmp)]))] : []),
    segment(0xed, 'Photoshop 3.0\0IPTC Alice Example'),
    segment(0xfe, 'shot by Alice Example'),
    Buffer.from(base.subarray(2)),
  ]))
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)])
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** A clean PNG (signature, IHDR, …) with eXIf, an XMP iTXt and a tEXt Author put after IHDR. */
export function pngWith(clean, { tiff = null, xmp = XMP_WITH_CREATOR } = {}) {
  const b = Buffer.from(clean)
  const ihdrEnd = 8 + 12 + b.readUInt32BE(8)
  return Uint8Array.from(Buffer.concat([
    b.subarray(0, ihdrEnd),
    pngChunk('tEXt', Buffer.from('Author\0Alice Example', 'latin1')),
    ...(tiff ? [pngChunk('eXIf', tiff)] : []),
    ...(xmp ? [pngChunk('iTXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0\0\0\0\0', 'latin1'), Buffer.from(xmp)]))] : []),
    b.subarray(ihdrEnd),
  ]))
}

/** A clean extended WebP (RIFF, VP8X, image) with EXIF and XMP chunks and their VP8X flags. */
export function webpWith(clean, { tiff = null, xmp = XMP_WITH_CREATOR } = {}) {
  const b = Buffer.from(clean)
  const body = Buffer.from(b.subarray(12))
  if (body.toString('latin1', 0, 4) !== 'VP8X') throw new Error('expected an extended WebP')
  body[8] |= (tiff ? 0x08 : 0) | (xmp ? 0x04 : 0)
  const chunk = (id, data) => {
    const d = Buffer.from(data)
    const len = Buffer.alloc(4); len.writeUInt32LE(d.length)
    return Buffer.concat([Buffer.from(id, 'latin1'), len, d, d.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)])
  }
  const all = Buffer.concat([body, ...(tiff ? [chunk('EXIF', tiff)] : []), ...(xmp ? [chunk('XMP ', Buffer.from(xmp))] : [])])
  const size = Buffer.alloc(4); size.writeUInt32LE(4 + all.length)
  return Uint8Array.from(Buffer.concat([Buffer.from('RIFF'), size, Buffer.from('WEBP'), all]))
}
