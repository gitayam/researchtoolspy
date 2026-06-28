/**
 * Survey Drops Public URL-Preview API (E-5a)
 *
 * POST /api/surveys/public/:token/preview-url
 *
 * Lets an UNAUTHENTICATED public submitter (identified only by the form's opaque
 * share token) paste a URL and get back extracted metadata to CONFIRM before
 * submitting: title / author / published-date / summary + an archive link + a
 * "already submitted to this form" dedup flag.
 *
 * This is BACKEND only (the form-UI wiring is E-5b). It mirrors submit.ts:
 *  - same token resolution + active/access checks (404 / 403),
 *  - same per-IP-hash rate limit (preview is cheap but fetches a URL),
 *  - calls the auth-gated `analyze-url` endpoint INTERNALLY with the system hash
 *    (NEVER exposing analyze-url directly to the public).
 *
 * PRIVACY (hard rule): the submitter's raw IP / user-agent are NEVER stored or
 * returned. An IP *hash* is used transiently for rate-limiting only (mirrors
 * submit.ts) and is never persisted on a response row here, nor returned.
 */
import { JSON_HEADERS, isPrivateUrl } from '../../../_shared/api-utils'
import {
  extractGeoFromRequest, isCountryAllowed, verifyPassword,
  hashSubmitterIP, hashFormData, checkSurveyResponseRateLimit,
} from '../../../_shared/survey-drops'
import { generateArchiveUrls } from '../../../content-intelligence/_archive-urls'
import { validatePreviewUrl, shapePreview } from './_preview-url'

interface Env {
  DB: D1Database
  SYSTEM_USER_HASH?: string
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

    // Internal forms cannot be previewed publicly
    if (form.access_level === 'internal') {
      return new Response(JSON.stringify({ error: 'This form requires authentication' }), {
        status: 403, headers: JSON_HEADERS,
      })
    }

    let body: { url?: unknown; password?: string }
    try {
      body = await request.json() as { url?: unknown; password?: string }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400, headers: JSON_HEADERS,
      })
    }

    // Password check (for password-protected forms) — mirror submit.ts
    if (form.access_level === 'password') {
      if (!body.password) {
        return new Response(JSON.stringify({ error: 'Password is required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!form.password_hash || !(await verifyPassword(body.password, form.password_hash))) {
        return new Response(JSON.stringify({ error: 'Incorrect password' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
    }

    // Validate the submitted URL (http(s) + length) BEFORE any network work.
    const validation = validatePreviewUrl(body.url)
    if (!validation.ok) {
      return new Response(JSON.stringify({ ok: false, error: validation.error }), {
        status: 400, headers: JSON_HEADERS,
      })
    }
    const url = validation.url

    // SSRF guard — reject private/internal targets (same guard analyze-url uses).
    if (isPrivateUrl(url)) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'URLs pointing to private/internal addresses are not allowed',
      }), { status: 400, headers: JSON_HEADERS })
    }

    // Rate limiting — same per-IP-hash throttle as submit.ts. The hash is
    // transient (used only for the count query); it is never stored or returned.
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
    const ipHash = await hashSubmitterIP(clientIP, form.id)
    if (form.rate_limit_per_hour > 0) {
      const rateCheck = await checkSurveyResponseRateLimit(env.DB, form.id, ipHash, form.rate_limit_per_hour)
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Rate limit exceeded. Please try again later.',
          retry_after_seconds: 3600,
        }), {
          status: 429,
          headers: { ...JSON_HEADERS, 'Retry-After': '3600' },
        })
      }
    }

    // Best-effort dedup: hash the URL the same way submit hashes form_data
    // ({ url } object) and look it up in survey_responses. NOTE: submit.ts hashes
    // the FULL form_data, so a real form with extra fields produces a different
    // content_hash than this URL-only hash — the flag is best-effort and may miss.
    let duplicate = false
    try {
      const contentHash = await hashFormData({ url })
      const existing = await env.DB.prepare(
        'SELECT 1 FROM survey_responses WHERE survey_id = ? AND content_hash = ? LIMIT 1'
      ).bind(form.id, contentHash).first()
      duplicate = !!existing
    } catch {
      // Dedup is an optimization, not a gate — never fail the preview on it.
      duplicate = false
    }

    // Archive link: use the pure builder (cheap, no network). We return the
    // Wayback link string rather than CREATING a live snapshot — creating a
    // snapshot would block the response and add an external dependency.
    const archiveUrl = generateArchiveUrls(url).wayback

    // Call analyze-url INTERNALLY with the system hash (it requires auth).
    // Quick mode keeps it cheap. Graceful failure — never 500-crash the preview.
    try {
      const origin = new URL(request.url).origin
      const analysisRes = await fetch(`${origin}/api/content-intelligence/analyze-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': env.SYSTEM_USER_HASH || 'system-internal',
        },
        body: JSON.stringify({ url, mode: 'quick' }),
        signal: AbortSignal.timeout(20000),
      })

      if (!analysisRes.ok) {
        return new Response(JSON.stringify({
          ok: false,
          url,
          error: 'Could not extract content from this URL. You can still submit it manually.',
          archive_url: archiveUrl,
          duplicate,
        }), { status: 200, headers: JSON_HEADERS })
      }

      const analysis = await analysisRes.json() as Record<string, unknown>
      const preview = shapePreview(analysis, { duplicate, archiveUrl })
      // Prefer the submitter-supplied URL for display consistency.
      preview.url = url

      return new Response(JSON.stringify(preview), {
        status: 200, headers: JSON_HEADERS,
      })
    } catch (e) {
      console.error('[Survey Preview] analyze-url call failed:', e)
      return new Response(JSON.stringify({
        ok: false,
        url,
        error: 'Preview timed out or failed. You can still submit this URL manually.',
        archive_url: archiveUrl,
        duplicate,
      }), { status: 200, headers: JSON_HEADERS })
    }
  } catch (error) {
    console.error('[Survey Drops Public] Preview error:', error)
    return new Response(JSON.stringify({ ok: false, error: 'Failed to preview URL' }), {
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
