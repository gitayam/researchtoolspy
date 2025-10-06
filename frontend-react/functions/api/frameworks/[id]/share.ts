/**
 * POST /api/frameworks/:id/share
 * Toggle public/private sharing for a framework
 */

interface Env {
  DB: D1Database
}

function generateShareToken(): string {
  // Generate a URL-safe random token (12 chars = 72 bits of entropy)
  const array = new Uint8Array(9)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { id } = context.params as { id: string }
    const { is_public, category } = await context.request.json() as { is_public: boolean; category?: string }

    // Check authentication
    const userId = context.data?.user?.id
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const framework = await context.env.DB
      .prepare('SELECT id, user_id, is_public, share_token FROM framework_sessions WHERE id = ?')
      .bind(id)
      .first()

    if (!framework) {
      return Response.json({ error: 'Framework not found' }, { status: 404 })
    }

    if (framework.user_id !== userId) {
      return Response.json({ error: 'Forbidden - you do not own this framework' }, { status: 403 })
    }

    // Generate share token if making public and doesn't have one
    let shareToken = framework.share_token as string | null
    if (is_public && !shareToken) {
      shareToken = generateShareToken()
    }

    // Update framework
    await context.env.DB
      .prepare(`
        UPDATE framework_sessions
        SET is_public = ?,
            share_token = ?,
            category = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(is_public ? 1 : 0, shareToken, category || null, id)
      .run()

    // Return updated info
    const shareUrl = shareToken ? `${new URL(context.request.url).origin}/public/framework/${shareToken}` : null

    return Response.json({
      success: true,
      is_public,
      share_token: shareToken,
      share_url: shareUrl,
      category
    })

  } catch (error) {
    console.error('Share framework error:', error)
    return Response.json({
      error: 'Failed to update sharing settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
