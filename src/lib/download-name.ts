/**
 * The file name a downloaded COP upload is saved under.
 *
 * The extension comes only from the server, which names the file after the type it
 * read from the bytes (`Content-Disposition: attachment; filename="<id>.<ext>"`,
 * functions/api/_shared/cop-uploads.ts) — never from the item's title or the original
 * file name, so "report.exe" can't be saved as an .exe. The title only gives the base
 * name, with any extension of its own removed.
 *
 * Keep DOWNLOAD_EXTENSION_ALLOWLIST equal to the values of DOWNLOAD_EXTENSIONS in
 * functions/api/_shared/document-sniff.ts (a unit test checks it).
 */

export const DOWNLOAD_EXTENSION_ALLOWLIST: ReadonlySet<string> = new Set([
  'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'txt', 'csv', 'md',
  'mp3', 'aac', 'ogg', 'flac', 'wav', 'm4a', 'pdf',
])

/** The extension the server chose, from its Content-Disposition header; 'bin' if none or unknown. */
export function extensionFromDisposition(header: string | null | undefined): string {
  const match = /filename="?[^";]*\.([A-Za-z0-9]{1,5})"?/.exec(header ?? '')
  const ext = match?.[1]?.toLowerCase() ?? ''
  return DOWNLOAD_EXTENSION_ALLOWLIST.has(ext) ? ext : 'bin'
}

/** A safe base name from a title: no path separators, controls or extension of its own. */
export function downloadName(title: string | null | undefined, ext: string): string {
  const base = Array.from(title ?? '')
    .map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\.[A-Za-z0-9]{1,5})+$/, '')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 100)
  return `${base || 'file'}.${DOWNLOAD_EXTENSION_ALLOWLIST.has(ext) ? ext : 'bin'}`
}
