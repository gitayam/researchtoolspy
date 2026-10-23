/**
 * Documents and audio a COP may hold as download-only files, typed from their bytes.
 *
 * Accepted (stored as uploaded — their metadata is NOT removed — and served only as an
 * inert download, never inline):
 *   - Office Open XML: docx, xlsx, pptx. The central directory must hold
 *     [Content_Types].xml and the format's main part; [Content_Types].xml and every
 *     *.rels part are inflated (at most 1 MB each) and read. Refused: anything
 *     macro-enabled or carrying VBA, ActiveX or OLE objects (by entry name or by
 *     content type), embedded binaries (embeddings/*.bin) or embedded macro-enabled
 *     Office files, and relationships that pull a template, OLE object, frame or
 *     sub-document from outside (TargetMode="External").
 *   - OpenDocument: odt, ods, odp (first entry an uncompressed `mimetype` naming the
 *     format). Refused: Basic/ or Scripts/ anywhere, embedded objects included.
 *   - Plain text (txt, csv, md): valid UTF-8, no NUL or stray control bytes, not a
 *     script (#!), not RTF, and no HTML/SVG markup anywhere. A CSV whose cells start
 *     like formulas (= + @, or - before a non-number) is kept as .txt so a spreadsheet
 *     doesn't evaluate it on opening. Other text (even JavaScript without tags) is
 *     accepted: it is only ever downloaded as .txt.
 *   - Audio: MP3 (an ID3 tag must be followed by an MPEG frame), AAC (ADTS), Ogg
 *     whose every stream is Opus, Vorbis or FLAC, FLAC, WAV with a `fmt ` chunk, and
 *     MPEG-4 audio (M4A, or an MP4) with a sound track and no video track.
 * Refused with a reason: video, programs, archives (other than the above), encrypted
 * or legacy (OLE) Office files, ambiguous ZIPs, and anything else.
 *
 * ZIP entry names are read with `\` as a path separator, as Windows tools do.
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

/** At most this much of a part is inflated to read it. */
const MAX_INFLATED_PART = 1024 * 1024
/** At most this many *.rels parts are read (a document has a handful). */
const MAX_RELS_PARTS = 64

const DANGEROUS_ENTRY = /(?:^|\/)vbaProject\.bin$|(?:^|\/)vbaData\.xml$|(?:^|\/)activeX\/|(?:^|\/)embeddings\/[^/]*\.bin$|\.(?:docm|dotm|xlsm|xltm|xlam|xlsb|pptm|potm|ppam|ppsm|sldm)$|\.(?:exe|dll|scr|bat|cmd|com|ps1|vbs|vbe|js|jse|wsf|hta|jar|msi|sh|app|lnk|reg)$/i
const ODF_MACROS = /(?:^|\/)(?:Basic|Scripts)\//i
const DANGEROUS_CONTENT_TYPE = /macroenabled|vbaproject|activex|oleobject/i
const DANGEROUS_RELATIONSHIP = /\/(?:vbaProject|activeXControl|activeXControlBinary|oleObject)$/i
const EXTERNAL_RELATIONSHIP = /\/(?:attachedTemplate|oleObject|frame|subDocument)$/i

const ascii = (b: Uint8Array, at: number, n: number): string => {
  let s = ''
  for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0

const fail = (reason: string): DocumentSniff => ({ ok: false, reason })

// ── ZIP containers ────────────────────────────────────────────────

interface ZipEntry {
  name: string
  encrypted: boolean
  method: number
  compressedSize: number
  localOffset: number
}

/**
 * The central directory's entries, or null when it can't be read unambiguously: no
 * end-of-central-directory record, more than one, one whose comment length doesn't
 * reach the end of the file, ZIP64, or a local header whose name disagrees with the
 * central directory (an archive that reads differently in different tools).
 */
function zipEntries(b: Uint8Array): ZipEntry[] | null {
  const min = Math.max(0, b.length - 65_557)
  const candidates: number[] = []
  for (let i = b.length - 22; i >= min; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) candidates.push(i)
  }
  if (candidates.length !== 1) return null
  const eocd = candidates[0]
  if (eocd + 22 + u16(b, eocd + 20) !== b.length) return null
  const count = u16(b, eocd + 10)
  const size = u32(b, eocd + 12)
  const offset = u32(b, eocd + 16)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) return null
  if (count > 20_000 || offset + size > eocd) return null
  const entries: ZipEntry[] = []
  let p = offset
  for (let n = 0; n < count; n++) {
    if (p + 46 > b.length || u32(b, p) !== 0x02014b50) return null
    const flags = u16(b, p + 8)
    const nameLength = u16(b, p + 28)
    const extraLength = u16(b, p + 30)
    const commentLength = u16(b, p + 32)
    if (p + 46 + nameLength > b.length) return null
    const entry: ZipEntry = {
      name: ascii(b, p + 46, nameLength).replace(/\\/g, '/'),
      encrypted: (flags & 1) === 1,
      method: u16(b, p + 10),
      compressedSize: u32(b, p + 20),
      localOffset: u32(b, p + 42),
    }
    const local = entry.localOffset
    if (local + 30 > b.length || u32(b, local) !== 0x04034b50) return null
    if (ascii(b, local + 30, u16(b, local + 26)).replace(/\\/g, '/') !== entry.name) return null
    entries.push(entry)
    p += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflateRaw(data: Uint8Array, cap: number): Promise<Uint8Array | null> {
  const stream = new DecompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  writer.write(data).catch(() => {})
  writer.close().catch(() => {})
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > cap) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}

/** One entry's bytes (stored or deflated), at most MAX_INFLATED_PART; null if unreadable. */
async function readEntry(b: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const local = entry.localOffset
  const start = local + 30 + u16(b, local + 26) + u16(b, local + 28)
  const end = start + entry.compressedSize
  if (end > b.length) return null
  const data = b.subarray(start, end)
  if (entry.method === 0) return data.length <= MAX_INFLATED_PART ? data : null
  if (entry.method === 8) return inflateRaw(data, MAX_INFLATED_PART)
  return null
}

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

/** Whether a *.rels part declares a relationship an Office file must not carry. */
function riskyRelationships(xml: string): boolean {
  for (const element of xml.match(/<Relationship\b[^>]*>/gi) ?? []) {
    const type = /\bType\s*=\s*["']([^"']*)["']/i.exec(element)?.[1] ?? ''
    const mode = /\bTargetMode\s*=\s*["']([^"']*)["']/i.exec(element)?.[1] ?? ''
    if (DANGEROUS_RELATIONSHIP.test(type)) return true
    if (mode.toLowerCase() === 'external' && EXTERNAL_RELATIONSHIP.test(type)) return true
  }
  return false
}

/** The stored (uncompressed) `mimetype` entry an OpenDocument file starts with. */
function odfMimetype(b: Uint8Array, entries: ZipEntry[]): string | null {
  const first = entries.find((e) => e.localOffset === 0)
  if (!first || first.name !== 'mimetype' || first.method !== 0 || first.compressedSize > 100) return null
  const start = 30 + u16(b, 26) + u16(b, 28)
  return ascii(b, start, first.compressedSize)
}

async function sniffZip(b: Uint8Array): Promise<DocumentSniff> {
  const entries = zipEntries(b)
  if (!entries) return fail('the archive could not be read unambiguously')
  if (entries.some((e) => e.encrypted)) return fail('encrypted files can\'t be checked')
  if (entries.some((e) => DANGEROUS_ENTRY.test(e.name))) return fail('it contains macros, embedded objects or programs')
  const byName = new Map(entries.map((e) => [e.name, e]))

  const odf = odfMimetype(b, entries)
  if (odf && ODF[odf]) {
    if (entries.some((e) => ODF_MACROS.test(e.name))) return fail('it contains macros')
    return { ok: true, type: odf, kind: 'document', ext: ODF[odf] }
  }

  const contentTypes = byName.get('[Content_Types].xml')
  const format = OOXML.find((o) => byName.has(o.part))
  if (!contentTypes || !format) {
    return fail('archives can\'t be added (only Word, Excel, PowerPoint and OpenDocument files)')
  }
  const types = await readEntry(b, contentTypes)
  if (!types) return fail('the document could not be checked')
  if (DANGEROUS_CONTENT_TYPE.test(latin1(types))) return fail('it contains macros or embedded objects')
  const rels = entries.filter((e) => e.name.toLowerCase().endsWith('.rels'))
  if (rels.length > MAX_RELS_PARTS) return fail('the document could not be checked')
  for (const entry of rels) {
    const xml = await readEntry(b, entry)
    if (!xml) return fail('the document could not be checked')
    if (riskyRelationships(latin1(xml))) return fail('it loads macros, embedded objects or remote content')
  }
  return { ok: true, type: format.type, kind: 'document', ext: format.ext }
}

// ── Audio ─────────────────────────────────────────────────────────

function mpegFrameAt(b: Uint8Array, at: number): 'audio/mpeg' | 'audio/aac' | null {
  if (at + 2 > b.length || b[at] !== 0xff) return null
  const b1 = b[at + 1]
  if ((b1 & 0xf6) === 0xf0) return 'audio/aac'
  const version = (b1 >> 3) & 3
  const layer = (b1 >> 1) & 3
  if ((b1 & 0xe0) === 0xe0 && version !== 1 && layer !== 0) return 'audio/mpeg'
  return null
}

/** An ID3v2 tag must be followed by an MPEG or ADTS frame (after its declared size). */
function afterId3(b: Uint8Array): 'audio/mpeg' | 'audio/aac' | null {
  if (b.length < 10) return null
  const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f)
  let at = 10 + size + ((b[5] & 0x10) ? 10 : 0)
  // Some writers pad past the declared size with zeros.
  for (let n = 0; n < 4096 && at < b.length && b[at] === 0; n++) at++
  return mpegFrameAt(b, at)
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

/** A WAV file: RIFF/WAVE with a `fmt ` chunk before any `data`. */
function wavHasFormat(b: Uint8Array): boolean {
  let p = 12
  for (let n = 0; n < 32 && p + 8 <= b.length; n++) {
    const id = ascii(b, p, 4)
    const size = u32(b, p + 4)
    if (id === 'fmt ') return size >= 16 && p + 8 + 16 <= b.length
    if (id === 'data') return false
    p += 8 + size + (size & 1)
  }
  return false
}

/** Every logical stream's first (BOS) page must start an Opus, Vorbis or FLAC stream. */
function oggAllAudio(b: Uint8Array): boolean {
  let p = 0
  let streams = 0
  for (let n = 0; n < 64 && p + 27 <= b.length; n++) {
    if (ascii(b, p, 4) !== 'OggS') return streams > 0
    const bos = (b[p + 5] & 0x02) !== 0
    const segments = b[p + 26]
    if (p + 27 + segments > b.length) return false
    let length = 0
    for (let s = 0; s < segments; s++) length += b[p + 27 + s]
    const data = p + 27 + segments
    if (!bos) return streams > 0
    const head = ascii(b, data, 8)
    if (!(head === 'OpusHead' || head.startsWith('\x01vorbis') || head.startsWith('\x7fFLAC'))) return false
    streams++
    p = data + length
  }
  return streams > 0
}

function sniffAudio(b: Uint8Array): DocumentSniff | null {
  if (ascii(b, 0, 3) === 'ID3') {
    const frame = afterId3(b)
    if (!frame) return fail('this kind of file can\'t be added')
    return frame === 'audio/aac' ? { ok: true, type: 'audio/aac', kind: 'audio', ext: 'aac' } : { ok: true, type: 'audio/mpeg', kind: 'audio', ext: 'mp3' }
  }
  const frame = mpegFrameAt(b, 0)
  if (frame === 'audio/aac') return { ok: true, type: 'audio/aac', kind: 'audio', ext: 'aac' }
  if (frame === 'audio/mpeg') return { ok: true, type: 'audio/mpeg', kind: 'audio', ext: 'mp3' }
  if (ascii(b, 0, 4) === 'fLaC') return { ok: true, type: 'audio/flac', kind: 'audio', ext: 'flac' }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') {
    return wavHasFormat(b) ? { ok: true, type: 'audio/wav', kind: 'audio', ext: 'wav' } : fail('this kind of file can\'t be added')
  }
  if (ascii(b, 0, 4) === 'OggS') {
    return oggAllAudio(b) ? { ok: true, type: 'audio/ogg', kind: 'audio', ext: 'ogg' } : fail('videos can\'t be added')
  }
  if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp' && u32be(b, 0) >= 8) {
    const handlers = mp4Handlers(b)
    if (handlers.has('vide')) return fail('videos can\'t be added')
    if (handlers.has('soun')) return { ok: true, type: 'audio/mp4', kind: 'audio', ext: 'm4a' }
    return fail('this kind of file can\'t be added')
  }
  return null
}

// ── Text ──────────────────────────────────────────────────────────

/** HTML/SVG/XML markup anywhere in a text file. */
const MARKUP = /<\s*(?:!doctype|\?xml|html|head|body|script|svg|iframe|frame|frameset|object|embed|img|style|link|meta|base|form|input|button|textarea|template|video|audio|math|a|div|span|table)\b[^>]*>|\bjavascript:/i

/** A CSV cell that a spreadsheet would evaluate as a formula. */
function csvLooksLikeFormulas(text: string): boolean {
  for (const line of text.split(/\r?\n/).slice(0, 20_000)) {
    for (const raw of line.split(/[,;\t]/)) {
      const cell = raw.trim().replace(/^"/, '')
      if (/^[=+@]/.test(cell) || /^-(?![\d.\s]|$)/.test(cell)) return true
    }
  }
  return false
}

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
  if (head.startsWith('{\\rtf')) return fail('rich-text (RTF) files can\'t be checked; save it as PDF or .docx')
  if (MARKUP.test(text)) return fail('web pages and markup can\'t be added')
  const lower = (name ?? '').toLowerCase()
  if (lower.endsWith('.csv')) {
    return csvLooksLikeFormulas(text)
      ? { ok: true, type: 'text/plain', kind: 'document', ext: 'txt' }
      : { ok: true, type: 'text/csv', kind: 'document', ext: 'csv' }
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { ok: true, type: 'text/markdown', kind: 'document', ext: 'md' }
  return { ok: true, type: 'text/plain', kind: 'document', ext: 'txt' }
}

// ── Entry point ───────────────────────────────────────────────────

/**
 * Type a non-image, non-PDF file from its bytes (`name` only picks csv/md for text).
 * Images and PDFs are typed by image-sanitize.ts first.
 */
export async function sniffDocument(bytes: Uint8Array, name: string | null = null): Promise<DocumentSniff> {
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
