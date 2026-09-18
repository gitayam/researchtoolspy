// GET /api/discovery/search?q=… — the caller's own content, for the command palette.
//
// The palette already searches the static catalogue of tools, frameworks and pages. This is
// the other half: the analyses, sessions and entities the caller has actually made, in their
// own workspaces and in the workspaces they belong to.
//
// Only content types with a route that opens one item are included. A result that can only
// land on a list page is not a search result, it is a redirect with extra steps — evidence
// items and saved content analyses are deliberately absent for that reason, until they have
// somewhere to go.

import { getUserFromRequest } from '../_shared/auth-helpers'
import { JSON_HEADERS } from '../_shared/api-utils'

interface Env {
  DB: D1Database
}

const MAX_RESULTS = 20
const PER_SOURCE = 12
/** Longer than this is a paste, not a search, and LIKE on it scans for nothing. */
const MAX_QUERY = 128

export type DiscoveryContentKind = 'framework' | 'cop' | 'actor' | 'investigation' | 'cross-table'

export interface ContentHit {
  kind: DiscoveryContentKind
  id: string
  title: string
  detail: string | null
  href: string
  updatedAt: string | null
  score: number
}

interface SourceRow {
  id: string | number
  title: string | null
  detail: string | null
  updated_at: string | null
}

/**
 * Workspace scope, as a subquery rather than a fetched list.
 *
 * Owned workspaces are included directly because ownership does not require a
 * `workspace_members` row — `ensureGuestWorkspace` is the one path that writes both, and
 * every other owner may have no membership row at all. Scoping on membership alone would
 * hide a caller's own workspaces from them.
 */
const SCOPE = `
  SELECT id AS workspace_id FROM workspaces WHERE owner_id = ?
  UNION
  SELECT workspace_id FROM workspace_members WHERE user_id = ?
`

interface Source {
  kind: DiscoveryContentKind
  sql: string
  /** Binds in order: the scope pair, the owner id, then the LIKE pattern twice. */
  href: (row: SourceRow) => string | null
}

const SOURCES: Source[] = [
  {
    kind: 'framework',
    sql: `SELECT id, title, framework_type AS detail, updated_at
          FROM framework_sessions
          WHERE (workspace_id IN (${SCOPE}) OR user_id = ?)
            AND (LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`,
    href: row => frameworkHref(String(row.detail ?? ''), row.id),
  },
  {
    kind: 'cop',
    sql: `SELECT id, name AS title, description AS detail, updated_at
          FROM cop_sessions
          WHERE (workspace_id IN (${SCOPE}) OR created_by = ?)
            AND (LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`,
    href: row => `/dashboard/cop/${row.id}`,
  },
  {
    kind: 'actor',
    sql: `SELECT id, name AS title, description AS detail, updated_at
          FROM actors
          WHERE (workspace_id IN (${SCOPE}) OR created_by = ?)
            AND (LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`,
    href: row => `/dashboard/entities/actors/${row.id}`,
  },
  {
    kind: 'investigation',
    sql: `SELECT id, title, description AS detail, updated_at
          FROM investigations
          WHERE (workspace_id IN (${SCOPE}) OR created_by = ?)
            AND (LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`,
    href: row => `/dashboard/investigations/${row.id}`,
  },
  {
    kind: 'cross-table',
    sql: `SELECT id, title, description AS detail, updated_at
          FROM cross_tables
          WHERE (workspace_id IN (${SCOPE}) OR user_id = ?)
            AND (LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC LIMIT ${PER_SOURCE}`,
    href: row => `/dashboard/tools/cross-table/${row.id}`,
  },
]

/**
 * Mirrors `src/lib/framework-routes.ts`. Duplicated rather than imported because the
 * Functions build does not take `@/` paths, and a relative import across the app/functions
 * boundary would make the app bundle depend on the handler. The spec
 * `framework-routes.spec.ts` asserts the two agree.
 */
const FRAMEWORK_SEGMENT: Record<string, string> = { ach: 'ach-dashboard', swot: 'swot-dashboard' }
const FRAMEWORK_BARE_ID = new Set(['ach-dashboard', 'swot-dashboard', 'cog', 'behavior'])

function frameworkHref(frameworkType: string, id: string | number): string | null {
  if (!frameworkType) return null
  const segment = FRAMEWORK_SEGMENT[frameworkType] ?? frameworkType
  const base = `/dashboard/analysis-frameworks/${segment}`
  return FRAMEWORK_BARE_ID.has(segment) ? `${base}/${id}` : `${base}/${id}/view`
}

/**
 * Ranking, in the same shape as the catalogue's: an exact title beats a prefix beats a word
 * start beats a substring, and only then does recency break ties. Recency alone would bury
 * an exact match under whatever was touched most recently, which is the opposite of what
 * someone typing a name they remember is asking for.
 */
function score(title: string, detail: string | null, query: string): number {
  const haystack = title.toLocaleLowerCase('en-US')
  if (haystack === query) return 1000
  if (haystack.startsWith(query)) return 800
  if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(haystack)) return 600
  if (haystack.includes(query)) return 400
  if ((detail ?? '').toLocaleLowerCase('en-US').includes(query)) return 200
  return 100
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSON_HEADERS })
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  const query = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .slice(0, MAX_QUERY)
    .toLocaleLowerCase('en-US')

  // A signed-out caller and a one-character query both get an empty list rather than an
  // error: the palette asks on every keystroke, and a 401 there would render as a failure
  // for someone who is simply browsing the catalogue.
  if (query.length < 2 || !env.DB) {
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: JSON_HEADERS })
  }

  const userId = await getUserFromRequest(request, env as never)
  if (userId === null) {
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: JSON_HEADERS })
  }

  // Escaped *and* declared: without the ESCAPE clause on every LIKE, SQLite reads the
  // backslash as an ordinary character, so a query containing `%` matches nothing at all
  // rather than matching a literal `%`. The first version of this had the escaping and not
  // the clause, and its test passed for the wrong reason.
  const pattern = `%${query.replace(/[%_\\]/g, char => `\\${char}`)}%`
  const hits: ContentHit[] = []

  const batch = await env.DB.batch<SourceRow>(
    SOURCES.map(source =>
      env.DB.prepare(source.sql).bind(userId, userId, userId, pattern, pattern),
    ),
  )

  batch.forEach((result, index) => {
    const source = SOURCES[index]
    for (const row of result.results ?? []) {
      const title = (row.title ?? '').trim()
      if (!title) continue
      const href = source.href(row)
      if (!href) continue
      hits.push({
        kind: source.kind,
        id: String(row.id),
        title,
        detail: row.detail ? String(row.detail).slice(0, 140) : null,
        href,
        updatedAt: row.updated_at,
        score: score(title, row.detail, query),
      })
    }
  })

  hits.sort((a, b) => b.score - a.score || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  return new Response(JSON.stringify({ results: hits.slice(0, MAX_RESULTS) }), {
    status: 200,
    headers: JSON_HEADERS,
  })
}
