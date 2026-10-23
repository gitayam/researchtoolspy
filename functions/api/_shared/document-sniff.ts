/**
 * Documents and audio a COP may hold as download-only files, typed from their bytes.
 *
 * Accepted (stored as uploaded — their metadata is NOT removed — and served only as an
 * inert download, never inline):
 *   - Office Open XML: docx, xlsx, pptx (a ZIP whose central directory has
 *     [Content_Types].xml and the format's main part); macro-enabled files (a
 *     vbaProject.bin anywhere), ActiveX parts and embedded programs are refused;
 *   - OpenDocument: odt, ods, odp (a ZIP whose first entry is an uncompressed
 *     `mimetype` naming the format); Basic/ or Scripts/ macros are refused;
 *   - plain text (txt, csv, md): valid UTF-8 with no NUL or stray control bytes, not
 *     a script (#!) and not markup that looks like a web page;
 *   - audio: MP3, AAC (ADTS), Ogg (Opus, Vorbis or FLAC), FLAC, WAV, and MPEG-4 audio
 *     (M4A/M4B, or an MP4 whose only tracks are sound).
 * Refused with a reason: video, programs, other archives, encrypted or legacy (OLE)
 * Office files, and anything else.
 *
 * The ZIP check reads only the central directory; nothing is ever decompressed.
 */

export type DocumentKind = 'document' | 'audio'

export type DocumentSniff =
  | { ok: true; type: string; kind: DocumentKind; ext: string; reason?: undefined }
  | { ok: false; reason: string; type?: undefined; kind?: undefined; ext?: undefined }

const OOXML: readonly { part: string; type: string; ext: string }[] = [
  { part: 'word/document.xml', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  { part: 'xl/workbook.xml', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  { part: 'ppt/presentation.xml', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
]

const ODF: Record<string, string> = {
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/vnd.oasis.opendocument.presentation': 'odp',
}

/** File extensions every accepted type downloads with. */
export const DOWNLOAD_EXTENSIONS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(OOXML.map((o) => [o.type, o.ext])),
  ...ODF,
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
}

const DANGEROUS_ENTRY = /(?:^|\/)vbaProject\.bin$|(?:^|\/)activeX\/|(?:^|\/)vbaData\.xml$|\.(?:exe|dll|scr|bat|cmd|com|ps1|vbs|vbe|js|jse|wsf|hta|jar|msi|sh|app|lnk|reg)$/i
const ODF_MACROS = /^(?:Basic|Scripts)\//

const ascii = (b: Uint8Array, at: number, n: number): string => {
  let s = ''
  for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0

const fail = (reason: string): DocumentSniff => ({ ok: false, reason })

// ── ZIP containers ────────────────────────────────────────────────

interface ZipEntry { name: string; encrypted: boolean }

/** The central directory's entries, or null when it can't be read (or is ZIP64). */
function zipEntries(b: Uint8Array): ZipEntry[] | null {
  const min = Math.max(0, b.length - 65_557)
  let eocd = -1
  for (let i = b.length - 22; i >= min; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = u16(b, eocd + 10)
  const size = u32(b, eocd + 12)
  const offset = u32(b, eocd + 16)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) return null
  if (count > 20_000 || offset + size > b.length) return null
  const entries: ZipEntry[] = []
  let p = offset
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) return null
    const flags = u16(b, p + 8)
    const nameLength = u16(b, p + 28)
    const extraLength = u16(b, p + 30)
    const commentLength = u16(b, p + 32)
    if (p + 46 + nameLength > b.length) return null
    entries.push({ name: ascii(b, p + 46, nameLength), encrypted: (flags & 1) === 1 })
    p += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** The stored (uncompressed) `mimetype` entry an OpenDocument file starts with. */
function odfMimetype(b: Uint8Array): string | null {
  if (b.length < 38 || u32(b, 0) !== 0x04034b50) return null
  const method = u16(b, 8)
  const size = u32(b, 18)
  const nameLength = u16(b, 26)
  const extraLength = u16(b, 28)
  if (method !== 0 || ascii(b, 30, nameLength) !== 'mimetype' || size > 100) return null
  return ascii(b, 30 + nameLength + extraLength, size)
}

function sniffZip(b: Uint8Array): DocumentSniff {
  const entries = zipEntries(b)
  if (!entries) return fail('the archive could not be read')
  if (entries.some((e) => e.encrypted)) return fail('encrypted files can\'t be checked')
  if (entries.some((e) => DANGEROUS_ENTRY.test(e.name))) return fail('it contains macros or programs')
  const names = new Set(entries.map((e) => e.name))

  const odf = odfMimetype(b)
  if (odf && ODF[odf]) {
    if (entries.some((e) => ODF_MACROS.test(e.name))) return fail('it contains macros')
    return { ok: true, type: odf, kind: 'document', ext: ODF[odf] }
  }
  if (names.has('[Content_Types].xml')) {
    const format = OOXML.find((o) => names.has(o.part))
    if (format) return { ok: true, type: format.type, kind: 'document', ext: format.ext }
  }
  return fail('archives can\'t be added (only Word, Excel, PowerPoint and OpenDocument files)')
}

// ── Audio ─────────────────────────────────────────────────────────

function containsAscii(b: Uint8Array, needle: string, from: number, to: number): boolean {
  const end = Math.min(b.length - needle.length, to)
  outer: for (let i = Math.max(0, from); i <= end; i++) {
    for (let j = 0; j < needle.length; j++) if (b[i + j] !== needle.charCodeAt(j)) continue outer
    return true
  }
  return false
}

/** The handler types (`soun`, `vide`, …) of every track in an MPEG-4 file. */
function mp4Handlers(b: Uint8Array): Set<string> {
  const handlers = new Set<string>()
  for (let i = 4; i + 16 <= b.length; i++) {
    if (b[i] === 0x68 && b[i + 1] === 0x64 && b[i + 2] === 0x6c && b[i + 3] === 0x72) { // 'hdlr'
      handlers.add(ascii(b, i + 12, 4))
      i += 16
    }
  }
  return handlers
}

function sniffAudio(b: Uint8Array): DocumentSniff | null {
  if (ascii(b, 0, 3) === 'ID3') return { ok: true, type: 'audio/mpeg', kind: 'audio', ext: 'mp3' }
  if (b.length >= 2 && b[0] === 0xff) {
    if ((b[1] & 0xf6) === 0xf0) return { ok: true, type: 'audio/aac', kind: 'audio', ext: 'aac' }
    const version = (b[1] >> 3) & 3
    const layer = (b[1] >> 1) & 3
    if ((b[1] & 0xe0) === 0xe0 && version !== 1 && layer !== 0) return { ok: true, type: 'audio/mpeg', kind: 'audio', ext: 'mp3' }
  }
  if (ascii(b, 0, 4) === 'fLaC') return { ok: true, type: 'audio/flac', kind: 'audio', ext: 'flac' }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return { ok: true, type: 'audio/wav', kind: 'audio', ext: 'wav' }
  if (ascii(b, 0, 4) === 'OggS') {
    const sound = containsAscii(b, 'OpusHead', 0, 96) || containsAscii(b, 'vorbis', 0, 96) || containsAscii(b, 'FLAC', 0, 96)
    return sound ? { ok: true, type: 'audio/ogg', kind: 'audio', ext: 'ogg' } : fail('videos can\'t be added')
  }
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4)
    if (brand === 'M4A ' || brand === 'M4B ') return { ok: true, type: 'audio/mp4', kind: 'audio', ext: 'm4a' }
    const handlers = mp4Handlers(b)
    if (handlers.has('soun') && !handlers.has('vide')) return { ok: true, type: 'audio/mp4', kind: 'audio', ext: 'm4a' }
    return fail('videos can\'t be added')
  }
  return null
}

// ── Text ──────────────────────────────────────────────────────────

const MARKUP = /<(?:!doctype|html|script|svg|\?xml|iframe|body|head|object|embed)\b/i

function sniffText(b: Uint8Array, name: string | null): DocumentSniff | null {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(b)
  } catch {
    return null
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text)) return null
  const head = text.replace(/^\uFEFF/, '').trimStart()
  if (head.startsWith('#!')) return fail('scripts can\'t be added')
  if (MARKUP.test(head.slice(0, 2048))) return fail('web pages and markup can\'t be added')
  const lower = (name ?? '').toLowerCase()
  if (lower.endsWith('.csv')) return { ok: true, type: 'text/csv', kind: 'document', ext: 'csv' }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { ok: true, type: 'text/markdown', kind: 'document', ext: 'md' }
  return { ok: true, type: 'text/plain', kind: 'document', ext: 'txt' }
}

// ── Entry point ───────────────────────────────────────────────────

/**
 * Type a non-image, non-PDF file from its bytes (`name` only picks csv/md for text).
 * Images and PDFs are typed by image-sanitize.ts first.
 */
export function sniffDocument(bytes: Uint8Array, name: string | null = null): DocumentSniff {
  const b = bytes
  if (b.length === 0) return fail('the file is empty')
  if (ascii(b, 0, 2) === 'MZ' || ascii(b, 0, 4) === '\x7fELF' ||
      (b[0] === 0xfe && b[1] === 0xed && b[2] === 0xfa) || (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed) ||
      (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe)) {
    return fail('programs can\'t be added')
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
    return fail('old-style or password-protected Office files can\'t be checked; save it as .docx/.xlsx/.pptx')
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return fail('videos can\'t be added')
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'AVI ') return fail('videos can\'t be added')
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return sniffZip(b)
  if (ascii(b, 0, 4) === 'Rar!' || ascii(b, 0, 6) === '7z\xbc\xaf\x27\x1c' || (b[0] === 0x1f && b[1] === 0x8b)) {
    return fail('archives can\'t be added')
  }
  const audio = sniffAudio(b)
  if (audio) return audio
  return sniffText(b, name) ?? fail('this kind of file can\'t be added')
}
