// ============================================================================
// Library Voting API - Upvote/downvote frameworks
// ============================================================================

import { logActivity, notifySubscribers } from '../../utils/activity-logger'
import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Hash',
  'Content-Type': 'application/json',
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const userId = await requireAuth(request, env)
    
    // Get user hash for legacy column
    const userResult = await env.DB.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
    const userHash = userResult?.user_hash as string

    if (!userHash) {
      return new Response(JSON.stringify({ error: 'User hash not found' }), {
        status: 404,
        headers: CORS_HEADERS
      })
    }

    if (request.method === 'POST') {
      const body: any = await request.json()
      const { library_framework_id, vote_type } = body

      if (!library_framework_id || !vote_type || !['up', 'down'].includes(vote_type)) {
        return new Response(JSON.stringify({ error: 'Invalid vote data' }), {
          status: 400,
          headers: CORS_HEADERS
        })
      }

      // Check if framework exists and get details
      const framework = await env.DB.prepare(
        'SELECT id, title, workspace_id FROM library_frameworks WHERE id = ? AND is_published = 1'
      ).bind(library_framework_id).first()

      if (!framework) {
        return new Response(JSON.stringify({ error: 'Framework not found' }), {
          status: 404,
          headers: CORS_HEADERS
        })
      }

      // Check for existing vote
      const existingVote = await env.DB.prepare(
        'SELECT id, vote_type FROM library_votes WHERE library_framework_id = ? AND user_hash = ?'
      ).bind(library_framework_id, userHash).first()

      if (existingVote) {
        if (existingVote.vote_type === vote_type) {
          // Same vote - remove it (toggle off)
          await env.DB.prepare(
            'DELETE FROM library_votes WHERE id = ?'
          ).bind(existingVote.id).run()

          // Recalculate vote score
          const scoreResult = await env.DB.prepare(`
            SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE -1 END) as score
            FROM library_votes WHERE library_framework_id = ?
          `).bind(library_framework_id).first()

          await env.DB.prepare(
            'UPDATE library_frameworks SET vote_score = ? WHERE id = ?'
          ).bind(scoreResult?.score || 0, library_framework_id).run()

          return new Response(JSON.stringify({
            action: 'removed',
            vote_score: scoreResult?.score || 0
          }), { headers: CORS_HEADERS })
        } else {
          // Different vote - update it
          await env.DB.prepare(
            'UPDATE library_votes SET vote_type = ?, voted_at = ? WHERE id = ?'
          ).bind(vote_type, new Date().toISOString(), existingVote.id).run()

          // Trigger will update vote_score
          const scoreResult = await env.DB.prepare(
            'SELECT vote_score FROM library_frameworks WHERE id = ?'
          ).bind(library_framework_id).first()

          return new Response(JSON.stringify({
            action: 'updated',
            vote_type,
            vote_score: scoreResult?.vote_score || 0
          }), { headers: CORS_HEADERS })
        }
      } else {
        // New vote
        const voteId = `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await env.DB.prepare(`
          INSERT INTO library_votes (id, library_framework_id, user_hash, vote_type, voted_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(voteId, library_framework_id, userHash, vote_type, new Date().toISOString()).run()

        // Trigger will update vote_score
        const scoreResult = await env.DB.prepare(
          'SELECT vote_score FROM library_frameworks WHERE id = ?'
        ).bind(library_framework_id).first()

        // Log activity
        await logActivity(env.DB, {
          workspace_id: framework.workspace_id as string,
          user_hash: userHash,
          activity_type: 'vote',
          entity_type: 'library_item',
          entity_id: library_framework_id,
          entity_title: framework.title as string,
          action_summary: `${vote_type}voted "${framework.title}"`,
          metadata: { vote_type }
        })

        // Notify subscribers
        await notifySubscribers(
          env.DB,
          'library_item',
          library_framework_id,
          'vote',
          userHash,
          'Anonymous', // TODO: Get user name
          framework.title as string,
          framework.workspace_id as string
        )

        return new Response(JSON.stringify({
          action: 'added',
          vote_type,
          vote_score: scoreResult?.vote_score || 0
        }), { headers: CORS_HEADERS })
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS
    })

  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('[Library Vote API] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
