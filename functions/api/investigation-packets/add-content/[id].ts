/**
 * Add Content to Investigation Packet API
 * POST /api/investigation-packets/add-content/:packet_id
 * Links a content analysis to an investigation packet
 */

import { requireAuth } from '../../_shared/auth-helpers'

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
    const auth = await requireAuth(context)
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const packetId = context.params.id as string
    const body = await context.request.json() as AddContentRequest

    // Validate required fields
    if (!body.content_analysis_id) {
      return new Response(JSON.stringify({
        error: 'content_analysis_id is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify packet exists and user owns it
    const packet = await context.env.DB.prepare(`
      SELECT id, user_id, title FROM investigation_packets WHERE id = ?
    `).bind(packetId).first()

    if (!packet) {
      return new Response(JSON.stringify({ error: 'Packet not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (packet.user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to modify this packet' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify content analysis exists and user owns it
    const content = await context.env.DB.prepare(`
      SELECT id, user_id, url, title FROM content_analysis WHERE id = ?
    `).bind(body.content_analysis_id).first()

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content analysis not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (content.user_id !== auth.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized to access this content' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if already added
    const existing = await context.env.DB.prepare(`
      SELECT id FROM packet_claims
      WHERE packet_id = ? AND content_analysis_id = ?
    `).bind(packetId, body.content_analysis_id).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'This content is already in the packet',
        existing_link_id: existing.id
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const now = new Date().toISOString()
    const linkId = crypto.randomUUID()

    // Add to packet
    await context.env.DB.prepare(`
      INSERT INTO packet_claims (
        id,
        packet_id,
        content_analysis_id,
        notes,
        added_by,
        added_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      linkId,
      packetId,
      body.content_analysis_id,
      body.notes?.trim() || null,
      auth.user.id,
      now
    ).run()

    // Update packet updated_at
    await context.env.DB.prepare(`
      UPDATE investigation_packets
      SET updated_at = ?
      WHERE id = ?
    `).bind(now, packetId).run()

    // Log activity
    await context.env.DB.prepare(`
      INSERT INTO investigation_activity_log (
        id,
        packet_id,
        user_id,
        action_type,
        action_details,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      packetId,
      auth.user.id,
      'content_added',
      JSON.stringify({
        content_analysis_id: body.content_analysis_id,
        url: content.url,
        title: content.title
      }),
      now
    ).run()

    return new Response(JSON.stringify({
      success: true,
      link_id: linkId,
      message: 'Content added to investigation packet'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Add Content to Packet] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to add content to packet',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
