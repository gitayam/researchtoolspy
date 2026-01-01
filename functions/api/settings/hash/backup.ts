/**
 * Hash Backup API
 *
 * POST: Generate hash backup file for download
 */

import { requireAuth } from '../../_shared/auth-helpers'

interface Env {
  DB: D1Database
  JWT_SECRET?: string
}

/**
 * Helper to get user hash from authenticated user ID
 */
async function getUserHashFromId(db: D1Database, userId: number): Promise<string | null> {
  const user = await db.prepare('SELECT user_hash FROM users WHERE id = ?').bind(userId).first()
  return user?.user_hash as string | null
}

/**
 * POST /api/settings/hash/backup
 * Generate hash backup file
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const userId = await requireAuth(context.request, context.env)
    const userHash = await getUserHashFromId(context.env.DB, userId)

    if (!userHash) {
      return Response.json({ error: 'User hash not found' }, { status: 404 })
    }

    // Get workspace names for this hash
    const workspaces = await context.env.DB.prepare('SELECT name FROM workspaces WHERE user_hash = ?')
      .bind(userHash)
      .all()

    const workspaceNames = (workspaces.results || []).map((w: any) => w.name)

    // Get account info
    let accountInfo = null
    try {
      accountInfo = await context.env.DB.prepare(
        'SELECT created_at, last_seen FROM hash_accounts WHERE account_hash = ?'
      )
        .bind(userHash)
        .first()
    } catch {
      // Table might not exist yet
    }

    // Generate backup code for additional verification
    const backupCode = Math.random().toString(36).substr(2, 12).toUpperCase()

    // Create backup file content
    const backupContent = `
=================================================================
           OMNICORE ACCOUNT HASH BACKUP
=================================================================

CRITICAL: This is your ONLY way to access your Omnicore account.
Store this file in a secure location (password manager recommended).
No recovery is possible if this hash is lost.

-----------------------------------------------------------------
                    ACCOUNT INFORMATION
-----------------------------------------------------------------

Account Hash: ${userHash}
Backup Code:  ${backupCode}

Created:      ${accountInfo?.created_at || 'Unknown'}
Last Seen:    ${accountInfo?.last_seen || 'Unknown'}
Backup Date:  ${new Date().toISOString()}

-----------------------------------------------------------------
                    WORKSPACES
-----------------------------------------------------------------

${workspaceNames.length > 0 ? workspaceNames.map((name, i) => `${i + 1}. ${name}`).join('\n') : 'No workspaces found'}

-----------------------------------------------------------------
                    RECOVERY INSTRUCTIONS
-----------------------------------------------------------------

1. Go to https://omnicore.app/login
2. Enter your Account Hash: ${userHash}
3. Enter Backup Code (if prompted): ${backupCode}
4. Access granted - your data is safe

-----------------------------------------------------------------
                    SECURITY NOTES
-----------------------------------------------------------------

- Keep this file SECURE and PRIVATE
- Do NOT share your hash with anyone
- Store in password manager (1Password, Bitwarden, etc.)
- Keep a second copy in a different secure location
- Test access periodically to ensure hash still works

-----------------------------------------------------------------

Questions? Visit https://omnicore.app/help or contact support

=================================================================
              Generated: ${new Date().toUTCString()}
=================================================================
`.trim()

    // Log backup generation (optional)
    try {
      await context.env.DB.prepare(
        `INSERT INTO settings_audit_log (user_hash, category, setting_key, new_value, changed_at)
         VALUES (?, 'security', 'hash_backup_generated', ?, CURRENT_TIMESTAMP)`
      )
        .bind(userHash, backupCode)
        .run()
    } catch {
      // Table might not exist - continue anyway
    }

    // Return as downloadable text file
    const blob = new TextEncoder().encode(backupContent)

    return new Response(blob, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="omnicore_hash_backup_${Date.now()}.txt"`,
        'Content-Length': blob.byteLength.toString(),
      },
    })
  } catch (error: any) {
    if (error instanceof Response) return error
    console.error('Hash backup error:', error)
    return Response.json(
      {
        error: 'Failed to generate hash backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
