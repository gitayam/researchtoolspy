import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { generateId, JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * GET /api/social-media/jobs?status=...&platform=...
 * List scraping jobs for the authenticated user.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const platform = url.searchParams.get('platform')

    let query = 'SELECT * FROM social_media_jobs WHERE created_by = ?'
    const params: any[] = [userId]

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }
    if (platform) {
      query += ' AND platform = ?'
      params.push(platform)
    }

    query += ' ORDER BY created_at DESC LIMIT 100'

    const { results } = await env.DB.prepare(query).bind(...params).all()
    const jobs = results.map((j: any) => ({
      ...j,
      config: safeJsonParse(j.config, {}),
    }))

    return new Response(JSON.stringify(jobs), { headers: JSON_HEADERS })
  } catch (err: any) {
    console.error('[social-media/jobs] GET error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to list jobs' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

/**
 * POST /api/social-media/jobs
 * Create a new scraping job. Requires authentication.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: JSON_HEADERS }
      )
    }

    if (!body.job_type || !body.platform) {
      return new Response(
        JSON.stringify({ error: 'job_type and platform are required' }),
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const id = generateId()
    const now = new Date().toISOString()
    const config = body.config ? JSON.stringify(body.config) : '{}'

    await env.DB.prepare(`
      INSERT INTO social_media_jobs (
        id, job_type, platform, target_url, target_username,
        search_query, config, status, progress,
        workspace_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?, ?)
    `).bind(
      id,
      body.job_type,
      body.platform,
      body.target_url || null,
      body.target_username || null,
      body.search_query || null,
      config,
      body.workspace_id || null,
      userId,
      now
    ).run()

    const job = {
      id,
      job_type: body.job_type,
      platform: body.platform,
      target_url: body.target_url || null,
      target_username: body.target_username || null,
      search_query: body.search_query || null,
      config: safeJsonParse(config, {}),
      status: 'PENDING',
      progress: 0,
      workspace_id: body.workspace_id || null,
      created_by: userId,
      created_at: now,
    }

    return new Response(
      JSON.stringify({
        ...job,
        message: 'Job created. Note: Actual scraping requires external tools (instaloader, yt-dlp, etc.) to be configured.',
      }),
      { status: 201, headers: JSON_HEADERS }
    )
  } catch (err: any) {
    console.error('[social-media/jobs] POST error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to create job' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
