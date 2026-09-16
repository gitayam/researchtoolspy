/**
 * Shared framework-ownership helpers.
 *
 * The framework_* link tables (framework_evidence, framework_entities,
 * framework_datasets) are joined to a framework by a caller-supplied
 * framework_id. Several handlers took that id on trust: finding link rows for it
 * proves the framework EXISTS, never that it is the caller's. The DELETE paths
 * in those same files already did this check inline -- these helpers make the
 * rule reusable so the read and write paths cannot drift from it again.
 *
 * Reads allow public frameworks; writes never do -- `is_public` marks an
 * analysis as readable, not as open for anyone to attach evidence to.
 */

export async function canReadFramework(
  db: D1Database,
  frameworkId: string | number,
  userId: number,
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT id FROM framework_sessions WHERE id = ? AND (user_id = ? OR is_public = 1)'
  ).bind(frameworkId, userId).first()
  return !!row
}

export async function canWriteFramework(
  db: D1Database,
  frameworkId: string | number,
  userId: number,
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT id FROM framework_sessions WHERE id = ? AND user_id = ?'
  ).bind(frameworkId, userId).first()
  return !!row
}

/** Uniform denial. Mirrors "not found" so these endpoints are not existence oracles. */
export function frameworkDenied(headers: HeadersInit): Response {
  return new Response(
    JSON.stringify({ error: 'Framework not found or access denied' }),
    { status: 404, headers },
  )
}
