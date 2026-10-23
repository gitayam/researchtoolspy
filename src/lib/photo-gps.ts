/**
 * The position a JPEG photo says it was taken at (EXIF GPS), read in the browser.
 *
 * Only so the capture bar can OFFER to pin it: the analyst decides, and the
 * server strips the metadata from the stored file either way. Every read is
 * bounds-checked; anything malformed, out of range or exactly 0,0 (a common
 * "no fix" value) is no position.
 */

export interface PhotoPosition {
  lat: number
  lon: number
}

/** EXIF sits near the start of the file; this much is enough to find it. */
export const GPS_SCAN_BYTES = 256 * 1024

const TAG_GPS_IFD = 0x8825
const TAG_LAT_REF = 1
const TAG_LAT = 2
const TAG_LON_REF = 3
const TAG_LON = 4
const TYPE_ASCII = 2
const TYPE_RATIONAL = 5

class Reader {
  private readonly bytes: Uint8Array
  private readonly little: boolean

  constructor(bytes: Uint8Array, little: boolean) {
    this.bytes = bytes
    this.little = little
  }

  u16(at: number): number {
    if (at < 0 || at + 2 > this.bytes.length) throw new RangeError('out of bounds')
    return this.little ? this.bytes[at] | (this.bytes[at + 1] << 8) : (this.bytes[at] << 8) | this.bytes[at + 1]
  }

  u32(at: number): number {
    if (at < 0 || at + 4 > this.bytes.length) throw new RangeError('out of bounds')
    const b = this.bytes
    return this.little
      ? (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0
      : ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
  }

  byte(at: number): number {
    if (at < 0 || at >= this.bytes.length) throw new RangeError('out of bounds')
    return this.bytes[at]
  }
}

interface IfdEntry {
  type: number
  count: number
  /** Where the value is: inline in the entry when it fits in 4 bytes. */
  valueAt: number
}

function readIfd(r: Reader, tiff: number, ifdOffset: number): Map<number, IfdEntry> {
  const entries = new Map<number, IfdEntry>()
  const at = tiff + ifdOffset
  const count = r.u16(at)
  if (count > 512) throw new RangeError('implausible IFD')
  for (let i = 0; i < count; i++) {
    const e = at + 2 + i * 12
    const tag = r.u16(e)
    const type = r.u16(e + 2)
    const n = r.u32(e + 4)
    const size = (type === TYPE_RATIONAL ? 8 : type === TYPE_ASCII ? 1 : 4) * n
    entries.set(tag, { type, count: n, valueAt: size <= 4 ? e + 8 : tiff + r.u32(e + 8) })
  }
  return entries
}

function degrees(r: Reader, entry: IfdEntry | undefined): number | null {
  if (!entry || entry.type !== TYPE_RATIONAL || entry.count !== 3) return null
  let value = 0
  for (let i = 0; i < 3; i++) {
    const num = r.u32(entry.valueAt + i * 8)
    const den = r.u32(entry.valueAt + i * 8 + 4)
    if (den === 0) return null
    value += num / den / (i === 0 ? 1 : i === 1 ? 60 : 3600)
  }
  return Number.isFinite(value) ? value : null
}

function ref(r: Reader, entry: IfdEntry | undefined): string | null {
  if (!entry || entry.type !== TYPE_ASCII || entry.count < 1) return null
  return String.fromCharCode(r.byte(entry.valueAt)).toUpperCase()
}

/** The GPS position in a JPEG's EXIF, or null. Never throws. */
export function parseJpegGps(bytes: Uint8Array): PhotoPosition | null {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
    let at = 2
    while (at + 4 <= bytes.length) {
      if (bytes[at] !== 0xff) return null
      const marker = bytes[at + 1]
      if (marker === 0xda || marker === 0xd9) return null // image data / end: no EXIF before it
      const size = (bytes[at + 2] << 8) | bytes[at + 3]
      if (size < 2) return null
      const isExif = marker === 0xe1 && at + 10 <= bytes.length
        && bytes[at + 4] === 0x45 && bytes[at + 5] === 0x78 && bytes[at + 6] === 0x69
        && bytes[at + 7] === 0x66 && bytes[at + 8] === 0 && bytes[at + 9] === 0
      if (isExif) {
        const tiff = at + 10
        const segmentEnd = Math.min(bytes.length, at + 2 + size)
        const view = bytes.subarray(0, segmentEnd)
        const order = String.fromCharCode(view[tiff] ?? 0, view[tiff + 1] ?? 0)
        if (order !== 'II' && order !== 'MM') return null
        const r = new Reader(view, order === 'II')
        if (r.u16(tiff + 2) !== 42) return null
        const ifd0 = readIfd(r, tiff, r.u32(tiff + 4))
        const gpsPointer = ifd0.get(TAG_GPS_IFD)
        if (!gpsPointer) return null
        const gps = readIfd(r, tiff, r.u32(gpsPointer.valueAt))
        const lat = degrees(r, gps.get(TAG_LAT))
        const lon = degrees(r, gps.get(TAG_LON))
        const latRef = ref(r, gps.get(TAG_LAT_REF))
        const lonRef = ref(r, gps.get(TAG_LON_REF))
        if (lat === null || lon === null || !latRef || !lonRef) return null
        if (!'NS'.includes(latRef) || !'EW'.includes(lonRef)) return null
        const position = { lat: latRef === 'S' ? -lat : lat, lon: lonRef === 'W' ? -lon : lon }
        if (Math.abs(position.lat) > 90 || Math.abs(position.lon) > 180) return null
        if (position.lat === 0 && position.lon === 0) return null
        return position
      }
      at += 2 + size
    }
    return null
  } catch {
    return null
  }
}

/** The GPS position of a photo file (JPEG only), or null. */
export async function readPhotoGps(file: Blob): Promise<PhotoPosition | null> {
  if (file.type && file.type !== 'image/jpeg') return null
  try {
    const head = new Uint8Array(await file.slice(0, GPS_SCAN_BYTES).arrayBuffer())
    return parseJpegGps(head)
  } catch {
    return null
  }
}
