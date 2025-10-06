/**
 * Saved Links Library - CRUD Operations
 *
 * Endpoints:
 * - GET    /saved-links       - List all saved links with search/filter
 * - GET    /saved-links/:id   - Get single saved link
 * - POST   /saved-links       - Save a new link (with or without analysis)
 * - PUT    /saved-links/:id   - Update link note/tags/reminder
 * - DELETE /saved-links/:id   - Delete saved link
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

// ========================================
// GET - List all saved links
// ========================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const url = new URL(request.url)

  // If ID provided, get single link
  if (params.id) {
    return getSingleLink(env.DB, Number(params.id))
  }

  // Otherwise list with filters
  const search = url.searchParams.get('search') || ''
  const tags = url.searchParams.get('tags')?.split(',').filter(Boolean) || []
  const page = Number(url.searchParams.get('page')) || 1
  const limit = Number(url.searchParams.get('limit')) || 50
  const offset = (page - 1) * limit
  const upcoming_reminders = url.searchParams.get('upcoming_reminders') === 'true'

  try {
    let query = `
      SELECT
        sl.*,
        ca.id as analysis_id,
        ca.title as analysis_title,
        ca.summary as analysis_summary
      FROM saved_links sl
      LEFT JOIN content_analysis ca ON sl.analysis_id = ca.id
      WHERE sl.user_id = ?
    `
    const bindings: any[] = [1] // TODO: Get actual user_id from auth

    // Search filter
    if (search) {
      query += ` AND (sl.url LIKE ? OR sl.title LIKE ? OR sl.note LIKE ?)`
      const searchPattern = `%${search}%`
      bindings.push(searchPattern, searchPattern, searchPattern)
    }

    // Tags filter
    if (tags.length > 0) {
      const tagConditions = tags.map(() => `sl.tags LIKE ?`).join(' OR ')
      query += ` AND (${tagConditions})`
      tags.forEach(tag => bindings.push(`%"${tag}"%`))
    }

    // Upcoming reminders filter
    if (upcoming_reminders) {
      query += ` AND sl.reminder_date IS NOT NULL AND sl.reminder_date >= datetime('now')`
    }

    // Count total
    const countQuery = query.replace('SELECT sl.*', 'SELECT COUNT(*) as total')
    const countResult = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>()
    const total = countResult?.total || 0

    // Get paginated results
    query += ` ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`
    bindings.push(limit, offset)

    const results = await env.DB.prepare(query).bind(...bindings).all()

    // Parse JSON fields
    const links = results.results?.map(row => ({
      ...row,
      tags: JSON.parse(row.tags as string || '[]'),
      is_social_media: Boolean(row.is_social_media),
      is_processed: Boolean(row.is_processed)
    })) || []

    return new Response(JSON.stringify({
      links,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Saved Links] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve saved links',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// POST - Create new saved link
// ========================================
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    const body = await request.json() as {
      url: string
      title?: string
      note?: string
      tags?: string[]
      reminder_date?: string
      auto_analyze?: boolean
    }

    const { url, title, note, tags = [], reminder_date, auto_analyze = false } = body

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Extract domain
    const domain = new URL(url).hostname

    // Detect social media
    const socialInfo = detectSocialMedia(url)

    // Check if link already saved
    const existing = await env.DB.prepare(`
      SELECT id FROM saved_links WHERE user_id = ? AND url = ?
    `).bind(1, url).first() // TODO: Get actual user_id

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Link already saved',
        existing_id: existing.id
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Insert saved link
    const result = await env.DB.prepare(`
      INSERT INTO saved_links (
        user_id, url, title, note, tags, reminder_date, domain,
        is_social_media, social_platform, is_processed, analysis_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      1, // TODO: Get actual user_id
      url,
      title || null,
      note || null,
      JSON.stringify(tags),
      reminder_date || null,
      domain,
      socialInfo ? 1 : 0,
      socialInfo?.platform || null,
      0, // Not processed yet
      null // No analysis yet
    ).run()

    const linkId = result.meta.last_row_id as number

    // If auto_analyze requested, trigger analysis
    let analysisId: number | undefined
    if (auto_analyze) {
      // Call analyze-url endpoint internally
      const analyzeResponse = await fetch(`${new URL(request.url).origin}/api/content-intelligence/analyze-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'full' })
      })

      if (analyzeResponse.ok) {
        const analysisData = await analyzeResponse.json()
        analysisId = analysisData.id

        // Update saved link with analysis_id
        await env.DB.prepare(`
          UPDATE saved_links SET analysis_id = ?, is_processed = 1 WHERE id = ?
        `).bind(analysisId, linkId).run()
      }
    }

    // Fetch the created link
    const savedLink = await env.DB.prepare(`
      SELECT * FROM saved_links WHERE id = ?
    `).bind(linkId).first()

    return new Response(JSON.stringify({
      ...savedLink,
      tags: JSON.parse(savedLink.tags as string || '[]'),
      is_social_media: Boolean(savedLink.is_social_media),
      is_processed: Boolean(savedLink.is_processed),
      analysis_id: analysisId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Saved Links] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// PUT - Update saved link
// ========================================
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context

  if (!params.id) {
    return new Response(JSON.stringify({ error: 'Link ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await request.json() as {
      title?: string
      note?: string
      tags?: string[]
      reminder_date?: string | null
    }

    const { title, note, tags, reminder_date } = body
    const linkId = Number(params.id)

    // Build update query dynamically
    const updates: string[] = []
    const bindings: any[] = []

    if (title !== undefined) {
      updates.push('title = ?')
      bindings.push(title)
    }
    if (note !== undefined) {
      updates.push('note = ?')
      bindings.push(note)
    }
    if (tags !== undefined) {
      updates.push('tags = ?')
      bindings.push(JSON.stringify(tags))
    }
    if (reminder_date !== undefined) {
      updates.push('reminder_date = ?')
      bindings.push(reminder_date)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    bindings.push(linkId, 1) // TODO: Add actual user_id

    await env.DB.prepare(`
      UPDATE saved_links
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...bindings).run()

    // Fetch updated link
    const updated = await env.DB.prepare(`
      SELECT * FROM saved_links WHERE id = ? AND user_id = ?
    `).bind(linkId, 1).first() // TODO: actual user_id

    if (!updated) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      ...updated,
      tags: JSON.parse(updated.tags as string || '[]'),
      is_social_media: Boolean(updated.is_social_media),
      is_processed: Boolean(updated.is_processed)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Saved Links] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// DELETE - Remove saved link
// ========================================
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context

  if (!params.id) {
    return new Response(JSON.stringify({ error: 'Link ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const linkId = Number(params.id)

    const result = await env.DB.prepare(`
      DELETE FROM saved_links WHERE id = ? AND user_id = ?
    `).bind(linkId, 1).run() // TODO: actual user_id

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Saved Links] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Helper: Get single link
// ========================================
async function getSingleLink(db: D1Database, id: number) {
  try {
    const link = await db.prepare(`
      SELECT
        sl.*,
        ca.id as analysis_id,
        ca.title as analysis_title,
        ca.summary as analysis_summary,
        ca.entities as analysis_entities,
        ca.top_phrases as analysis_top_phrases
      FROM saved_links sl
      LEFT JOIN content_analysis ca ON sl.analysis_id = ca.id
      WHERE sl.id = ? AND sl.user_id = ?
    `).bind(id, 1).first() // TODO: actual user_id

    if (!link) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      ...link,
      tags: JSON.parse(link.tags as string || '[]'),
      is_social_media: Boolean(link.is_social_media),
      is_processed: Boolean(link.is_processed),
      analysis_entities: link.analysis_entities ? JSON.parse(link.analysis_entities as string) : null,
      analysis_top_phrases: link.analysis_top_phrases ? JSON.parse(link.analysis_top_phrases as string) : null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Saved Links] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve link',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ========================================
// Helper: Detect social media
// ========================================
function detectSocialMedia(url: string): { platform: string } | null {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return { platform: 'twitter' }
  }
  if (urlLower.includes('facebook.com')) {
    return { platform: 'facebook' }
  }
  if (urlLower.includes('instagram.com')) {
    return { platform: 'instagram' }
  }
  if (urlLower.includes('linkedin.com')) {
    return { platform: 'linkedin' }
  }
  if (urlLower.includes('tiktok.com')) {
    return { platform: 'tiktok' }
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { platform: 'youtube' }
  }
  if (urlLower.includes('reddit.com')) {
    return { platform: 'reddit' }
  }

  return null
}
