/**
 * Social Media Profile Detail
 *
 * GET /api/social-media/profiles/:id — Get single profile with post count
 * DELETE /api/social-media/profiles/:id — Delete profile
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
  const profileId = params.id as string

  try {
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    const profile = await env.DB.prepare(
      'SELECT * FROM social_media_profiles WHERE id = ? AND created_by = ?'
    ).bind(profileId, userId).first()

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404, headers: JSON_HEADERS,
      })
    }

    const postCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM social_media_posts WHERE profile_id = ?'
    ).bind(profileId).first()

    return new Response(JSON.stringify({
      ...profile,
      platform_data: safeJsonParse(profile.platform_data, null),
      tags: safeJsonParse(profile.tags, null),
      verified: Boolean(profile.verified),
      is_active: Boolean(profile.is_active),
      scraped_posts_count: (postCount?.count as number) || 0,
    }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/profiles/id] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const profileId = params.id as string

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

    await env.DB.prepare(
      'DELETE FROM social_media_profiles WHERE id = ? AND created_by = ?'
    ).bind(profileId, userId).run()

    return new Response(JSON.stringify({ message: 'Profile deleted successfully' }), {
      headers: JSON_HEADERS,
    })
  } catch (error) {
    console.error('[social-media/profiles/id] DELETE error:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete profile' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
