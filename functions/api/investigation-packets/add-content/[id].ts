/**
 * Add Content to Investigation Packet API
 * POST /api/investigation-packets/add-content/:packet_id
 * Links a content analysis to an investigation packet
 */

import { requireAuth } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface AddContentRequest {
  content_analysis_id: number
  notes?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)

    const packetId = context.params.id as string
    const body = await context.request.json() as AddContentRequest

    // Validate required fields
    if (!body.content_analysis_id) {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Verify packet exists and user owns it
    const packet = await context.env.DB.prepare(`
      SELECT id, user_id, title FROM investigation_packets WHERE id = ?
    `).bind(packetId).first()

    if (!packet) {
      return new Response(JSON.stringify({ error: 'Packet not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    if (Number(packet.user_id) !== Number(authUserId)) {
      return new Response(JSON.stringify({ error: 'Unauthorized to modify this packet' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Verify content analysis exists and user owns it
    const content = await context.env.DB.prepare(`
      SELECT id, user_id, url, title FROM content_analysis WHERE id = ?
    `).bind(body.content_analysis_id).first()

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content analysis not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    if (Number(content.user_id) !== Number(authUserId)) {
      return new Response(JSON.stringify({ error: 'Unauthorized to access this content' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    // Link every claim extracted from this content item. packet_claims stores
    // claim_adjustment_id, not content_analysis_id.
    const unlinkedClaims = await context.env.DB.prepare(`
      SELECT ca.id
      FROM claim_adjustments ca
      LEFT JOIN packet_claims pc
        ON pc.claim_adjustment_id = ca.id
       AND pc.packet_id = ?
      WHERE ca.content_analysis_id = ?
        AND pc.id IS NULL
      ORDER BY ca.claim_index ASC
    `).bind(packetId, body.content_analysis_id).all<{ id: string }>()

    if (!unlinkedClaims.results?.length) {
      const totalClaims = await context.env.DB.prepare(
        'SELECT COUNT(*) as count FROM claim_adjustments WHERE content_analysis_id = ?'
      ).bind(body.content_analysis_id).first<{ count: number }>()

      if (!totalClaims?.count) {
        return new Response(JSON.stringify({
          error: 'This content has no extracted claims to add'
        }), {
          status: 400,
          headers: JSON_HEADERS
        })
      }

      return new Response(JSON.stringify({
        error: 'This content is already in the packet'
      }), {
        status: 409,
        headers: JSON_HEADERS
      })
    }

    const now = new Date().toISOString()
    const linkIds: string[] = []
    const statements = unlinkedClaims.results.map((claim) => {
      const linkId = crypto.randomUUID()
      linkIds.push(linkId)
      return context.env.DB.prepare(`
        INSERT INTO packet_claims (
          id,
          packet_id,
          claim_adjustment_id,
          investigation_notes,
          added_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        linkId,
        packetId,
        claim.id,
        body.notes?.trim() || null,
        now
      )
    })

    statements.push(context.env.DB.prepare(`
      UPDATE investigation_packets
      SET updated_at = ?
      WHERE id = ?
    `).bind(now, packetId))

    statements.push(context.env.DB.prepare(`
      INSERT INTO investigation_activity_log (
        id,
        packet_id,
        user_id,
        activity_type,
        description,
        new_value,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      packetId,
      authUserId,
      'claim_added',
      `Added ${linkIds.length} claims from "${content.title || content.url}"`,
      JSON.stringify({
        content_analysis_id: body.content_analysis_id,
        url: content.url,
        title: content.title,
        claim_count: linkIds.length,
      }),
      now
    ))

    // The links, packet timestamp, and audit record succeed or fail together.
    await context.env.DB.batch(statements)

    return new Response(JSON.stringify({
      success: true,
      link_id: linkIds[0],
      link_ids: linkIds,
      claims_added: linkIds.length,
      message: 'Content claims added to investigation packet'
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[Add Content to Packet] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add content to packet'

    }), {
      status: 500,
      headers: JSON_HEADERS
    })
  }
}

// Reject GET requests (POST-only endpoint)
export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405, headers: JSON_HEADERS,
  })
}

// CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return optionsResponse()
}
