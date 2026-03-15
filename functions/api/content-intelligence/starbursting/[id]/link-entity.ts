/**
 * Link Starbursting Entity API
 * POST /api/content-intelligence/starbursting/:id/link-entity
 * Links an extracted entity to a database entity ID
 */

import { getUserFromRequest } from '../../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../../_shared/api-utils'

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await getUserFromRequest(context.request, context.env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: JSON_HEADERS,
      })
    }
    const sessionId = context.params.id as string

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: JSON_HEADERS
      })
    }

    const body = await context.request.json() as {
      question_id: string
      entity_name: string
      linked_id: string
      entity_type: string
    }

    const { question_id, entity_name, linked_id, entity_type } = body

    // 1. Fetch current session data
    const session = await context.env.DB.prepare(`
      SELECT data, user_id FROM framework_sessions WHERE id = ?
    `).bind(sessionId).first()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // 2. Authorization check
    if (session.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: JSON_HEADERS
      })
    }

    const data = JSON.parse(session.data as string || '{}')
    let found = false

    // 3. Update the data JSON
    // The data is structured as { who: [], what: [], ... }
    const categories = ['who', 'what', 'where', 'when', 'why', 'how']
    
    for (const cat of categories) {
      if (Array.isArray(data[cat])) {
        data[cat] = data[cat].map((q: any) => {
          if (q.id === question_id) {
            if (Array.isArray(q.extracted_entities)) {
              q.extracted_entities = q.extracted_entities.map((e: any) => {
                if (e.name === entity_name) {
                  found = true
                  return { ...e, linked_id }
                }
                return e
              })
            }
          }
          return q
        })
      }
    }

    if (!found) {
      return new Response(JSON.stringify({ error: 'Entity or question not found in session data' }), {
        status: 404,
        headers: JSON_HEADERS
      })
    }

    // 4. Save back to database
    await context.env.DB.prepare(`
      UPDATE framework_sessions
      SET data = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(JSON.stringify(data), sessionId).run()

    // 5. Also create a relationship in the relationships table if needed
    // (Future improvement: link framework_session to entity via a formal relationship table)

    return new Response(JSON.stringify({ success: true, linked_id }), {
      headers: JSON_HEADERS
    })

  } catch (error) {
    console.error('[Link Entity] Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to link entity'

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
