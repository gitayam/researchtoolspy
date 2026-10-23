/**
 * Where and when a photo was taken, read in the Worker (pure JS, no native tools), and
 * the minimal Exif block that carries it in the team's copy.
 *
 * A research COP keeps a photo's location for its own team (decision 2026-10-23): the
 * team copy of an image keeps exactly
 *   - Orientation (IFD0 0x0112),
 *   - DateTimeOriginal (Exif 0x9003) and OffsetTimeOriginal (Exif 0x9011),
 *   - GPSVersionID (written as 2.3.0.0), GPSLatitudeRef/GPSLatitude,
 *     GPSLongitudeRef/GPSLongitude, GPSAltitudeRef/GPSAltitude,
 * written fresh from validated values (teamExifTiff), never copied as a block, so
 * nothing else rides along: no make, model, serial numbers, owner/artist/copyright,
 * maker notes, software, thumbnail (IFD1), XMP or IPTC. The public copy has none of it
 * (image-sanitize.ts keeps only Orientation).
 *
 * Reading: the first Exif block (JPEG APP1 "Exif\0\0", PNG eXIf, WebP EXIF), then XMP
 * (JPEG APP1 "http://ns.adobe.com/xap/1.0/", PNG uncompressed iTXt
 * "XML:com.adobe.xmp", WebP "XMP ") for whatever the Exif block lacks. Every read is
 * bounds-checked and nothing here throws: a block that can't be read is no location.
 *
 * A position is kept only when it is plausible: both references present (N/S, E/W),
 * degrees within range, minutes and seconds below 60, not 0,0 (a common "no fix"
 * value), and not marked void (GPSStatus 'V').
 */
import type { SniffedType } from './image-sanitize'

export interface PhotoGps {
  lat: number
  lon: number
  /** Metres above (negative: below) sea level, or null. */
  alt: number | null
}

export interface PhotoLocation {
  gps: PhotoGps | null
  /** DateTimeOriginal as Exif writes it, "YYYY:MM:DD HH:MM:SS", validated. */
  dateTimeOriginal: string | null
  /** OffsetTimeOriginal, "+HH:MM" / "-HH:MM", validated. */
  offsetTimeOriginal: string | null
  orientation: number | null
}

export const NO_LOCATION: PhotoLocation = { gps: null, dateTimeOriginal: null, offsetTimeOriginal: null, orientation: null }

/** True when the team copy carries something the public copy does not. */
export function hasTeamMetadata(location: PhotoLocation): boolean {
  return location.gps !== null || location.dateTimeOriginal !== null
}

/** The capture time as ISO 8601 ("2026-10-23T10:15:00+02:00"; without an offset when the photo gives none). */
export function capturedAtIso(location: PhotoLocation): string | null {
  const m = location.dateTimeOriginal ? DATE_TIME.exec(location.dateTimeOriginal) : null
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${location.offsetTimeOriginal ?? ''}`
}

// ── Validation ─────────────────────────────────────────────────────────────

const DATE_TIME = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
const OFFSET = /^([+-])(\d{2}):(\d{2})$/

function validDateTime(value: string | null): string | null {
  if (!value) return null
  const m = DATE_TIME.exec(value.trim())
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
  if (y < 1900 || y > 2200 || h > 23 || mi > 59 || s > 59) return null
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return value.trim()
}

function validOffset(value: string | null): string | null {
  if (!value) return null
  const m = OFFSET.exec(value.trim())
  if (!m || Number(m[2]) > 14 || Number(m[3]) > 59) return null
  return value.trim()
}

/** Degrees from a degrees/minutes/seconds triple, or null when any part is implausible. */
function fromDms(parts: number[] | null, max: number): number | null {
  if (!parts || parts.length !== 3 || parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  const [d, m, s] = parts
  if (d > max || m >= 60 || s >= 60) return null
  const value = d + m / 60 + s / 3600
  return value <= max ? value : null
}

/** A plausible position, or null (0,0, out of range, missing hemisphere, NaN). */
export function validGps(lat: number | null, lon: number | null, alt: number | null): PhotoGps | null {
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (lat === 0 && lon === 0) return null
  const altitude = alt !== null && Number.isFinite(alt) && Math.abs(alt) <= 100_000 ? Math.round(alt * 100) / 100 : null
  return { lat, lon, alt: altitude }
}

// ── TIFF (Exif) reading ────────────────────────────────────────────────────

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }
const MAX_IFD_ENTRIES = 1000

interface Entry { type: number; count: number; at: number }

class Tiff {
  private readonly b: Uint8Array
  private readonly le: boolean
  constructor(b: Uint8Array, le: boolean) {
    this.b = b
    this.le = le
  }
  u16(i: number): number {
    if (i < 0 || i + 2 > this.b.length) throw new RangeError('out of bounds')
    return this.le ? this.b[i] | (this.b[i + 1] << 8) : (this.b[i] << 8) | this.b[i + 1]
  }
  u32(i: number): number {
    if (i < 0 || i + 4 > this.b.length) throw new RangeError('out of bounds')
    return this.le
      ? (this.b[i] | (this.b[i + 1] << 8) | (this.b[i + 2] << 16)) + this.b[i + 3] * 0x1000000
      : this.b[i] * 0x1000000 + ((this.b[i + 1] << 16) | (this.b[i + 2] << 8) | this.b[i + 3])
  }
  byte(i: number): number {
    if (i < 0 || i >= this.b.length) throw new RangeError('out of bounds')
    return this.b[i]
  }
  ifd(offset: number): Map<number, Entry> {
    const out = new Map<number, Entry>()
    const count = this.u16(offset)
    if (count > MAX_IFD_ENTRIES) throw new RangeError('implausible IFD')
    for (let n = 0; n < count; n++) {
      const e = offset + 2 + n * 12
      const tag = this.u16(e)
      const type = this.u16(e + 2)
      const c = this.u32(e + 4)
      const size = (TYPE_SIZES[type] ?? 0) * c
      if (!size) continue
      const at = size <= 4 ? e + 8 : this.u32(e + 8)
      if (at + size > this.b.length) continue
      if (!out.has(tag)) out.set(tag, { type, count: c, at })
    }
    return out
  }
  ascii(e: Entry | undefined): string | null {
    if (!e || e.type !== 2) return null
    let s = ''
    for (let i = 0; i < e.count; i++) {
      const c = this.byte(e.at + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }
  short(e: Entry | undefined): number | null {
    if (!e || e.count < 1) return null
    if (e.type === 3) return this.u16(e.at)
    if (e.type === 1 || e.type === 7) return this.byte(e.at)
    if (e.type === 4) return this.u32(e.at)
    return null
  }
  rationals(e: Entry | undefined, n: number): number[] | null {
    if (!e || e.type !== 5 || e.count !== n) return null
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      const num = this.u32(e.at + i * 8)
      const den = this.u32(e.at + i * 8 + 4)
      if (den === 0) return null
      out.push(num / den)
    }
    return out
  }
}

/** Orientation, capture time and position from a TIFF block (starting at "II"/"MM"). */
export function readExifTiff(tiff: Uint8Array): PhotoLocation {
  try {
    if (tiff.length < 8) return NO_LOCATION
    const order = String.fromCharCode(tiff[0], tiff[1])
    if (order !== 'II' && order !== 'MM') return NO_LOCATION
    const t = new Tiff(tiff, order === 'II')
    if (t.u16(2) !== 42) return NO_LOCATION
    const ifd0 = t.ifd(t.u32(4))

    const orientationValue = t.short(ifd0.get(0x0112))
    const orientation = orientationValue !== null && orientationValue >= 1 && orientationValue <= 8 ? orientationValue : null

    let dateTimeOriginal: string | null = null
    let offsetTimeOriginal: string | null = null
    const exifPointer = ifd0.get(0x8769)
    if (exifPointer && exifPointer.type === 4) {
      try {
        const exif = t.ifd(t.u32(exifPointer.at))
        dateTimeOriginal = validDateTime(t.ascii(exif.get(0x9003)))
        offsetTimeOriginal = dateTimeOriginal ? validOffset(t.ascii(exif.get(0x9011))) : null
      } catch { /* an unreadable Exif IFD is no capture time */ }
    }

    let gps: PhotoGps | null = null
    const gpsPointer = ifd0.get(0x8825)
    if (gpsPointer && gpsPointer.type === 4) {
      try {
        const g = t.ifd(t.u32(gpsPointer.at))
        const latRef = t.ascii(g.get(0x0001))?.trim().toUpperCase() ?? ''
        const lonRef = t.ascii(g.get(0x0003))?.trim().toUpperCase() ?? ''
        const status = t.ascii(g.get(0x0009))?.trim().toUpperCase() ?? ''
        const lat = fromDms(t.rationals(g.get(0x0002), 3), 90)
        const lon = fromDms(t.rationals(g.get(0x0004), 3), 180)
        if ((latRef === 'N' || latRef === 'S') && (lonRef === 'E' || lonRef === 'W') && status !== 'V' && lat !== null && lon !== null) {
          const altValue = t.rationals(g.get(0x0006), 1)
          const altRef = t.short(g.get(0x0005)) ?? 0
          const alt = altValue && (altRef === 0 || altRef === 1) ? (altRef === 1 ? -altValue[0] : altValue[0]) : null
          gps = validGps(latRef === 'S' ? -lat : lat, lonRef === 'W' ? -lon : lon, alt)
        }
      } catch { /* an unreadable GPS IFD is no position */ }
    }
    return { gps, dateTimeOriginal, offsetTimeOriginal, orientation }
  } catch {
    return NO_LOCATION
  }
}

// ── XMP reading ────────────────────────────────────────────────────────────

/** A property's value, written as an attribute (exif:X="v") or an element (<exif:X>v</exif:X>). */
function xmpValue(xmp: string, name: string): string | null {
  const attr = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]{0,200})"|'([^']{0,200})')`).exec(xmp)
  if (attr) return (attr[1] ?? attr[2] ?? '').trim()
  const element = new RegExp(`<${name}>([^<]{0,200})</${name}>`).exec(xmp)
  return element ? element[1].trim() : null
}

/** An XMP GPS coordinate: "DDD,MM,SSk" or "DDD,MM.mmk" (k = N/S/E/W). */
function xmpCoordinate(value: string | null, refs: string, max: number): number | null {
  const m = value ? /^(\d{1,3}),(\d{1,2}(?:\.\d+)?)(?:,(\d{1,2}(?:\.\d+)?))?([NSEW])$/i.exec(value.replace(/\s+/g, '')) : null
  if (!m) return null
  const ref = m[4].toUpperCase()
  if (!refs.includes(ref)) return null
  const v = fromDms([Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 0], max)
  if (v === null) return null
  return ref === 'S' || ref === 'W' ? -v : v
}

function xmpRational(value: string | null): number | null {
  const m = value ? /^(\d{1,9})(?:\/(\d{1,9}))?$/.exec(value) : null
  if (!m) return null
  const den = m[2] ? Number(m[2]) : 1
  return den === 0 ? null : Number(m[1]) / den
}

/** An XMP date ("2026-10-23T10:15:00+02:00", seconds and zone optional) as Exif time + offset. */
function xmpDate(value: string | null): { dateTime: string; offset: string | null } | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value) : null
  if (!m) return null
  const dateTime = validDateTime(`${m[1]}:${m[2]}:${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}`)
  if (!dateTime) return null
  return { dateTime, offset: m[7] === 'Z' ? '+00:00' : validOffset(m[7] ?? null) }
}

/** Position and capture time from an XMP packet. */
export function readXmp(xmp: string): PhotoLocation {
  try {
    const lat = xmpCoordinate(xmpValue(xmp, 'exif:GPSLatitude'), 'NS', 90)
    const lon = xmpCoordinate(xmpValue(xmp, 'exif:GPSLongitude'), 'EW', 180)
    const altValue = xmpRational(xmpValue(xmp, 'exif:GPSAltitude'))
    const altRef = xmpValue(xmp, 'exif:GPSAltitudeRef')
    const alt = altValue === null ? null : altRef === '1' ? -altValue : altRef === null || altRef === '0' ? altValue : null
    const date = xmpDate(xmpValue(xmp, 'exif:DateTimeOriginal')) ?? xmpDate(xmpValue(xmp, 'photoshop:DateCreated'))
    return {
      gps: validGps(lat, lon, alt),
      dateTimeOriginal: date?.dateTime ?? null,
      offsetTimeOriginal: date?.offset ?? null,
      orientation: null,
    }
  } catch {
    return NO_LOCATION
  }
}

// ── Finding the blocks in each container ──────────────────────────────────

const EXIF_ID = 'Exif\u0000\u0000'
const XMP_ID = 'http://ns.adobe.com/xap/1.0/\u0000'

function ascii(b: Uint8Array, at: number, n: number): string {
  let s = ''
  for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}

function latin1(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return s
}

const u32be = (b: Uint8Array, i: number) => b[i] * 0x1000000 + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 0x1000000

/** The Exif TIFF block and the XMP packet of an image, as found (either may be null). */
export function metadataBlocks(bytes: Uint8Array, type: SniffedType): { tiff: Uint8Array | null; xmp: string | null } {
  let tiff: Uint8Array | null = null
  let xmp: string | null = null
  try {
    if (type === 'image/jpeg') {
      let i = 2
      while (i + 4 <= bytes.length && bytes[i] === 0xff) {
        let m = i + 1
        while (m < bytes.length && bytes[m] === 0xff) m++
        const code = bytes[m]
        if (code === 0xda || code === 0xd9 || m + 2 >= bytes.length) break
        if ((code >= 0xd0 && code <= 0xd7) || code === 0x01) { i = m + 1; continue }
        const len = (bytes[m + 1] << 8) | bytes[m + 2]
        const next = m + 1 + len
        if (len < 2 || next > bytes.length) break
        const payload = bytes.subarray(m + 3, next)
        if (code === 0xe1) {
          if (!tiff && ascii(payload, 0, 6) === EXIF_ID) tiff = payload.subarray(6)
          else if (xmp === null && ascii(payload, 0, XMP_ID.length) === XMP_ID) xmp = latin1(payload.subarray(XMP_ID.length))
        }
        i = next
      }
    } else if (type === 'image/png') {
      let i = 8
      while (i + 12 <= bytes.length) {
        const len = u32be(bytes, i)
        const chunk = ascii(bytes, i + 4, 4)
        const end = i + 12 + len
        if (end > bytes.length) break
        const data = bytes.subarray(i + 8, i + 8 + len)
        if (chunk === 'eXIf' && !tiff) tiff = data
        if (chunk === 'iTXt' && xmp === null && ascii(data, 0, 18) === 'XML:com.adobe.xmp\u0000' && data[18] === 0) {
          // keyword\0, compression flag (0 = plain), method, language\0, translated keyword\0, text
          let p = 20
          for (let zeros = 0; p < data.length && zeros < 2; p++) if (data[p] === 0) zeros++
          xmp = latin1(data.subarray(p))
        }
        if (chunk === 'IEND') break
        i = end
      }
    } else if (type === 'image/webp') {
      const riffEnd = Math.min(bytes.length, 8 + u32le(bytes, 4))
      let i = 12
      while (i + 8 <= riffEnd) {
        const fourcc = ascii(bytes, i, 4)
        const size = u32le(bytes, i + 4)
        const dataEnd = i + 8 + size
        if (dataEnd > riffEnd) break
        const data = bytes.subarray(i + 8, dataEnd)
        if (fourcc === 'EXIF' && !tiff) tiff = ascii(data, 0, 6) === EXIF_ID ? data.subarray(6) : data
        if (fourcc === 'XMP ' && xmp === null) xmp = latin1(data)
        i = dataEnd + (size & 1)
      }
    }
  } catch { /* whatever was found so far */ }
  return { tiff, xmp }
}

/**
 * Where and when an image says it was taken. Exif first; XMP fills only what the Exif
 * block lacks. GIF and PDF carry none. Never throws.
 */
export function readPhotoLocation(bytes: Uint8Array, type: SniffedType): PhotoLocation {
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/webp') return NO_LOCATION
  try {
    const { tiff, xmp } = metadataBlocks(bytes, type)
    const exif = tiff ? readExifTiff(tiff) : NO_LOCATION
    const fromXmp = xmp ? readXmp(xmp) : NO_LOCATION
    const timeFromExif = exif.dateTimeOriginal !== null
    return {
      gps: exif.gps ?? fromXmp.gps,
      dateTimeOriginal: timeFromExif ? exif.dateTimeOriginal : fromXmp.dateTimeOriginal,
      offsetTimeOriginal: timeFromExif ? exif.offsetTimeOriginal : fromXmp.offsetTimeOriginal,
      orientation: exif.orientation,
    }
  } catch {
    return NO_LOCATION
  }
}

// ── Writing the team's Exif block ─────────────────────────────────────────

interface OutEntry { tag: number; type: number; count: number; data: number[] }

const asciiData = (s: string): number[] => [...Array.from(s, (c) => c.charCodeAt(0) & 0x7f), 0]
const u16Data = (v: number): number[] => [(v >> 8) & 0xff, v & 0xff]
const u32Data = (v: number): number[] => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]
const rationalData = (pairs: [number, number][]): number[] => pairs.flatMap(([n, d]) => [...u32Data(n), ...u32Data(d)])

/** Degrees as Exif rationals: whole degrees, decimal minutes (1e-6), zero seconds. */
function dmsRationals(value: number): [number, number][] {
  let deg = Math.floor(Math.abs(value))
  let micro = Math.round((Math.abs(value) - deg) * 60 * 1_000_000)
  if (micro >= 60_000_000) { deg += 1; micro = 0 }
  return [[deg, 1], [micro, 1_000_000], [0, 1]]
}

/**
 * A big-endian TIFF block with only what the team keeps (see the top of this file),
 * or null when there is nothing to keep beyond Orientation. Its Orientation is the
 * photo's own, kept so a portrait photo stays upright.
 */
export function teamExifTiff(location: PhotoLocation): Uint8Array | null {
  if (!hasTeamMetadata(location)) return null
  const ifd0: OutEntry[] = []
  if (location.orientation !== null && location.orientation !== 1) {
    ifd0.push({ tag: 0x0112, type: 3, count: 1, data: [...u16Data(location.orientation), 0, 0] })
  }
  const exif: OutEntry[] = []
  if (location.dateTimeOriginal) {
    exif.push({ tag: 0x9003, type: 2, count: 20, data: asciiData(location.dateTimeOriginal) })
    if (location.offsetTimeOriginal) exif.push({ tag: 0x9011, type: 2, count: 7, data: asciiData(location.offsetTimeOriginal) })
  }
  const gps: OutEntry[] = []
  if (location.gps) {
    const { lat, lon, alt } = location.gps
    gps.push({ tag: 0x0000, type: 1, count: 4, data: [2, 3, 0, 0] })
    gps.push({ tag: 0x0001, type: 2, count: 2, data: asciiData(lat < 0 ? 'S' : 'N').concat(0, 0) })
    gps.push({ tag: 0x0002, type: 5, count: 3, data: rationalData(dmsRationals(lat)) })
    gps.push({ tag: 0x0003, type: 2, count: 2, data: asciiData(lon < 0 ? 'W' : 'E').concat(0, 0) })
    gps.push({ tag: 0x0004, type: 5, count: 3, data: rationalData(dmsRationals(lon)) })
    if (alt !== null) {
      gps.push({ tag: 0x0005, type: 1, count: 1, data: [alt < 0 ? 1 : 0, 0, 0, 0] })
      gps.push({ tag: 0x0006, type: 5, count: 1, data: rationalData([[Math.round(Math.abs(alt) * 100), 100]]) })
    }
  }

  // Layout: header, IFD0, Exif IFD, GPS IFD, then each IFD's out-of-line values.
  const ifdSize = (n: number) => 2 + n * 12 + 4
  const pointers = (exif.length ? 1 : 0) + (gps.length ? 1 : 0)
  const ifd0At = 8
  const exifAt = ifd0At + ifdSize(ifd0.length + pointers)
  const gpsAt = exifAt + (exif.length ? ifdSize(exif.length) : 0)
  let dataAt = gpsAt + (gps.length ? ifdSize(gps.length) : 0)
  if (exif.length) ifd0.push({ tag: 0x8769, type: 4, count: 1, data: u32Data(exifAt) })
  if (gps.length) ifd0.push({ tag: 0x8825, type: 4, count: 1, data: u32Data(gpsAt) })

  const out: number[] = [0x4d, 0x4d, 0x00, 0x2a, ...u32Data(ifd0At)]
  const extra: number[] = []
  const writeIfd = (entries: OutEntry[]) => {
    entries.sort((a, b) => a.tag - b.tag)
    out.push(...u16Data(entries.length))
    for (const e of entries) {
      out.push(...u16Data(e.tag), ...u16Data(e.type), ...u32Data(e.count))
      const size = (TYPE_SIZES[e.type] ?? 1) * e.count
      if (size <= 4) {
        out.push(...e.data.slice(0, 4), ...new Array(Math.max(0, 4 - e.data.length)).fill(0))
      } else {
        out.push(...u32Data(dataAt))
        const padded = e.data.slice(0, size)
        while (padded.length < size) padded.push(0)
        if (padded.length & 1) padded.push(0)
        extra.push(...padded)
        dataAt += padded.length
      }
    }
    out.push(0, 0, 0, 0) // no next IFD (so no IFD1 thumbnail)
  }
  writeIfd(ifd0)
  if (exif.length) writeIfd(exif)
  if (gps.length) writeIfd(gps)
  return Uint8Array.from([...out, ...extra])
}

// ── Putting it into an already-cleaned image ──────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const be32 = (v: number) => Uint8Array.from(u32Data(v >>> 0))
const le32 = (v: number) => Uint8Array.from([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])
const text = (s: string) => Uint8Array.from(Array.from(s, (c) => c.charCodeAt(0)))

/**
 * The team copy: the cleaned (public) image with the team's Exif block put in. `clean`
 * must be image-sanitize.ts output (its structure is known). Null when there is
 * nothing to add or the format can't carry it (GIF).
 */
export function withTeamMetadata(clean: Uint8Array, type: SniffedType, location: PhotoLocation, size: { width: number | null; height: number | null }): Uint8Array | null {
  try {
    const tiff = teamExifTiff(location)
    if (!tiff) return null
    if (type === 'image/jpeg') {
      // clean = SOI, [APP0 JFIF], [APP1 Exif with Orientation only], the rest.
      let i = 2
      const head: Uint8Array[] = [clean.subarray(0, 2)]
      if (clean[i] === 0xff && clean[i + 1] === 0xe0) {
        const len = (clean[i + 2] << 8) | clean[i + 3]
        head.push(clean.subarray(i, i + 2 + len))
        i += 2 + len
      }
      if (clean[i] === 0xff && clean[i + 1] === 0xe1 && ascii(clean, i + 4, 6) === EXIF_ID) {
        i += 2 + ((clean[i + 2] << 8) | clean[i + 3]) // replaced by the team block
      }
      const payload = concat([text(EXIF_ID), tiff])
      const len = payload.length + 2
      if (len > 0xffff) return null
      return concat([...head, Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff]), payload, clean.subarray(i)])
    }
    if (type === 'image/png') {
      // clean = signature, IHDR, …: eXIf goes right after IHDR (before any IDAT).
      const ihdrEnd = 8 + 12 + u32be(clean, 8)
      const typeAndData = concat([text('eXIf'), tiff])
      const chunk = concat([be32(tiff.length), typeAndData, be32(crc32(typeAndData))])
      return concat([clean.subarray(0, ihdrEnd), chunk, clean.subarray(ihdrEnd)])
    }
    if (type === 'image/webp') {
      // clean = RIFF size WEBP, [VP8X], image chunks. EXIF needs VP8X with its flag set.
      let body = clean.subarray(12)
      if (ascii(body, 0, 4) === 'VP8X') {
        const copy = new Uint8Array(body)
        copy[8] |= 0x08
        body = copy
      } else {
        const { width, height } = size
        if (!width || !height) return null
        const alpha = ascii(body, 0, 4) === 'ALPH' || (ascii(body, 0, 4) === 'VP8L' && body.length > 12 && (body[12] & 0x10) !== 0)
        const vp8x = new Uint8Array(18)
        vp8x.set(text('VP8X'), 0)
        vp8x.set(le32(10), 4)
        vp8x[8] = 0x08 | (alpha ? 0x10 : 0)
        const w = width - 1
        const h = height - 1
        vp8x.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 12)
        body = concat([vp8x, body])
      }
      const exifChunk = concat([text('EXIF'), le32(tiff.length), tiff, tiff.length & 1 ? Uint8Array.of(0) : new Uint8Array(0)])
      const all = concat([body, exifChunk])
      return concat([text('RIFF'), le32(4 + all.length), text('WEBP'), all])
    }
  } catch {
    return null
  }
  return null
}
