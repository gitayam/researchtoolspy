/**
 * Comments API
 * Threaded comments system for COG, ACH, and other framework entities
 * Supports @mentions, resolve/unresolve workflow, and collaboration
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

interface Comment {
  id: string
  entity_type: string
  entity_id: string
  parent_comment_id?: string
  thread_root_id?: string
  depth: number
  content: string
  content_html?: string
  user_id: string
  user_hash?: string
  created_at: string
  updated_at: string
  edited: boolean
  mentioned_users?: string[]
  status: 'open' | 'resolved' | 'deleted'
  resolved_at?: string
  resolved_by?: string
  workspace_id: number
  reactions?: Record<string, number>
}

// Helper to get user from session or hash
async function getUserFromRequest(request: Request, env: Env): Promise<{ userId?: string; userHash?: string }> {
  // Try bearer token first (authenticated users)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const sessionData = await env.SESSIONS.get(token)
    if (sessionData) {
      const session = JSON.parse(sessionData)
      return { userId: session.user_id?.toString() }
    }
  }

  // Fall back to hash-based (guest mode)
  const userHash = request.headers.get('X-User-Hash')
  if (userHash) {
    return { userHash }
  }

  return {}
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

// Simple markdown to HTML conversion (basic, can be enhanced)
function markdownToHtml(markdown: string): string {
  let html = markdown
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const method = request.method

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  }

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // GET /api/comments?entity_type=X&entity_id=Y
    // Fetch all comments for an entity
    if (method === 'GET') {
      const entityType = url.searchParams.get('entity_type')
      const entityId = url.searchParams.get('entity_id')
      const status = url.searchParams.get('status') || 'open' // Default to open comments
      const includeResolved = url.searchParams.get('include_resolved') === 'true'

      if (!entityType || !entityId) {
        return new Response(JSON.stringify({ error: 'entity_type and entity_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Build query based on status filter
      let query = `
        SELECT * FROM comments
        WHERE entity_type = ? AND entity_id = ?
      `
      const params: any[] = [entityType, entityId]

      if (!includeResolved) {
        query += ` AND status != 'deleted'`
        if (status !== 'all') {
          query += ` AND status = ?`
          params.push(status)
        }
      }

      query += ` ORDER BY created_at ASC`

      const { results } = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields
      const comments = results.map(comment => ({
        ...comment,
        mentioned_users: comment.mentioned_users ? JSON.parse(comment.mentioned_users as string) : [],
        reactions: comment.reactions ? JSON.parse(comment.reactions as string) : {}
      }))

      return new Response(JSON.stringify(comments), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // POST /api/comments
    // Create a new comment
    if (method === 'POST') {
      const { userId, userHash } = await getUserFromRequest(request, env)
      if (!userId && !userHash) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const body = await request.json() as Partial<Comment>
      const {
        entity_type,
        entity_id,
        parent_comment_id,
        content,
        workspace_id = 1
      } = body

      if (!entity_type || !entity_id || !content) {
        return new Response(JSON.stringify({ error: 'entity_type, entity_id, and content required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const commentId = generateId()
      const mentions = extractMentions(content)
      const contentHtml = markdownToHtml(content)

      // Determine depth and thread_root_id
      let depth = 0
      let threadRootId: string | null = null

      if (parent_comment_id) {
        const parent = await env.DB.prepare(`
          SELECT depth, thread_root_id FROM comments WHERE id = ?
        `).bind(parent_comment_id).first()

        if (parent) {
          depth = (parent.depth as number) + 1
          threadRootId = (parent.thread_root_id as string) || parent_comment_id
        }
      } else {
        threadRootId = commentId // Root comment is its own thread root
      }

      // Insert comment
      await env.DB.prepare(`
        INSERT INTO comments (
          id, entity_type, entity_id, parent_comment_id, thread_root_id, depth,
          content, content_html, user_id, user_hash, mentioned_users, workspace_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        commentId,
        entity_type,
        entity_id,
        parent_comment_id || null,
        threadRootId,
        depth,
        content,
        contentHtml,
        userId || 'guest',
        userHash || null,
        JSON.stringify(mentions),
        workspace_id
      ).run()

      // Create mention notifications
      if (mentions.length > 0) {
        for (const mentionedUsername of mentions) {
          const mentionId = generateId()
          await env.DB.prepare(`
            INSERT INTO comment_mentions (id, comment_id, mentioned_user_id, workspace_id)
            VALUES (?, ?, ?, ?)
          `).bind(mentionId, commentId, mentionedUsername, workspace_id).run()
        }
      }

      // Fetch created comment
      const created = await env.DB.prepare(`
        SELECT * FROM comments WHERE id = ?
      `).bind(commentId).first()

      const createdComment = {
        ...created,
        mentioned_users: mentions,
        reactions: {}
      }

      return new Response(JSON.stringify(createdComment), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // PATCH /api/comments/:id
    // Update a comment (edit content or resolve/unresolve)
    if (method === 'PATCH') {
      const pathParts = url.pathname.split('/')
      const commentId = pathParts[pathParts.length - 1]

      if (!commentId) {
        return new Response(JSON.stringify({ error: 'Comment ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { userId, userHash } = await getUserFromRequest(request, env)
      if (!userId && !userHash) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Verify ownership
      const existing = await env.DB.prepare(`
        SELECT * FROM comments WHERE id = ?
      `).bind(commentId).first()

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Comment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check ownership
      const isOwner = (userId && existing.user_id === userId) ||
                     (userHash && existing.user_hash === userHash)

      const body = await request.json() as any

      // Handle resolve/unresolve actions (anyone can resolve)
      if (body.action === 'resolve') {
        await env.DB.prepare(`
          UPDATE comments
          SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
          WHERE id = ?
        `).bind(userId || userHash, commentId).run()

        const updated = await env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(commentId).first()
        return new Response(JSON.stringify(updated), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (body.action === 'unresolve') {
        await env.DB.prepare(`
          UPDATE comments
          SET status = 'open', resolved_at = NULL, resolved_by = NULL
          WHERE id = ?
        `).bind(commentId).run()

        const updated = await env.DB.prepare(`SELECT * FROM comments WHERE id = ?`).bind(commentId).first()
        return new Response(JSON.stringify(updated), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Handle content edit (only owner)
      if (body.content) {
        if (!isOwner) {
          return new Response(JSON.stringify({ error: 'Only comment owner can edit' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        return new Response(JSON.stringify({
          ...updated,
          mentioned_users: mentions,
          reactions: updated.reactions ? JSON.parse(updated.reactions as string) : {}
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ error: 'No valid update provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // DELETE /api/comments/:id
    // Soft delete a comment
    if (method === 'DELETE') {
      const pathParts = url.pathname.split('/')
      const commentId = pathParts[pathParts.length - 1]

      if (!commentId) {
        return new Response(JSON.stringify({ error: 'Comment ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { userId, userHash } = await getUserFromRequest(request, env)
      if (!userId && !userHash) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Verify ownership
      const existing = await env.DB.prepare(`
        SELECT * FROM comments WHERE id = ?
      `).bind(commentId).first()

      if (!existing) {
        return new Response(JSON.stringify({ error: 'Comment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check ownership
      const isOwner = (userId && existing.user_id === userId) ||
                     (userHash && existing.user_hash === userHash)

      if (!isOwner) {
        return new Response(JSON.stringify({ error: 'Only comment owner can delete' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Soft delete
      await env.DB.prepare(`
        UPDATE comments SET status = 'deleted', content = '[deleted]' WHERE id = ?
      `).bind(commentId).run()

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[Comments API] Error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
