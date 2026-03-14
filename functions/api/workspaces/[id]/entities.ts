/**
 * Workspace Entities API
 *
 * GET /api/workspaces/:id/entities — List all entity types in workspace
 * Supports ?type=, ?search=, ?limit=, ?offset=
 */

import { getUserFromRequest } from '../../_shared/auth-helpers'
import { getWorkspaceMemberRole } from '../../_shared/workspace-helpers'

interface Env {
  DB: D1Database
  SESSIONS?: KVNamespace
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const ENTITY_TABLES = ['actors', 'sources', 'events', 'places', 'behaviors'] as const
type EntityTable = typeof ENTITY_TABLES[number]

// Map singular type param (from frontend) to plural table name
const TYPE_TO_TABLE: Record<string, EntityTable> = {
  actor: 'actors', source: 'sources', event: 'events',
  place: 'places', behavior: 'behaviors',
}

// Each table has different columns for "type" and "category"
const TABLE_META: Record<EntityTable, { typeCol: string; categoryCol: string }> = {
  actors:    { typeCol: 'type',        categoryCol: 'category' },
  sources:   { typeCol: 'type',        categoryCol: 'category' },
  events:    { typeCol: 'type',        categoryCol: 'significance' },
  places:    { typeCol: 'type',        categoryCol: 'strategic_importance' },
  behaviors: { typeCol: 'type',        categoryCol: 'sophistication' },
}

function buildEntityQuery(
  table: EntityTable,
  workspaceId: string,
  search: string | null,
): { sql: string; binds: any[] } {
  const meta = TABLE_META[table]
  // Singular form for entity_type label (strip trailing 's')
  const entityType = table.slice(0, -1)

  let where = `WHERE workspace_id = ?`
  const binds: any[] = [workspaceId]

  if (search) {
    where += ` AND name LIKE ?`
    binds.push(`${search}%`)
  }

  const sql = `SELECT CAST(id AS TEXT) as id, name, '${entityType}' as entity_type, ${meta.typeCol} as type, ${meta.categoryCol} as category, created_by, created_at, workspace_id FROM ${table} ${where}`
  return { sql, binds }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context
  const workspaceId = params.id as string
  const url = new URL(request.url)

  try {
    const userId = await getUserFromRequest(request, env)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: jsonHeaders,
      })
    }

    const role = await getWorkspaceMemberRole(env.DB, workspaceId, userId)
    if (!role) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403, headers: jsonHeaders,
      })
    }

    const typeFilter = url.searchParams.get('type') || null
    const search = url.searchParams.get('search') || null
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // If type filter is set, resolve singular name to plural table name
    const resolvedTable = typeFilter ? TYPE_TO_TABLE[typeFilter] : null
    const tables = resolvedTable
      ? [resolvedTable]
      : [...ENTITY_TABLES]

    // Build UNION ALL query
    const parts: string[] = []
    const allBinds: any[] = []

    for (const table of tables) {
      const { sql, binds } = buildEntityQuery(table, workspaceId, search)
      parts.push(sql)
      allBinds.push(...binds)
    }

    const unionSql = parts.join(' UNION ALL ')

    // Get total count
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM (${unionSql})`
    ).bind(...allBinds).first()

    // Get paginated results
    const dataResult = await env.DB.prepare(
      `SELECT * FROM (${unionSql}) ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...allBinds, limit, offset).all()

    return new Response(JSON.stringify({
      entities: dataResult.results,
      total: (countResult?.total as number) || 0,
      limit,
      offset,
    }), { headers: jsonHeaders })
  } catch (error) {
    console.error('[workspace entities] Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch entities' }), {
      status: 500, headers: jsonHeaders,
    })
  }
}
