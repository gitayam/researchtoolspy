/**
 * Workspaces Settings API
 *
 * Manages workspaces for hash-based authentication
 * GET: List all workspaces for a hash
 * POST: Create new workspace
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface Workspace {
  id: string
  name: string
  description?: string
  type: 'PERSONAL' | 'TEAM' | 'PUBLIC'
  user_hash: string
  is_public: boolean
  is_default: boolean
  created_at: string
  updated_at?: string
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * GET /api/settings/workspaces
 * List all workspaces for a hash
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    // Query workspaces owned by this hash
    const results = await context.env.DB.prepare(
      `SELECT id, name, description, type, user_hash, is_public, created_at, updated_at
       FROM workspaces
       WHERE user_hash = ?
       ORDER BY created_at ASC`
    )
      .bind(userHash)
      .all()

    const workspaces = (results.results || []).map((row: any) => ({
      ...row,
      is_public: Boolean(row.is_public),
      is_default: row.id === '1', // First workspace is default
    }))

    // If no workspaces exist, create a default one
    if (workspaces.length === 0) {
      const defaultWorkspace = {
        id: '1',
        name: 'My Workspace',
        description: 'Default workspace',
        type: 'PERSONAL' as const,
        user_hash: userHash,
        is_public: false,
        is_default: true,
        created_at: new Date().toISOString(),
      }

      await context.env.DB.prepare(
        `INSERT INTO workspaces (id, name, description, type, user_hash, is_public, owner_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          defaultWorkspace.id,
          defaultWorkspace.name,
          defaultWorkspace.description,
          defaultWorkspace.type,
          userHash,
          defaultWorkspace.is_public ? 1 : 0,
          userId, // Correct owner_id
          defaultWorkspace.created_at
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
        message: error instanceof Error ? error.message : 'Unknown error',
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
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

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
    const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const isPublic = body.type === 'PUBLIC'
    const createdAt = new Date().toISOString()

    // Insert workspace
    await context.env.DB.prepare(
      `INSERT INTO workspaces (id, name, description, type, user_hash, is_public, owner_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, body.name, body.description || null, body.type, userHash, isPublic ? 1 : 0, userId, createdAt)
      .run()

    const workspace = {
      id,
      name: body.name,
      description: body.description,
      type: body.type,
      user_hash: userHash,
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
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
