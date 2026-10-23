/**
 * Public Upload Serve Endpoint (E-6a)
 *
 * GET /api/uploads/<r2-object-key>
 *
 * Streams a stored submission attachment back from R2. The object key produced by
 * the upload endpoint contains slashes (`uploads/<surveyId>/<random>-<file>`), so
 * this is a CATCH-ALL route (`[[key]]`): the Pages runtime gives `params.key` as the
 * array of path segments, which we re-join into the full R2 key.
 *
 * ACCESS SCOPING (v1): these are submission attachments addressed by a
 * hard-to-guess random-prefixed key — the unguessable key IS the gate for v1.
 * A stricter per-survey/owner access check can layer on later if needed.
 *
 * Metadata: uploads are now stripped before they are stored (survey upload.ts).
 * Files stored earlier may still carry EXIF/GPS, so every image is also cleaned
 * here (functions/api/_shared/image-sanitize.ts: JPEG keeps only Orientation; PNG,
 * WebP and GIF lose their text/EXIF/XMP blocks). An image that can't be parsed is
 * not served raw. PDFs stream as stored.
 */
import { CORS_HEADERS } from '../_shared/api-utils'
import { IMAGE_TYPES, sanitizeImage, sniffFileType } from '../_shared/image-sanitize'

interface Env {
  UPLOADS?: R2Bucket
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context

  if (!env.UPLOADS) {
    return new Response(JSON.stringify({ error: 'File uploads are not configured' }), {
      status: 503,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // Catch-all param: array of segments for `[[key]]`, but tolerate a string too.
  const raw = params.key
  const key = Array.isArray(raw) ? raw.join('/') : String(raw ?? '')

  // Constrain to the uploads/ namespace and reject path traversal — defense in
  // depth even though keys are server-generated.
  if (!key || key.includes('..') || !key.startsWith('uploads/')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let object: R2ObjectBody | null
  try {
    object = await env.UPLOADS.get(key)
  } catch (error) {
    console.error('[Uploads Serve] R2 get failed:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch file' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!object) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'

  const headers = new Headers(CORS_HEADERS)
  headers.set('Content-Type', contentType)
  // Treat all uploads as attachments by default — never render inline as the
  // top-level document (mitigates stored-XSS via crafted files).
  headers.set('Content-Disposition', 'inline')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
  // Immutable: keys are random-prefixed and never reused, so cache aggressively.
  headers.set('Cache-Control', 'private, max-age=31536000, immutable')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  // Images: buffered and cleaned (older objects were stored with their metadata).
  if (contentType.toLowerCase().startsWith('image/')) {
    const buf = new Uint8Array(await object.arrayBuffer())
    const sniffed = sniffFileType(buf)
    const cleaned = sniffed && IMAGE_TYPES.has(sniffed) ? sanitizeImage(buf, sniffed) : null
    if (!sniffed || !cleaned || cleaned.ok === false) {
      return new Response(JSON.stringify({ error: 'This file cannot be shown' }), {
        status: 415,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    headers.set('Content-Type', sniffed)
    headers.set('Content-Length', String(cleaned.bytes.byteLength))
    return new Response(cleaned.bytes, { status: 200, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
