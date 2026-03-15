import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

// Simple markdown to HTML conversion (basic, can be enhanced)
function markdownToHtml(markdown: string): string {
  let html = markdown
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Links (sanitize URLs to only allow http:// and https://)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const sanitizedUrl = url.trim()
    if (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://')) {
      return `<a href="${sanitizedUrl}" target="_blank">${text}</a>`
    }
    return text // Strip the link if not http(s)
  })
  // Line breaks
  html = html.replace(/\n/g, '<br>')
  // @mentions highlighting
  html = html.replace(/@(\w+)/g, '<span class="mention">@$1</span>')
  return html
}

// Extract @mentions from content
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1])
  }
  return [...new Set(mentions)] // Deduplicate
}

/**
 * Shared handler for PATCH and PUT on /api/comments/:id
 * Supports: edit content, resolve, unresolve
 */
async function handlePatch(context: EventContext<Env, 'id', Record<string, unknown>>): Promise<Response> {
  const { request, env, params } = context
  const commentId = params.id as string

  if (!commentId) {
    return new Response(JSON.stringify({ error: 'Comment ID required' }), {
      status: 400,
      headers: JSON_HEADERS
    })
  }

  const userId = await getUserFromRequest(request, env)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: JSON_HEADERS
    })
  }

  // Verify ownership
  const existing = await env.DB.prepare(`
    SELECT * FROM comments WHERE id = ?
  `).bind(commentId).first()

  if (!existing) {
    return new Response(JSON.stringify({ error: 'Comment not found' }), {
      status: 404,
      headers: JSON_HEADERS
    })
  }

  // Check ownership
  const isOwner = String(existing.user_id) === String(userId)

  const body = await request.json() as any

  // Handle resolve/unresolve actions (anyone can resolve)
  if (body.action === 'resolve') {
    await env.DB.prepare(`
      UPDATE comments
      SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
      WHERE id = ?
    `).bind(userId.toString(), commentId).run()

    const updated = await env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(commentId).first()
    return new Response(JSON.stringify(updated || { id: commentId, status: 'resolved' }), {
      status: 200,
      headers: JSON_HEADERS
    })
  }

  if (body.action === 'unresolve') {
    await env.DB.prepare(`
      UPDATE comments
      SET status = 'open', resolved_at = NULL, resolved_by = NULL
      WHERE id = ?
    `).bind(commentId).run()

    const updated = await env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(commentId).first()
    return new Response(JSON.stringify(updated || { id: commentId, status: 'open' }), {
      status: 200,
      headers: JSON_HEADERS
    })
  }

  // Handle content edit (only owner)
  if (body.content) {
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Only comment owner can edit' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    const mentions = extractMentions(body.content)
    const contentHtml = markdownToHtml(body.content)

    await env.DB.prepare(`
      UPDATE comments
      SET content = ?, content_html = ?, mentioned_users = ?, edited = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(body.content, contentHtml, JSON.stringify(mentions), commentId).run()

    const updated = await env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(commentId).first()
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve updated comment' }), {
        status: 500, headers: JSON_HEADERS
      })
    }
    return new Response(JSON.stringify({
      ...updated,
      mentioned_users: mentions,
      reactions: (() => { try { return updated.reactions ? JSON.parse(updated.reactions as string) : {} } catch { return {} } })()
    }), {
      status: 200,
      headers: JSON_HEADERS
    })
  }

  return new Response(JSON.stringify({ error: 'No valid update provided' }), {
    status: 400,
    headers: JSON_HEADERS
  })
}

/**
 * PATCH /api/comments/:id
 * Update a comment (edit content or resolve/unresolve)
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') return optionsResponse()
  try {
    return await handlePatch(context)
  } catch (error: any) {
    console.error('[Comments API] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * PUT /api/comments/:id
 * Delegates to PATCH logic (frontend uses both methods)
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') return optionsResponse()
  try {
    return await handlePatch(context)
  } catch (error: any) {
    console.error('[Comments API] PUT error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * DELETE /api/comments/:id
 * Soft delete a comment (sets status to 'deleted', replaces content)
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  if (context.request.method === 'OPTIONS') return optionsResponse()

  try {
    const { request, env, params } = context
    const commentId = params.id as string

    if (!commentId) {
      return new Response(JSON.stringify({ error: 'Comment ID required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS
      })
    }

    // Verify ownership
    const existing = await env.DB.prepare(`
      SELECT * FROM comments WHERE id = ?
    `).bind(commentId).first()

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // Check ownership
    const isOwner = String(existing.user_id) === String(userId)

    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Only comment owner can delete' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Soft delete
    const deleteResult = await env.DB.prepare(`
      UPDATE comments SET status = 'deleted', content = '[deleted]' WHERE id = ?
    `).bind(commentId).run()

    if (!deleteResult.meta.changes) {
      return new Response(JSON.stringify({ error: 'Comment not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: JSON_HEADERS
    })
  } catch (error: any) {
    console.error('[Comments API] DELETE error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

/**
 * OPTIONS /api/comments/:id
 * CORS preflight
 */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
