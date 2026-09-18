/**
 * Where a saved framework session lives.
 *
 * Built because two facts that look obvious are both false: a session's `framework_type` is
 * not always its route segment, and not every framework opens at `<slug>/<id>`. The
 * dashboard's Recent Activity list assumed both, and additionally omitted the `/dashboard`
 * prefix, so every link in it went nowhere.
 *
 * `tests/e2e/smoke/framework-routes.spec.ts` checks each entry against the real router, so
 * a renamed or restructured route fails there rather than silently producing dead links.
 */

/** Types whose route segment differs from the stored `framework_type`. */
const SEGMENT_FOR_TYPE: Record<string, string> = {
  ach: 'ach-dashboard',
  swot: 'swot-dashboard',
}

/**
 * Frameworks routed as `<segment>/:id`. The rest are `<segment>/:id/:action` and need an
 * action, because `<segment>/<id>` would otherwise match `<segment>/:action` and be read as
 * a verb — a session id silently interpreted as a command.
 */
const OPENS_AT_BARE_ID = new Set(['ach-dashboard', 'swot-dashboard', 'cog', 'behavior'])

/** The action used to open an existing session in the `:id/:action` frameworks. */
const VIEW_ACTION = 'view'

/** The route segment for a stored `framework_type`. */
export function frameworkSegment(frameworkType: string): string {
  return SEGMENT_FOR_TYPE[frameworkType] ?? frameworkType
}

/** The dashboard path that opens a saved session, or null for a type with no route. */
export function frameworkSessionHref(frameworkType: string, id: string | number): string | null {
  if (!frameworkType) return null
  const segment = frameworkSegment(frameworkType)
  const base = `/dashboard/analysis-frameworks/${segment}`
  return OPENS_AT_BARE_ID.has(segment) ? `${base}/${id}` : `${base}/${id}/${VIEW_ACTION}`
}
