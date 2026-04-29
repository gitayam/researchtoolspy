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
}

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
