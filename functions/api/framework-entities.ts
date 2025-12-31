// Cloudflare Pages Function for Framework-Entity Linking API
// Supports linking actors, sources, events to frameworks
export async function onRequest(context: any) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('framework_id')
    const entityType = url.searchParams.get('entity_type')
    const entityId = url.searchParams.get('entity_id')

    // GET - Get linked entities for a framework
    if (request.method === 'GET') {
      if (!frameworkId) {
        return new Response(JSON.stringify({ error: 'framework_id is required' }), {
          status: 400,
          headers: corsHeaders,
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

      query += ' ORDER BY fe.created_at DESC'

      const links = await env.DB.prepare(query).bind(...params).all()

      // Fetch full entity data for each linked entity
      const enrichedLinks = await Promise.all(
        links.results.map(async (link: any) => {
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
        headers: corsHeaders,
      })
    }

    // POST - Link entities to framework
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.framework_id) {
        return new Response(JSON.stringify({
          error: 'framework_id is required'
        }), {
          status: 400,
          headers: corsHeaders,
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
          headers: corsHeaders,
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
            body.created_by || 1
          ).run()

          results.push({ entity_type: entity.entity_type, entity_id: entity.entity_id, success: true })
        } catch (error: any) {
          results.push({ entity_type: entity.entity_type, entity_id: entity.entity_id, success: false, error: error.message })
        }
      }

      return new Response(JSON.stringify({
        message: 'Entities linked successfully',
        results
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // DELETE - Unlink entity from framework
    if (request.method === 'DELETE') {
      if (!frameworkId || !entityType || !entityId) {
        return new Response(JSON.stringify({
          error: 'framework_id, entity_type, and entity_id are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      await env.DB.prepare(
        'DELETE FROM framework_entities WHERE framework_id = ? AND entity_type = ? AND entity_id = ?'
      ).bind(frameworkId, entityType, entityId).run()

      return new Response(JSON.stringify({ message: 'Entity unlinked successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Framework-Entities API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
