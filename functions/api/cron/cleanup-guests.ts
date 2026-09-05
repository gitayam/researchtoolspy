/** Remove expired, unconverted guest work after the advertised seven-day window. */
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
  CRON_SECRET?: string
}

const USER_REFERENCE_COLUMNS = [
  'user_id', 'created_by', 'owner_id', 'requested_by', 'imported_by', 'added_by',
  'updated_by', 'verified_by', 'published_by', 'original_creator', 'reviewed_by',
  'created_by_id', 'revoked_by_id', 'exported_by_id',
] as const
const EXPIRED_GUESTS = `
  SELECT u.id FROM users u
  WHERE u.role = 'guest'
    AND u.user_hash LIKE 'guest-session:%'
    AND u.created_at < datetime('now', '-7 days')
    AND NOT EXISTS (
      SELECT 1 FROM guest_conversions gc WHERE gc.guest_session_id = u.user_hash
    )
`

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return diff === 0
}

function authorize(request: Request, env: Env): Response | null {
  if (!env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
      status: 503, headers: JSON_HEADERS,
    })
  }
  if (!secretsMatch(request.headers.get('X-Cron-Secret') || '', env.CRON_SECRET)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: JSON_HEADERS,
    })
  }
  return null
}

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Unsafe schema identifier')
  return `"${value}"`
}

async function cleanup(env: Env, dryRun: boolean): Promise<Response> {
  const before = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${EXPIRED_GUESTS})`)
    .first<{ n: number }>()
  const expired = Number(before?.n || 0)
  if (dryRun || expired === 0) {
    return new Response(JSON.stringify({ success: true, dry_run: dryRun, expired_guests: expired }), {
      status: 200, headers: JSON_HEADERS,
    })
  }

  const schema = await env.DB.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql IS NOT NULL ORDER BY rowid DESC`
  ).all<{ name: string; sql: string }>()
  const skip = new Set(['users', 'workspaces', 'workspace_members', 'guest_conversions'])
  const deleteSql: string[] = []
  const expiredWorkspaces = `SELECT id FROM workspaces WHERE owner_id IN (${EXPIRED_GUESTS})`

  // Legacy/user-scoped tools are not uniformly attached to workspaces. Walk
  // schema-owned identifiers (never request input) in reverse creation order.
  // Some older foreign keys do not cascade, so workspace_id is swept as well.
  for (const row of schema.results || []) {
    if (!row?.name || !row.sql || skip.has(row.name) || row.name.startsWith('sqlite_')) continue
    const table = quoteIdentifier(row.name)
    if (/\bworkspace_id\b/i.test(row.sql)) {
      deleteSql.push(`DELETE FROM ${table} WHERE "workspace_id" IN (${expiredWorkspaces})`)
    }
    for (const column of USER_REFERENCE_COLUMNS) {
      if (!new RegExp(`\\b${column}\\b`, 'i').test(row.sql)) continue
      deleteSql.push(`DELETE FROM ${table} WHERE ${quoteIdentifier(column)} IN (${EXPIRED_GUESTS})`)
    }
  }

  // A small number of legacy tables were rebuilt after their dependants, so
  // sqlite_master order alone is not a complete dependency graph. Two passes
  // let a parent blocked on pass one succeed after its child is removed. A
  // constraint failure is retained and reported; it never aborts other cleanup.
  let changes = 0
  let constrainedStatements = 0
  for (let pass = 0; pass < 2; pass += 1) {
    constrainedStatements = 0
    for (const sql of deleteSql) {
      try {
        const result = await env.DB.prepare(sql).run()
        changes += Number(result.meta?.changes || 0)
      } catch {
        constrainedStatements += 1
      }
    }
  }

  for (const sql of [
    `DELETE FROM workspace_members WHERE workspace_id IN (${expiredWorkspaces}) OR user_id IN (${EXPIRED_GUESTS})`,
    `DELETE FROM workspaces WHERE owner_id IN (${EXPIRED_GUESTS})`,
    `DELETE FROM users WHERE id IN (${EXPIRED_GUESTS})`,
  ]) {
    try {
      const result = await env.DB.prepare(sql).run()
      changes += Number(result.meta?.changes || 0)
    } catch {
      constrainedStatements += 1
    }
  }
  const after = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${EXPIRED_GUESTS})`)
    .first<{ n: number }>()

  return new Response(JSON.stringify({
    success: true,
    expired_guests: expired,
    guest_rows_remaining: Number(after?.n || 0),
    rows_deleted: changes,
    constrained_statements: constrainedStatements,
  }), { status: 200, headers: JSON_HEADERS })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const denied = authorize(request, env)
  if (denied) return denied
  try {
    return await cleanup(env, true)
  } catch (error) {
    console.error('[GuestCleanup] Dry run failed:', error)
    return new Response(JSON.stringify({ error: 'Guest cleanup count failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const denied = authorize(request, env)
  if (denied) return denied
  try {
    const dryRun = new URL(request.url).searchParams.get('dry') === '1'
    return await cleanup(env, dryRun)
  } catch (error) {
    console.error('[GuestCleanup] Cleanup failed:', error)
    return new Response(JSON.stringify({ error: 'Guest cleanup failed' }), {
      status: 500, headers: JSON_HEADERS,
    })
  }
}
