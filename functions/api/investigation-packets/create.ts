/**
 * Create Investigation Packet API
 * POST /api/investigation-packets/create
 * Creates a new investigation packet for organizing claims across multiple sources
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface CreatePacketRequest {
  title: string
  description?: string
  investigation_type?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  category?: string
  tags?: string[]
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const authUserId = await requireAuth(context.request, context.env)
    const workspaceId = context.request.headers.get('X-Workspace-ID') || null

    const body = await context.request.json() as CreatePacketRequest

    // Validate required fields
    if (!body.title || body.title.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'title is required'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    // Validate priority if provided
    if (body.priority && !['low', 'medium', 'high', 'critical'].includes(body.priority)) {
      return new Response(JSON.stringify({
        error: 'priority must be one of: low, medium, high, critical'
      }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Create the packet
    await context.env.DB.prepare(`
      INSERT INTO investigation_packets (
        id,
        user_id,
        workspace_id,
        title,
        description,
        investigation_type,
        priority,
        status,
        lead_investigator,
        category,
        tags,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      authUserId,
      workspaceId,
      body.title.trim(),
      body.description?.trim() || null,
      body.investigation_type?.trim() || null,
      body.priority || 'medium',
      'active',
      authUserId, // User is the lead investigator
      body.category?.trim() || null,
      body.tags ? JSON.stringify(body.tags) : null,
      now,
      now
    ).run()

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
      id,
      authUserId,
      'packet_created',
      JSON.stringify({
        title: body.title.trim(),
        priority: body.priority || 'medium'
      }),
      now
    ).run()

    // Return the created packet
    const packet = await context.env.DB.prepare(`
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
        updated_at
      FROM investigation_packets
      WHERE id = ?
    `).bind(id).first()

    return new Response(JSON.stringify({
      success: true,
      packet: packet ? {
        ...packet,
        tags: packet.tags ? JSON.parse(packet.tags as string) : []
      } : null
    }), {
      headers: JSON_HEADERS
    })
  } catch (error) {
    console.error('[Create Packet] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation packet'

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
