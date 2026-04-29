/**
 * GET /api/frameworks/behavior/shared/<id>
 *
 * Public read-only access to a behavior analysis stored via /intake.
 * No auth required — anyone with the UUID can fetch. This is intentional:
 * the URL itself is the access token, sent via Signal/Slack/etc. when
 * the bot generates the analysis.
 *
 * Response (200):
 *   {
 *     id: string,
 *     source: 'signal-bot' | 'bcw-mcp' | 'mcp-other',
 *     payload_kind: 'l1' | 'frame' | 'l2' | 'pipeline',
 *     payload: any,                  // the analysis JSON
 *     source_user_hint?: string,
 *     created_at: number,            // Unix epoch seconds
 *     expires_at: number,
 *     view_count: number             // post-increment
 *   }
 *
 * Response (404): id not found OR expired
 * Response (410): id was found but is now expired (separate from never existed)
 *
 * Closes C-6 of the cross-repo team-review (2026-04-27). Companion to:
 * - POST /api/frameworks/behavior/intake
 * - signal-bot integration that prints the URL after L1/Frame output
 *
 * Note: this endpoint returns RAW JSON. A frontend viewer route at
 * /shared/behavior/<id> can be added later that fetches this endpoint
 * and renders the analysis using the existing BehaviorAnalysisToolPage
 * components — that's its own work.
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS, optionsResponse } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
  /** Shared bearer for edit-via-PUT. Same value as intake's BOT_INTAKE_API_KEY. */
  BOT_INTAKE_API_KEY?: string
}

const MAX_PAYLOAD_BYTES = 256 * 1024 // 256 KB
const MAX_EDITS_PER_ANALYSIS = 25 // hard cap to prevent runaway edit loops

export const onRequestOptions: PagesFunction<Env> = async () => optionsResponse()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context
  const id = (params?.id as string | undefined)?.trim()

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  // Quick UUID-shape check to avoid wasting a D1 query on garbage IDs
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id format' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  let row: {
    id: string
    source: string
    payload_kind: string
    payload: string
    source_user_hint: string | null
    created_at: number
    expires_at: number
    view_count: number
  } | null = null

  try {
    row = (await env.DB.prepare(
      `SELECT id, source, payload_kind, payload, source_user_hint,
              created_at, expires_at, view_count
       FROM imported_behavior_analyses
       WHERE id = ?`,
    )
      .bind(id)
      .first()) as typeof row
  } catch (error) {
    console.error('[behavior/shared/[id]] D1 read failed:', error)
    return new Response(JSON.stringify({ error: 'Read failed' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  if (!row) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (row.expires_at <= nowSeconds) {
    // Distinguish expired-but-still-in-DB from never-existed. Cron will
    // sweep expired rows; until then, return 410 so the caller knows the
    // analysis WAS valid but TTL'd out.
    return new Response(
      JSON.stringify({
        error: 'Analysis expired',
        expired_at: row.expires_at,
      }),
      { status: 410, headers: JSON_HEADERS },
    )
  }

  // Increment view counter — best-effort, don't fail the read if this errors
  try {
    await env.DB.prepare(
      `UPDATE imported_behavior_analyses
       SET view_count = view_count + 1, last_viewed_at = ?
       WHERE id = ?`,
    )
      .bind(nowSeconds, id)
      .run()
  } catch (error) {
    console.warn('[behavior/shared/[id]] view_count increment failed (non-fatal):', error)
  }

  // Parse the stored payload back to an object
  let payload: unknown
  try {
    payload = JSON.parse(row.payload)
  } catch (error) {
    console.error('[behavior/shared/[id]] stored payload not valid JSON:', error)
    return new Response(JSON.stringify({ error: 'Stored payload corrupt' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  return new Response(
    JSON.stringify({
      id: row.id,
      source: row.source,
      payload_kind: row.payload_kind,
      payload,
      ...(row.source_user_hint ? { source_user_hint: row.source_user_hint } : {}),
      created_at: row.created_at,
      expires_at: row.expires_at,
      view_count: row.view_count + 1,
    }),
    { status: 200, headers: JSON_HEADERS },
  )
}

/**
 * PUT /api/frameworks/behavior/shared/<id>
 *
 * Update an existing stored analysis with a new payload. Used by the
 * signal-bot's `!bcw edit <instruction>` command (conversational edit
 * via reply): the bot fetches the current analysis, applies the user's
 * edit instruction via AI, then PUTs the result back here.
 *
 * Auth: same Bearer token as intake (BOT_INTAKE_API_KEY). Edit is bot-
 * driven by design — preserves the "URL is the access token" model for
 * reads while keeping writes gated to trusted consumers.
 *
 * Body: { payload: any }  — the new analysis JSON. The other fields
 * (source, payload_kind, source_user_hint, expires_at) are PRESERVED
 * from the original record. Only payload is mutable.
 *
 * Hard cap: 25 edits per analysis. Beyond that, returns 429.
 *
 * Response (200): { id, edit_count, last_edited_at }
 * Response (401): missing/invalid bearer
 * Response (404): id not found
 * Response (410): id expired
 * Response (413): payload over 256 KB
 * Response (429): edit limit exceeded
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context

  // Auth — same model as intake
  if (!env.BOT_INTAKE_API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Bot intake disabled' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Missing Bearer token' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }
  const token = authHeader.slice(7).trim()
  if (token !== env.BOT_INTAKE_API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized', reason: 'Invalid Bearer token' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  const id = (params?.id as string | undefined)?.trim()
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid id format' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  // Body size guard pre-parse
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return new Response(
      JSON.stringify({ error: 'Payload too large', max_bytes: MAX_PAYLOAD_BYTES }),
      { status: 413, headers: JSON_HEADERS },
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body is not valid JSON' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }
  if (!body || typeof body !== 'object' || !body.payload || typeof body.payload !== 'object') {
    return new Response(JSON.stringify({ error: 'Body must include a "payload" object' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
  }

  let payloadJson: string
  try {
    payloadJson = JSON.stringify(body.payload)
  } catch {
    return new Response(JSON.stringify({ error: 'payload could not be serialized' }), {
      status: 400,
      headers: JSON_HEADERS,
    })
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

  // Look up the existing row to (a) verify it exists, (b) check expiry,
  // (c) check edit cap.
  let row: { id: string; expires_at: number; edit_count: number } | null = null
  try {
    row = (await env.DB.prepare(
      `SELECT id, expires_at, edit_count FROM imported_behavior_analyses WHERE id = ?`,
    )
      .bind(id)
      .first()) as typeof row
  } catch (error) {
    console.error('[behavior/shared/[id] PUT] D1 read failed:', error)
    return new Response(JSON.stringify({ error: 'Read failed' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  if (!row) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: JSON_HEADERS,
    })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (row.expires_at <= nowSeconds) {
    return new Response(
      JSON.stringify({ error: 'Analysis expired — cannot edit', expired_at: row.expires_at }),
      { status: 410, headers: JSON_HEADERS },
    )
  }

  if (row.edit_count >= MAX_EDITS_PER_ANALYSIS) {
    return new Response(
      JSON.stringify({
        error: 'Edit limit exceeded',
        max_edits: MAX_EDITS_PER_ANALYSIS,
        edit_count: row.edit_count,
      }),
      { status: 429, headers: JSON_HEADERS },
    )
  }

  // Apply the update
  try {
    await env.DB.prepare(
      `UPDATE imported_behavior_analyses
       SET payload = ?, edit_count = edit_count + 1, last_edited_at = ?
       WHERE id = ?`,
    )
      .bind(payloadJson, nowSeconds, id)
      .run()
  } catch (error) {
    console.error('[behavior/shared/[id] PUT] D1 update failed:', error)
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  console.log(
    `[behavior/shared/[id] PUT] updated id=${id} edit_count=${row.edit_count + 1}`,
  )

  return new Response(
    JSON.stringify({
      id,
      edit_count: row.edit_count + 1,
      last_edited_at: nowSeconds,
    }),
    { status: 200, headers: JSON_HEADERS },
  )
}
