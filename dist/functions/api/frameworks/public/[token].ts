/**
 * GET /api/frameworks/public/:token
 * Get a public framework by share token (no auth required)
 * Increments view count
 */

interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { token } = context.params as { token: string }

    // Get framework by share token
    const framework = await context.env.DB
      .prepare(`
        SELECT
          id, user_id, title, description, framework_type,
          data, config, tags, category, share_token,
          view_count, clone_count, created_at, updated_at
        FROM framework_sessions
        WHERE share_token = ? AND is_public = 1
      `)
      .bind(token)
      .first()

    if (!framework) {
      return Response.json({ error: 'Public framework not found' }, { status: 404 })
    }

    // Increment view count (fire and forget - don't wait)
    context.waitUntil(
      context.env.DB
        .prepare('UPDATE framework_sessions SET view_count = view_count + 1 WHERE id = ?')
        .bind(framework.id)
        .run()
    )

    // Parse JSON fields
    const data = framework.data ? JSON.parse(framework.data as string) : {}
    const config = framework.config ? JSON.parse(framework.config as string) : null
    const tags = framework.tags ? JSON.parse(framework.tags as string) : []

    return Response.json({
      id: framework.id,
      title: framework.title,
      description: framework.description,
      framework_type: framework.framework_type,
      data,
      config,
      tags,
      category: framework.category,
      share_token: framework.share_token,
      view_count: framework.view_count,
      clone_count: framework.clone_count,
      created_at: framework.created_at,
      updated_at: framework.updated_at,
      is_public: true
    })

  } catch (error) {
    console.error('Get public framework error:', error)
    return Response.json({
      error: 'Failed to load public framework',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
