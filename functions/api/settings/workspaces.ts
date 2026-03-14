/**
 * Workspaces Settings API
 *
 * Manages workspaces for hash-based authentication
 * GET: List all workspaces for a user
 * POST: Create new workspace
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

/**
 * GET /api/settings/workspaces
 * List all workspaces for the authenticated user
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    // Query workspaces owned by this user
    const results = await context.env.DB.prepare(
      `SELECT id, name, description, type, is_public, created_at, updated_at
       FROM workspaces
       WHERE owner_id = ?
       ORDER BY created_at ASC`
    )
      .bind(userId)
      .all()

    const workspaces = (results.results || []).map((row: any) => ({
      ...row,
      is_public: Boolean(row.is_public),
      is_default: row.id === '1',
    }))

    // If no workspaces exist, create a default one
    if (workspaces.length === 0) {
      const defaultId = crypto.randomUUID()
      const createdAt = new Date().toISOString()

      const defaultWorkspace = {
        id: defaultId,
        name: 'My Workspace',
        description: 'Default workspace',
        type: 'PERSONAL' as const,
        is_public: false,
        is_default: true,
        created_at: createdAt,
      }

      await context.env.DB.prepare(
        `INSERT INTO workspaces (id, name, description, type, is_public, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          defaultId,
          defaultWorkspace.name,
          defaultWorkspace.description,
          defaultWorkspace.type,
          0,
          userId,
          createdAt,
          createdAt
        )
        .run()

      return Response.json({
        workspaces: [defaultWorkspace],
      })
    }

    return Response.json({
      workspaces,
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Workspaces GET error:', error)
    return Response.json(
      {
        error: 'Failed to load workspaces',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/workspaces
 * Create new workspace
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)

    const body = (await context.request.json()) as {
      name: string
      description?: string
      type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
    }

    if (!body.name || !body.name.trim()) {
      return Response.json({ error: 'Workspace name is required' }, { status: 400 })
    }

    if (!['PERSONAL', 'TEAM', 'PUBLIC'].includes(body.type)) {
      return Response.json({ error: 'Invalid workspace type' }, { status: 400 })
    }

    // Generate unique ID
    const id = crypto.randomUUID()
    const isPublic = body.type === 'PUBLIC'
    const createdAt = new Date().toISOString()

    // Insert workspace
    await context.env.DB.prepare(
      `INSERT INTO workspaces (id, name, description, type, is_public, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, body.name, body.description || null, body.type, isPublic ? 1 : 0, userId, createdAt, createdAt)
      .run()

    const workspace = {
      id,
      name: body.name,
      description: body.description,
      type: body.type,
      is_public: isPublic,
      is_default: false,
      created_at: createdAt,
    }

    return Response.json(workspace, { status: 201 })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Workspace POST error:', error)
    return Response.json(
      {
        error: 'Failed to create workspace',
      },
      { status: 500 }
    )
  }
}
