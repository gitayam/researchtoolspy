/**
 * Social Media Job Detail
 *
 * GET /api/social-media/jobs/:id — Get single job
 * PUT /api/social-media/jobs/:id — Update job status/progress
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const jobId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const job = await env.DB.prepare(
      'SELECT * FROM social_media_jobs WHERE id = ? AND created_by = ?'
    ).bind(jobId, userId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...job,
      config: safeJsonParse(job.config, {}),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/jobs/id] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch job' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const jobId = params.id as string

  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const body = await request.json() as any

    await env.DB.prepare(`
      UPDATE social_media_jobs
      SET status = ?, progress = ?, items_found = ?, items_processed = ?,
          error_message = ?, started_at = ?, completed_at = ?
      WHERE id = ? AND created_by = ?
    `).bind(
      body.status || 'PENDING',
      body.progress || 0,
      body.items_found || 0,
      body.items_processed || 0,
      body.error_message || null,
      body.started_at || null,
      body.completed_at || null,
      jobId,
      userId
    ).run()

    const job = await env.DB.prepare(
      'SELECT * FROM social_media_jobs WHERE id = ?'
    ).bind(jobId).first()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({
      ...job,
      config: safeJsonParse(job.config, {}),
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/jobs/id] PUT error:', error)
    return new Response(JSON.stringify({ error: 'Failed to update job' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
