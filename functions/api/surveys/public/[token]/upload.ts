/**
 * Survey Drops Public File-Upload API (E-6a)
 *
 * POST /api/surveys/public/:token/upload
 *
 * Lets an UNAUTHENTICATED public submitter (identified only by the form's opaque
 * share token) upload attachments (PDF + common images) that the form will later
 * reference on submission. BACKEND ONLY — the form-UI wiring is a later unit; this
 * is built FAIL-CLOSED so it is safe to ship before it is wired up.
 *
 * Mirrors submit.ts / preview-url.ts:
 *  - same token resolution + active / access-level / expiry / country checks,
 *  - same per-IP-hash rate limit (uploads are expensive — definitely throttle),
 *  - same privacy rule: the submitter's raw IP / user-agent are NEVER stored or
 *    returned. An IP *hash* is used transiently for rate-limiting only.
 *
 * Gating beyond the form checks:
 *  - Cloudflare Turnstile (FAIL-CLOSED): a valid `cf-turnstile-response` token must
 *    verify against env.TURNSTILE_SECRET, else 403. Since TURNSTILE_SECRET is unset
 *    today, this endpoint currently rejects everything — intended (goes live E-6e).
 *
 * Caps: 10MB/file, <=5 files/submission, MIME allowlist (PDF + png/jpeg/webp/gif).
 *
 * E-6b: for PDF uploads, text is extracted in-Worker (unpdf, no vendor) from the
 * already-read buffer and returned as `extractedText` for form pre-fill. Extraction
 * is best-effort — any failure/timeout omits the text and the upload still succeeds.
 * The extracted text is RETURNED only (not stored to a table here — reviewer-side
 * full-text storage is a later refinement).
 *
 * NOT here (later units): EXIF strip + retention (E-6c/E-6d). Files are stored verbatim.
 */
import { JSON_HEADERS } from '../../../_shared/api-utils'
import {
  extractGeoFromRequest, isCountryAllowed, verifyPassword,
  hashSubmitterIP, checkSurveyResponseRateLimit,
} from '../../../_shared/survey-drops'
import { verifyTurnstile } from '../../../_shared/_turnstile'
import {
  validateUpload, uploadObjectKey,
  shouldExtractPdf, truncateText,
  MAX_FILES_PER_SUBMISSION,
} from './_upload'
import { extractPdfTextFromBuffer } from '../../../content-intelligence/pdf-extractor'

interface Env {
  DB: D1Database
  UPLOADS?: R2Bucket
  TURNSTILE_SECRET?: string
}

interface UploadedFileInfo {
  key: string
  name: string
  size: number
  type: string
  /** E-6b: auto-extracted PDF text for pre-fill. Omitted for non-PDFs or on
   * extraction failure — extraction never fails the upload. */
  extractedText?: string
  /** E-6b: page count when extraction succeeded and metadata is available. */
  pageCount?: number
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context
  const token = params.token as string

  try {
    const form = await env.DB.prepare(
      `SELECT id, status, access_level, password_hash, allowed_countries,
              rate_limit_per_hour, expires_at
       FROM survey_drops WHERE share_token = ?`
    ).bind(token).first() as {
      id: string
      status: string
      access_level: string | null
      password_hash: string | null
      allowed_countries: string | null
      rate_limit_per_hour: number
      expires_at: string | null
    } | null

    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    if (form.status !== 'active') {
      return new Response(JSON.stringify({ error: 'This form is not currently accepting submissions' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Expiry check
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'This form has expired' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Country gate
    const geo = extractGeoFromRequest(request)
    let allowedCountries: string[] = []
    try { allowedCountries = form.allowed_countries ? JSON.parse(form.allowed_countries) : [] } catch { /* */ }

    if (!isCountryAllowed(allowedCountries, geo.country)) {
      return new Response(JSON.stringify({
        error: 'This form is not available in your region',
        country_blocked: true,
      }), { status: 403, headers: JSON_HEADERS })
    }

    // Internal forms cannot be uploaded to publicly
    if (form.access_level === 'internal') {
      return new Response(JSON.stringify({ error: 'This form requires authentication' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // R2 binding guard — without it there is nowhere to store, fail clearly.
    if (!env.UPLOADS) {
      return new Response(JSON.stringify({ error: 'File uploads are not configured' }), {
        status: 503, headers: JSON_HEADERS,
      })
    }

    // Parse multipart body up front (we need the Turnstile token + password from
    // form fields, and the files themselves).
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid multipart body' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Password check (for password-protected forms) — mirror submit.ts. Password
    // can come from a form field or an `X-Form-Password` header.
    if (form.access_level === 'password') {
      const password = (formData.get('password') as string | null)
        || request.headers.get('X-Form-Password')
      if (!password) {
        return new Response(JSON.stringify({ error: 'Password is required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!form.password_hash || !(await verifyPassword(password, form.password_hash))) {
        return new Response(JSON.stringify({ error: 'Incorrect password' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
    }

    // Rate limiting — same per-IP-hash throttle as submit.ts. The hash is
    // transient (used only for the count query); it is never stored or returned.
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
    const ipHash = await hashSubmitterIP(clientIP, form.id)
    if (form.rate_limit_per_hour > 0) {
      const rateCheck = await checkSurveyResponseRateLimit(env.DB, form.id, ipHash, form.rate_limit_per_hour)
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          retry_after_seconds: 3600,
        }), {
          status: 429,
          headers: { ...JSON_HEADERS, 'Retry-After': '3600' },
        })
      }
    }

    // Turnstile gate (FAIL-CLOSED). Token from the form field or a header.
    const turnstileToken = (formData.get('cf-turnstile-response') as string | null)
      || request.headers.get('CF-Turnstile-Response')
    const turnstileOk = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, fetch, clientIP)
    if (!turnstileOk) {
      return new Response(JSON.stringify({ error: 'turnstile_required' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    // Collect the uploaded File entries (accept `files` and `file` field names).
    const files: File[] = []
    for (const [name, value] of formData.entries()) {
      if (value instanceof File && (name === 'files' || name === 'file')) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    if (files.length > MAX_FILES_PER_SUBMISSION) {
      return new Response(JSON.stringify({
        error: `Too many files (max ${MAX_FILES_PER_SUBMISSION} per submission)`,
      }), { status: 413, headers: JSON_HEADERS })
    }

    // Validate every file BEFORE writing any — all-or-nothing on validation.
    for (const file of files) {
      const v = validateUpload({ mime: file.type, size: file.size })
      if (!v.ok) {
        return new Response(JSON.stringify({ error: v.error, filename: file.name }), {
          status: 415, headers: JSON_HEADERS,
        })
      }
    }

    // Store each file in R2. The returned keys are what the form will later attach
    // to the submission row.
    const stored: UploadedFileInfo[] = []
    for (const file of files) {
      const key = uploadObjectKey(token, form.id, file.name)
      // Read the bytes ONCE — reused for the R2 put and (for PDFs) extraction.
      const body = await file.arrayBuffer()
      // E-6c: strip EXIF before storing (images). For now stored verbatim.
      await env.UPLOADS.put(key, body, {
        httpMetadata: { contentType: file.type },
        // Survey id recorded for E-6d retention sweeps; NO submitter IP/UA (privacy).
        customMetadata: { surveyId: form.id },
      })

      const entry: UploadedFileInfo = { key, name: file.name, size: file.size, type: file.type }

      // E-6b: for PDFs within the size guard, extract text in-Worker for pre-fill.
      // Extraction MUST NOT fail the upload — any throw/timeout just omits the text.
      // NB: full-text storage for the reviewer is a later refinement (not stored here).
      if (shouldExtractPdf(file.type, file.size)) {
        try {
          const result = await extractPdfTextFromBuffer(body)
          entry.extractedText = truncateText(result.text)
          if (typeof result.metadata?.pageCount === 'number') {
            entry.pageCount = result.metadata.pageCount
          }
        } catch (extractErr) {
          // Image-only / encrypted / corrupt PDF, or CPU/timeout — leave text off.
          console.warn('[Survey Drops Public] PDF extraction skipped:',
            extractErr instanceof Error ? extractErr.message : String(extractErr))
        }
      }

      stored.push(entry)
    }

    return new Response(JSON.stringify({ ok: true, files: stored }), {
      status: 201, headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[Survey Drops Public] Upload error:', error)
    return new Response(JSON.stringify({ error: 'Failed to upload' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}

export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}
