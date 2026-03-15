// Cloudflare Pages Function for Evidence API
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
    const evidenceId = url.searchParams.get('id')
    const userId = await getUserIdOrDefault(request, env)

    // GET - List evidence or get single evidence
    if (request.method === 'GET') {
      if (evidenceId) {
        // Get single evidence from D1
        const evidence = await env.DB.prepare(
          'SELECT * FROM evidence WHERE id = ? AND created_by = ?'
        ).bind(evidenceId, userId).first()

        if (!evidence) {
          return new Response(JSON.stringify({ error: 'Evidence not found' }), {
            status: 404,
            headers: JSON_HEADERS,
          })
        }

        // Parse JSON fields
        const safeJSON = (val: any, fallback: any = []) => {
          if (!val) return fallback
          try { return JSON.parse(val) } catch { return fallback }
        }
        const parsedEvidence = {
          ...evidence,
          tags: safeJSON(evidence.tags, []),
          source: safeJSON(evidence.source, {}),
          metadata: safeJSON(evidence.metadata, {}),
          sats_evaluation: safeJSON(evidence.sats_evaluation, null),
          frameworks: safeJSON(evidence.frameworks, []),
          attachments: safeJSON(evidence.attachments, []),
          key_points: safeJSON(evidence.key_points, []),
          contradictions: safeJSON(evidence.contradictions, []),
          corroborations: safeJSON(evidence.corroborations, []),
          implications: safeJSON(evidence.implications, []),
          previous_versions: safeJSON(evidence.previous_versions, []),
        }

        return new Response(JSON.stringify(parsedEvidence), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      // List all evidence with optional filters
      const type = url.searchParams.get('type')
      const status = url.searchParams.get('status')
      const limit = parseInt(url.searchParams.get('limit') || '50')

      let query = 'SELECT * FROM evidence WHERE created_by = ?'
      const params: any[] = [userId]

      if (type) {
        query += ' AND type = ?'
        params.push(type)
      }
      if (status) {
        query += ' AND status = ?'
        params.push(status)
      }

      query += ' ORDER BY updated_at DESC LIMIT ?'
      params.push(limit)

      const results = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields for all results (using safeJSON to handle malformed data)
      const safeJ = (val: any, fallback: any = []) => {
        if (!val) return fallback
        try { return JSON.parse(val) } catch { return fallback }
      }
      const parsedResults = (results.results || []).map((evidence: any) => ({
        ...evidence,
        tags: safeJ(evidence.tags, []),
        source: safeJ(evidence.source, {}),
        metadata: safeJ(evidence.metadata, {}),
        sats_evaluation: safeJ(evidence.sats_evaluation, null),
        frameworks: safeJ(evidence.frameworks, []),
        attachments: safeJ(evidence.attachments, []),
        key_points: safeJ(evidence.key_points, []),
        contradictions: safeJ(evidence.contradictions, []),
        corroborations: safeJ(evidence.corroborations, []),
        implications: safeJ(evidence.implications, []),
        previous_versions: safeJ(evidence.previous_versions, []),
      }))

      return new Response(JSON.stringify({ evidence: parsedResults }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // POST - Create new evidence
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      // Build source object from separate fields or existing source object
      const source = body.source || {
        type: body.source_type || body.type,
        name: body.source_name || '',
        url: body.source_url || null,
        credibility: body.credibility || '6',
        reliability: body.reliability || 'F'
      }

      const result = await env.DB.prepare(
        `INSERT INTO evidence (
          title, description, content, type, status, tags,
          source, metadata, sats_evaluation, frameworks, attachments,
          created_by, created_at, updated_at,
          key_points, contradictions, corroborations, implications,
          version, previous_versions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?)`
      ).bind(
        body.title,
        body.description || '',
        body.content || '',
        body.type,
        body.status || 'pending',
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        JSON.stringify(source),
        JSON.stringify(body.metadata || {}),
        body.sats_evaluation ? JSON.stringify(body.sats_evaluation) : null,
        JSON.stringify(body.frameworks || []),
        JSON.stringify(body.attachments || []),
        authUserId,
        JSON.stringify(body.key_points || []),
        JSON.stringify(body.contradictions || []),
        JSON.stringify(body.corroborations || []),
        JSON.stringify(body.implications || []),
        body.version || 1,
        JSON.stringify(body.previous_versions || [])
      ).run()

      return new Response(JSON.stringify({
        id: result.meta.last_row_id,
        message: 'Evidence created successfully'
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // PUT - Update evidence
    if (request.method === 'PUT') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      // Build source object from separate fields or existing source object
      const source = body.source || {
        type: body.source_type || body.type,
        name: body.source_name || '',
        url: body.source_url || null,
        credibility: body.credibility || '6',
        reliability: body.reliability || 'F'
      }

      const updateResult = await env.DB.prepare(
        `UPDATE evidence
         SET title = ?, description = ?, content = ?, type = ?, status = ?,
             tags = ?, source = ?, metadata = ?, sats_evaluation = ?,
             frameworks = ?, attachments = ?, updated_at = datetime('now'),
             updated_by = ?, key_points = ?, contradictions = ?,
             corroborations = ?, implications = ?, version = ?, previous_versions = ?
         WHERE id = ? AND created_by = ?`
      ).bind(
        body.title,
        body.description || '',
        body.content || '',
        body.type,
        body.status,
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
        JSON.stringify(source),
        JSON.stringify(body.metadata || {}),
        body.sats_evaluation ? JSON.stringify(body.sats_evaluation) : null,
        JSON.stringify(body.frameworks || []),
        JSON.stringify(body.attachments || []),
        authUserId,
        JSON.stringify(body.key_points || []),
        JSON.stringify(body.contradictions || []),
        JSON.stringify(body.corroborations || []),
        JSON.stringify(body.implications || []),
        body.version || 1,
        JSON.stringify(body.previous_versions || []),
        evidenceId,
        authUserId
      ).run()

      if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Evidence not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Evidence updated successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Delete evidence (scoped to owner)
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const result = await env.DB.prepare(
        'DELETE FROM evidence WHERE id = ? AND created_by = ?'
      ).bind(evidenceId, authUserId).run()

      if (result.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Evidence not found or access denied' }), {
          status: 404,
          headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Evidence deleted successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('[EVIDENCE API] Error:', error)

    // If table doesn't exist, return empty array for GET requests
    if (request.method === 'GET' && error.message?.includes('no such table')) {
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
