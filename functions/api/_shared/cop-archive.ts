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
 *
 * Collaborators also get `archive_url`: for `silo:<id>`, the community portal's member
 * download for that file (SILO_PORTAL_BASE + id; the portal checks the signed-in member
 * belongs to the room), and for `peertube:<url>`, the video link. It is derived here on
 * read, never stored, and only archiveFields() — the collaborator view — adds it.
 */

export const SCAN_STATES = ['pending', 'clean', 'quarantined'] as const
export type ScanState = (typeof SCAN_STATES)[number]

const SILO_REF = /^silo:(\d{1,18}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const MAX_REF_LENGTH = 500

export interface ArchiveEnv {
  COP_PEERTUBE_HOST?: string
  /** https prefix ending in '/', e.g. https://irregulars.io/files/breakout/ (wrangler vars). */
  SILO_PORTAL_BASE?: string
}

/** The configured portal prefix, or null when unset or not a plain https prefix ending in '/'. */
export function siloPortalBase(env: ArchiveEnv | undefined): string | null {
  const raw = (env?.SILO_PORTAL_BASE ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) return null
    return url.href
  } catch {
    return null
  }
}

/**
 * Where a collaborator can open an item's original: the portal download for a Silo file,
 * the PeerTube page for a saved video; null for anything else (or when unconfigured).
 */
export function archiveUrl(sourceRef: unknown, env: ArchiveEnv | undefined): string | null {
  if (typeof sourceRef !== 'string') return null
  const silo = SILO_REF.exec(sourceRef)
  if (silo) {
    const base = siloPortalBase(env)
    return base ? `${base}${encodeURIComponent(silo[1].toLowerCase())}` : null
  }
  if (sourceRef.startsWith('peertube:')) {
    try {
      const url = new URL(sourceRef.slice('peertube:'.length))
      const host = (env?.COP_PEERTUBE_HOST ?? '').trim().toLowerCase()
      return url.protocol === 'https:' && !url.username && !url.password && (!host || url.hostname === host) ? url.href : null
    } catch {
      return null
    }
  }
  return null
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
export function archiveFields(row: { source_ref?: unknown; metadata?: unknown }, env?: ArchiveEnv): {
  archived_in: 'silo' | 'peertube' | null
  archive_url: string | null
  scan_state: ScanState | null
  held: boolean
} {
  const ref = typeof row.source_ref === 'string' ? row.source_ref : ''
  const held = evidenceHeld(row)
  return {
    archived_in: ref.startsWith('silo:') ? 'silo' : ref.startsWith('peertube:') ? 'peertube' : null,
    // The portal refuses a file the scan hasn't cleared, so a held Silo item gets no link.
    archive_url: held && ref.startsWith('silo:') ? null : archiveUrl(ref, env),
    scan_state: scanStateOf(row),
    held,
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
  delete rest.archive_url
  delete rest.archived_in
  delete rest.scan_state
  return held ? { ...rest, source_url: null, held: true } : { ...rest, held: false }
}
