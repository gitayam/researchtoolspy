/**
 * Auto-Extract Entities API
 * Automatically creates actor entities and relationships from content analysis entities
 */

import { nanoid } from 'nanoid'

interface Env {
  DB: D1Database
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body = await request.json()
    const { analysis_id, workspace_id = '1', user_id = 1 } = body

    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'analysis_id required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Get the content analysis
    const analysis = await env.DB.prepare(`
      SELECT id, entities, url, title
      FROM content_analysis
      WHERE id = ?
    `).bind(analysis_id).first()

    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    const entities = JSON.parse(analysis.entities as string || '{}')
    const createdActors: any[] = []
    const matchedActors: any[] = []
    const createdRelationships: any[] = []

    // Helper: Find or create actor
    const findOrCreateActor = async (name: string, type: 'PERSON' | 'ORGANIZATION', contexts: string[]) => {
      // Try to find existing actor by name (case-insensitive)
      const existing = await env.DB.prepare(`
        SELECT id, name FROM actors
        WHERE LOWER(name) = LOWER(?) AND workspace_id = ?
        LIMIT 1
      `).bind(name, workspace_id).first()

      if (existing) {
        matchedActors.push({ id: existing.id, name: existing.name, matched: true })
        return existing.id
      }

      // Create new actor
      const actorId = `actor_${nanoid(12)}`
      await env.DB.prepare(`
        INSERT INTO actors (
          id, type, name, description, workspace_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        actorId,
        type,
        name,
        `Auto-extracted from content analysis. Mentioned ${contexts.length} time(s).`,
        workspace_id,
        user_id
      ).run()

      createdActors.push({ id: actorId, name, type })
      return actorId
    }

    // Extract people as PERSON actors
    const peopleIds: string[] = []
    if (entities.people && Array.isArray(entities.people)) {
      for (const person of entities.people.slice(0, 20)) { // Limit to top 20
        if (person.text && person.text.length > 2) {
          const actorId = await findOrCreateActor(
            person.text,
            'PERSON',
            person.contexts || []
          )
          peopleIds.push(actorId)
        }
      }
    }

    // Extract organizations as ORGANIZATION actors
    const orgIds: string[] = []
    if (entities.organizations && Array.isArray(entities.organizations)) {
      for (const org of entities.organizations.slice(0, 20)) { // Limit to top 20
        if (org.text && org.text.length > 2) {
          const actorId = await findOrCreateActor(
            org.text,
            'ORGANIZATION',
            org.contexts || []
          )
          orgIds.push(actorId)
        }
      }
    }

    // Create relationships between extracted actors (mentioned together in same content)
    const allActorIds = [...peopleIds, ...orgIds]
    for (let i = 0; i < allActorIds.length; i++) {
      for (let j = i + 1; j < Math.min(allActorIds.length, i + 5); j++) { // Limit to 5 relationships per actor
        const relId = `rel_${nanoid(12)}`

        try {
          await env.DB.prepare(`
            INSERT INTO relationships (
              id,
              source_entity_id,
              source_entity_type,
              target_entity_id,
              target_entity_type,
              relationship_type,
              description,
              confidence,
              evidence_ids,
              workspace_id,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            relId,
            allActorIds[i],
            'ACTOR',
            allActorIds[j],
            'ACTOR',
            'MENTIONED_WITH',
            `Co-mentioned in: ${analysis.title || analysis.url}`,
            'PROBABLE',
            JSON.stringify([analysis_id]),
            workspace_id,
            user_id
          ).run()

          createdRelationships.push({
            id: relId,
            from: allActorIds[i],
            to: allActorIds[j]
          })
        } catch (error) {
          // Relationship might already exist, skip
          console.log('Relationship already exists or error:', error)
        }
      }
    }

    // Link all extracted actors to the content analysis
    // Note: This links to content_analysis, not evidence_items
    // We'll need to create a content_analysis_actors junction table or store in JSON

    return new Response(JSON.stringify({
      success: true,
      created_actors: createdActors,
      matched_actors: matchedActors,
      created_relationships: createdRelationships,
      total_actors_processed: allActorIds.length,
      summary: {
        new_actors: createdActors.length,
        matched_actors: matchedActors.length,
        new_relationships: createdRelationships.length,
      }
    }), {
      status: 200,
      headers: corsHeaders,
    })

  } catch (error) {
    console.error('Auto-extract entities error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to auto-extract entities',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
