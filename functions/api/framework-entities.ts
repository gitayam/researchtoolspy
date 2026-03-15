// Cloudflare Pages Function for Framework-Entity Linking API
// Supports linking actors, sources, events to frameworks
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('framework_id')
    const entityType = url.searchParams.get('entity_type')
    const entityId = url.searchParams.get('entity_id')
    const userId = await getUserIdOrDefault(request, env)

    // GET - Get linked entities for a framework
    if (request.method === 'GET') {
      if (!frameworkId) {
        return new Response(JSON.stringify({ error: 'framework_id is required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Build query based on optional entity_type filter
      let query = `
        SELECT fe.*
        FROM framework_entities fe
        WHERE fe.framework_id = ?
      `
      const params: (string | null)[] = [frameworkId]

      if (entityType) {
        query += ' AND fe.entity_type = ?'
        params.push(entityType)
      }

      query += ' ORDER BY fe.created_at DESC LIMIT 500'

      const links = await env.DB.prepare(query).bind(...params).all()

      // Fetch full entity data for each linked entity
      const enrichedLinks = await Promise.all(
        (links.results || []).map(async (link: any) => {
          let entityData = null

          try {
            switch (link.entity_type) {
              case 'actor': {
                const actor = await env.DB.prepare(
                  'SELECT * FROM actors WHERE id = ?'
                ).bind(link.entity_id).first()
                entityData = actor
                break
              }
              case 'source': {
                const source = await env.DB.prepare(
                  'SELECT * FROM sources WHERE id = ?'
                ).bind(link.entity_id).first()
                entityData = source
                break
              }
              case 'event': {
                const event = await env.DB.prepare(
                  'SELECT * FROM events WHERE id = ?'
                ).bind(link.entity_id).first()
                entityData = event
                break
              }
            }
          } catch (e) {
            console.error(`Failed to fetch ${link.entity_type} ${link.entity_id}:`, e)
          }

          return {
            ...link,
            entity_data: entityData
          }
        })
      )

      return new Response(JSON.stringify({ links: enrichedLinks }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // POST - Link entities to framework
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      if (!body.framework_id) {
        return new Response(JSON.stringify({
          error: 'framework_id is required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Support both single entity and batch linking
      const entities = body.entities || [{
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        relevance_note: body.relevance_note,
        role: body.role,
        confidence: body.confidence
      }]

      if (!entities || !Array.isArray(entities) || entities.length === 0) {
        return new Response(JSON.stringify({
          error: 'entities array or entity_type/entity_id are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Link each entity to the framework
      const results = []
      for (const entity of entities) {
        if (!entity.entity_type || !entity.entity_id) {
          results.push({ entity, success: false, error: 'entity_type and entity_id required' })
          continue
        }

        // Validate entity_type
        if (!['actor', 'source', 'event'].includes(entity.entity_type)) {
          results.push({ entity, success: false, error: 'Invalid entity_type. Must be actor, source, or event' })
          continue
        }

        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO framework_entities
            (framework_id, entity_type, entity_id, relevance_note, role, confidence, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            body.framework_id,
            entity.entity_type,
            String(entity.entity_id),
            entity.relevance_note || null,
            entity.role || null,
            entity.confidence || 1.0,
            authUserId
          ).run()

          results.push({ entity_type: entity.entity_type, entity_id: entity.entity_id, success: true })
        } catch (error: any) {
          results.push({ entity_type: entity.entity_type, entity_id: entity.entity_id, success: false, error: 'Processing failed' })
        }
      }

      return new Response(JSON.stringify({
        message: 'Entities linked successfully',
        results
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Unlink entity from framework
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!frameworkId || !entityType || !entityId) {
        return new Response(JSON.stringify({
          error: 'framework_id, entity_type, and entity_id are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Verify framework ownership before unlinking
      const fw = await env.DB.prepare(
        'SELECT id FROM framework_sessions WHERE id = ? AND user_id = ?'
      ).bind(frameworkId, authUserId).first()
      if (!fw) {
        return new Response(JSON.stringify({ error: 'Framework not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      const delResult = await env.DB.prepare(
        'DELETE FROM framework_entities WHERE framework_id = ? AND entity_type = ? AND entity_id = ?'
      ).bind(frameworkId, entityType, entityId).run()

      if (!delResult.meta.changes || delResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Entity link not found' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Entity unlinked successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Framework-Entities API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
