/**
 * Uploaded files: the type from the bytes, and images without their metadata.
 *
 * Phone photos carry GPS coordinates, device serials, owner names and edit
 * history in EXIF, XMP, IPTC and comment blocks. Every image a COP stores goes
 * through sanitizeImage BEFORE it is written anywhere, so the bucket never holds
 * those blocks. The one piece kept is the JPEG Orientation tag: without it a
 * portrait photo shows sideways.
 *
 * Rules:
 *   - The type comes from magic bytes (sniffFileType), never from a declared
 *     Content-Type or file name. Only JPEG, PNG, WebP, GIF and PDF are accepted;
 *     SVG and HTML are not images here.
 *   - Fails closed: an image whose structure can't be walked is refused rather
 *     than stored unchanged.
 *   - Data after the image's end marker (JPEG EOI, PNG IEND, GIF trailer) is
 *     dropped: phones append extra images and metadata there.
 *   - PDFs are typed and size-checked but not rewritten (their metadata is not
 *     stripped); callers serve them as downloads.
 *   - Images above MAX_PIXELS (every GIF frame too) are refused: a small file can
 *     declare a huge canvas.
 *   - Only blocks needed to draw the image are kept: JPEG APP0 only as JFIF (its
 *     thumbnail removed), APP14 only as Adobe, an ICC profile; markers outside the
 *     known set refuse the file. Animated WebP is refused. PNG keeps no ICC profile
 *     or suggested palette; GIF keeps no comment or plain-text blocks.
 */

/** About 50 megapixels. */
export const MAX_PIXELS = 50_000_000

export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

export const IMAGE_TYPES: ReadonlySet<SniffedType> = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp'
  if (b.length >= 6 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) return 'image/gif'
  if (b.length >= 5 && ascii(b, 0, 5) === '%PDF-') return 'application/pdf'
  return null
}

export type SanitizeResult =
  | { ok: true; bytes: Uint8Array; width: number | null; height: number | null; orientation: number | null; reason?: undefined }
  | { ok: false; reason: string; bytes?: undefined; width?: undefined; height?: undefined; orientation?: undefined }

/** Strip metadata from an image of a sniffed type. PDFs pass through untouched. */
export function sanitizeImage(bytes: Uint8Array, type: SniffedType): SanitizeResult {
  try {
    switch (type) {
      case 'image/jpeg': return sanitizeJpeg(bytes)
      case 'image/png': return sanitizePng(bytes)
      case 'image/webp': return sanitizeWebp(bytes)
      case 'image/gif': return sanitizeGif(bytes)
      case 'application/pdf': return { ok: true, bytes, width: null, height: null, orientation: null }
    }
  } catch {
    return fail('the image could not be read')
  }
  return fail('unsupported type')
}

// ── helpers ────────────────────────────────────────────────────────────────

function ascii(b: Uint8Array, at: number, n: number): string {
  let s = ''
  for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}

function fail(reason: string): SanitizeResult {
  return { ok: false, reason }
}

function tooLarge(width: number, height: number): boolean {
  return width <= 0 || height <= 0 || width * height > MAX_PIXELS
}

/** Collects slices and joins them once, so large images are not copied byte by byte. */
class Writer {
  private parts: Uint8Array[] = []
  private size = 0
  push(part: Uint8Array): void {
    this.parts.push(part)
    this.size += part.length
  }
  bytes(...values: number[]): void {
    this.push(Uint8Array.from(values))
  }
  done(): Uint8Array {
    const out = new Uint8Array(this.size)
    let at = 0
    for (const p of this.parts) {
      out.set(p, at)
      at += p.length
    }
    return out
  }
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + ((b[i + 3] << 24) >>> 0)

// ── JPEG ───────────────────────────────────────────────────────────────────

const EXIF_ID = 'Exif\u0000\u0000'
const ICC_ID = 'ICC_PROFILE\u0000'

/** SOF markers that carry the frame size (not DHT C4, JPG C8 or DAC CC). */
function isSof(code: number): boolean {
  return code >= 0xc0 && code <= 0xcf && code !== 0xc4 && code !== 0xc8 && code !== 0xcc
}

/**
 * Markers allowed between SOI and EOI outside scan data: frames, tables, restart
 * interval, scans, APPn (filtered below) and comments (dropped). Reserved markers
 * (JPG C8, JPGn F0–FD, RES 02–BF), hierarchical DHP/EXP and stray restarts refuse.
 */
function knownJpegMarker(code: number): boolean {
  return isSof(code) || code === 0xc4 || code === 0xcc || code === 0xda || code === 0xdb || code === 0xdc ||
    code === 0xdd || (code >= 0xe0 && code <= 0xef) || code === 0xfe
}

/** A JFIF APP0 rewritten without its thumbnail (Xthumb = Ythumb = 0). */
function jfifWithoutThumbnail(payload: Uint8Array): Uint8Array | null {
  if (payload.length < 14 || ascii(payload, 0, 5) !== 'JFIF\u0000') return null
  return Uint8Array.from([0xff, 0xe0, 0x00, 0x10, ...payload.subarray(0, 12), 0x00, 0x00])
}

/** The Orientation tag (0x0112) from an Exif APP1 payload (starting at "Exif\0\0"), or null. */
export function readExifOrientation(app1: Uint8Array): number | null {
  if (app1.length < 6 + 8 || ascii(app1, 0, 6) !== EXIF_ID) return null
  const t = 6
  const order = ascii(app1, t, 2)
  const le = order === 'II'
  if (!le && order !== 'MM') return null
  const r16 = (i: number) => (le ? u16le(app1, i) : u16be(app1, i))
  const r32 = (i: number) => (le ? u32le(app1, i) : u32be(app1, i))
  if (r16(t + 2) !== 42) return null
  const ifd = t + r32(t + 4)
  if (ifd + 2 > app1.length) return null
  const count = r16(ifd)
  for (let n = 0; n < count; n++) {
    const e = ifd + 2 + n * 12
    if (e + 12 > app1.length) return null
    if (r16(e) === 0x0112 && r16(e + 2) === 3) {
      const value = r16(e + 8)
      return value >= 1 && value <= 8 ? value : null
    }
  }
  return null
}

/** A minimal Exif APP1 segment holding only Orientation (big-endian TIFF). */
export function orientationApp1(orientation: number): Uint8Array {
  const payload = [
    ...Array.from(EXIF_ID, (c) => c.charCodeAt(0)),
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // MM, 42, IFD0 at 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation & 0xff, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]
  const len = payload.length + 2
  return Uint8Array.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload])
}

/** Walk JPEG markers from `i`: returns the marker code, the segment end and its payload. */
function jpegSegment(b: Uint8Array, i: number):
  | { code: number; next: number; payload: Uint8Array | null; error?: undefined }
  | { error: string; code?: undefined; next?: undefined; payload?: undefined } {
  if (b[i] !== 0xff) return { error: 'the JPEG structure is broken' }
  let m = i + 1
  while (m < b.length && b[m] === 0xff) m++
  if (m >= b.length) return { error: 'the JPEG ends early' }
  const code = b[m]
  if (code === 0xd9 || (code >= 0xd0 && code <= 0xd7) || code === 0x01) {
    return { code, next: m + 1, payload: null }
  }
  if (m + 2 >= b.length) return { error: 'the JPEG ends early' }
  const len = u16be(b, m + 1)
  if (len < 2) return { error: 'the JPEG structure is broken' }
  const next = m + 1 + len
  if (next > b.length) return { error: 'the JPEG ends early' }
  return { code, next, payload: b.subarray(m + 3, next) }
}

function sanitizeJpeg(b: Uint8Array): SanitizeResult {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return fail('not a JPEG')

  // Pass 1: the Orientation tag from the first Exif block before the image data.
  let orientation: number | null = null
  for (let i = 2; i < b.length;) {
    const seg = jpegSegment(b, i)
    if (seg.error !== undefined) return fail(seg.error)
    if (seg.code === 0xda || seg.code === 0xd9) break
    if (seg.code === 0xe1 && seg.payload && orientation === null) orientation = readExifOrientation(seg.payload)
    i = seg.next
  }

  // Pass 2: copy what draws the image; drop metadata; Orientation goes after APP0.
  const out = new Writer()
  out.bytes(0xff, 0xd8)
  let orientationDone = false
  const placeOrientation = () => {
    if (!orientationDone && orientation !== null && orientation !== 1) out.push(orientationApp1(orientation))
    orientationDone = true
  }
  let width: number | null = null
  let height: number | null = null
  let sawScan = false
  let sawApp0 = false
  let i = 2
  while (i < b.length) {
    const seg = jpegSegment(b, i)
    if (seg.error !== undefined) return fail(seg.error)
    const { code, next, payload } = seg
    if (code === 0xd9) {
      if (!sawScan) return fail('the JPEG has no image data')
      if (width === null || height === null) return fail('the JPEG has no frame size')
      out.bytes(0xff, 0xd9) // anything after the end marker is dropped
      return { ok: true, bytes: out.done(), width, height, orientation }
    }
    if (payload === null || !knownJpegMarker(code)) return fail('the JPEG has an unexpected marker')
    const segment = b.subarray(i, next)
    if (code === 0xe0) {
      // APP0 stays first, and only as JFIF without its thumbnail (JFXX and others go).
      const jfif = sawApp0 ? null : jfifWithoutThumbnail(payload)
      if (jfif) out.push(jfif)
      sawApp0 = true
      i = next
      continue
    }
    placeOrientation()
    if (code === 0xe1) {
      // EXIF / XMP: dropped (Orientation already read)
    } else if (code === 0xe2) {
      if (ascii(payload, 0, ICC_ID.length) === ICC_ID) out.push(segment) // colour profile
    } else if (code === 0xee) {
      if (ascii(payload, 0, 5) === 'Adobe') out.push(segment) // needed to decode CMYK/YCCK
    } else if ((code >= 0xe3 && code <= 0xef) || code === 0xfe) {
      // APP3..APP15 (Photoshop/IPTC among them) and comments: dropped
    } else if (code === 0xda) {
      out.push(segment)
      sawScan = true
      // Entropy-coded data runs to the next marker that is not stuffing or a restart.
      let p = next
      while (p < b.length) {
        if (b[p] === 0xff && p + 1 < b.length) {
          const n = b[p + 1]
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { p += 2; continue }
          if (n === 0xff) { p += 1; continue }
          break
        }
        p++
      }
      if (p >= b.length) return fail('the JPEG ends early')
      out.push(b.subarray(next, p))
      i = p
      continue
    } else {
      if (isSof(code)) {
        if (payload.length < 5) return fail('the JPEG frame header is broken')
        height = u16be(payload, 1)
        width = u16be(payload, 3)
        if (tooLarge(width, height)) return fail('the image is too large')
      }
      out.push(segment)
    }
    i = next
  }
  return fail('the JPEG has no end marker')
}

// ── PNG ────────────────────────────────────────────────────────────────────

/** Ancillary chunks that only describe how to draw the image. Text, time and EXIF are not among them. */
const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'sBIT', 'sRGB', 'cICP', 'mDCv', 'cLLI',
  'bKGD', 'hIST', 'pHYs', 'acTL', 'fcTL', 'fdAT',
])

function sanitizePng(b: Uint8Array): SanitizeResult {
  if (b.length < 8 + 12) return fail('the PNG is too short')
  const out = new Writer()
  out.push(b.subarray(0, 8))
  let i = 8
  let width: number | null = null
  let height: number | null = null
  let first = true
  while (i + 12 <= b.length) {
    const len = u32be(b, i)
    const type = ascii(b, i + 4, 4)
    const end = i + 12 + len
    if (!/^[A-Za-z]{4}$/.test(type) || end > b.length) return fail('the PNG structure is broken')
    if (first) {
      if (type !== 'IHDR' || len < 8) return fail('the PNG has no header')
      width = u32be(b, i + 8)
      height = u32be(b, i + 12)
      if (tooLarge(width, height)) return fail('the image is too large')
      first = false
    }
    const critical = type.charCodeAt(0) < 0x61
    if (PNG_KEEP.has(type)) {
      out.push(b.subarray(i, end))
    } else if (critical) {
      return fail(`the PNG has an unknown required chunk (${type})`)
    }
    if (type === 'IEND') return { ok: true, bytes: out.done(), width, height, orientation: null }
    i = end
  }
  return fail('the PNG has no end chunk')
}

// ── WebP ───────────────────────────────────────────────────────────────────

const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH'])

function sanitizeWebp(b: Uint8Array): SanitizeResult {
  if (b.length < 20) return fail('the WebP is too short')
  const riffEnd = Math.min(b.length, 8 + u32le(b, 4))
  const chunks = new Writer()
  let i = 12
  let width: number | null = null
  let height: number | null = null
  let image = false
  while (i + 8 <= riffEnd) {
    const fourcc = ascii(b, i, 4)
    const size = u32le(b, i + 4)
    const dataEnd = i + 8 + size
    const padded = dataEnd + (size & 1)
    if (dataEnd > riffEnd) return fail('the WebP structure is broken')
    const data = b.subarray(i + 8, dataEnd)
    if (fourcc === 'ANIM' || fourcc === 'ANMF') return fail('animated WebP is not accepted')
    if (WEBP_KEEP.has(fourcc)) {
      if (fourcc === 'VP8X') {
        if (size < 10) return fail('the WebP header is broken')
        if (data[0] & 0x02) return fail('animated WebP is not accepted')
        const copy = b.slice(i, Math.min(padded, b.length))
        copy[8] &= ~(0x20 | 0x08 | 0x04) // clear the ICC, EXIF and XMP flags (those chunks are dropped)
        chunks.push(copy)
        width = u24le(data, 4) + 1
        height = u24le(data, 7) + 1
      } else {
        chunks.push(b.subarray(i, Math.min(padded, b.length)))
        if (fourcc === 'VP8 ' && width === null && data.length >= 10 &&
            data[3] === 0x9d && data[4] === 0x01 && data[5] === 0x2a) {
          width = u16le(data, 6) & 0x3fff
          height = u16le(data, 8) & 0x3fff
        }
        if (fourcc === 'VP8L' && width === null && data.length >= 5 && data[0] === 0x2f) {
          const bits = u32le(data, 1)
          width = (bits & 0x3fff) + 1
          height = ((bits >>> 14) & 0x3fff) + 1
        }
      }
      if (fourcc === 'VP8 ' || fourcc === 'VP8L') image = true
    }
    // EXIF, XMP and unknown chunks are dropped.
    i = padded
  }
  if (!image) return fail('the WebP has no image data')
  if (width === null || height === null || tooLarge(width, height)) return fail('the image is too large or has no size')
  const body = chunks.done()
  const out = new Writer()
  const total = 4 + body.length
  out.push(new TextEncoder().encode('RIFF'))
  out.bytes(total & 0xff, (total >>> 8) & 0xff, (total >>> 16) & 0xff, (total >>> 24) & 0xff)
  out.push(new TextEncoder().encode('WEBP'))
  out.push(body)
  return { ok: true, bytes: out.done(), width, height, orientation: null }
}

// ── GIF ────────────────────────────────────────────────────────────────────

/** Application extensions that only control playback (looping). XMP and others are dropped. */
const GIF_APPS = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0'])

function sanitizeGif(b: Uint8Array): SanitizeResult {
  if (b.length < 13) return fail('the GIF is too short')
  const width = u16le(b, 6)
  const height = u16le(b, 8)
  if (tooLarge(width, height)) return fail('the image is too large')
  const packed = b[10]
  let i = 13 + (packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0)
  if (i > b.length) return fail('the GIF structure is broken')
  const out = new Writer()
  out.push(b.subarray(0, i))
  let image = false

  /** End of the sub-block chain starting at p (one past its zero terminator), or -1. */
  const subBlocksEnd = (p: number): number => {
    while (p < b.length) {
      const n = b[p]
      if (n === 0) return p + 1
      p += n + 1
    }
    return -1
  }

  while (i < b.length) {
    const sep = b[i]
    if (sep === 0x3b) {
      out.bytes(0x3b)
      if (!image) return fail('the GIF has no image data')
      return { ok: true, bytes: out.done(), width, height, orientation: null }
    }
    if (sep === 0x2c) {
      if (i + 10 > b.length) return fail('the GIF structure is broken')
      if (tooLarge(u16le(b, i + 5), u16le(b, i + 7))) return fail('a GIF frame is too large')
      const local = b[i + 9]
      let p = i + 10 + (local & 0x80 ? 3 * (1 << ((local & 0x07) + 1)) : 0)
      p += 1 // LZW minimum code size
      const end = subBlocksEnd(p)
      if (end < 0) return fail('the GIF ends early')
      out.push(b.subarray(i, end))
      image = true
      i = end
      continue
    }
    if (sep === 0x21) {
      if (i + 2 > b.length) return fail('the GIF structure is broken')
      const label = b[i + 1]
      const end = subBlocksEnd(i + 2)
      if (end < 0) return fail('the GIF ends early')
      let keep = label === 0xf9 // graphic control (timing, transparency); plain text and comments go
      if (label === 0xff && b[i + 2] === 11) keep = GIF_APPS.has(ascii(b, i + 3, 11))
      if (keep) out.push(b.subarray(i, end))
      i = end
      continue
    }
    return fail('the GIF structure is broken')
  }
  return fail('the GIF has no trailer')
}
