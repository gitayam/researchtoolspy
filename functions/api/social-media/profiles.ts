import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault, getUserFromRequest } from '../_shared/auth-helpers'
import { generateId, JSON_HEADERS } from '../_shared/api-utils'
import { safeJsonParse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

/**
 * GET /api/social-media/profiles?platform=...&workspace_id=...
 * List social media profiles for the authenticated user.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const userId = await getUserIdOrDefault(request, env)
    const url = new URL(request.url)
    const platform = url.searchParams.get('platform')
    const workspaceId = url.searchParams.get('workspace_id')

    let query = 'SELECT * FROM social_media_profiles WHERE created_by = ?'
    const params: any[] = [userId]

    if (platform) {
      query += ' AND platform = ?'
      params.push(platform)
    }
    if (workspaceId) {
      query += ' AND workspace_id = ?'
      params.push(workspaceId)
    }
    query += ' ORDER BY last_scraped_at DESC, created_at DESC LIMIT 200'

    const { results } = await env.DB.prepare(query).bind(...params).all()

    const profiles = results.map((p: any) => ({
      ...p,
      platform_data: safeJsonParse(p.platform_data, null),
      tags: safeJsonParse(p.tags, null),
      verified: Boolean(p.verified),
      is_active: Boolean(p.is_active),
    }))

    return new Response(JSON.stringify(profiles), { headers: JSON_HEADERS })
  } catch (err: any) {
    console.error('[social-media/profiles] GET error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch profiles' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}

/**
 * POST /api/social-media/profiles
 * Create or update a social media profile. Requires authentication.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const authUserId = await getUserFromRequest(request, env)
    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: JSON_HEADERS }
      )
    }

    const userId = await getUserIdOrDefault(request, env)

    let body: any
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: JSON_HEADERS }
      )
    }

    if (!body.platform || !body.username) {
      return new Response(
        JSON.stringify({ error: 'platform and username are required' }),
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const now = new Date().toISOString()

    // Check if profile already exists for this platform + username
    const existing = await env.DB.prepare(
      'SELECT id, created_by FROM social_media_profiles WHERE platform = ? AND username = ?'
    ).bind(body.platform, body.username).first<{ id: string; created_by: any }>()

    if (existing) {
      // Update existing profile - verify ownership
      if (String(existing.created_by) !== String(userId)) {
        return new Response(
          JSON.stringify({ error: 'You do not own this profile' }),
          { status: 403, headers: JSON_HEADERS }
        )
      }

      await env.DB.prepare(`
        UPDATE social_media_profiles SET
          display_name = ?,
          profile_url = ?,
          bio = ?,
          profile_pic_url = ?,
          followers_count = ?,
          following_count = ?,
          posts_count = ?,
          verified = ?,
          platform_data = ?,
          tags = ?,
          category = ?,
          workspace_id = ?,
          updated_at = ?,
          last_scraped_at = ?,
          is_active = ?,
          scrape_frequency = ?
        WHERE id = ?
      `).bind(
        body.display_name || null,
        body.profile_url || `https://${body.platform.toLowerCase()}.com/${body.username}`,
        body.bio || null,
        body.profile_pic_url || null,
        body.followers_count ?? null,
        body.following_count ?? null,
        body.posts_count ?? null,
        body.verified ? 1 : 0,
        body.platform_data ? JSON.stringify(body.platform_data) : null,
        body.tags ? JSON.stringify(body.tags) : null,
        body.category || null,
        body.workspace_id || null,
        now,
        body.last_scraped_at || null,
        body.is_active !== false ? 1 : 0,
        body.scrape_frequency || null,
        existing.id
      ).run()

      // Fetch and return the updated profile
      const updated = await env.DB.prepare(
        'SELECT * FROM social_media_profiles WHERE id = ?'
      ).bind(existing.id).first()

      const profile = updated ? {
        ...updated,
        platform_data: safeJsonParse((updated as any).platform_data, null),
        tags: safeJsonParse((updated as any).tags, null),
        verified: Boolean((updated as any).verified),
        is_active: Boolean((updated as any).is_active),
      } : null

      return new Response(JSON.stringify(profile), { headers: JSON_HEADERS })
    }

    // Create new profile
    const id = generateId()
    const profileUrl = body.profile_url || `https://${body.platform.toLowerCase()}.com/${body.username}`

    await env.DB.prepare(`
      INSERT INTO social_media_profiles (
        id, platform, username, display_name, profile_url, bio, profile_pic_url,
        followers_count, following_count, posts_count, verified, platform_data,
        tags, category, workspace_id, created_by, created_at, updated_at,
        last_scraped_at, is_active, scrape_frequency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.platform,
      body.username,
      body.display_name || null,
      profileUrl,
      body.bio || null,
      body.profile_pic_url || null,
      body.followers_count ?? null,
      body.following_count ?? null,
      body.posts_count ?? null,
      body.verified ? 1 : 0,
      body.platform_data ? JSON.stringify(body.platform_data) : null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.category || null,
      body.workspace_id || null,
      userId,
      now,
      now,
      body.last_scraped_at || null,
      body.is_active !== false ? 1 : 0,
      body.scrape_frequency || null
    ).run()

    // Fetch and return the created profile
    const created = await env.DB.prepare(
      'SELECT * FROM social_media_profiles WHERE id = ?'
    ).bind(id).first()

    const profile = created ? {
      ...created,
      platform_data: safeJsonParse((created as any).platform_data, null),
      tags: safeJsonParse((created as any).tags, null),
      verified: Boolean((created as any).verified),
      is_active: Boolean((created as any).is_active),
    } : null

    return new Response(JSON.stringify(profile), { status: 201, headers: JSON_HEADERS })
  } catch (err: any) {
    console.error('[social-media/profiles] POST error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to save profile' }),
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
