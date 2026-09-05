// Cloudflare Pages Function for Guest Conversion API
import {
  AuthDbError,
  getExistingGuestPrincipalFromRequest,
  getUserFromRequest,
} from './_shared/auth-helpers'
import { CORS_HEADERS, JSON_HEADERS } from './_shared/api-utils'

const USER_REFERENCE_COLUMNS = [
  'user_id', 'created_by', 'owner_id', 'requested_by', 'imported_by', 'added_by',
  'updated_by', 'verified_by', 'published_by', 'original_creator', 'reviewed_by',
  'created_by_id', 'revoked_by_id', 'exported_by_id',
] as const

const SPECIAL_TABLES = new Set(['users', 'workspaces', 'workspace_members', 'guest_conversions'])

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unsafe schema identifier')
  return `"${value}"`
}

async function transferGuestData(db: D1Database, guestUserId: number, authUserId: number) {
  const schema = await db.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL`
  ).all<{ name: string; sql: string }>()

  const statements: D1PreparedStatement[] = []
  for (const row of schema.results || []) {
    if (!row?.name || !row.sql || SPECIAL_TABLES.has(row.name) || row.name.startsWith('sqlite_')) continue
    const table = quoteIdentifier(row.name)
    for (const column of USER_REFERENCE_COLUMNS) {
      if (!new RegExp(`\\b${column}\\b`, 'i').test(row.sql)) continue
      statements.push(
        db.prepare(`UPDATE OR IGNORE ${table} SET ${quoteIdentifier(column)} = ? WHERE ${quoteIdentifier(column)} = ?`)
          .bind(authUserId, guestUserId)
      )
    }
  }

  // Workspace ownership is the durable authorization boundary for modern tools.
  // Add the destination first, revoke the browser guest, and only then change owner.
  statements.push(
    db.prepare(`
      INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
      SELECT 'converted-' || lower(hex(randomblob(16))), id, ?, 'ADMIN', datetime('now')
      FROM workspaces WHERE owner_id = ?
    `).bind(authUserId, guestUserId),
    db.prepare(`
      DELETE FROM workspace_members
      WHERE user_id = ? AND workspace_id IN (SELECT id FROM workspaces WHERE owner_id = ?)
    `).bind(guestUserId, guestUserId),
    db.prepare(`UPDATE workspaces SET owner_id = ?, updated_at = datetime('now') WHERE owner_id = ?`)
      .bind(authUserId, guestUserId),
  )

  const results = statements.length ? await db.batch(statements) : []
  return results.reduce((sum, result) => sum + Number(result.meta?.changes || 0), 0)
}

export async function onRequest(context: any) {
  const { request, env } = context

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  try {
    // POST - Convert guest session to authenticated user
    if (request.method === 'POST') {
      const authUserId = await getUserFromRequest(request, env)
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const authUser = await env.DB.prepare(
        'SELECT role, user_hash FROM users WHERE id = ?'
      ).bind(authUserId).first() as { role: string; user_hash: string | null } | null
      if (!authUser || authUser.role === 'guest' || authUser.user_hash?.startsWith('guest-session:')) {
        return new Response(JSON.stringify({ error: 'Login required to save guest work' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      // Inactive lookup is allowed only to make an already-completed conversion
      // retry-safe; a new conversion still requires an active seven-day session.
      const guest = await getExistingGuestPrincipalFromRequest(request, env, { allowInactive: true })
      if (!guest) {
        return new Response(JSON.stringify({ error: 'Active guest session required' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }

      if (guest.userId === authUserId) {
        return new Response(JSON.stringify({ error: 'Guest and account identities must differ' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }

      const existing = await env.DB.prepare(`
        SELECT id FROM guest_conversions WHERE guest_session_id = ? AND user_id = ?
      `).bind(guest.principalHash, authUserId).first() as { id: number } | null
      if (existing) {
        await env.DB.prepare(
          `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND role = 'guest'`
        ).bind(guest.userId).run()
        return new Response(JSON.stringify({
          message: 'Guest work is already attached to this account',
          conversion_id: existing.id,
          already_converted: true,
        }), { status: 200, headers: JSON_HEADERS })
      }

      if (!guest.isActive) {
        return new Response(JSON.stringify({ error: 'Active guest session required' }), {
          status: 400, headers: JSON_HEADERS,
        })
      }

      const transferredRows = await transferGuestData(env.DB, guest.userId, authUserId)

      // Record the conversion — use server-side auth user ID, never client-supplied
      const result = await env.DB.prepare(`
        INSERT OR IGNORE INTO guest_conversions (
          guest_session_id,
          user_id,
          framework_count,
          converted_at
        ) VALUES (?, ?, ?, datetime('now'))
      `).bind(
        guest.principalHash,
        authUserId,
        0
      ).run()

      const persistedConversion = await env.DB.prepare(`
        SELECT id FROM guest_conversions WHERE guest_session_id = ? AND user_id = ?
      `).bind(guest.principalHash, authUserId).first() as { id: number } | null

      // The source row remains as provenance for any schema-specific references
      // that could not be reassigned due to uniqueness constraints, but its
      // possession credential is revoked immediately.
      await env.DB.prepare(
        `UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND role = 'guest'`
      ).bind(guest.userId).run()

      return new Response(JSON.stringify({
        message: 'Guest converted to authenticated user successfully',
        conversion_id: persistedConversion?.id || result.meta.last_row_id,
        transferred_rows: transferredRows,
      }), {
        status: Number(result.meta.changes || 0) > 0 ? 201 : 200,
        headers: JSON_HEADERS,
      })
    }

    // GET - Get conversion statistics (admin only)
    if (request.method === 'GET') {
      const getAuthUserId = await getUserFromRequest(request, env)
      if (!getAuthUserId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401, headers: JSON_HEADERS,
        })
      }

      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_conversions,
          SUM(framework_count) as total_frameworks_converted,
          AVG(framework_count) as avg_frameworks_per_conversion
        FROM guest_conversions
      `).first()

      return new Response(JSON.stringify({ stats }), {
        status: 200,
        headers: JSON_HEADERS,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    })

  } catch (error: any) {
    console.error('Guest conversion API error:', error)
    const unavailable = error instanceof AuthDbError || error?.isAuthDbError
    return new Response(JSON.stringify({ error: unavailable ? 'Service temporarily unavailable' : 'Internal server error' }), {
      status: unavailable ? 503 : 500,
      headers: JSON_HEADERS,
    })
  }
}
