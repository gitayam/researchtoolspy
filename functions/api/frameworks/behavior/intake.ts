/**
 * POST /api/frameworks/behavior/intake
 *
 * Public intake endpoint for behavior analyses produced by external
 * consumers (signal-bot, bcw-mcp, future MCP integrations). Lets a Signal
 * user produce an analysis via `!bcw` in the bot and get back a shareable
 * URL.
 *
 * Auth: Authorization: Bearer <BOT_INTAKE_API_KEY> (server-side env).
 * The bot is a single trusted consumer; it does not act on behalf of
 * authenticated users. This is NOT a general user-facing endpoint.
 *
 * Request body:
 *   {
 *     source: 'signal-bot' | 'bcw-mcp' | 'mcp-other',
 *     payload_kind: 'l1' | 'frame' | 'l2' | 'pipeline',
 *     payload: any,                  // JSON object — the analysis itself
 *     source_user_hint?: string,     // optional display label (Signal source name)
 *     ttl_days?: number              // optional, default 30, max 90
 *   }
 *
 * Response (201):
 *   {
 *     id: string,                    // UUID v4
 *     view_url: string,              // canonical viewable URL (JSON)
 *     expires_at: number             // Unix epoch seconds
 *   }
 *
 * Response (401): missing or invalid bearer token
 * Response (400): malformed body / missing required fields
 * Response (413): payload over size limit (256 KB)
 *
 * Closes C-6 of the cross-repo team-review (2026-04-27). Companion to:
 * - signal-bot client integration (separate commit)
 * - GET /api/frameworks/behavior/shared/<id> for read-only public access
 *
 * Data lifecycle: TTL'd via expires_at; consumer nightly cron sweep deletes
 * expired rows (separate from this endpoint).
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  /** Shared secret for bot intake. Set via Cloudflare Pages env. */
  BOT_INTAKE_API_KEY?: string
  /** Hash for the system bot user — analyses created via /intake are owned
   *  by this user. Resolves/creates the user on first use. */
  SYSTEM_USER_HASH?: string
}

const VALID_SOURCES = ['signal-bot', 'bcw-mcp', 'mcp-other'] as const
const VALID_PAYLOAD_KINDS = ['l1', 'frame', 'l2', 'pipeline'] as const
const DEFAULT_TTL_DAYS = 30
const MAX_TTL_DAYS = 90
const MAX_PAYLOAD_BYTES = 256 * 1024 // 256 KB
const MAX_HINT_LENGTH = 100

function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized', reason }), {
    status: 401,
    headers: JSON_HEADERS,
  })
}

function badRequest(error: string, hint?: string): Response {
  return new Response(JSON.stringify({ error, ...(hint ? { hint } : {}) }), {
    status: 400,
    headers: JSON_HEADERS,
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Auth — bot intake requires a shared bearer token. If the env var is
  // unset on the deployment, intake is disabled (returns 401 — not 503 —
  // to avoid leaking deployment state).
  if (!env.BOT_INTAKE_API_KEY) {
    return unauthorized('Bot intake disabled')
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('Missing Bearer token')
  }
  const token = authHeader.slice(7).trim()
  if (token !== env.BOT_INTAKE_API_KEY) {
    return unauthorized('Invalid Bearer token')
  }

  // Body parsing — guard against oversized bodies BEFORE JSON.parse to
  // avoid a 100MB DoS surface on the public endpoint.
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: 'Payload too large',
        max_bytes: MAX_PAYLOAD_BYTES,
      }),
      { status: 413, headers: JSON_HEADERS },
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return badRequest('Body is not valid JSON')
  }

  if (!body || typeof body !== 'object') {
    return badRequest('Body must be a JSON object')
  }

  // Validate source
  if (!VALID_SOURCES.includes(body.source)) {
    return badRequest(
      `Invalid source "${body.source}". Valid: ${VALID_SOURCES.join(', ')}.`,
    )
  }
  const source = body.source as (typeof VALID_SOURCES)[number]

  // Validate payload_kind
  if (!VALID_PAYLOAD_KINDS.includes(body.payload_kind)) {
    return badRequest(
      `Invalid payload_kind "${body.payload_kind}". Valid: ${VALID_PAYLOAD_KINDS.join(', ')}.`,
    )
  }
  const payloadKind = body.payload_kind as (typeof VALID_PAYLOAD_KINDS)[number]

  // Validate payload — must be an object; serialized form must fit
  if (!body.payload || typeof body.payload !== 'object') {
    return badRequest('payload must be a JSON object')
  }
  let payloadJson: string
  try {
    payloadJson = JSON.stringify(body.payload)
  } catch {
    return badRequest('payload could not be serialized')
  }
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({
        error: 'Payload too large after serialization',
        max_bytes: MAX_PAYLOAD_BYTES,
        actual: payloadJson.length,
      }),
      { status: 413, headers: JSON_HEADERS },
    )
  }

  // Optional fields
  let sourceUserHint: string | null = null
  if (body.source_user_hint !== undefined) {
    if (typeof body.source_user_hint !== 'string') {
      return badRequest('source_user_hint must be a string')
    }
    sourceUserHint = body.source_user_hint.trim().slice(0, MAX_HINT_LENGTH)
    if (sourceUserHint.length === 0) sourceUserHint = null
  }

  let ttlDays = DEFAULT_TTL_DAYS
  if (body.ttl_days !== undefined) {
    if (
      typeof body.ttl_days !== 'number' ||
      !Number.isInteger(body.ttl_days) ||
      body.ttl_days < 1 ||
      body.ttl_days > MAX_TTL_DAYS
    ) {
      return badRequest(`ttl_days must be an integer between 1 and ${MAX_TTL_DAYS}`)
    }
    ttlDays = body.ttl_days
  }

  // Resolve the system bot user. Bot-created analyses live in the canonical
  // framework_sessions table owned by a designated system user. Logged-in
  // users get full edit/clone tooling on these via the existing UI; the
  // public is_public=1 flag lets unauth viewers read.
  const systemUserHash = env.SYSTEM_USER_HASH
  if (!systemUserHash) {
    console.error('[behavior/intake] SYSTEM_USER_HASH not configured')
    return new Response(
      JSON.stringify({ error: 'Bot intake misconfigured (system user)' }),
      { status: 500, headers: JSON_HEADERS },
    )
  }
  let systemUserId: number | null = null
  try {
    const existing = (await env.DB.prepare(
      `SELECT id FROM users WHERE user_hash = ?`,
    )
      .bind(systemUserHash)
      .first()) as { id: number } | null
    if (existing?.id) {
      systemUserId = Number(existing.id)
    } else {
      const created = (await env.DB.prepare(
        `INSERT INTO users (username, email, user_hash, full_name, hashed_password,
                            created_at, is_active, is_verified, role)
         VALUES (?, ?, ?, ?, 'HASH_AUTH', ?, 1, 1, 'system')
         RETURNING id`,
      )
        .bind(
          'system-bot',
          'system-bot@irregularchat',
          systemUserHash,
          'IrregularChat Bot',
          new Date().toISOString(),
        )
        .first()) as { id: number } | null
      systemUserId = created?.id ? Number(created.id) : null
    }
  } catch (error) {
    console.error('[behavior/intake] system user resolve failed:', error)
  }
  if (!systemUserId) {
    return new Response(
      JSON.stringify({ error: 'Failed to resolve system user' }),
      { status: 500, headers: JSON_HEADERS },
    )
  }

  // Map the bot's payload_kind onto a canonical framework_type:
  //   l1 / frame / pipeline → 'behavior' (the behavior analysis is the
  //     primary artifact; Frame metadata is nested inside data)
  //   l2 → 'comb-analysis' (audience-specific COM-B is a different type)
  const frameworkType = payloadKind === 'l2' ? 'comb-analysis' : 'behavior'

  // Build the data blob for the framework_sessions row. The shape is the
  // bot payload as-is, lightly normalized to fit the existing UI's
  // expectations where possible. Extra bot-specific fields (decisionType,
  // psychological_state, etc.) stay in the JSON for forward compat — the
  // existing UI ignores unknown fields, our future PublicSharedBehaviorPage
  // / new UI work renders them.
  const payloadObj = body.payload as Record<string, unknown>
  let frameworkData: Record<string, unknown>
  let derivedTitle: string
  let derivedDescription: string | null = null

  if (payloadKind === 'l1') {
    const l1 = (payloadObj.l1 ?? payloadObj) as Record<string, unknown>
    frameworkData = { ...l1, _bot_source: source, _bot_user_hint: sourceUserHint || null }
    derivedTitle = String(l1.title || payloadObj.behavior || '(Untitled Behavior)')
    derivedDescription = (l1.description as string | undefined) ?? null
  } else if (payloadKind === 'pipeline') {
    const l1 = (payloadObj.l1 ?? {}) as Record<string, unknown>
    const frame = (payloadObj.frame ?? {}) as Record<string, unknown>
    frameworkData = {
      ...l1,
      operational_frame: frame,
      _bot_source: source,
      _bot_objective: payloadObj.objective ?? null,
      _bot_user_hint: sourceUserHint || null,
    }
    derivedTitle = String(l1.title || payloadObj.behavior || '(Untitled Behavior)')
    derivedDescription = (l1.description as string | undefined) ?? null
  } else if (payloadKind === 'frame') {
    frameworkData = {
      operational_frame: payloadObj,
      _bot_source: source,
      _bot_user_hint: sourceUserHint || null,
    }
    derivedTitle = String(
      payloadObj.objective_restated ||
        payloadObj.objective_text ||
        '(Untitled Operational Frame)',
    )
  } else {
    // l2
    frameworkData = {
      ...payloadObj,
      _bot_source: source,
      _bot_user_hint: sourceUserHint || null,
    }
    const audience = String(payloadObj.audience ?? '')
    const behavior = String(payloadObj.behavior ?? '')
    derivedTitle = audience && behavior
      ? `${audience} — ${behavior}`
      : audience || behavior || '(Untitled COM-B Analysis)'
  }

  // Persist as a framework_sessions row, public by default so the share URL
  // works without auth. Logged-in users see edit/clone affordances via the
  // existing UI.
  const nowIso = new Date().toISOString()
  let frameworkId: number | null = null
  try {
    const result = (await env.DB.prepare(
      `INSERT INTO framework_sessions
        (user_id, title, description, framework_type, status, data, is_public,
         workspace_id, original_workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', ?, 1, '1', '1', ?, ?)
       RETURNING id`,
    )
      .bind(
        systemUserId,
        derivedTitle.slice(0, 500),
        derivedDescription ? derivedDescription.slice(0, 2000) : null,
        frameworkType,
        JSON.stringify(frameworkData),
        nowIso,
        nowIso,
      )
      .first()) as { id: number } | null
    frameworkId = result?.id ? Number(result.id) : null
  } catch (error) {
    console.error('[behavior/intake] framework_sessions INSERT failed:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to persist analysis' }),
      { status: 500, headers: JSON_HEADERS },
    )
  }
  if (!frameworkId) {
    return new Response(
      JSON.stringify({ error: 'Insert returned no id' }),
      { status: 500, headers: JSON_HEADERS },
    )
  }

  console.log(
    `[behavior/intake] stored framework_sessions.id=${frameworkId} source=${source} kind=${payloadKind} type=${frameworkType}` +
      (sourceUserHint ? ` hint="${sourceUserHint}"` : ''),
  )

  // Canonical view URL: the existing rt frontend route. Logged-in users
  // see edit/clone CTAs. Anonymous users see a public read-only render
  // (since is_public=1).
  const origin = request.headers.get('origin') || 'https://researchtools.net'
  const viewUrl = `${origin}/dashboard/analysis-frameworks/${frameworkType}/${frameworkId}/view`

  // expires_at is now informational only — framework_sessions has no TTL
  // (analyses persist until the user deletes them). Return 0 to signal "no
  // expiry" while keeping the response shape stable for existing clients.
  return new Response(
    JSON.stringify({
      id: String(frameworkId),
      view_url: viewUrl,
      expires_at: 0,
      framework_type: frameworkType,
    }),
    { status: 201, headers: JSON_HEADERS },
  )
}
