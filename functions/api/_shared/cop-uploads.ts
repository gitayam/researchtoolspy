/**
 * Files added to a COP (photos and PDFs): store and serve.
 *
 * Storing: the type comes from the bytes (image-sanitize.ts), never from a declared
 * Content-Type or file name; images are stripped of metadata BEFORE they reach R2;
 * an image that can't be parsed is refused. Keys are `cop/<session>/<uuid>`, which
 * the public `/api/uploads/[[key]]` route (only `uploads/*`) cannot serve.
 *
 * Serving (authenticated route and share route) is inert: the stored type from an
 * allow-list, `nosniff`, a `default-src 'none'; sandbox` policy, inline only for
 * images and a download for PDFs.
 */
import { emitCopEventLoose } from './cop-events-loose'
import { IMAGE_TYPES, sanitizeImage, sniffFileType, type SniffedType } from './image-sanitize'
import type { SourceChannel } from './cop-records'

export const MAX_COP_UPLOAD_BYTES = 10 * 1024 * 1024
export const UPLOADS_UNAVAILABLE = 'UPLOADS_UNAVAILABLE'
export const UNSUPPORTED_FILE = 'UNSUPPORTED_FILE'
export const UNREADABLE_IMAGE = 'UNREADABLE_IMAGE'
export const FILE_TOO_LARGE = 'FILE_TOO_LARGE'

const SERVABLE: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])

export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>
  get(key: string): Promise<{ body: ReadableStream | null; arrayBuffer(): Promise<ArrayBuffer>; size: number } | null>
  delete?(key: string): Promise<unknown>
}

export interface UploadRow {
  id: string
  cop_session_id: string
  r2_key: string
  content_type: string
  bytes: number
  width: number | null
  height: number | null
  original_name: string | null
  evidence_id: string | null
  created_at: string
}

export interface PublicUpload {
  id: string
  url: string
  content_type: string
  bytes: number
  width: number | null
  height: number | null
}

export function copUploadPath(sessionId: string, uploadId: string): string {
  return `/api/cop/${encodeURIComponent(sessionId)}/uploads/${encodeURIComponent(uploadId)}`
}

export function publicUpload(row: Pick<UploadRow, 'id' | 'cop_session_id' | 'content_type' | 'bytes' | 'width' | 'height'>): PublicUpload {
  return {
    id: row.id,
    url: copUploadPath(row.cop_session_id, row.id),
    content_type: row.content_type,
    bytes: Number(row.bytes),
    width: row.width ?? null,
    height: row.height ?? null,
  }
}

export function uploadsTableMissing(error: unknown): boolean {
  return /no such table:\s*(?:main\.)?cop_uploads\b/i.test(String(error instanceof Error ? error.message : error))
}

/** A file name for display only: no path, no control characters, at most 120 characters. */
export function cleanOriginalName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const base = (raw.split(/[/\\]/).pop() ?? '').replace(/[\u0000-\u001f\u007f<>"]+/g, '').trim()
  return base ? base.slice(0, 120) : null
}

export type CleanFileResult =
  | { ok: true; type: SniffedType; bytes: Uint8Array; width: number | null; height: number | null; status?: undefined; code?: undefined; error?: undefined }
  | { ok: false; status: number; code: string; error: string; type?: undefined; bytes?: undefined; width?: undefined; height?: undefined }

/** Type a file from its bytes and strip an image's metadata. */
export function cleanFile(bytes: Uint8Array): CleanFileResult {
  if (bytes.length === 0) return { ok: false, status: 400, code: UNSUPPORTED_FILE, error: 'The file is empty.' }
  if (bytes.length > MAX_COP_UPLOAD_BYTES) {
    return { ok: false, status: 413, code: FILE_TOO_LARGE, error: `Files are limited to ${MAX_COP_UPLOAD_BYTES / (1024 * 1024)} MB.` }
  }
  const type = sniffFileType(bytes)
  if (!type) {
    return { ok: false, status: 415, code: UNSUPPORTED_FILE, error: 'Only JPEG, PNG, WebP or GIF images and PDF documents can be added.' }
  }
  const clean = sanitizeImage(bytes, type)
  if (clean.ok === false) {
    return { ok: false, status: 422, code: UNREADABLE_IMAGE, error: `That image could not be checked (${clean.reason}). Try saving it again as JPEG or PNG.` }
  }
  return { ok: true, type, bytes: clean.bytes, width: clean.width, height: clean.height }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

export interface StoreUploadInput {
  sessionId: string
  bytes: Uint8Array
  originalName: string | null
  createdBy: number
  sourceChannel: SourceChannel
}

export type StoreUploadResult =
  | { ok: true; row: UploadRow; status?: undefined; code?: undefined; error?: undefined }
  | { ok: false; status: number; code: string; error: string; row?: undefined }

/** Clean, store in R2, then record the row (the bytes are removed again if the row can't be written). */
export async function storeCopUpload(
  env: { DB: D1Database; UPLOADS?: R2Like },
  input: StoreUploadInput,
): Promise<StoreUploadResult> {
  if (!env.UPLOADS) return { ok: false, status: 503, code: UPLOADS_UNAVAILABLE, error: 'File uploads are not configured on this server.' }
  const clean = cleanFile(input.bytes)
  if (clean.ok === false) return clean

  const id = `upl-${crypto.randomUUID()}`
  const key = `cop/${encodeURIComponent(input.sessionId)}/${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const row: UploadRow = {
    id,
    cop_session_id: input.sessionId,
    r2_key: key,
    content_type: clean.type,
    bytes: clean.bytes.length,
    width: clean.width,
    height: clean.height,
    original_name: cleanOriginalName(input.originalName),
    evidence_id: null,
    created_at: now,
  }
  await env.UPLOADS.put(key, clean.bytes, {
    httpMetadata: { contentType: clean.type },
    customMetadata: { copSession: input.sessionId, upload: id },
  })
  try {
    await env.DB.prepare(`
      INSERT INTO cop_uploads (id, cop_session_id, r2_key, content_type, bytes, width, height, sha256, original_name,
        source_channel, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, input.sessionId, key, clean.type, row.bytes, row.width, row.height, await sha256Hex(clean.bytes),
      row.original_name, input.sourceChannel, input.createdBy, now).run()
  } catch (error) {
    await env.UPLOADS.delete?.(key).catch(() => {})
    if (uploadsTableMissing(error)) {
      return { ok: false, status: 503, code: UPLOADS_UNAVAILABLE, error: 'File uploads are not available on this server yet.' }
    }
    throw error
  }
  await emitCopEventLoose(env.DB, {
    copSessionId: input.sessionId,
    eventType: 'upload.created',
    entityType: 'upload',
    entityId: id,
    payload: { content_type: clean.type, bytes: row.bytes },
    createdBy: input.createdBy,
  })
  return { ok: true, row }
}

export async function getSessionUpload(db: D1Database, sessionId: string, uploadId: string): Promise<UploadRow | null> {
  try {
    return await db.prepare(`
      SELECT id, cop_session_id, r2_key, content_type, bytes, width, height, original_name, evidence_id, created_at
      FROM cop_uploads WHERE id = ? AND cop_session_id = ? AND archived_at IS NULL
    `).bind(uploadId, sessionId).first<UploadRow>()
  } catch (error) {
    if (uploadsTableMissing(error)) return null
    throw error
  }
}

/** Inert response headers for a stored upload. */
export function uploadHeaders(row: Pick<UploadRow, 'id' | 'content_type'>, cache: string): Headers {
  const type = SERVABLE.has(row.content_type) ? row.content_type : 'application/octet-stream'
  const headers = new Headers()
  headers.set('Content-Type', type)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('Cache-Control', cache)
  if (IMAGE_TYPES.has(type as SniffedType)) {
    headers.set('Content-Disposition', 'inline')
  } else {
    headers.set('Content-Disposition', `attachment; filename="${row.id}.${type === 'application/pdf' ? 'pdf' : 'bin'}"`)
  }
  return headers
}

export async function serveUpload(env: { UPLOADS?: R2Like }, row: UploadRow, cache: string): Promise<Response> {
  if (!env.UPLOADS) {
    return new Response(JSON.stringify({ error: 'File uploads are not configured on this server.', code: UPLOADS_UNAVAILABLE }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }
  const object = await env.UPLOADS.get(row.r2_key)
  if (!object) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }
  const headers = uploadHeaders(row, cache)
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}
