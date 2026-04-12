/**
 * Search Actors API
 * GET /api/actors/search?workspace_id={id}&name={name}&type={type}
 * Returns actors matching search criteria for duplicate detection
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserIdOrDefault } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserIdOrDefault(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }
    const url = new URL(context.request.url)

    const workspaceId = url.searchParams.get('workspace_id') || context.request.headers.get('X-Workspace-ID') || null
    const name = url.searchParams.get('name')
    const type = url.searchParams.get('type')


    if (!name) {
      return new Response(JSON.stringify({
        error: 'name parameter is required'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Search for exact match first
    let query = `
      SELECT
        a.id,
        a.name,
        a.type,
        a.description,
        a.created_at
      FROM actors a
      WHERE a.workspace_id = ?
        AND LOWER(a.name) = LOWER(?)
    `

    const params: (string | number)[] = [workspaceId, name]

    // Add type filter if specified
    if (type) {
      query += ` AND a.type = ?`
      params.push(type)
    }

    query += ` LIMIT 1`


    const result = await context.env.DB.prepare(query).bind(...params).first()


    if (result) {
      // Exact match found
      return new Response(JSON.stringify({
        exists: true,
        actor: {
          id: result.id,
          name: result.name,
          type: result.type,
          description: result.description,
          created_at: result.created_at
        }
      }), {
        headers: JSON_HEADERS
      })
    }

    // No exact match found
    return new Response(JSON.stringify({
      exists: false,
      actor: null
    }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Actor Search] Error:', error)
    console.error('[Actor Search] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return new Response(JSON.stringify({
      error: 'Failed to search actors'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
