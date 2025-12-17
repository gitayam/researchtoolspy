/**
 * POST /api/frameworks/public/:token/clone
 * Clone a public framework
 * - For authenticated users: saves to their workspace
 * - For non-authenticated users: returns data for local storage
 */

interface Env {
  DB: D1Database
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { token } = context.params as { token: string }
    const userId = context.data?.user?.id

    // Get the public framework
    const framework = await context.env.DB
      .prepare(`
        SELECT
          id, title, description, framework_type,
          data, config, tags, category
        FROM framework_sessions
        WHERE share_token = ? AND is_public = 1
      `)
      .bind(token)
      .first()

    if (!framework) {
      return Response.json({ error: 'Public framework not found' }, { status: 404 })
    }

    // Increment clone count (fire and forget)
    context.waitUntil(
      context.env.DB
        .prepare('UPDATE framework_sessions SET clone_count = clone_count + 1 WHERE id = ?')
        .bind(framework.id)
        .run()
    )

    // Parse data
    const data = framework.data ? JSON.parse(framework.data as string) : {}
    const config = framework.config ? JSON.parse(framework.config as string) : null
    const tags = framework.tags ? JSON.parse(framework.tags as string) : []

    // If user is authenticated, save to their workspace
    if (userId) {
      const result = await context.env.DB
        .prepare(`
          INSERT INTO framework_sessions (
            user_id, title, description, framework_type,
            data, config, tags, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'), datetime('now'))
        `)
        .bind(
          userId,
          `${framework.title} (Copy)`,
          framework.description,
          framework.framework_type,
          framework.data,
          framework.config,
          framework.tags
        )
        .run()

      const clonedId = result.meta.last_row_id

      return Response.json({
        success: true,
        saved_to: 'workspace',
        id: clonedId,
        title: `${framework.title} (Copy)`,
        framework_type: framework.framework_type,
        redirect: `/frameworks/${framework.framework_type}/${clonedId}`
      })
    }

    // For non-authenticated users, return data for local storage
    return Response.json({
      success: true,
      saved_to: 'local',
      framework: {
        title: `${framework.title} (Copy)`,
        description: framework.description,
        framework_type: framework.framework_type,
        data,
        config,
        tags,
        category: framework.category,
        cloned_from_public: true
      },
      message: 'Framework cloned to local storage. Sign in to save permanently.'
    })

  } catch (error) {
    console.error('Clone public framework error:', error)
    return Response.json({
      error: 'Failed to clone framework',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
