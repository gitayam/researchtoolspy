/**
 * Facts from Windy for a COP's Windy cameras: filled in when one is added, and
 * re-checked in the background when a session's cameras are listed.
 *
 * Windy is the source of truth for where its cameras are and whether they work.
 * When Windy cannot be asked (no key, timeout, 5xx) a camera is added as before;
 * only a definite answer (no such camera, or one Windy has withdrawn) refuses it.
 */
import type { WebcamInput, WebcamRow } from './cop-webcams'
import { webcamColumnsMissing } from './cop-webcams'
import { kvGetJson, kvPutJson, type KvLike } from './kv-json'
import {
  windyCamera,
  WindyError,
  windyKeyConfigured,
  windyStatuses,
  WINDY_UNAVAILABLE_STATUSES,
  type WindyCamera,
  type WindyEnv,
} from './windy-webcams'
import { WEBCAM_NOT_FOUND, WEBCAM_UNAVAILABLE } from './webcam-discovery'

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

/** Fill a Windy camera's position, title, player and status from Windy. */
export async function enrichWebcamInput(
  env: WindyEnv & { DB?: unknown },
  cam: WebcamInput,
  now: string,
  warn: (message: string) => Promise<void>,
): Promise<EnrichOutcome> {
  const fallbackLabel = () => (cam.label ? cam : { ...cam, label: `Windy webcam ${cam.provider_ref}` })
  if (cam.provider !== 'windy' || !cam.provider_ref) return { ok: true, cam, enriched: false }
  if (!windyKeyConfigured(env)) return { ok: true, cam: fallbackLabel(), enriched: false }
  try {
    const facts = await windyCamera(env, cam.provider_ref)
    if (WINDY_UNAVAILABLE_STATUSES.has(facts.status)) {
      return { ok: false, status: 422, code: WEBCAM_UNAVAILABLE, error: `Windy lists this camera as ${facts.status}; it cannot be shown.` }
    }
    return { ok: true, cam: applyWindy(cam, facts, now), enriched: true }
  } catch (error) {
    if (error instanceof WindyError && error.kind === 'not_found') {
      return { ok: false, status: 422, code: WEBCAM_NOT_FOUND, error: 'Windy has no webcam with that id.' }
    }
    await warn(`Windy lookup failed; added without Windy's details: ${String(error instanceof Error ? error.message : error)}`)
    return { ok: true, cam: fallbackLabel(), enriched: false }
  }
}

/** Windy cameras of `rows` whose status is unknown or older than 6 hours. */
export function staleWindyCameras(rows: WebcamRow[], nowMs = Date.now()): WebcamRow[] {
  return rows.filter((row) => {
    if (row.provider !== 'windy' || !row.provider_ref) return false
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
 */
export async function refreshWindyStatuses(
  env: WindyEnv & { DB: D1Database },
  sessionId: string,
  stale: WebcamRow[],
): Promise<number> {
  if (!windyKeyConfigured(env) || stale.length === 0) return 0
  const ids = [...new Set(stale.map((row) => String(row.provider_ref)))].slice(0, 50)
  const found = await windyStatuses(env, ids)
  const now = new Date().toISOString()
  const updates: { id: string; status: string; live: boolean | null }[] = []
  for (const id of ids) {
    const cam = found.get(id)
    if (cam) updates.push({ id, status: cam.status, live: cam.live })
  }
  for (const id of ids.filter((i) => !found.has(i)).slice(0, MAX_SINGLE_LOOKUPS)) {
    try {
      const cam = await windyCamera({ ...env, CACHE: undefined }, id)
      updates.push({ id, status: cam.status, live: cam.live })
    } catch (error) {
      if (error instanceof WindyError && error.kind === 'not_found') updates.push({ id, status: 'not_found', live: null })
    }
  }
  let changed = 0
  for (const u of updates) {
    try {
      const result = await env.DB.prepare(`
        UPDATE cop_webcams
        SET windy_status = ?, status_checked_at = ?,
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
