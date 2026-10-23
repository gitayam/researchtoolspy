/**
 * Facts from Windy for a COP's Windy cameras: filled in when one is added, and
 * re-checked in the background when a session's cameras are listed.
 *
 * Windy is the source of truth for where its cameras are and whether they work.
 * When Windy cannot be asked (no key, timeout, 5xx, the app-wide cap, no KV to
 * count with) a camera is added as before; only a definite answer from a real or
 * cached lookup (no such camera, or one Windy has withdrawn) refuses it. A lookup
 * that would call Windy is charged to the person adding (ADD_LOOKUP_LIMITS); over
 * that allowance the add is refused 429.
 */
import type { WebcamInput, WebcamRow } from './cop-webcams'
import { webcamColumnsMissing } from './cop-webcams'
import { kvGetJson, kvPutJson, type KvLike } from './kv-json'
import {
  cachedWindyCamera,
  windyCamera,
  WindyError,
  windyKeyConfigured,
  windyStatuses,
  WINDY_UNAVAILABLE_STATUSES,
  type WindyCamera,
  type WindyEnv,
} from './windy-webcams'
import {
  ADD_LOOKUP_LIMITS,
  chargeSpend,
  RATE_LIMITED,
  WEBCAM_NOT_FOUND,
  WEBCAM_UNAVAILABLE,
  type SpendCaller,
} from './webcam-discovery'

// Both arms name every field: functions compile with strict: false, where a boolean
// discriminant does not narrow.
export type EnrichOutcome =
  | { ok: true; cam: WebcamInput; enriched: boolean; status?: undefined; code?: undefined; error?: undefined }
  | { ok: false; status: number; code: string; error: string; cam?: undefined; enriched?: undefined }

const STATUS_MAX_AGE_MS = 6 * 3600 * 1000
const REFRESH_EVERY_S = 10 * 60
const MAX_SINGLE_LOOKUPS = 10

function applyWindy(cam: WebcamInput, facts: WindyCamera, now: string): WebcamInput {
  const out = { ...cam }
  if (out.lat === null && facts.lat !== null && facts.lon !== null) {
    out.lat = facts.lat
    out.lon = facts.lon
    out.position_source = 'windy'
  }
  if (!out.label) out.label = facts.title.slice(0, 120)
  out.delivery = facts.live ? 'live' : 'timelapse'
  out.source_url = facts.source_url
  out.windy_status = facts.status
  out.status_checked_at = now
  return out
}

const NOT_FOUND: EnrichOutcome = { ok: false, status: 422, code: WEBCAM_NOT_FOUND, error: 'Windy has no webcam with that id.' }

function fromFacts(cam: WebcamInput, facts: WindyCamera, now: string): EnrichOutcome {
  if (WINDY_UNAVAILABLE_STATUSES.has(facts.status)) {
    return { ok: false, status: 422, code: WEBCAM_UNAVAILABLE, error: `Windy lists this camera as ${facts.status}; it cannot be shown.` }
  }
  return { ok: true, cam: applyWindy(cam, facts, now), enriched: true }
}

/** Fill a Windy camera's position, title, player and status from Windy. */
export async function enrichWebcamInput(
  env: WindyEnv & { DB?: unknown },
  cam: WebcamInput,
  now: string,
  caller: SpendCaller,
  warn: (message: string) => Promise<void>,
): Promise<EnrichOutcome> {
  const asBefore = (): EnrichOutcome => ({
    ok: true,
    cam: cam.label ? cam : { ...cam, label: `Windy webcam ${cam.provider_ref}` },
    enriched: false,
  })
  if (cam.provider !== 'windy' || !cam.provider_ref) return { ok: true, cam, enriched: false }
  if (!windyKeyConfigured(env)) return asBefore()

  const cached = await cachedWindyCamera(env, cam.provider_ref)
  if (cached === 'not_found') return NOT_FOUND
  if (cached) return fromFacts(cam, cached, now)

  const charge = await chargeSpend(env.CACHE, 'webcams-add', caller, ADD_LOOKUP_LIMITS)
  if (charge === 'over') {
    return { ok: false, status: 429, code: RATE_LIMITED, error: 'Too many cameras added in a short time. Try again in a few minutes.' }
  }
  if (charge === 'unavailable') {
    await warn("Windy lookup skipped (no quota store); added without Windy's details")
    return asBefore()
  }
  try {
    return fromFacts(cam, await windyCamera(env, cam.provider_ref), now)
  } catch (error) {
    if (error instanceof WindyError && error.kind === 'not_found') return NOT_FOUND
    await warn(`Windy lookup failed; added without Windy's details: ${String(error instanceof Error ? error.message : error)}`)
    return asBefore()
  }
}

/**
 * Windy cameras of `rows` whose status is unknown or older than 6 hours. Rows read
 * with the 0020 column list (migration 0021 pending) have no status_checked_at at
 * all; they are skipped, since a refresh could not store its answer.
 */
export function staleWindyCameras(rows: WebcamRow[], nowMs = Date.now()): WebcamRow[] {
  return rows.filter((row) => {
    if (row.provider !== 'windy' || !row.provider_ref || row.status_checked_at === undefined) return false
    const checked = row.status_checked_at ? Date.parse(row.status_checked_at) : Number.NaN
    return !Number.isFinite(checked) || nowMs - checked > STATUS_MAX_AGE_MS
  })
}

/**
 * Claim this session's refresh slot (at most one refresh per session per 10 minutes).
 * Without KV there is no way to bound it, so nothing is refreshed.
 */
export async function claimStatusRefresh(kv: KvLike | undefined, sessionId: string): Promise<boolean> {
  if (!kv) return false
  const key = `windy:refresh:v1:${sessionId}`
  if (await kvGetJson<number>(kv, key)) return false
  await kvPutJson(kv, key, Date.now(), REFRESH_EVERY_S)
  return true
}

/**
 * Re-check stale Windy cameras: one batched call, then single lookups (up to 10) for
 * cameras the batch left out, which tells a withdrawn camera from a missing one.
 * A lookup that fails is stamped (status_checked_at, status unchanged) so it waits
 * the full 6 hours like any other; one the app-wide cap stopped is not, since
 * nothing was asked.
 */
export async function refreshWindyStatuses(
  env: WindyEnv & { DB: D1Database },
  sessionId: string,
  stale: WebcamRow[],
): Promise<number> {
  if (!windyKeyConfigured(env) || stale.length === 0) return 0
  const ids = [...new Set(stale.map((row) => String(row.provider_ref)))].slice(0, 50)
  const now = new Date().toISOString()
  // status null: the lookup failed; only the time is stamped.
  const updates: { id: string; status: string | null; live: boolean | null }[] = []

  let found: Map<string, WindyCamera>
  try {
    found = await windyStatuses(env, ids)
  } catch (error) {
    if (error instanceof WindyError && error.kind === 'throttled') return 0
    return applyStatusUpdates(env.DB, sessionId, ids.map((id) => ({ id, status: null, live: null })), now)
  }
  for (const id of ids) {
    const cam = found.get(id)
    if (cam) updates.push({ id, status: cam.status, live: cam.live })
  }
  for (const id of ids.filter((i) => !found.has(i)).slice(0, MAX_SINGLE_LOOKUPS)) {
    try {
      const cam = await windyCamera(env, id, { fresh: true })
      updates.push({ id, status: cam.status, live: cam.live })
    } catch (error) {
      if (error instanceof WindyError && error.kind === 'throttled') break
      const notFound = error instanceof WindyError && error.kind === 'not_found'
      updates.push({ id, status: notFound ? 'not_found' : null, live: null })
    }
  }
  return applyStatusUpdates(env.DB, sessionId, updates, now)
}

async function applyStatusUpdates(
  db: D1Database,
  sessionId: string,
  updates: { id: string; status: string | null; live: boolean | null }[],
  now: string,
): Promise<number> {
  let changed = 0
  for (const u of updates) {
    try {
      const result = await db.prepare(`
        UPDATE cop_webcams
        SET windy_status = COALESCE(?, windy_status), status_checked_at = ?,
            delivery = CASE WHEN ? IS NULL THEN delivery WHEN ? = 1 THEN 'live' ELSE 'timelapse' END
        WHERE cop_session_id = ? AND provider = 'windy' AND provider_ref = ? AND archived_at IS NULL
      `).bind(u.status, now, u.live === null ? null : 1, u.live ? 1 : 0, sessionId, u.id).run()
      changed += Number(result.meta?.changes ?? 0)
    } catch (error) {
      if (webcamColumnsMissing(error)) return changed
      throw error
    }
  }
  return changed
}
