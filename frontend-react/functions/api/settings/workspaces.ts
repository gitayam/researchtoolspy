/**
 * Workspaces Settings API
 *
 * Manages workspaces for hash-based authentication
 * GET: List all workspaces for a hash
 * POST: Create new workspace
 */

interface Env {
  DB: D1Database
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
 * Extract user hash from request
 */
function getUserHash(request: Request): string | null {
  const headerHash = request.headers.get('X-User-Hash')
  if (headerHash) return headerHash

  const url = new URL(request.url)
  const queryHash = url.searchParams.get('hash')
  return queryHash || null
}

/**
 * Validate hash format
 */
function isValidHash(hash: string): boolean {
  return /^\d{16}$/.test(hash)
}

/**
 * GET /api/settings/workspaces
 * List all workspaces for a hash
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userHash = getUserHash(context.request)

    if (!userHash) {
      return Response.json({ error: 'Missing user hash' }, { status: 400 })
    }

    if (!isValidHash(userHash)) {
      return Response.json({ error: 'Invalid hash format' }, { status: 400 })
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
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      )
        .bind(
          defaultWorkspace.id,
          defaultWorkspace.name,
          defaultWorkspace.description,
          defaultWorkspace.type,
          userHash,
          defaultWorkspace.is_public ? 1 : 0,
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
  } catch (error) {
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
    const userHash = getUserHash(context.request)

    if (!userHash) {
      return Response.json({ error: 'Missing user hash' }, { status: 400 })
    }

    if (!isValidHash(userHash)) {
      return Response.json({ error: 'Invalid hash format' }, { status: 400 })
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
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
      .bind(id, body.name, body.description || null, body.type, userHash, isPublic ? 1 : 0, createdAt)
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
  } catch (error) {
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
