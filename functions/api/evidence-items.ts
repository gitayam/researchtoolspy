// Cloudflare Pages Function for Evidence Items API
import { getUserFromRequest } from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS, safeJsonParse } from './_shared/api-utils'
import { checkWorkspaceAccess } from './_shared/workspace-helpers'

function serializeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    const url = new URL(request.url)
    const evidenceId = url.searchParams.get('id')

    // GET - Get evidence item(s)
    if (request.method === 'GET') {
      const userId = await getUserFromRequest(request, env)
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const workspaceId = url.searchParams.get('workspace_id') || request.headers.get('X-Workspace-ID') || null
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }
      if (evidenceId) {
        // Get single evidence item with citations
        const evidence = await env.DB.prepare(`
          SELECT * FROM evidence_items
          WHERE id = ? AND ((created_by = ? AND workspace_id = ?) OR is_public = 1)
        `).bind(evidenceId, userId, workspaceId).first()

        if (!evidence) {
          return new Response(JSON.stringify({ error: 'Evidence not found' }), {
            status: 404,
            headers: JSON_HEADERS,
          })
        }

        // Get citations for this evidence
        const citations = await env.DB.prepare(`
          SELECT
            ec.*,
            ec.citation_format as citation_style,
            d.id as dataset_id,
            d.title as dataset_title,
            d.description as dataset_description,
            d.type as dataset_type,
            d.source as dataset_source
          FROM evidence_citations ec
          JOIN datasets d ON ec.dataset_id = d.id
          WHERE ec.evidence_id = ?
          ORDER BY ec.relevance_score DESC
        `).bind(evidenceId).all()

        // Get linked actors
        const linkedActors = await env.DB.prepare(`
          SELECT actor_id, relevance, auto_linked
          FROM evidence_actors
          WHERE evidence_id = ?
        `).bind(evidenceId).all()

        // Parse JSON fields
        const parsedEvidence = {
          ...evidence,
          tags: JSON.parse(evidence.tags || '[]'),
          eve_assessment: safeJsonParse(evidence.eve_assessment, null),
          linked_actors: (linkedActors.results || []).map((la: any) => la.actor_id),
          linked_actors_details: linkedActors.results,
          citations: (citations.results || []).map((c: any) => ({
            ...c,
            dataset: {
              id: c.dataset_id,
              title: c.dataset_title,
              description: c.dataset_description,
              type: c.dataset_type,
              source: JSON.parse(c.dataset_source || '{}'),
            }
          }))
        }

        return new Response(JSON.stringify(parsedEvidence), {
          status: 200,
          headers: JSON_HEADERS,
        })
      }

      // Get list of evidence items with filters
      let query = 'SELECT * FROM evidence_items WHERE 1=1'
      const params: any[] = []

      // Apply filters
      const type = url.searchParams.get('type')
      const level = url.searchParams.get('level')
      const status = url.searchParams.get('status')
      const priority = url.searchParams.get('priority')
      const confidence = url.searchParams.get('confidence_level')
      const category = url.searchParams.get('category')
      const publicOnly = url.searchParams.get('public') === 'true'

      // Scope: show user's own evidence + public evidence
      if (publicOnly) {
        query += ' AND is_public = 1'
      } else {
        query += ' AND ((created_by = ? AND workspace_id = ?) OR is_public = 1)'
        params.push(userId, workspaceId)
      }

      if (type) {
        query += ' AND evidence_type = ?'
        params.push(type)
      }
      if (level) {
        query += ' AND evidence_level = ?'
        params.push(level)
      }
      if (status) {
        query += ' AND status = ?'
        params.push(status)
      }
      if (priority) {
        query += ' AND priority = ?'
        params.push(priority)
      }
      if (confidence) {
        query += ' AND confidence_level = ?'
        params.push(confidence)
      }
      if (category) {
        query += ' AND category = ?'
        params.push(category)
      }

      query += ' ORDER BY created_at DESC LIMIT 100'

      const result = await env.DB.prepare(query).bind(...params).all()

      // Parse JSON fields
      const evidence = (result.results || []).map((item: any) => ({
        ...item,
        tags: JSON.parse(item.tags || '[]'),
        eve_assessment: safeJsonParse(item.eve_assessment, null),
      }))

      return new Response(JSON.stringify({ evidence }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    // POST - Create new evidence item
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      const body = await request.json()
      const workspaceId = body.workspace_id || request.headers.get('X-Workspace-ID') || null

      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      if (!(await checkWorkspaceAccess(workspaceId, authUserId, env, 'EDITOR'))) {
        return new Response(JSON.stringify({ error: 'Access denied to workspace' }), {
          status: 403,
          headers: JSON_HEADERS,
        })
      }

      if (!body.title || !body.evidence_type) {
        return new Response(JSON.stringify({
          error: 'title and evidence_type are required'
        }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      // Insert evidence item
      const result = await env.DB.prepare(`
        INSERT INTO evidence_items (
          title, description,
          who, what, when_occurred, where_location, why_purpose, how_method,
          source_classification, source_name, source_url, source_id,
          evidence_type, evidence_level, category,
          credibility, reliability, confidence_level,
          tags, status, priority,
          workspace_id, eve_assessment,
          created_by, updated_by, is_public, shared_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        body.title,
        body.description || '',  // Empty string instead of null (column is NOT NULL)
        body.who || null,
        body.what || null,
        body.when_occurred || null,
        body.where_location || null,
        body.why_purpose || null,
        body.how_method || null,
        body.source_classification || null,
        body.source_name || null,
        body.source_url || null,
        body.source_id || null,
        body.evidence_type,
        body.evidence_level || 'tactical',
        body.category || null,
        body.credibility || 'unknown',
        body.reliability || 'unknown',
        body.confidence_level || 'low',
        JSON.stringify(body.tags || []),
        body.status || 'pending',
        body.priority || 'normal',
        workspaceId,
        serializeJson(body.eve_assessment),
        authUserId,
        authUserId,
        body.is_public ? 1 : 0,
        body.shared_by_user_id || null
      ).run()

      const evidenceId = result.meta.last_row_id
      const manuallyLinkedActorIds = new Set(
        Array.isArray(body.linked_actors) ? body.linked_actors.map(String) : []
      )

      // Auto-link actors mentioned in the "who" field
      if (body.who && body.who.trim()) {
        try {
          // Search for actors whose names appear in the "who" field (case-insensitive)
          const actors = await env.DB.prepare(`
            SELECT id, name FROM actors
            WHERE LOWER(?) LIKE '%' || LOWER(name) || '%'
            AND LENGTH(name) > 3
            AND workspace_id = ?
            LIMIT 10
          `).bind(body.who, workspaceId).all()

          // Auto-create links for matched actors
          for (const actor of actors.results) {
            if (manuallyLinkedActorIds.has(String(actor.id))) continue
            try {
              await env.DB.prepare(`
                INSERT INTO evidence_actors (evidence_id, actor_id, relevance, auto_linked)
                VALUES (?, ?, ?, 1)
              `).bind(evidenceId, actor.id, 'Auto-detected').run()
            } catch (e) {
              console.error('[Evidence] Auto-link actor failed:', e)
            }
          }
        } catch (error) {
          console.error('[Evidence] Auto-linking failed (non-blocking):', error)
        }
      }

      // Persist required related records atomically. If this batch fails, remove
      // the parent row so callers never receive a 500 after an orphaned create.
      const relatedStatements: D1PreparedStatement[] = []
      if (body.citations && Array.isArray(body.citations)) {
        for (const citation of body.citations) {
          relatedStatements.push(env.DB.prepare(`
            INSERT INTO evidence_citations (
              evidence_id, dataset_id, citation_type,
              page_number, quote, context,
              citation_format, relevance_score, notes,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            evidenceId,
            citation.dataset_id,
            citation.citation_type || 'primary',
            citation.page_number || null,
            citation.quote || null,
            citation.context || null,
            citation.citation_style || citation.citation_format || 'apa',
            citation.relevance_score || 5,
            citation.notes || null,
            authUserId
          ))
        }
      }

      if (body.linked_actors && Array.isArray(body.linked_actors)) {
        for (const actorId of manuallyLinkedActorIds) {
          relatedStatements.push(env.DB.prepare(`
            INSERT INTO evidence_actors (evidence_id, actor_id, relevance, auto_linked)
            VALUES (?, ?, ?, 0)
          `).bind(evidenceId, actorId, 'Mentioned'))
        }
      }

      if (relatedStatements.length > 0) {
        try {
          await env.DB.batch(relatedStatements)
        } catch (error) {
          await env.DB.batch([
            env.DB.prepare('DELETE FROM evidence_citations WHERE evidence_id = ?').bind(evidenceId),
            env.DB.prepare('DELETE FROM evidence_actors WHERE evidence_id = ?').bind(evidenceId),
            env.DB.prepare('DELETE FROM evidence_items WHERE id = ? AND created_by = ?').bind(evidenceId, authUserId),
          ])
          throw error
        }
      }

      return new Response(JSON.stringify({
        message: 'Evidence created successfully',
        id: evidenceId
      }), {
        status: 201,
        headers: JSON_HEADERS,
      })
    }

    // PUT - Update evidence item
    if (request.method === 'PUT') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!evidenceId) {
        return new Response(JSON.stringify({ error: 'Evidence ID required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      const body = await request.json()
      const workspaceId = body.workspace_id || request.headers.get('X-Workspace-ID') || null
      const hasEveAssessment = Object.prototype.hasOwnProperty.call(body, 'eve_assessment')

      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }

      if (!(await checkWorkspaceAccess(workspaceId, authUserId, env, 'EDITOR'))) {
        return new Response(JSON.stringify({ error: 'Access denied to workspace' }), {
          status: 403,
          headers: JSON_HEADERS,
        })
      }
      const existingEvidence = await env.DB.prepare(`
        SELECT id FROM evidence_items
        WHERE id = ? AND created_by = ? AND workspace_id = ?
      `).bind(evidenceId, authUserId, workspaceId).first()
      if (!existingEvidence) {
        return new Response(JSON.stringify({ error: 'Evidence not found or access denied' }), {
          status: 404, headers: JSON_HEADERS,
        })
      }

      let refreshAutoLinks = false
      let autoActorIds: string[] = []
      if (body.who && body.who.trim()) {
        try {
          const actors = await env.DB.prepare(`
            SELECT id FROM actors
            WHERE LOWER(?) LIKE '%' || LOWER(name) || '%'
              AND LENGTH(name) > 3
              AND workspace_id = ?
            LIMIT 10
          `).bind(body.who, workspaceId).all<{ id: string }>()

          const manualActorIds = Array.isArray(body.linked_actors)
            ? body.linked_actors.map(String)
            : (await env.DB.prepare(`
                SELECT actor_id FROM evidence_actors
                WHERE evidence_id = ? AND (auto_linked IS NULL OR auto_linked = 0)
              `).bind(evidenceId).all<{ actor_id: string }>()).results.map((row) => String(row.actor_id))
          const manualActorSet = new Set(manualActorIds)
          autoActorIds = [...new Set(
            (actors.results || []).map((actor) => String(actor.id))
          )].filter((actorId) => !manualActorSet.has(actorId))
          refreshAutoLinks = true
        } catch (error) {
          console.error('[evidence-items] Auto-link lookup failed (preserving existing links):', error)
        }
      }

      const updateStatement = env.DB.prepare(`
        UPDATE evidence_items
        SET
          title = ?,
          description = ?,
          who = ?,
          what = ?,
          when_occurred = ?,
          where_location = ?,
          why_purpose = ?,
          how_method = ?,
          source_classification = ?,
          source_name = ?,
          source_url = ?,
          source_id = ?,
          evidence_type = ?,
          evidence_level = ?,
          category = ?,
          credibility = ?,
          reliability = ?,
          confidence_level = ?,
          tags = ?,
          status = ?,
          priority = ?,
          workspace_id = COALESCE(?, workspace_id),
          eve_assessment = CASE WHEN ? = 1 THEN ? ELSE eve_assessment END,
          updated_at = datetime('now'),
          updated_by = ?,
          is_public = ?,
          shared_by_user_id = ?
        WHERE id = ? AND created_by = ? AND workspace_id = ?
      `).bind(
        body.title,
        body.description || '',  // Empty string instead of null
        body.who || null,
        body.what || null,
        body.when_occurred || null,
        body.where_location || null,
        body.why_purpose || null,
        body.how_method || null,
        body.source_classification || null,
        body.source_name || null,
        body.source_url || null,
        body.source_id || null,
        body.evidence_type,
        body.evidence_level,
        body.category || null,
        body.credibility,
        body.reliability,
        body.confidence_level,
        JSON.stringify(body.tags || []),
        body.status,
        body.priority,
        workspaceId,
        hasEveAssessment ? 1 : 0,
        serializeJson(body.eve_assessment),
        authUserId,
        body.is_public ? 1 : 0,
        body.shared_by_user_id || null,
        evidenceId,
        authUserId,
        workspaceId
      )

      const updateStatements: D1PreparedStatement[] = [updateStatement]
      const ownedEvidenceClause = `
        evidence_id = ?
        AND evidence_id IN (
          SELECT id FROM evidence_items WHERE id = ? AND created_by = ?
        )
      `

      if (refreshAutoLinks) {
        updateStatements.push(env.DB.prepare(`
          DELETE FROM evidence_actors
          WHERE ${ownedEvidenceClause} AND auto_linked = 1
        `).bind(evidenceId, evidenceId, authUserId))

        for (const actorId of autoActorIds) {
          updateStatements.push(env.DB.prepare(`
            INSERT INTO evidence_actors (evidence_id, actor_id, relevance, auto_linked)
            SELECT ?, ?, 'Auto-detected', 1
            WHERE EXISTS (
              SELECT 1 FROM evidence_items WHERE id = ? AND created_by = ?
            )
          `).bind(evidenceId, actorId, evidenceId, authUserId))
        }
      }

      if (body.linked_actors !== undefined) {
        updateStatements.push(env.DB.prepare(`
          DELETE FROM evidence_actors
          WHERE ${ownedEvidenceClause}
            AND (auto_linked IS NULL OR auto_linked = 0)
        `).bind(evidenceId, evidenceId, authUserId))

        if (Array.isArray(body.linked_actors)) {
          for (const actorId of [...new Set(body.linked_actors.map(String))]) {
            updateStatements.push(env.DB.prepare(`
              INSERT INTO evidence_actors (evidence_id, actor_id, relevance, auto_linked)
              SELECT ?, ?, 'Mentioned', 0
              WHERE EXISTS (
                SELECT 1 FROM evidence_items WHERE id = ? AND created_by = ?
              )
            `).bind(evidenceId, actorId, evidenceId, authUserId))
          }
        }
      }

      const [updateResult] = await env.DB.batch(updateStatements)

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

    // DELETE - Delete evidence item
    if (request.method === 'DELETE') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }
      if (!evidenceId) {
        return new Response(JSON.stringify({ error: 'Evidence ID required' }), {
          status: 400,
          headers: JSON_HEADERS,
        })
      }
      const workspaceId = request.headers.get('X-Workspace-ID') || null
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }

      // Delete citations first (scoped to owner's evidence)
      await env.DB.prepare('DELETE FROM evidence_citations WHERE evidence_id = ? AND evidence_id IN (SELECT id FROM evidence_items WHERE created_by = ? AND workspace_id = ?)')
        .bind(evidenceId, authUserId, workspaceId)
        .run()

      // Delete evidence (scoped to owner)
      const delResult = await env.DB.prepare('DELETE FROM evidence_items WHERE id = ? AND created_by = ? AND workspace_id = ?')
        .bind(evidenceId, authUserId, workspaceId)
        .run()

      if (!delResult.meta.changes || delResult.meta.changes === 0) {
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
    console.error('[Evidence Items] Error:', error)

    return new Response(JSON.stringify({
      error: 'Evidence API error',
    }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
