// Cloudflare Pages Function for Framework-Evidence Linking API
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
    const evidenceId = url.searchParams.get('evidence_id')

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
        `).bind(frameworkId).all()

        const parsedLinks = links.results.map((link: any) => ({
          ...link,
          tags: JSON.parse(link.tags || '[]')
        }))

        return new Response(JSON.stringify({ links: parsedLinks }), {
          status: 200,
          headers: corsHeaders,
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
        `).bind(evidenceId).all()

        return new Response(JSON.stringify({ links: links.results }), {
          status: 200,
          headers: corsHeaders,
        })
      }

      return new Response(JSON.stringify({ error: 'framework_id or evidence_id required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // POST - Link evidence to framework
    if (request.method === 'POST') {
      const body = await request.json()

      if (!body.framework_id || !body.evidence_ids || !Array.isArray(body.evidence_ids)) {
        return new Response(JSON.stringify({
          error: 'framework_id and evidence_ids (array) are required'
        }), {
          status: 400,
          headers: corsHeaders,
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
            body.created_by || 1
          ).run()

          results.push({ evidence_id: evidenceId, success: true })
        } catch (error: any) {
          results.push({ evidence_id: evidenceId, success: false, error: error.message })
        }
      }

      return new Response(JSON.stringify({
        message: 'Evidence linked successfully',
        results
      }), {
        status: 201,
        headers: corsHeaders,
      })
    }

    // DELETE - Unlink evidence from framework
    if (request.method === 'DELETE') {
      if (!frameworkId || !evidenceId) {
        return new Response(JSON.stringify({
          error: 'framework_id and evidence_id are required'
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      const sectionKey = url.searchParams.get('section_key')

      let query = 'DELETE FROM framework_evidence WHERE framework_id = ? AND evidence_id = ?'
      const params = [frameworkId, evidenceId]

      if (sectionKey) {
        query += ' AND section_key = ?'
        params.push(sectionKey)
      }

      await env.DB.prepare(query).bind(...params).run()

      return new Response(JSON.stringify({ message: 'Evidence unlinked successfully' }), {
        status: 200,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })

  } catch (error: any) {
    console.error('Framework-Evidence API error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}
