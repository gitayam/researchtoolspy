/**
 * List Investigation Packets API
 * GET /api/investigation-packets/list
 * Returns all investigation packets for the user
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(context.request.url)
    const status = url.searchParams.get('status') // Filter by status (active, completed, archived)
    const limit = parseInt(url.searchParams.get('limit') || '50')
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
      WHERE user_id = ?
    `

    const bindings: any[] = [auth.user.id]

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
          SELECT COUNT(*) as count
          FROM packet_claims
          WHERE packet_id = ?
        `).bind(packet.id).first()

        // Count total claims across all content in this packet
        const claimCount = await context.env.DB.prepare(`
          SELECT COUNT(*) as count
          FROM claim_adjustments ca
          WHERE ca.content_analysis_id IN (
            SELECT content_analysis_id
            FROM packet_claims
            WHERE packet_id = ?
          )
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
    let countSql = `SELECT COUNT(*) as total FROM investigation_packets WHERE user_id = ?`
    const countBindings: any[] = [auth.user.id]

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
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[List Packets] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list investigation packets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
