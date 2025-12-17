/**
 * Social Media Intelligence API
 * Comprehensive social media scraping and analysis
 * Supports: Instagram, YouTube, Twitter/X, TikTok, Facebook, LinkedIn
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session
async function getUserFromRequest(request: Request, env: Env): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const sessionData = await env.SESSIONS.get(token)

  if (!sessionData) {
    return null
  }

  const session = JSON.parse(sessionData)
  return session.user_id
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

// Parse JSON fields safely
function parseJSON(field: any): any {
  if (!field) return null
  if (typeof field === 'string') {
    try {
      return JSON.parse(field)
    } catch {
      return null
    }
  }
  return field
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // PROFILES
    // ============================================================

    // GET /api/social-media/profiles?platform=xxx
    if (method === 'GET' && url.pathname === '/api/social-media/profiles') {
      const platform = url.searchParams.get('platform')
      const workspaceId = url.searchParams.get('workspace_id')

      let query = `SELECT * FROM social_media_profiles WHERE created_by = ?`
      const params: any[] = [userId]

      if (platform) {
        query += ` AND platform = ?`
        params.push(platform)
      }

      if (workspaceId) {
        query += ` AND workspace_id = ?`
        params.push(workspaceId)
      }

      query += ` ORDER BY last_scraped_at DESC, created_at DESC`

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const profiles = results.map(p => ({
        ...p,
        platform_data: parseJSON(p.platform_data),
        tags: parseJSON(p.tags),
        verified: Boolean(p.verified),
        is_active: Boolean(p.is_active)
      }))

      return new Response(
        JSON.stringify(profiles),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/social-media/profiles - Create/update profile
    if (method === 'POST' && url.pathname === '/api/social-media/profiles') {
      const body = await request.json() as any

      if (!body.platform || !body.username) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: platform, username' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if profile exists
      const existing = await env.DB.prepare(`
        SELECT id FROM social_media_profiles
        WHERE platform = ? AND username = ?
      `).bind(body.platform, body.username).first()

      const id = existing?.id || generateId()
      const now = new Date().toISOString()

      if (existing) {
        // Update existing profile
        await env.DB.prepare(`
          UPDATE social_media_profiles
          SET display_name = ?,
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
          body.followers_count || 0,
          body.following_count || 0,
          body.posts_count || 0,
          body.verified ? 1 : 0,
          body.platform_data ? JSON.stringify(body.platform_data) : null,
          body.tags ? JSON.stringify(body.tags) : null,
          body.category || null,
          body.workspace_id || null,
          now,
          now,
          body.is_active !== false ? 1 : 0,
          body.scrape_frequency || 'MANUAL',
          id
        ).run()
      } else {
        // Create new profile
        await env.DB.prepare(`
          INSERT INTO social_media_profiles (
            id, platform, username, display_name, profile_url, bio,
            profile_pic_url, followers_count, following_count, posts_count,
            verified, platform_data, tags, category,
            workspace_id, created_by, created_at, updated_at,
            last_scraped_at, is_active, scrape_frequency
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          body.platform,
          body.username,
          body.display_name || null,
          body.profile_url || `https://${body.platform.toLowerCase()}.com/${body.username}`,
          body.bio || null,
          body.profile_pic_url || null,
          body.followers_count || 0,
          body.following_count || 0,
          body.posts_count || 0,
          body.verified ? 1 : 0,
          body.platform_data ? JSON.stringify(body.platform_data) : null,
          body.tags ? JSON.stringify(body.tags) : null,
          body.category || null,
          body.workspace_id || null,
          userId,
          now,
          now,
          now,
          body.is_active !== false ? 1 : 0,
          body.scrape_frequency || 'MANUAL'
        ).run()
      }

      const profile = await env.DB.prepare(`
        SELECT * FROM social_media_profiles WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...profile,
          platform_data: parseJSON(profile.platform_data),
          tags: parseJSON(profile.tags),
          verified: Boolean(profile.verified),
          is_active: Boolean(profile.is_active)
        }),
        { status: existing ? 200 : 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/social-media/profiles/:id
    const profileMatch = url.pathname.match(/^\/api\/social-media\/profiles\/([^\/]+)$/)
    if (method === 'GET' && profileMatch) {
      const profileId = profileMatch[1]

      const profile = await env.DB.prepare(`
        SELECT * FROM social_media_profiles WHERE id = ?
      `).bind(profileId).first()

      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get post count
      const { results: postCount } = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM social_media_posts WHERE profile_id = ?
      `).bind(profileId).all()

      return new Response(
        JSON.stringify({
          ...profile,
          platform_data: parseJSON(profile.platform_data),
          tags: parseJSON(profile.tags),
          verified: Boolean(profile.verified),
          is_active: Boolean(profile.is_active),
          scraped_posts_count: postCount[0]?.count || 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /api/social-media/profiles/:id
    if (method === 'DELETE' && profileMatch) {
      const profileId = profileMatch[1]

      await env.DB.prepare(`
        DELETE FROM social_media_profiles WHERE id = ? AND created_by = ?
      `).bind(profileId, userId).run()

      return new Response(
        JSON.stringify({ message: 'Profile deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // POSTS
    // ============================================================

    // GET /api/social-media/posts?profile_id=xxx
    if (method === 'GET' && url.pathname === '/api/social-media/posts') {
      const profileId = url.searchParams.get('profile_id')
      const platform = url.searchParams.get('platform')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = `SELECT * FROM social_media_posts WHERE created_by = ?`
      const params: any[] = [userId]

      if (profileId) {
        query += ` AND profile_id = ?`
        params.push(profileId)
      }

      if (platform) {
        query += ` AND platform = ?`
        params.push(platform)
      }

      query += ` ORDER BY posted_at DESC, scraped_at DESC LIMIT ?`
      params.push(limit)

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const posts = results.map(p => ({
        ...p,
        media_urls: parseJSON(p.media_urls),
        platform_data: parseJSON(p.platform_data),
        topics: parseJSON(p.topics),
        entities: parseJSON(p.entities),
        media_downloaded: Boolean(p.media_downloaded)
      }))

      return new Response(
        JSON.stringify(posts),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/social-media/posts - Create post
    if (method === 'POST' && url.pathname === '/api/social-media/posts') {
      const body = await request.json() as any

      if (!body.profile_id || !body.platform || !body.post_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: profile_id, platform, post_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if post exists
      const existing = await env.DB.prepare(`
        SELECT id FROM social_media_posts
        WHERE platform = ? AND post_id = ?
      `).bind(body.platform, body.post_id).first()

      const id = existing?.id || generateId()
      const now = new Date().toISOString()

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
          WHERE id = ?
        `).bind(
          body.caption || null,
          body.content || null,
          body.media_urls ? JSON.stringify(body.media_urls) : null,
          body.thumbnail_url || null,
          body.likes_count || 0,
          body.comments_count || 0,
          body.shares_count || 0,
          body.views_count || 0,
          body.posted_at || now,
          body.platform_data ? JSON.stringify(body.platform_data) : null,
          body.sentiment_score || null,
          body.topics ? JSON.stringify(body.topics) : null,
          body.entities ? JSON.stringify(body.entities) : null,
          id
        ).run()
      } else {
        // Create new post
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
          body.profile_id,
          body.platform,
          body.post_url || '',
          body.post_id,
          body.post_type || null,
          body.caption || null,
          body.content || null,
          body.media_urls ? JSON.stringify(body.media_urls) : null,
          body.thumbnail_url || null,
          body.likes_count || 0,
          body.comments_count || 0,
          body.shares_count || 0,
          body.views_count || 0,
          body.posted_at || now,
          now,
          body.platform_data ? JSON.stringify(body.platform_data) : null,
          body.sentiment_score || null,
          body.topics ? JSON.stringify(body.topics) : null,
          body.entities ? JSON.stringify(body.entities) : null,
          0,
          null,
          body.workspace_id || null,
          userId,
          now
        ).run()
      }

      const post = await env.DB.prepare(`
        SELECT * FROM social_media_posts WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...post,
          media_urls: parseJSON(post.media_urls),
          platform_data: parseJSON(post.platform_data),
          topics: parseJSON(post.topics),
          entities: parseJSON(post.entities),
          media_downloaded: Boolean(post.media_downloaded)
        }),
        { status: existing ? 200 : 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // JOBS
    // ============================================================

    // GET /api/social-media/jobs
    if (method === 'GET' && url.pathname === '/api/social-media/jobs') {
      const status = url.searchParams.get('status')
      const platform = url.searchParams.get('platform')

      let query = `SELECT * FROM social_media_jobs WHERE created_by = ?`
      const params: any[] = [userId]

      if (status) {
        query += ` AND status = ?`
        params.push(status)
      }

      if (platform) {
        query += ` AND platform = ?`
        params.push(platform)
      }

      query += ` ORDER BY created_at DESC LIMIT 100`

      const { results } = await env.DB.prepare(query).bind(...params).all()

      const jobs = results.map(j => ({
        ...j,
        config: parseJSON(j.config)
      }))

      return new Response(
        JSON.stringify(jobs),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST /api/social-media/jobs - Create scraping job
    if (method === 'POST' && url.pathname === '/api/social-media/jobs') {
      const body = await request.json() as any

      if (!body.job_type || !body.platform) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: job_type, platform' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const id = generateId()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT INTO social_media_jobs (
          id, job_type, platform, target_url, target_username, search_query,
          config, status, progress, workspace_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        body.job_type,
        body.platform,
        body.target_url || null,
        body.target_username || null,
        body.search_query || null,
        body.config ? JSON.stringify(body.config) : JSON.stringify({}),
        'PENDING',
        0,
        body.workspace_id || null,
        userId,
        now
      ).run()

      const job = await env.DB.prepare(`
        SELECT * FROM social_media_jobs WHERE id = ?
      `).bind(id).first()

      return new Response(
        JSON.stringify({
          ...job,
          config: parseJSON(job.config),
          message: 'Job created. Note: Actual scraping requires external tools (instaloader, yt-dlp, etc.) to be configured.'
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/social-media/jobs/:id
    const jobMatch = url.pathname.match(/^\/api\/social-media\/jobs\/([^\/]+)$/)
    if (method === 'GET' && jobMatch) {
      const jobId = jobMatch[1]

      const job = await env.DB.prepare(`
        SELECT * FROM social_media_jobs WHERE id = ?
      `).bind(jobId).first()

      if (!job) {
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          ...job,
          config: parseJSON(job.config)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT /api/social-media/jobs/:id - Update job status
    if (method === 'PUT' && jobMatch) {
      const jobId = jobMatch[1]
      const body = await request.json() as any

      const now = new Date().toISOString()

      await env.DB.prepare(`
        UPDATE social_media_jobs
        SET status = ?,
            progress = ?,
            items_found = ?,
            items_processed = ?,
            error_message = ?,
            started_at = ?,
            completed_at = ?
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

      const job = await env.DB.prepare(`
        SELECT * FROM social_media_jobs WHERE id = ?
      `).bind(jobId).first()

      return new Response(
        JSON.stringify({
          ...job,
          config: parseJSON(job.config)
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // ANALYTICS
    // ============================================================

    // GET /api/social-media/analytics/profile/:profileId
    const analyticsMatch = url.pathname.match(/^\/api\/social-media\/analytics\/profile\/([^\/]+)$/)
    if (method === 'GET' && analyticsMatch) {
      const profileId = analyticsMatch[1]

      // Get aggregated statistics from posts
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_posts,
          SUM(likes_count) as total_likes,
          SUM(comments_count) as total_comments,
          SUM(shares_count) as total_shares,
          SUM(views_count) as total_views,
          AVG(sentiment_score) as avg_sentiment,
          MIN(posted_at) as first_post,
          MAX(posted_at) as last_post
        FROM social_media_posts
        WHERE profile_id = ?
      `).bind(profileId).first()

      // Get top posts
      const { results: topPosts } = await env.DB.prepare(`
        SELECT * FROM social_media_posts
        WHERE profile_id = ?
        ORDER BY likes_count DESC
        LIMIT 10
      `).bind(profileId).all()

      return new Response(
        JSON.stringify({
          profile_id: profileId,
          stats: stats || {},
          top_posts: topPosts.map(p => ({
            ...p,
            media_urls: parseJSON(p.media_urls),
            platform_data: parseJSON(p.platform_data)
          }))
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /api/social-media/stats - Overall statistics
    if (method === 'GET' && url.pathname === '/api/social-media/stats') {
      const profileCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM social_media_profiles WHERE created_by = ?
      `).bind(userId).first()

      const postCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM social_media_posts WHERE created_by = ?
      `).bind(userId).first()

      const jobStats = await env.DB.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM social_media_jobs
        WHERE created_by = ?
        GROUP BY status
      `).bind(userId).all()

      return new Response(
        JSON.stringify({
          profiles: profileCount?.count || 0,
          posts: postCount?.count || 0,
          jobs_by_status: jobStats.results || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Social Media API error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
