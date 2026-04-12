// Cloudflare Pages Function for Framework-Evidence Linking API
import { getUserIdOrDefault, getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const frameworkId = url.searchParams.get('framework_id')
    const evidenceId = url.searchParams.get('evidence_id')
    const userId = await getUserIdOrDefault(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: JSON_HEADERS,
      })
    }

    // GET - Get linked evidence for a framework or frameworks for an evidence item
    if (request.method === 'GET') {
      if (frameworkId) {
        // Get all evidence linked to this framework
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            e.id as evidence_id,
            e.title,
            e.description,
            e.who,
            e.what,
            e.when_occurred,
            e.where_location,
            e.evidence_type,
            e.evidence_level,
            e.priority,
            e.status,
            e.tags
          FROM framework_evidence fe
          JOIN evidence_items e ON fe.evidence_id = e.id
          WHERE fe.framework_id = ?
          ORDER BY fe.created_at DESC
          LIMIT 500
        `).bind(frameworkId).all()

        const parsedLinks = (links.results || []).map((link: any) => ({
          ...link,
          tags: safeJsonParse(link.tags, [])
        }))

        return new Response(JSON.stringify({ links: parsedLinks }), {
          status: 200,
          headers: JSON_HEADERS,
        })
      } else if (evidenceId) {
        // Get all frameworks this evidence is linked to
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            f.id as framework_id,
            f.framework_type,
            f.title,
            f.status
          FROM framework_evidence fe
          JOIN framework_sessions f ON fe.framework_id = f.id
          WHERE fe.evidence_id = ?
          ORDER BY fe.created_at DESC
          LIMIT 500
        `).bind(evidenceId).all()

        return new Response(JSON.stringify({ links: links.results }), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ error: 'framework_id or evidence_id required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // POST - Link evidence to framework
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      if (!body.framework_id || !body.evidence_ids || !Array.isArray(body.evidence_ids)) {
        return new Response(JSON.stringify({
          error: 'framework_id and evidence_ids (array) are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Link each evidence item to the framework
      const results = []
      for (const evidenceId of body.evidence_ids) {
        try {
          const result = await env.DB.prepare(`
            INSERT OR REPLACE INTO framework_evidence
            (framework_id, evidence_id, section_key, relevance_note, weight, supports, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            body.framework_id,
            evidenceId,
            body.section_key || null,
            body.relevance_note || null,
            body.weight || 1.0,
            body.supports !== undefined ? body.supports : 1,
            authUserId
          ).run()

          results.push({ evidence_id: evidenceId, success: true })
        } catch (error: any) {
          results.push({ evidence_id: evidenceId, success: false, error: 'Processing failed' })
        }
      }

      return new Response(JSON.stringify({
        message: 'Evidence linked successfully',
        results
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Unlink evidence from framework
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!frameworkId || !evidenceId) {
        return new Response(JSON.stringify({
          error: 'framework_id and evidence_id are required'
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

      const sectionKey = url.searchParams.get('section_key')

      let query = 'DELETE FROM framework_evidence WHERE framework_id = ? AND evidence_id = ?'
      const params = [frameworkId, evidenceId]

      if (sectionKey) {
        query += ' AND section_key = ?'
        params.push(sectionKey)
      }

      const delResult = await env.DB.prepare(query).bind(...params).run()

      if (!delResult.meta.changes || delResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Evidence link not found' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Evidence unlinked successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Framework-Evidence API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
