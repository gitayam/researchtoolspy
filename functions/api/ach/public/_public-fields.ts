/**
 * Public ACH field allowlist + serializer.
 *
 * The public (no-auth) ACH endpoints must return an explicit, stable contract —
 * only the display fields the public UI actually reads — rather than spreading
 * the whole DB row. This keeps internal columns (e.g. `user_id`) and any column
 * added to `ach_analyses` in the future from leaking to unauthenticated clients.
 *
 * Dependency-free on purpose (no PagesFunction / D1 type imports) so it can be
 * imported directly in a plain Node test.
 *
 * `tags` is intentionally excluded — callers parse it from its JSON string and
 * attach the parsed value separately.
 * `user_id` is intentionally excluded — internal field, never read by the UI.
 */

export const PUBLIC_ACH_FIELDS = [
  'id',
  'title',
  'description',
  'question',
  'analyst',
  'organization',
  'scale_type',
  'status',
  'domain',
  'view_count',
  'clone_count',
  'is_public',
  'share_token',
  'shared_publicly_at',
  'created_at',
  'updated_at',
] as const

/**
 * Return a NEW object containing only the allowlisted display fields that exist
 * on `row`. Anything outside PUBLIC_ACH_FIELDS (e.g. `user_id`, or an
 * unrecognized/future column) is simply not copied.
 */
export function serializePublicAnalysis(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of PUBLIC_ACH_FIELDS) {
    if (field in row) {
      out[field] = row[field]
    }
  }
  return out
}
