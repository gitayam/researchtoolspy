/**
 * Create Investigation Packet API
 * POST /api/investigation-packets/create
 * Creates a new investigation packet for organizing claims across multiple sources
 */

import { requireAuth } from '../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../_shared/api-utils'
import { checkWorkspaceAccess } from '../_shared/workspace-helpers'

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

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: 'X-Workspace-ID header is required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    if (!(await checkWorkspaceAccess(workspaceId, authUserId, context.env, 'EDITOR'))) {
      return new Response(JSON.stringify({ error: 'Access denied to workspace' }), {
        status: 403,
        headers: JSON_HEADERS,
      })
    }

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

    const packetInsert = context.env.DB.prepare(`
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
    )

    const activityInsert = context.env.DB.prepare(`
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
      id,
      authUserId,
      'created',
      `Created investigation packet "${body.title.trim()}"`,
      JSON.stringify({
        title: body.title.trim(),
        priority: body.priority || 'medium'
      }),
      now
    )

    // D1 batch is transactional: the packet and its audit trail either both
    // exist or neither does.
    await context.env.DB.batch([packetInsert, activityInsert])

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
    if (error instanceof Response) return error
    console.error('[Create Packet] Error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create investigation packet'

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
