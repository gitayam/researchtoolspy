/**
 * Files added to a COP live behind `GET /api/cop/:id/uploads/:uploadId`, which
 * takes the COP's header credentials only, so the browser fetches them with the
 * credentials and shows them from a blob URL (components/cop/CopUploadPreview).
 */
import { getCopAuthHeaders } from '@/lib/cop-auth'

export const MAX_PREVIEW_BYTES = 12 * 1024 * 1024

/** Is this the address of one of this session's uploads? */
export function isCopUploadPath(url: string | null | undefined, sessionId: string): url is string {
  if (!url) return false
  const prefix = `/api/cop/${encodeURIComponent(sessionId)}/uploads/`
  if (!url.startsWith(prefix)) return false
  return /^[A-Za-z0-9._~%-]{1,120}$/.test(url.slice(prefix.length))
}

export async function fetchUploadBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(path, { headers: getCopAuthHeaders(), signal })
  if (!res.ok) {
    throw new Error(res.status === 403 || res.status === 401
      ? 'You do not have access to this file.'
      : `The file could not be loaded (HTTP ${res.status}).`)
  }
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_PREVIEW_BYTES) throw new Error('The file is too large to preview.')
  return res.blob()
}

/** A file name safe to offer for a download: no path separators or control characters. */
export function safeDownloadName(name: string, fallback = 'document.pdf'): string {
  const cleaned = Array.from(name)
    .map(ch => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}
