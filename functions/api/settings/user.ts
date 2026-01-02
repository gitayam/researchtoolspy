/**
 * User Settings API
 *
 * Manages user settings stored in D1 database, keyed by hash
 * GET: Retrieve all user settings
 * PUT: Update user settings
 * DELETE: Reset settings to defaults
 */

import { requireAuth } from '../_shared/auth-helpers'

interface Env {
  DB: D1Database
}

interface UserSettings {
  user_hash: string
  display: {
    theme: 'light' | 'dark' | 'system'
    language: 'en' | 'es'
    density: 'compact' | 'comfortable' | 'spacious'
    sidebar_behavior: 'always_open' | 'auto_collapse' | 'manual'
    font_size: 'small' | 'medium' | 'large' | 'x-large'
    show_tooltips: boolean
    animation_enabled: boolean
  }
  ai: {
    default_model: string
    temperature: number
    max_tokens: number
    show_cost_tracking: boolean
    show_token_usage: boolean
    auto_suggestions: boolean
    context_window: number
  }
  notifications: {
    email_enabled: boolean
    desktop_enabled: boolean
    analysis_complete: boolean
    export_ready: boolean
    workspace_invite: boolean
  }
  workspace: {
    default_workspace_id: string
    auto_save_enabled: boolean
    auto_save_interval: number
    show_recent_items: boolean
    recent_items_limit: number
  }
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'user_hash'> = {
  display: {
    theme: 'system',
    language: 'en',
    density: 'comfortable',
    sidebar_behavior: 'auto_collapse',
    font_size: 'medium',
    show_tooltips: true,
    animation_enabled: true,
  },
  ai: {
    default_model: 'gpt-5-mini',
    temperature: 0.7,
    max_tokens: 2048,
    show_cost_tracking: true,
    show_token_usage: true,
    auto_suggestions: true,
    context_window: 4096,
  },
  notifications: {
    email_enabled: false,
    desktop_enabled: true,
    analysis_complete: true,
    export_ready: true,
    workspace_invite: true,
  },
  workspace: {
    default_workspace_id: '1',
    auto_save_enabled: true,
    auto_save_interval: 30,
    show_recent_items: true,
    recent_items_limit: 10,
  },
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * Load settings from database
 */
async function loadSettings(db: D1Database, userHash: string): Promise<UserSettings> {
  const results = await db
    .prepare('SELECT category, setting_key, setting_value FROM user_settings WHERE user_hash = ?')
    .bind(userHash)
    .all()

  if (!results.results || results.results.length === 0) {
    // No settings found - return defaults
    return {
      user_hash: userHash,
      ...DEFAULT_SETTINGS,
    }
  }

  // Build settings object from database rows
  const settings: UserSettings = {
    user_hash: userHash,
    ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), // Deep clone defaults
  }

  for (const row of results.results) {
    const { category, setting_key, setting_value } = row as {
      category: string
      setting_key: string
      setting_value: string
    }

    try {
      const value = JSON.parse(setting_value)
      if (settings[category as keyof UserSettings]) {
        ;(settings[category as keyof Omit<UserSettings, 'user_hash'>] as any)[setting_key] = value
      }
    } catch (error) {
      console.error(`Failed to parse setting ${category}.${setting_key}:`, error)
    }
  }

  return settings
}

/**
 * Save settings to database
 */
async function saveSettings(
  db: D1Database,
  userHash: string,
  updates: Partial<Omit<UserSettings, 'user_hash'>>
): Promise<void> {
  // Start transaction (if supported) or just execute multiple statements
  for (const [category, categorySettings] of Object.entries(updates)) {
    if (!categorySettings || typeof categorySettings !== 'object') continue

    for (const [key, value] of Object.entries(categorySettings)) {
      await db
        .prepare(
          `INSERT INTO user_settings (user_hash, category, setting_key, setting_value, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT (user_hash, category, setting_key)
           DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP`
        )
        .bind(userHash, category, key, JSON.stringify(value), JSON.stringify(value))
        .run()
    }
  }
}

/**
 * GET /api/settings/user
 * Retrieve user settings
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    const settings = await loadSettings(context.env.DB, userHash)

    return Response.json(settings, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Settings GET error:', error)
    return Response.json(
      {
        error: 'Failed to load settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/user
 * Update user settings
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    const updates = (await context.request.json()) as Partial<Omit<UserSettings, 'user_hash'>>

    // Validate updates contain at least one valid category
    const validCategories = ['display', 'ai', 'notifications', 'workspace']
    const hasValidUpdate = Object.keys(updates).some((key) => validCategories.includes(key))

    if (!hasValidUpdate) {
      return Response.json(
        {
          error: 'Invalid update',
          message: 'Must include at least one valid category: display, ai, notifications, or workspace',
        },
        { status: 400 }
      )
    }

    await saveSettings(context.env.DB, userHash, updates)

    // Return updated settings
    const settings = await loadSettings(context.env.DB, userHash)

    return Response.json({
      success: true,
      settings,
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Settings PUT error:', error)
    return Response.json(
      {
        error: 'Failed to update settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/user
 * Reset settings to defaults
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    // Delete all settings for this hash
    await context.env.DB.prepare('DELETE FROM user_settings WHERE user_hash = ?').bind(userHash).run()

    return Response.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: {
        user_hash: userHash,
        ...DEFAULT_SETTINGS,
      },
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Settings DELETE error:', error)
    return Response.json(
      {
        error: 'Failed to reset settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
