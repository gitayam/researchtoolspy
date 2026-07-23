/**
 * List Investigation Packets API
 * GET /api/investigation-packets/list
 * Returns all investigation packets for the user
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)
    const workspaceId = context.request.headers.get('X-Workspace-ID') || null

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'X-Workspace-ID header is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(workspaceId, authUserId, context.env))) {
      return new Response(JSON.stringify({ error: 'Access denied to workspace' }), {
        status: 403,
        headers: JSON_HEADERS,
      })
    }

    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') // Filter by status (active, completed, archived)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    let sql = `
      SELECT
        id,
        title,
        description,
        investigation_type,
        priority,
        status,
        category,
        tags,
        created_at,
        updated_at,
        completed_at
      FROM investigation_packets
      WHERE user_id = ? AND workspace_id = ?
    `

    const bindings: any[] = [authUserId, workspaceId]

    // Filter by status if provided
    if (status && ['active', 'completed', 'archived'].includes(status)) {
      sql += ` AND status = ?`
      bindings.push(status)
    }

    sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    bindings.push(limit, offset)

    const results = await context.env.DB.prepare(sql).bind(...bindings).all()

    // For each packet, get content count and claim count
    const packetsWithCounts = await Promise.all(
      (results.results || []).map(async (packet: any) => {
        // Count content analyses
        const contentCount = await context.env.DB.prepare(`
          SELECT COUNT(DISTINCT ca.content_analysis_id) as count
          FROM packet_claims pc
          JOIN claim_adjustments ca ON ca.id = pc.claim_adjustment_id
          WHERE pc.packet_id = ?
        `).bind(packet.id).first()

        // Count claims explicitly linked to this packet.
        const claimCount = await context.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM packet_claims
          WHERE packet_id = ?
        `).bind(packet.id).first()

        return {
          ...packet,
          tags: packet.tags ? JSON.parse(packet.tags) : [],
          content_count: contentCount?.count || 0,
          claim_count: claimCount?.count || 0
        }
      })
    )

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM investigation_packets WHERE user_id = ? AND workspace_id = ?`
    const countBindings: any[] = [authUserId, workspaceId]

    if (status && ['active', 'completed', 'archived'].includes(status)) {
      countSql += ` AND status = ?`
      countBindings.push(status)
    }

    const totalCount = await context.env.DB.prepare(countSql).bind(...countBindings).first()

    return new Response(JSON.stringify({
      success: true,
      packets: packetsWithCounts,
      pagination: {
        total: totalCount?.total || 0,
        limit,
        offset,
        has_more: (totalCount?.total || 0) > (offset + limit)
      }
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[List Packets] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list investigation packets'

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
