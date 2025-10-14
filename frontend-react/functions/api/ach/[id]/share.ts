/**
 * ACH Analysis Public Sharing API
 * POST /api/ach/:id/share - Toggle public/private and manage sharing settings
 */

import { getUserIdOrDefault } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

interface ShareRequest {
  is_public: boolean
  domain?: string
  tags?: string[]
}

// POST /api/ach/:id/share - Toggle public/private sharing
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { id } = context.params
    const userId = await getUserIdOrDefault(context.request, context.env)
    const data = await context.request.json() as ShareRequest

    // Verify ownership - try with new columns first, fallback to basic
    let existing: any
    try {
      existing = await context.env.DB.prepare(
        'SELECT id, share_token, is_public, domain, tags, shared_publicly_at FROM ach_analyses WHERE id = ? AND user_id = ?'
      ).bind(id, userId).first()
    } catch (err) {
      // Columns might not exist yet, try basic query
      console.log('Falling back to basic SELECT:', err)
      existing = await context.env.DB.prepare(
        'SELECT id FROM ach_analyses WHERE id = ? AND user_id = ?'
      ).bind(id, userId).first()
    }

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Analysis not found or access denied' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let shareToken = existing.share_token as string | null

    // Generate share token if making public and doesn't have one
    if (data.is_public && !shareToken) {
      shareToken = crypto.randomUUID()
    }

    const now = new Date().toISOString()

    // Update analysis with sharing settings
    // Try to update with all fields, fall back if columns don't exist
    let updateSuccess = false

    try {
      await context.env.DB.prepare(`
        UPDATE ach_analyses SET
          is_public = ?,
          share_token = ?,
          domain = ?,
          tags = ?,
          shared_publicly_at = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        data.is_public ? 1 : 0,
        shareToken,
        data.domain || null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.is_public ? (existing.is_public ? existing.shared_publicly_at : now) : null,
        now,
        id
      ).run()
      updateSuccess = true
    } catch (updateError) {
      // Fall back to basic update if columns don't exist
      console.warn('Falling back to basic share update. Columns may not exist yet:', updateError)
      console.warn('Error details:', updateError instanceof Error ? updateError.message : String(updateError))

      try {
        await context.env.DB.prepare(`
          UPDATE ach_analyses SET
            is_public = ?,
            share_token = ?,
            updated_at = ?
          WHERE id = ?
        `).bind(
          data.is_public ? 1 : 0,
          shareToken,
          now,
          id
        ).run()
        updateSuccess = true
      } catch (fallbackError) {
        console.error('Even basic update failed:', fallbackError)
        throw new Error(`Failed to update analysis sharing: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`)
      }
    }

    if (!updateSuccess) {
      throw new Error('Failed to update analysis sharing settings')
    }

    return new Response(JSON.stringify({
      success: true,
      is_public: data.is_public,
      share_token: data.is_public ? shareToken : null,
      share_url: data.is_public ? `/public/ach/${shareToken}` : null,
      domain: data.domain,
      tags: data.tags
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('ACH share error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update sharing settings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
