import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { generateId, JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'

interface Env { DB: D1Database; SESSIONS?: KVNamespace; JWT_SECRET?: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: JSON_HEADERS })
    }
    const url = new URL(request.url)
    const profileId = url.searchParams.get('profile_id')
    const platform = url.searchParams.get('platform')
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 500)

    let query = 'SELECT * FROM social_media_posts WHERE created_by = ?'
    const bindings: (string | number)[] = [userId]

    if (profileId) {
      query += ' AND profile_id = ?'
      bindings.push(profileId)
    }

    if (platform) {
      query += ' AND platform = ?'
      bindings.push(platform)
    }

    query += ' ORDER BY posted_at DESC LIMIT ?'
    bindings.push(limit)

    const result = await env.DB.prepare(query).bind(...bindings).all()

    const posts = (result.results || []).map((row: any) => ({
      ...row,
      media_urls: safeJsonParse(row.media_urls, []),
      platform_data: safeJsonParse(row.platform_data, {}),
      topics: safeJsonParse(row.topics, []),
      entities: safeJsonParse(row.entities, []),
      media_downloaded: Boolean(row.media_downloaded),
    }))

    return new Response(JSON.stringify({ posts, total: posts.length }), { headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/posts] GET error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch posts' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required. Please use a bookmark hash.' }), { status: 401, headers: JSON_HEADERS })
    }
    const body = await request.json() as any

    const { profile_id, platform, post_id } = body
    if (!profile_id || !platform || !post_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: profile_id, platform, post_id' }), { status: 400, headers: JSON_HEADERS })
    }

    const now = new Date().toISOString()

    // Check if post already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM social_media_posts WHERE platform = ? AND post_id = ?'
    ).bind(platform, post_id).first()

    if (existing) {
      // Update existing post
      await env.DB.prepare(`
        UPDATE social_media_posts
        SET caption = ?,
            content = ?,
            media_urls = ?,
            thumbnail_url = ?,
            likes_count = ?,
            comments_count = ?,
            shares_count = ?,
            views_count = ?,
            posted_at = ?,
            platform_data = ?,
            sentiment_score = ?,
            topics = ?,
            entities = ?
        WHERE id = ? AND created_by = ?
      `).bind(
        body.caption || null,
        body.content || null,
        body.media_urls ? JSON.stringify(body.media_urls) : null,
        body.thumbnail_url || null,
        body.likes_count ?? 0,
        body.comments_count ?? 0,
        body.shares_count ?? 0,
        body.views_count ?? 0,
        body.posted_at || null,
        body.platform_data ? JSON.stringify(body.platform_data) : null,
        body.sentiment_score ?? null,
        body.topics ? JSON.stringify(body.topics) : null,
        body.entities ? JSON.stringify(body.entities) : null,
        existing.id,
        userId,
      ).run()

      const updated = await env.DB.prepare(
        'SELECT * FROM social_media_posts WHERE id = ?'
      ).bind(existing.id).first()

      if (updated) {
        return new Response(JSON.stringify({
          ...updated,
          media_urls: safeJsonParse((updated as any).media_urls, []),
          platform_data: safeJsonParse((updated as any).platform_data, {}),
          topics: safeJsonParse((updated as any).topics, []),
          entities: safeJsonParse((updated as any).entities, []),
          media_downloaded: Boolean((updated as any).media_downloaded),
        }), { headers: JSON_HEADERS })
      }

      return new Response(JSON.stringify({ message: 'Post updated' }), { headers: JSON_HEADERS })
    }

    // Insert new post
    const id = generateId()
    await env.DB.prepare(`
      INSERT INTO social_media_posts (
        id, profile_id, platform, post_url, post_id, post_type,
        caption, content, media_urls, thumbnail_url,
        likes_count, comments_count, shares_count, views_count,
        posted_at, scraped_at, platform_data,
        sentiment_score, topics, entities,
        media_downloaded, media_local_path,
        workspace_id, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      profile_id,
      platform,
      body.post_url || null,
      post_id,
      body.post_type || null,
      body.caption || null,
      body.content || null,
      body.media_urls ? JSON.stringify(body.media_urls) : null,
      body.thumbnail_url || null,
      body.likes_count ?? 0,
      body.comments_count ?? 0,
      body.shares_count ?? 0,
      body.views_count ?? 0,
      body.posted_at || null,
      body.scraped_at || now,
      body.platform_data ? JSON.stringify(body.platform_data) : null,
      body.sentiment_score ?? null,
      body.topics ? JSON.stringify(body.topics) : null,
      body.entities ? JSON.stringify(body.entities) : null,
      0,
      null,
      body.workspace_id || null,
      userId,
      now,
    ).run()

    const created = await env.DB.prepare(
      'SELECT * FROM social_media_posts WHERE id = ?'
    ).bind(id).first()

    return new Response(JSON.stringify({
      ...(created || { id }),
      media_urls: safeJsonParse((created as any)?.media_urls, []),
      platform_data: safeJsonParse((created as any)?.platform_data, {}),
      topics: safeJsonParse((created as any)?.topics, []),
      entities: safeJsonParse((created as any)?.entities, []),
      media_downloaded: false,
    }), { status: 201, headers: JSON_HEADERS })
  } catch (error) {
    console.error('[social-media/posts] POST error:', error)
    return new Response(JSON.stringify({ error: 'Failed to create/update post' }), { status: 500, headers: JSON_HEADERS })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: JSON_HEADERS })
}
