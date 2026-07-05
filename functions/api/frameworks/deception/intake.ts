/**
 * POST /api/frameworks/deception/intake
 *
 * Bot intake for deception assessments produced by the Signal community bot
 * (`!deception <url>`). The bot owns MOM-POP-MOSES-EVE scoring; this endpoint
 * persists each finished assessment as a public `framework_sessions` row of
 * type 'deception' so it shows up in ResearchTools' deception history/trends
 * (GET /api/deception/history reads framework_sessions WHERE framework_type =
 * 'deception') and is shareable via the normal framework view.
 *
 * Mirrors /api/frameworks/behavior/intake exactly (same Bearer auth, same
 * system-user ownership, same framework_sessions table + workspace '1'); only
 * the framework_type and the data shape differ. No new secret, no migration.
 *
 * Auth: Authorization: Bearer <BOT_INTAKE_API_KEY> (server-side env).
 *
 * Request body:
 *   {
 *     source: 'signal-bot',
 *     url: string,                    // the analyzed article URL
 *     title?: string,                 // article title (falls back to the URL)
 *     assessment: {                   // the bot's DeceptionAssessment
 *       likelihood: number,           // 0-100
 *       riskLevel?: string,
 *       confidence?: string,
 *       bluf?: string,
 *       category: { mom, pop, moses, eve, rage },  // 0-5 each
 *       scores?: object,              // 11 sub-scores
 *       motives?: Array<{ hypothesis, rationale }>,
 *       popExamples?: Array<{ date, description, sourceUrl }>,
 *       actors?: string[]
 *     },
 *     source_user_hint?: string
 *   }
 *
 * Response (201): { id, view_url, framework_type: 'deception' }
 * Response (401): missing/invalid bearer   (400): malformed   (413): oversized
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  BOT_INTAKE_API_KEY?: string
  SYSTEM_USER_HASH?: string
}

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

  // Auth — same shared bearer as behavior intake. Disabled (401, not 503) when
  // the env var is unset, to avoid leaking deployment state.
  if (!env.BOT_INTAKE_API_KEY) {
    return unauthorized('Bot intake disabled')
  }
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('Missing Bearer token')
  }
  if (authHeader.slice(7).trim() !== env.BOT_INTAKE_API_KEY) {
    return unauthorized('Invalid Bearer token')
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large', max_bytes: MAX_PAYLOAD_BYTES }), {
      status: 413,
      headers: JSON_HEADERS,
    })
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
  if (body.source !== 'signal-bot') {
    return badRequest(`Invalid source "${body.source}". Expected "signal-bot".`)
  }
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return badRequest('Missing "url"')
  }
  const assessment = body.assessment
  if (!assessment || typeof assessment !== 'object' || typeof assessment.likelihood !== 'number') {
    return badRequest('Missing or malformed "assessment" (needs numeric likelihood)')
  }
  const sourceUserHint =
    typeof body.source_user_hint === 'string'
      ? body.source_user_hint.slice(0, MAX_HINT_LENGTH)
      : null
  const title = (typeof body.title === 'string' && body.title.trim()) || url

  // Resolve the system bot user (create-if-missing) — identical to behavior intake.
  const systemUserHash = env.SYSTEM_USER_HASH
  if (!systemUserHash) {
    console.error('[deception/intake] SYSTEM_USER_HASH not configured')
    return new Response(JSON.stringify({ error: 'Bot intake misconfigured (system user)' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
  let systemUserId: number | null = null
  try {
    const existing = (await env.DB.prepare(`SELECT id FROM users WHERE user_hash = ?`)
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
    console.error('[deception/intake] system user resolve failed:', error)
  }
  if (!systemUserId) {
    return new Response(JSON.stringify({ error: 'Failed to resolve system user' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  // Build the framework_sessions.data blob. GET /api/deception/history reads
  // `data.calculatedAssessment.likelihood` and `data.scores`, so those two keys
  // are the contract; the rest is carried for the framework view + aggregate.
  const category = (assessment.category ?? {}) as Record<string, number>
  const frameworkData = {
    calculatedAssessment: {
      likelihood: assessment.likelihood,
      riskLevel: assessment.riskLevel ?? null,
      confidence: assessment.confidence ?? null,
    },
    scores: category,
    aiAnalysis: {
      deceptionLikelihood: assessment.likelihood,
      bluf: assessment.bluf ?? null,
    },
    subScores: assessment.scores ?? null,
    motives: Array.isArray(assessment.motives) ? assessment.motives.slice(0, 5) : [],
    popExamples: Array.isArray(assessment.popExamples) ? assessment.popExamples.slice(0, 8) : [],
    actors: Array.isArray(assessment.actors) ? assessment.actors.slice(0, 10) : [],
    source_url: url,
    _bot_source: 'signal-bot',
    _bot_user_hint: sourceUserHint,
  }

  const nowIso = new Date().toISOString()
  let frameworkId: number | null = null
  try {
    const result = (await env.DB.prepare(
      `INSERT INTO framework_sessions
        (user_id, title, description, framework_type, status, data, is_public,
         workspace_id, original_workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, 'deception', 'draft', ?, 1, '1', '1', ?, ?)
       RETURNING id`,
    )
      .bind(
        systemUserId,
        `Deception: ${title}`.slice(0, 500),
        `Community deception assessment (signal-bot) — ${url}`.slice(0, 2000),
        JSON.stringify(frameworkData),
        nowIso,
        nowIso,
      )
      .first()) as { id: number } | null
    frameworkId = result?.id ? Number(result.id) : null
  } catch (error) {
    console.error('[deception/intake] framework_sessions INSERT failed:', error)
    return new Response(JSON.stringify({ error: 'Failed to persist assessment' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
  if (!frameworkId) {
    return new Response(JSON.stringify({ error: 'Insert returned no id' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }

  console.log(
    `[deception/intake] stored framework_sessions.id=${frameworkId} likelihood=${assessment.likelihood}` +
      (sourceUserHint ? ` hint="${sourceUserHint}"` : ''),
  )

  const origin = request.headers.get('origin') || 'https://researchtools.net'
  const viewUrl = `${origin}/dashboard/analysis-frameworks/deception/${frameworkId}/view`

  return new Response(
    JSON.stringify({ id: String(frameworkId), view_url: viewUrl, framework_type: 'deception' }),
    { status: 201, headers: JSON_HEADERS },
  )
}
