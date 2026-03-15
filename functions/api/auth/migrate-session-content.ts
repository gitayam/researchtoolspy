/**
 * Session Content Migration API
 * Migrates all content from a bookmark_hash (guest session) to an authenticated user account
 */

import type { PagesFunction } from '@cloudflare/workers-types'
import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    // Get authentication
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authToken) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: JSON_HEADERS
      })
    }

    // Resolve user from auth token
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Could not resolve user from auth token'
      }), {
        status: 401,
        headers: JSON_HEADERS
      })
    }

    // Get request body
    const body = await request.json() as { bookmark_hash: string }
    const { bookmark_hash } = body

    if (!bookmark_hash || bookmark_hash === 'guest') {
      return new Response(JSON.stringify({
        error: 'Invalid bookmark hash'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Get workspace (default to '1' for now)
    const workspaceId = request.headers.get('X-Workspace-ID') || null


    // Begin transaction-like operations
    const migrationResults = {
      content_analysis: 0,
      saved_links: 0,
      framework_sessions: 0
    }

    // Migrate content_analysis
    try {
      const contentResult = await env.DB.prepare(`
        UPDATE content_analysis
        SET user_id = ?, bookmark_hash = NULL
        WHERE bookmark_hash = ? AND workspace_id = ?
      `).bind(userId, bookmark_hash, workspaceId).run()

      migrationResults.content_analysis = contentResult.meta.changes || 0
    } catch (error) {
      console.error('[Migration] Error migrating content_analysis:', error)
    }

    // Migrate saved_links
    try {
      const linksResult = await env.DB.prepare(`
        UPDATE saved_links
        SET user_id = ?, bookmark_hash = NULL
        WHERE bookmark_hash = ? AND workspace_id = ?
      `).bind(userId, bookmark_hash, workspaceId).run()

      migrationResults.saved_links = linksResult.meta.changes || 0
    } catch (error) {
      console.error('[Migration] Error migrating saved_links:', error)
    }

    // Migrate framework_sessions (if bookmark_hash column exists)
    try {
      // Check if framework_sessions has bookmark_hash column
      const schemaCheck = await env.DB.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='framework_sessions'
      `).first()

      if (schemaCheck && String(schemaCheck.sql).includes('bookmark_hash')) {
        const frameworkResult = await env.DB.prepare(`
          UPDATE framework_sessions
          SET user_id = ?, bookmark_hash = NULL
          WHERE bookmark_hash = ? AND workspace_id = ?
        `).bind(userId, bookmark_hash, workspaceId).run()

        migrationResults.framework_sessions = frameworkResult.meta.changes || 0
      }
    } catch (error) {
      console.error('[Migration] Error migrating framework_sessions:', error)
    }

    const totalMigrated = migrationResults.content_analysis +
                         migrationResults.saved_links +
                         migrationResults.framework_sessions


    return new Response(JSON.stringify({
      success: true,
      migrated: migrationResults,
      total: totalMigrated,
      message: `Successfully migrated ${totalMigrated} records to your account`
    }), {
      status: 200,
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return new Response(JSON.stringify({
      error: 'Migration failed'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}
