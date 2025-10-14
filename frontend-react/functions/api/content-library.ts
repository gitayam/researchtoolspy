/**
 * Content Library API
 * Fetches all analyzed content for a user/workspace
 */

import type { PagesFunction } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Workspace-ID, X-User-Hash, Authorization',
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    // Get authentication
    const workspaceId = request.headers.get('X-Workspace-ID') || '1'
    const userHash = request.headers.get('X-User-Hash')
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '')

    console.log(`[Content Library] workspace=${workspaceId}, userHash=${!!userHash}, authToken=${!!authToken}`)

    // Parse query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query based on auth method
    let query = `
      SELECT
        id, url, url_normalized, title, author, publish_date, domain,
        summary, word_count, key_entities, created_at, updated_at,
        last_accessed_at
      FROM content_intelligence
      WHERE 1=1
    `
    const params: any[] = []

    // Filter by workspace
    query += ` AND workspace_id = ?`
    params.push(workspaceId)

    // Filter by user authentication
    if (userHash && userHash !== 'guest') {
      query += ` AND user_hash = ?`
      params.push(userHash)
    } else if (authToken) {
      // TODO: Get user_id from session token
      query += ` AND user_id = ?`
      params.push(1) // Placeholder
    }

    // Order by most recently accessed
    query += ` ORDER BY last_accessed_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const results = await env.DB.prepare(query).bind(...params).all()

    const content = (results.results || []).map((row: any) => ({
      ...row,
      key_entities: row.key_entities ? JSON.parse(row.key_entities) : [],
      from_cache: false // Add cache indicator if needed
    }))

    return new Response(JSON.stringify({
      content,
      total: content.length,
      limit,
      offset
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('[Content Library] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to fetch content library',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    })
  }
}
