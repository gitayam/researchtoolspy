/**
 * Pure, dependency-free helpers for the public token-scoped file-upload endpoint (E-6a).
 *
 * No env, no fetch, no D1, no R2 — so they are unit-testable in plain Node. The
 * endpoint (`upload.ts`) composes these with token resolution, the shared
 * rate-limit helper, the Turnstile verify, and the R2 `UPLOADS` binding.
 *
 * Conservative caps + a MIME allowlist (PDF + common images). EXIF stripping,
 * retention, and PDF text extraction are LATER units (E-6c / E-6d / E-6b) and are
 * deliberately NOT done here.
 */

/** 10 MB per file. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** At most 5 files per submission. */
export const MAX_FILES_PER_SUBMISSION = 5

/** MIME allowlist: PDF + common web image formats. */
export const ALLOWED_UPLOAD_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const

/** Cap the (sanitized) filename length so keys stay bounded. */
export const MAX_FILENAME_LENGTH = 100

/** True iff `mime` is in the allowlist (exact match, case-insensitive). */
export function isAllowedUploadMime(mime: unknown): boolean {
  if (typeof mime !== 'string') return false
  const m = mime.trim().toLowerCase()
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(m)
}

export type ValidateUploadResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Enforce the MIME allowlist + size cap for a single file. Pure — the endpoint
 * passes `{ mime: file.type, size: file.size }`.
 */
export function validateUpload(input: { mime: unknown; size: unknown }): ValidateUploadResult {
  const { mime, size } = input

  if (!isAllowedUploadMime(mime)) {
    return {
      ok: false,
      error: `Unsupported file type${typeof mime === 'string' && mime ? ` "${mime}"` : ''}. Allowed: ${ALLOWED_UPLOAD_MIME.join(', ')}`,
    }
  }

  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return { ok: false, error: 'Invalid file size' }
  }
  if (size === 0) {
    return { ok: false, error: 'Empty file' }
  }
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)` }
  }

  return { ok: true }
}

/**
 * Sanitize a user-supplied filename into a safe basename:
 *  - strip any path component (handles both `/` and `\` separators),
 *  - drop control chars and anything outside a conservative allowlist,
 *  - collapse repeats, trim leading/trailing dots & dashes,
 *  - cap length (preserving the extension where possible),
 *  - fall back to `file` when nothing usable remains.
 *
 * This NEVER returns a string containing a path separator or `..`.
 */
export function sanitizeFilename(name: unknown): string {
  if (typeof name !== 'string') return 'file'

  // Take the last path segment only (defeats `../`, absolute paths, Windows `\`).
  const base = name.split(/[/\\]/).pop() ?? ''

  // Allowlist: alphanumerics, dot, dash, underscore. Everything else → '-'.
  let cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\.{2,}/g, '.') // collapse '..' (and longer) to a single dot
    .replace(/^[.-]+/, '') // no leading dots/dashes (no hidden files, no '-')
    .replace(/[.-]+$/, '') // no trailing dots/dashes

  if (!cleaned) return 'file'

  if (cleaned.length > MAX_FILENAME_LENGTH) {
    const dot = cleaned.lastIndexOf('.')
    if (dot > 0 && cleaned.length - dot <= 12) {
      // Preserve a short extension; truncate the stem.
      const ext = cleaned.slice(dot)
      const stem = cleaned.slice(0, MAX_FILENAME_LENGTH - ext.length)
      cleaned = (stem || 'file') + ext
    } else {
      cleaned = cleaned.slice(0, MAX_FILENAME_LENGTH)
    }
  }

  return cleaned || 'file'
}

/**
 * Build a safe R2 object key namespaced by the survey, with a random prefix to
 * make keys hard to guess (these are submission attachments — for v1 the
 * unguessable key IS the access gate; see upload serve endpoint).
 *
 * Shape: `uploads/<surveyId>/<random>-<sanitized-filename>`
 *
 * `token` is accepted for signature symmetry with the rest of the public-token
 * helpers but is intentionally NOT used in the key — the durable namespace is the
 * surveyId, not the rotatable share token.
 */
export function uploadObjectKey(token: string, surveyId: string, filename: string): string {
  const safeSurvey = sanitizeFilename(surveyId) || 'unknown'
  const safeName = sanitizeFilename(filename)
  const random = randomToken()
  return `uploads/${safeSurvey}/${random}-${safeName}`
}

/** 24-hex-char random token (96 bits) for unguessable key prefixes. */
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
