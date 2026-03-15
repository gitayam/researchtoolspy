import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env { DB: D1Database; SESSIONS?: KVNamespace }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  try {
    const userId = await getUserIdOrDefault(request, env)

    const [profileCount, postCount, jobStats] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM social_media_profiles WHERE created_by = ?').bind(userId).first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM social_media_posts WHERE created_by = ?').bind(userId).first(),
      env.DB.prepare('SELECT status, COUNT(*) as count FROM social_media_jobs WHERE created_by = ? GROUP BY status').bind(userId).all(),
    ])

    return new Response(JSON.stringify({
      profiles: (profileCount?.count as number) || 0,
      posts: (postCount?.count as number) || 0,
      jobs_by_status: jobStats.results || []
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/stats] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use GET.' }), { status: 405, headers: JSON_HEADERS })
}
