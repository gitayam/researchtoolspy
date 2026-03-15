// Cloudflare Pages Function for Framework-Dataset Linking API
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
    const datasetId = url.searchParams.get('dataset_id')
    const userId = await getUserIdOrDefault(request, env)

    // GET - Get linked dataset for a framework or frameworks for an dataset
    if (request.method === 'GET') {
      if (frameworkId) {
        // Get all dataset linked to this framework
        const workspaceId = url.searchParams.get('workspace_id') || request.headers.get('X-Workspace-ID') || null
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            e.id as dataset_id,
            e.title,
            e.description,
            e.type,
            e.status,
            e.source,
            e.tags
          FROM framework_datasets fe
          JOIN datasets e ON fe.dataset_id = e.id
          WHERE fe.framework_id = ? AND e.workspace_id = ?
          ORDER BY fe.created_at DESC
          LIMIT 500
        `).bind(frameworkId, workspaceId).all()

        const safeJSON = (val: any, fallback: any = []) => {
          if (!val) return fallback
          try { return JSON.parse(val) } catch { return fallback }
        }
        const parsedLinks = (links.results || []).map((link: any) => ({
          ...link,
          source: safeJSON(link.source, {}),
          tags: safeJSON(link.tags, [])
        }))

        return new Response(JSON.stringify({ links: parsedLinks }), {
          status: 200,
          headers: JSON_HEADERS,
        })
      } else if (datasetId) {
        // Get all frameworks this dataset is linked to
        const links = await env.DB.prepare(`
          SELECT
            fe.*,
            f.id as framework_id,
            f.framework_type,
            f.title,
            f.status
          FROM framework_datasets fe
          JOIN framework_sessions f ON fe.framework_id = f.id
          WHERE fe.dataset_id = ?
          ORDER BY fe.created_at DESC
          LIMIT 500
        `).bind(datasetId).all()

        return new Response(JSON.stringify({ links: links.results }), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ error: 'framework_id or dataset_id required' }), {
        status: 400,
        headers: JSON_HEADERS,
      })
    }

    // POST - Link dataset to framework
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()

      if (!body.framework_id || !body.dataset_ids || !Array.isArray(body.dataset_ids)) {
        return new Response(JSON.stringify({
          error: 'framework_id and dataset_ids (array) are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Link each dataset to the framework
      const results = []
      for (const datasetId of body.dataset_ids) {
        try {
          const result = await env.DB.prepare(`
            INSERT OR REPLACE INTO framework_datasets
            (framework_id, dataset_id, section_key, relevance_note, created_by)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            body.framework_id,
            datasetId,
            body.section_key || null,
            body.relevance_note || null,
            userId
          ).run()

          results.push({ dataset_id: datasetId, success: true })
        } catch (error: any) {
          results.push({ dataset_id: datasetId, success: false, error: 'Processing failed' })
        }
      }

      return new Response(JSON.stringify({
        message: 'Dataset linked successfully',
        results
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // DELETE - Unlink dataset from framework
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!frameworkId || !datasetId) {
        return new Response(JSON.stringify({
          error: 'framework_id and dataset_id are required'
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

      let query = 'DELETE FROM framework_datasets WHERE framework_id = ? AND dataset_id = ?'
      const params = [frameworkId, datasetId]

      if (sectionKey) {
        query += ' AND section_key = ?'
        params.push(sectionKey)
      }

      const delResult = await env.DB.prepare(query).bind(...params).run()

      if (!delResult.meta.changes || delResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      return new Response(JSON.stringify({ message: 'Dataset unlinked successfully' }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Framework-Dataset API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
