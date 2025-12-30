/**
 * Auto-generate entities from COG Framework Analysis
 * Creates actors, behaviors, and relationships from structured COG data
 */

import type { PagesFunction } from '@cloudflare/workers-types'

import { getUserIdOrDefault } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS: KVNamespace
}

// Helper to get user from session
async function getUserFromRequest(request: Request, env: Env): Promise<number | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  const sessionData = await env.SESSIONS.get(token)

  if (!sessionData) {
    return null
  }

  const session = JSON.parse(sessionData)
  return session.user_id
}

// Generate UUID v4
function generateId(): string {
  return crypto.randomUUID()
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const frameworkId = params.id as string

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get authenticated user
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get framework from database
    const framework = await env.DB.prepare(`
      SELECT * FROM framework_sessions WHERE id = ?
    `).bind(frameworkId).first()

    if (!framework) {
      return new Response(
        JSON.stringify({ error: 'Framework not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user owns this framework
    if (framework.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify it's a COG framework
    if (framework.framework_type !== 'cog') {
      return new Response(
        JSON.stringify({ error: 'Only COG frameworks support entity generation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse COG data
    let cogData
    try {
      cogData = typeof framework.data === 'string'
        ? JSON.parse(framework.data)
        : framework.data
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid framework data format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create default workspace
    const workspaceId = '1' // Default workspace

    // Ensure workspace exists
    const workspace = await env.DB.prepare(`
      SELECT id FROM workspaces WHERE id = ?
    `).bind(workspaceId).first()

    if (!workspace) {
      // Create default workspace
      const now = new Date().toISOString()
      await env.DB.prepare(`
        INSERT INTO workspaces (id, name, description, type, owner_id, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        workspaceId,
        'Default Workspace',
        'Auto-created workspace for entity generation',
        'PERSONAL',
        userId,
        0,
        now,
        now
      ).run()
    }

    const now = new Date().toISOString()
    const createdEntities = {
      actors: [] as any[],
      behaviors: [] as any[],
      relationships: [] as any[]
    }

    // Extract and create actors from Centers of Gravity
    if (cogData.centers_of_gravity && Array.isArray(cogData.centers_of_gravity)) {
      for (const cog of cogData.centers_of_gravity) {
        // Skip if actor already exists or no actor name
        if (!cog.actor_name || cog.actor_id) {
          continue
        }

        const actorId = generateId()

        // Determine actor type based on actor_category
        let actorType = 'OTHER'
        if (cog.actor_category === 'friendly') {
          actorType = 'ORGANIZATION' // Friendly forces are usually organizations/units
        } else if (cog.actor_category === 'adversary') {
          actorType = 'ORGANIZATION' // Adversaries are usually organizations/groups
        } else if (cog.actor_category === 'host_nation') {
          actorType = 'GOVERNMENT'
        } else if (cog.actor_category === 'third_party') {
          actorType = 'ORGANIZATION'
        }

        // Create actor
        await env.DB.prepare(`
          INSERT INTO actors (
            id, type, name, description,
            category, role, affiliation,
            cog_analysis_id,
            workspace_id, created_by, created_at, updated_at,
            is_public, votes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          actorId,
          actorType,
          cog.actor_name,
          cog.description || `${cog.actor_category.toUpperCase()} actor from COG analysis in ${cog.domain} domain`,
          cog.actor_category,
          `COG in ${cog.domain} domain`,
          cog.actor_category === 'friendly' ? 'Friendly Forces' :
            cog.actor_category === 'adversary' ? 'Adversary Forces' :
            cog.actor_category === 'host_nation' ? 'Host Nation' : 'Third Party',
          frameworkId,
          workspaceId,
          userId,
          now,
          now,
          0,
          0
        ).run()

        // Update COG with actor_id reference
        cog.actor_id = actorId

        createdEntities.actors.push({
          id: actorId,
          name: cog.actor_name,
          type: actorType,
          cog_id: cog.id
        })
      }
    }

    // Extract and create behaviors from Critical Capabilities
    if (cogData.critical_capabilities && Array.isArray(cogData.critical_capabilities)) {
      for (const capability of cogData.critical_capabilities) {
        const behaviorId = generateId()

        // Create behavior as a TTP (Tactic, Technique, Procedure)
        await env.DB.prepare(`
          INSERT INTO behaviors (
            id, name, description, behavior_type,
            sophistication, effectiveness,
            behavior_analysis_id,
            workspace_id, created_by, created_at, updated_at,
            is_public, votes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          behaviorId,
          capability.capability,
          capability.description + '\n\nStrategic Contribution: ' + (capability.strategic_contribution || ''),
          'TTP',
          'INTERMEDIATE', // Default sophistication
          capability.composite_score && capability.composite_score > 10 ? 'HIGHLY_EFFECTIVE' :
            capability.composite_score && capability.composite_score > 7 ? 'EFFECTIVE' : 'MODERATELY_EFFECTIVE',
          frameworkId,
          workspaceId,
          userId,
          now,
          now,
          0,
          0
        ).run()

        createdEntities.behaviors.push({
          id: behaviorId,
          name: capability.capability,
          capability_id: capability.id,
          cog_id: capability.cog_id
        })

        // Create relationship: Actor (from COG) -> exhibits -> Behavior (capability)
        const cogEntry = cogData.centers_of_gravity?.find((c: any) => c.id === capability.cog_id)
        if (cogEntry && cogEntry.actor_id) {
          const relId = generateId()

          await env.DB.prepare(`
            INSERT INTO relationships (
              id, source_entity_id, source_entity_type,
              target_entity_id, target_entity_type,
              relationship_type, description, weight, confidence,
              workspace_id, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            relId,
            cogEntry.actor_id,
            'ACTOR',
            behaviorId,
            'BEHAVIOR',
            'EXHIBITS',
            `Actor demonstrates this capability as part of their COG in the ${cogEntry.domain} domain`,
            capability.composite_score || 1,
            cogEntry.confidence === 'high' || cogEntry.confidence === 'confirmed' ? 'CONFIRMED' :
              cogEntry.confidence === 'medium' ? 'PROBABLE' : 'POSSIBLE',
            workspaceId,
            userId,
            now,
            now
          ).run()

          createdEntities.relationships.push({
            id: relId,
            source: cogEntry.actor_id,
            target: behaviorId,
            type: 'EXHIBITS'
          })
        }
      }
    }

    // Update framework data with actor_id references
    await env.DB.prepare(`
      UPDATE framework_sessions
      SET data = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      JSON.stringify(cogData),
      frameworkId
    ).run()

    // Update workspace entity counts
    await env.DB.prepare(`
      UPDATE workspaces
      SET entity_count = json_set(
        COALESCE(entity_count, '{}'),
        '$.actors', COALESCE(json_extract(entity_count, '$.actors'), 0) + ?,
        '$.behaviors', COALESCE(json_extract(entity_count, '$.behaviors'), 0) + ?
      ),
      updated_at = ?
      WHERE id = ?
    `).bind(
      createdEntities.actors.length,
      createdEntities.behaviors.length,
      now,
      workspaceId
    ).run()

    return new Response(
      JSON.stringify({
        message: 'Entities generated successfully',
        created: createdEntities,
        summary: {
          actors: createdEntities.actors.length,
          behaviors: createdEntities.behaviors.length,
          relationships: createdEntities.relationships.length
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Entity generation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Entity generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
