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

  // Generate identity + timestamps
  const id = crypto.randomUUID()
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + ttlDays * 24 * 60 * 60

  // Persist
  try {
    await env.DB.prepare(
      `INSERT INTO imported_behavior_analyses
        (id, source, payload_kind, payload, source_user_hint, created_at, expires_at, view_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    )
      .bind(id, source, payloadKind, payloadJson, sourceUserHint, nowSeconds, expiresAt)
      .run()
  } catch (error) {
    console.error('[behavior/intake] D1 insert failed:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to persist analysis' }),
      { status: 500, headers: JSON_HEADERS },
    )
  }

  console.log(
    `[behavior/intake] stored id=${id} source=${source} kind=${payloadKind} ttl_days=${ttlDays}` +
      (sourceUserHint ? ` hint="${sourceUserHint}"` : ''),
  )

  // Build the canonical view URL. `Origin` may not be present (curl, MCP);
  // fall back to a conventional production host.
  const origin = request.headers.get('origin') || 'https://researchtools.net'
  const viewUrl = `${origin}/api/frameworks/behavior/shared/${id}`

  return new Response(
    JSON.stringify({
      id,
      view_url: viewUrl,
      expires_at: expiresAt,
    }),
    { status: 201, headers: JSON_HEADERS },
  )
}
