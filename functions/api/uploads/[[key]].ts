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
 * EXIF stripping (E-6c): JPEG bytes are buffered and their APP1 (EXIF/GPS/XMP)
 * segments removed before serving; all other content types stream as-stored.
 */
import { CORS_HEADERS } from '../_shared/api-utils'
import { stripImageExif } from './_exif'

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
  // Immutable: keys are random-prefixed and never reused, so cache aggressively.
  headers.set('Cache-Control', 'private, max-age=31536000, immutable')
  if (object.httpEtag) headers.set('ETag', object.httpEtag)

  // E-6c: strip EXIF/GPS from JPEGs before serving. Only images are buffered;
  // every other type streams the R2 body unchanged.
  if (contentType.toLowerCase() === 'image/jpeg') {
    const buf = new Uint8Array(await object.arrayBuffer())
    const cleaned = stripImageExif(buf, contentType)
    headers.set('Content-Length', String(cleaned.byteLength))
    return new Response(cleaned, { status: 200, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
