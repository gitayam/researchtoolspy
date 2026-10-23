/**
 * Putting a photo or PDF into a COP from the browser.
 *
 * The server decides the type from the file's bytes and strips its metadata
 * before storing it (`POST /api/cop/:id/uploads`); the checks here only spare a
 * pointless upload. A photo's GPS position is read here first so the bar can
 * OFFER to pin it; it is only sent if the analyst says yes, as a marker.
 */
import { copRequest, createdItemId, notifyCopChanged, type CopRequestResult } from '@/lib/cop-request'
import { readPhotoGps, type PhotoPosition } from '@/lib/photo-gps'
import type { CopUploadResponse } from '@/types/cop'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
/** At most this many files from one paste or drop. */
export const MAX_FILES_PER_DROP = 5

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'JPEG photo',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'image/gif': 'GIF image',
  'application/pdf': 'PDF',
}
const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
}

export const UPLOAD_ACCEPT = Object.keys(ALLOWED).join(',')

/** The file's type as the browser reports it, or by extension when it reports none. */
export function declaredType(file: { name: string; type: string }): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return BY_EXTENSION[ext] ?? ''
}

/** Why a file will not be accepted, or null. */
export function uploadProblem(file: { name: string; type: string; size: number }): string | null {
  if (!ALLOWED[declaredType(file)]) return `${file.name}: only photos (JPEG, PNG, WebP, GIF) and PDFs can be added.`
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is over 10 MB.`
  if (file.size === 0) return `${file.name} is empty.`
  return null
}

/** A title for an uploaded file: its name without the extension and separators. */
export function fileTitle(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim()
  return base.slice(0, 120) || 'Photo'
}

export interface UploadOptions {
  title?: string
  tags?: string[]
  /** Also create an evidence item for it (the capture bar always does). */
  evidence?: boolean
}

export interface UploadedFile {
  response: CopUploadResponse
  evidenceId: string | null
  /** The photo's own GPS position, to offer as a marker. Never sent by itself. */
  position: PhotoPosition | null
}

export async function uploadToCop(sessionId: string, file: File, opts: UploadOptions = {}): Promise<CopRequestResult<UploadedFile>> {
  const position = await readPhotoGps(file)
  const form = new FormData()
  form.append('file', file, file.name)
  if (opts.evidence !== false) form.append('evidence', 'true')
  form.append('title', opts.title?.trim() || fileTitle(file.name))
  if (opts.tags?.length) form.append('tags', JSON.stringify(opts.tags))

  const res = await copRequest<CopUploadResponse>(`/api/cop/${encodeURIComponent(sessionId)}/uploads`, {
    method: 'POST',
    body: form,
    newRoute: true,
  })
  if (res.ok === false) return res
  notifyCopChanged(res.data.evidence ? ['upload', 'evidence'] : ['upload'])
  return {
    ok: true,
    status: res.status,
    data: { response: res.data, evidenceId: createdItemId(res.data.evidence), position },
  }
}

/** Pin a photo's position, once the analyst chose to. */
export async function pinPhotoPosition(
  sessionId: string,
  position: PhotoPosition,
  label: string,
  evidenceId: string | null,
): Promise<CopRequestResult<unknown>> {
  const res = await copRequest<unknown>(`/api/cop/${encodeURIComponent(sessionId)}/markers`, {
    method: 'POST',
    json: {
      lat: position.lat,
      lon: position.lon,
      label: label.slice(0, 120),
      cot_type: 'b-m-p-s-p-i',
      confidence: 'POSSIBLE',
      // A place stays on the map until someone removes it; the route otherwise
      // makes a marker stale after 5 minutes.
      stale_minutes: null,
      ...(evidenceId ? { source_type: 'EVIDENCE', source_id: evidenceId } : { source_type: 'MANUAL' }),
      rationale: "Where the photo says it was taken (its own GPS data), pinned by the analyst",
    },
  })
  if (res.ok === true) notifyCopChanged(['marker'])
  return res
}
