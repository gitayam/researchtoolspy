/**
 * Where a COP evidence item's original lives, and whether its file may be shown.
 *
 * `evidence_items.source_ref` (migration 0022) normally records which client made an
 * item. For a file from a Signal room it may instead name the room's archive copy:
 *   - `silo:<archived_files id>` — the original in Silo, the member-only archive;
 *   - `peertube:<https URL>` — a video saved to the configured PeerTube instance
 *     (COP_PEERTUBE_HOST, exact host; without it PeerTube references are refused).
 * Nothing else is accepted from a caller.
 *
 * `metadata.scan_state` is 'pending' until the archive's virus scan clears a file,
 * 'clean' after, or 'quarantined'. A held item (pending or quarantined) serves no file.
 *
 * Neither the reference nor the scan state leaves for anyone outside the COP: public
 * payloads and feeds never carry them, and non-collaborators reading a public session
 * get evidence rows without them (stripPrivateEvidenceFields).
 */

export const SCAN_STATES = ['pending', 'clean', 'quarantined'] as const
export type ScanState = (typeof SCAN_STATES)[number]

const SILO_REF = /^silo:(\d{1,18}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const MAX_REF_LENGTH = 500

export interface ArchiveEnv {
  COP_PEERTUBE_HOST?: string
}

export type CleanResult<T> = { ok: true; value: T; error?: undefined } | { ok: false; error: string; value?: undefined }

/**
 * A caller-supplied archive reference: undefined (not given), null/'' (clear it), or a
 * valid `silo:` / `peertube:` reference. Anything else is refused.
 */
export function cleanArchiveRef(raw: unknown, env: ArchiveEnv): CleanResult<string | null | undefined> {
  if (raw === undefined) return { ok: true, value: undefined }
  if (raw === null || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string' || raw.length > MAX_REF_LENGTH) {
    return { ok: false, error: 'source_ref must be silo:<id> or peertube:<link>' }
  }
  const value = raw.trim()
  const silo = SILO_REF.exec(value)
  if (silo) return { ok: true, value: `silo:${silo[1].toLowerCase()}` }
  if (value.toLowerCase().startsWith('peertube:')) {
    const host = (env.COP_PEERTUBE_HOST ?? '').trim().toLowerCase()
    if (!host) return { ok: false, error: 'PeerTube references are not enabled on this server' }
    let url: URL
    try {
      url = new URL(value.slice('peertube:'.length))
    } catch {
      return { ok: false, error: 'peertube: must be followed by an https link' }
    }
    if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password) {
      return { ok: false, error: `peertube: links must be https on ${host}` }
    }
    url.hash = ''
    return { ok: true, value: `peertube:${url.href}` }
  }
  return { ok: false, error: 'source_ref must be silo:<id> or peertube:<link>' }
}

/** A caller-supplied scan state: undefined (not given) or one of SCAN_STATES. */
export function cleanScanState(raw: unknown): CleanResult<ScanState | undefined> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined }
  return typeof raw === 'string' && (SCAN_STATES as readonly string[]).includes(raw)
    ? { ok: true, value: raw as ScanState }
    : { ok: false, error: `scan_state must be one of ${SCAN_STATES.join(', ')}` }
}

/** An evidence row's metadata column as an object ({} for anything unparsable). */
export function readMetadata(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function scanStateOf(row: { metadata?: unknown }): ScanState | null {
  const value = readMetadata(row.metadata).scan_state
  return typeof value === 'string' && (SCAN_STATES as readonly string[]).includes(value) ? (value as ScanState) : null
}

/** Held items (scan pending or quarantined) serve no file. */
export function evidenceHeld(row: { metadata?: unknown }): boolean {
  const state = scanStateOf(row)
  return state === 'pending' || state === 'quarantined'
}

export function isArchiveRef(value: unknown): value is string {
  return typeof value === 'string' && /^(?:silo|peertube):/.test(value)
}

/**
 * Collaborator-facing extras for an evidence row: whether it is archived in Silo or
 * saved to PeerTube, and its scan state ("held pending a virus scan" while pending).
 */
export function archiveFields(row: { source_ref?: unknown; metadata?: unknown }): {
  archived_in: 'silo' | 'peertube' | null
  scan_state: ScanState | null
  held: boolean
} {
  const ref = typeof row.source_ref === 'string' ? row.source_ref : ''
  return {
    archived_in: ref.startsWith('silo:') ? 'silo' : ref.startsWith('peertube:') ? 'peertube' : null,
    scan_state: scanStateOf(row),
    held: evidenceHeld(row),
  }
}

/**
 * An evidence row for someone outside the COP (a signed-in reader of a public session):
 * no archive reference, no scan state, no metadata, no client id; a held item keeps no link.
 */
export function stripPrivateEvidenceFields(row: Record<string, unknown>): Record<string, unknown> {
  const held = evidenceHeld(row)
  const rest: Record<string, unknown> = { ...row }
  delete rest.source_ref
  delete rest.metadata
  return held ? { ...rest, source_url: null, held: true } : { ...rest, held: false }
}
