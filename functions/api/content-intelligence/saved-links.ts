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

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, safeJsonParse } from '../_shared/api-utils'
import { safeFetchText } from '../_shared/safe-fetch'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const TITLE_FETCH_TIMEOUT_MS = 10_000
const TITLE_FETCH_MAX_BYTES = 2 * 1024 * 1024
const INTERNAL_ANALYZE_TIMEOUT_MS = 30_000

interface AnalyzeUrlResponse {
  id: number
}

function isAnalyzeUrlResponse(value: unknown): value is AnalyzeUrlResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const id = (value as Record<string, unknown>).id
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
}

function internalAnalyzeHeaders(request: Request): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const name of ['Authorization', 'X-User-Hash', 'X-Workspace-ID']) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  return headers
}

// ========================================
// GET - List all saved links
// ========================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const url = new URL(request.url)
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }

  // If ID provided, get single link
  if (params.id) {
    return getSingleLink(env.DB, Number(params.id), userId)
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
        COALESCE(sl.title, ca.title, sl.domain) as title,
        ca.id as analysis_id,
        ca.title as analysis_title,
        ca.summary as analysis_summary
      FROM saved_links sl
      LEFT JOIN content_analysis ca ON sl.analysis_id = ca.id
      WHERE sl.user_id = ?
    `
    const bindings: unknown[] = [userId]

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
      tags: safeJsonParse(row.tags, []),
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
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Saved Links] List error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve saved links'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// ========================================
// POST - Create new saved link
// ========================================
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

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
        headers: JSON_HEADERS
      })
    }

    // Extract domain
    const domain = new URL(url).hostname

    // Detect social media
    const socialInfo = detectSocialMedia(url)

    // If no title provided, try to fetch it from the URL
    let finalTitle = title
    if (!finalTitle) {
      try {
        finalTitle = await fetchUrlTitle(url)
      } catch (error) {
        console.warn('[Saved Links] Failed to fetch title:', error)
        finalTitle = domain // Fallback to domain name
      }
    }

    // Check if link already saved
    const existing = await env.DB.prepare(`
      SELECT id FROM saved_links WHERE user_id = ? AND url = ?
    `).bind(userId, url).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Link already saved',
        existing_id: existing.id
      }), {
        status: 409,
        headers: JSON_HEADERS
      })
    }

    // Insert saved link
    const result = await env.DB.prepare(`
      INSERT INTO saved_links (
        user_id, url, title, note, tags, reminder_date, domain,
        is_social_media, social_platform, is_processed, analysis_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      url,
      finalTitle || null,
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
        redirect: 'error',
        headers: internalAnalyzeHeaders(request),
        body: JSON.stringify({ url, mode: 'full' }),
        signal: AbortSignal.timeout(INTERNAL_ANALYZE_TIMEOUT_MS),
      })

      if (analyzeResponse.ok) {
        const analysisData: unknown = await analyzeResponse.json()
        if (!isAnalyzeUrlResponse(analysisData)) {
          throw new Error('Analyze URL response did not contain a valid analysis id')
        }
        analysisId = analysisData.id

        // Update saved link with analysis_id
        await env.DB.prepare(`
          UPDATE saved_links SET analysis_id = ?, is_processed = 1 WHERE id = ?
        `).bind(analysisId, linkId).run()

        // A content_analysis referenced by a saved link must be kept permanently —
        // mark it saved and clear its expiry so retention cleanup never deletes it
        // (otherwise the saved link is orphaned and its cascade children are destroyed).
        if (analysisId) {
          await env.DB.prepare(`
            UPDATE content_analysis SET is_saved = TRUE, expires_at = NULL WHERE id = ?
          `).bind(analysisId).run()
        }
      }
    }

    // Fetch the created link
    const savedLink = await env.DB.prepare(`
      SELECT * FROM saved_links WHERE id = ?
    `).bind(linkId).first()

    return new Response(JSON.stringify({
      ...savedLink,
      tags: safeJsonParse(savedLink.tags, []),
      is_social_media: Boolean(savedLink.is_social_media),
      is_processed: Boolean(savedLink.is_processed),
      analysis_id: analysisId
    }), {
      status: 201,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Saved Links] Create error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to save link'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// ========================================
// PUT - Update saved link
// ========================================
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  if (!params.id) {
    return new Response(JSON.stringify({ error: 'Link ID required' }), {
      status: 400,
      headers: JSON_HEADERS
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
    const bindings: unknown[] = []

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
        headers: JSON_HEADERS
      })
    }

    bindings.push(linkId, userId)

    await env.DB.prepare(`
      UPDATE saved_links
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `).bind(...bindings).run()

    // Fetch updated link
    const updated = await env.DB.prepare(`
      SELECT * FROM saved_links WHERE id = ? AND user_id = ?
    `).bind(linkId, userId).first()

    if (!updated) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({
      ...updated,
      tags: safeJsonParse(updated.tags, []),
      is_social_media: Boolean(updated.is_social_media),
      is_processed: Boolean(updated.is_processed)
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Saved Links] Update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update link'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// ========================================
// DELETE - Remove saved link
// ========================================
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS,
    })
  }

  if (!params.id) {
    return new Response(JSON.stringify({ error: 'Link ID required' }), {
      status: 400,
      headers: JSON_HEADERS
    })
  }

  try {
    const linkId = Number(params.id)

    const result = await env.DB.prepare(`
      DELETE FROM saved_links WHERE id = ? AND user_id = ?
    `).bind(linkId, userId).run()

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Saved Links] Delete error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to delete link'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// ========================================
// Helper: Get single link
// ========================================
async function getSingleLink(db: D1Database, id: number, userId: number) {
  try {
    const link = await db.prepare(`
      SELECT
        sl.*,
        COALESCE(sl.title, ca.title, sl.domain) as title,
        ca.id as analysis_id,
        ca.title as analysis_title,
        ca.summary as analysis_summary,
        ca.entities as analysis_entities,
        ca.top_phrases as analysis_top_phrases
      FROM saved_links sl
      LEFT JOIN content_analysis ca ON sl.analysis_id = ca.id
      WHERE sl.id = ? AND sl.user_id = ?
    `).bind(id, userId).first()

    if (!link) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({
      ...link,
      tags: safeJsonParse(link.tags, []),
      is_social_media: Boolean(link.is_social_media),
      is_processed: Boolean(link.is_processed),
      analysis_entities: safeJsonParse(link.analysis_entities),
      analysis_top_phrases: safeJsonParse(link.analysis_top_phrases)
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Saved Links] Get error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to retrieve link'

    }), {
      status: 500,
      headers: JSON_HEADERS
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

// ========================================
// Helper: Fetch URL title from HTML
// ========================================
async function fetchUrlTitle(url: string): Promise<string | null> {
  try {
    const result = await safeFetchText(url, {
      timeoutMs: TITLE_FETCH_TIMEOUT_MS,
      maxRedirects: 5,
      maxResponseBytes: TITLE_FETCH_MAX_BYTES,
      allowedContentTypes: ['text/html'],
      requestInit: {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchToolsBot/1.0)',
        },
      },
    })

    if (!result.response.ok) {
      return null
    }
    const html = result.text

    // Try to extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }

    // Try Open Graph title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    if (ogTitleMatch && ogTitleMatch[1]) {
      return ogTitleMatch[1].trim()
    }

    // Try Twitter title
    const twitterTitleMatch = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)
    if (twitterTitleMatch && twitterTitleMatch[1]) {
      return twitterTitleMatch[1].trim()
    }

    return null
  } catch (error) {
    console.error('[fetchUrlTitle] Error:', error)
    return null
  }
}
