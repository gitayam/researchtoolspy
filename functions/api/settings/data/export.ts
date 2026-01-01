/**
 * Data Export API
 *
 * POST: Export user data in various formats
 */

import { requireAuth } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface ExportRequest {
  export_type: 'full' | 'workspace' | 'settings' | 'frameworks' | 'evidence'
  format: 'json' | 'csv' | 'excel' | 'pdf'
  workspace_id?: string
  include_metadata?: boolean
  include_comments?: boolean
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * Export settings
 */
async function exportSettings(db: D1Database, userHash: string) {
  const results = await db
    .prepare('SELECT category, setting_key, setting_value FROM user_settings WHERE user_hash = ?')
    .bind(userHash)
    .all()

  const settings: Record<string, any> = {}

  for (const row of results.results || []) {
    const { category, setting_key, setting_value } = row as any
    if (!settings[category]) settings[category] = {}
    try {
      settings[category][setting_key] = JSON.parse(setting_value)
    } catch {
      settings[category][setting_key] = setting_value
    }
  }

  return settings
}

/**
 * Export workspaces
 */
async function exportWorkspaces(db: D1Database, userHash: string, workspaceId?: string) {
  let query = 'SELECT * FROM workspaces WHERE user_hash = ?'
  const bindings = [userHash]

  if (workspaceId) {
    query += ' AND id = ?'
    bindings.push(workspaceId)
  }

  const results = await db.prepare(query).bind(...bindings).all()
  return results.results || []
}

/**
 * Export frameworks
 */
async function exportFrameworks(db: D1Database, userHash: string, workspaceId?: string) {
  // This is a placeholder - adjust based on your actual frameworks table structure
  let query = `
    SELECT f.*
    FROM frameworks f
    JOIN workspaces w ON f.workspace_id = w.id
    WHERE w.user_hash = ?
  `
  const bindings = [userHash]

  if (workspaceId) {
    query += ' AND w.id = ?'
    bindings.push(workspaceId)
  }

  try {
    const results = await db.prepare(query).bind(...bindings).all()
    return results.results || []
  } catch {
    // Table might not exist yet
    return []
  }
}

/**
 * Export evidence
 */
async function exportEvidence(db: D1Database, userHash: string, workspaceId?: string) {
  // This is a placeholder - adjust based on your actual evidence table structure
  let query = `
    SELECT e.*
    FROM evidence e
    JOIN workspaces w ON e.workspace_id = w.id
    WHERE w.user_hash = ?
  `
  const bindings = [userHash]

  if (workspaceId) {
    query += ' AND w.id = ?'
    bindings.push(workspaceId)
  }

  try {
    const results = await db.prepare(query).bind(...bindings).all()
    return results.results || []
  } catch {
    // Table might not exist yet
    return []
  }
}

/**
 * POST /api/settings/data/export
 * Export user data
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    const body = (await context.request.json()) as ExportRequest

    // Validate export request
    if (!['full', 'workspace', 'settings', 'frameworks', 'evidence'].includes(body.export_type)) {
      return Response.json({ error: 'Invalid export_type' }, { status: 400 })
    }

    if (!['json', 'csv', 'excel', 'pdf'].includes(body.format)) {
      return Response.json({ error: 'Invalid format' }, { status: 400 })
    }

    // Only JSON is fully supported for now
    if (body.format !== 'json') {
      return Response.json({ error: 'Only JSON format is currently supported' }, { status: 400 })
    }

    // Build export data
    const exportData: any = {
      export_id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_hash: userHash,
      exported_at: new Date().toISOString(),
      export_type: body.export_type,
      version: '1.0',
      data: {},
    }

    // Collect data based on export type
    if (body.export_type === 'full' || body.export_type === 'settings') {
      exportData.data.settings = await exportSettings(context.env.DB, userHash)
    }

    if (body.export_type === 'full' || body.export_type === 'workspace') {
      exportData.data.workspaces = await exportWorkspaces(context.env.DB, userHash, body.workspace_id)
    }

    if (body.export_type === 'full' || body.export_type === 'frameworks') {
      exportData.data.frameworks = await exportFrameworks(context.env.DB, userHash, body.workspace_id)
    }

    if (body.export_type === 'full' || body.export_type === 'evidence') {
      exportData.data.evidence = await exportEvidence(context.env.DB, userHash, body.workspace_id)
    }

    // Log export in database
    try {
      await context.env.DB.prepare(
        `INSERT INTO data_exports (export_id, user_hash, export_type, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      )
        .bind(exportData.export_id, userHash, body.export_type)
        .run()
    } catch {
      // Table might not exist yet - continue anyway
    }

    // Return JSON file
    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new TextEncoder().encode(jsonString)

    return new Response(blob, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="omnicore_export_${exportData.export_id}.json"`,
        'Content-Length': blob.byteLength.toString(),
      },
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Export error:', error)
    return Response.json(
      {
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
