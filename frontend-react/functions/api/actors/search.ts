/**
 * Search Actors API
 * GET /api/actors/search?workspace_id={id}&name={name}&type={type}
 * Returns actors matching search criteria for duplicate detection
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash'
  }

  try {
    const userId = await getUserIdOrDefault(context.request, context.env)
    const url = new URL(context.request.url)

    const workspaceId = url.searchParams.get('workspace_id') || '1'
    const name = url.searchParams.get('name')
    const type = url.searchParams.get('type')

    console.log('[Actor Search] Request:', { workspaceId, name, type, userId })

    if (!name) {
      return new Response(JSON.stringify({
        error: 'name parameter is required'
      }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Search for exact match first
    let query = `
      SELECT
        a.id,
        a.name,
        a.actor_type,
        a.description,
        a.created_at
      FROM actors a
      WHERE a.workspace_id = ?
        AND LOWER(a.name) = LOWER(?)
    `

    const params: (string | number)[] = [workspaceId, name]

    // Add type filter if specified
    if (type) {
      query += ` AND a.actor_type = ?`
      params.push(type)
    }

    query += ` LIMIT 1`

    console.log('[Actor Search] Executing query with params:', params)

    const result = await context.env.DB.prepare(query).bind(...params).first()

    console.log('[Actor Search] Result:', result ? 'Found' : 'Not found')

    if (result) {
      // Exact match found
      return new Response(JSON.stringify({
        exists: true,
        actor: {
          id: result.id,
          name: result.name,
          type: result.actor_type,
          description: result.description,
          created_at: result.created_at
        }
      }), {
        headers: corsHeaders
      })
    }

    // No exact match found
    return new Response(JSON.stringify({
      exists: false,
      actor: null
    }), {
      headers: corsHeaders
    })

  } catch (error) {
    console.error('[Actor Search] Error:', error)
    console.error('[Actor Search] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return new Response(JSON.stringify({
      error: 'Failed to search actors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash'
    }
  })
}
