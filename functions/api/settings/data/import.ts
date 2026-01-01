/**
 * Data Import API
 *
 * POST: Import previously exported data
 */

import { requireAuth } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

interface ImportRequest {
  data: {
    export_id: string
    user_hash: string
    exported_at: string
    data: {
      settings?: any
      workspaces?: any[]
      frameworks?: any[]
      evidence?: any[]
    }
  }
  options: {
    merge: boolean
    overwrite: boolean
    import_settings: boolean
    import_workspaces: boolean
    import_frameworks: boolean
    import_evidence: boolean
  }
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * Import settings
 */
async function importSettings(db: D1Database, userHash: string, settings: any, overwrite: boolean) {
  let count = 0

  for (const [category, categorySettings] of Object.entries(settings)) {
    if (!categorySettings || typeof categorySettings !== 'object') continue

    for (const [key, value] of Object.entries(categorySettings)) {
      if (overwrite) {
        await db
          .prepare(
            `INSERT INTO user_settings (user_hash, category, setting_key, setting_value, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (user_hash, category, setting_key)
             DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP`
          )
          .bind(userHash, category, key, JSON.stringify(value), JSON.stringify(value))
          .run()
        count++
      } else {
        // Only insert if doesn't exist
        const existing = await db
          .prepare('SELECT 1 FROM user_settings WHERE user_hash = ? AND category = ? AND setting_key = ?')
          .bind(userHash, category, key)
          .first()

        if (!existing) {
          await db
            .prepare(
              `INSERT INTO user_settings (user_hash, category, setting_key, setting_value, updated_at)
               VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
            )
            .bind(userHash, category, key, JSON.stringify(value))
            .run()
          count++
        }
      }
    }
  }

  return count
}

/**
 * POST /api/settings/data/import
 * Import user data
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    const body = (await context.request.json()) as ImportRequest

    // Validate import data
    if (!body.data || !body.data.export_id) {
      return Response.json({ error: 'Invalid import data' }, { status: 400 })
    }

    if (!body.options) {
      return Response.json({ error: 'Import options required' }, { status: 400 })
    }

    const imported = {
      settings: 0,
      workspaces: 0,
      frameworks: 0,
      evidence: 0,
    }

    const errors: string[] = []

    // Import settings
    if (body.options.import_settings && body.data.data.settings) {
      try {
        imported.settings = await importSettings(
          context.env.DB,
          userHash,
          body.data.data.settings,
          body.options.overwrite
        )
      } catch (error) {
        errors.push(`Settings import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Import workspaces (placeholder - implement based on your needs)
    if (body.options.import_workspaces && body.data.data.workspaces) {
      // TODO: Implement workspace import
      errors.push('Workspace import not yet implemented')
    }

    // Import frameworks (placeholder)
    if (body.options.import_frameworks && body.data.data.frameworks) {
      // TODO: Implement frameworks import
      errors.push('Framework import not yet implemented')
    }

    // Import evidence (placeholder)
    if (body.options.import_evidence && body.data.data.evidence) {
      // TODO: Implement evidence import
      errors.push('Evidence import not yet implemented')
    }

    return Response.json({
      success: true,
      imported_count: imported,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Import error:', error)
    return Response.json(
      {
        error: 'Failed to import data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
