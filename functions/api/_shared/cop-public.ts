/**
 * What a COP share link (/public/cop/:token) may see beyond the session fields:
 *   - the change feed, limited to the entity types its panels show;
 *   - the session's evidence form, when the link allows evidence (managed migration 0022);
 *   - key questions (starred RFIs) and the evidence list for the panels that show them.
 * Only explicit columns leave the database: never user ids, emails, descriptions of
 * submitted evidence, or other sessions' rows.
 */
import { JSON_HEADERS } from './api-utils'
import type { CopFeedEntityType } from './cop-event-types'
import { isMissingColumn } from './cop-input'
import { shareExpired, sharePanels } from './cop-share'
import { keyDigest, type KvLike } from './kv-json'

export interface PublicShareRow {
  id: string
  cop_session_id: string
  visible_panels: string
  allow_rfi_answers: number
  allow_evidence?: number
  expires_at?: string | null
  created_by: number
}

export type PublicShareLookup =
  | { ok: true; share: PublicShareRow; session: Record<string, unknown>; panels: string[] }
  | { ok: false; response: Response }

/**
 * The share behind a token, with its session: 404 for an unknown or expired link, 410
 * for an archived session (as the payload route answers).
 */
export async function loadPublicShare(db: D1Database, token: string): Promise<PublicShareLookup> {
  const share = await db.prepare('SELECT * FROM cop_shares WHERE share_token = ?').bind(token).first<PublicShareRow>()
  if (!share || shareExpired(share as never)) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Share link not found or expired' }), { status: 404, headers: JSON_HEADERS }) }
  }
  const session = await db.prepare('SELECT * FROM cop_sessions WHERE id = ?').bind(share.cop_session_id).first<Record<string, unknown>>()
  if (!session) {
    return { ok: false, response: new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: JSON_HEADERS }) }
  }
  if (session.status === 'ARCHIVED') {
    return { ok: false, response: new Response(JSON.stringify({ error: 'This session is no longer available' }), { status: 410, headers: JSON_HEADERS }) }
  }
  return { ok: true, share, session, panels: sharePanels(share as never) }
}

/** The change-feed entity types a share's panels show. */
export function publicFeedTypes(panels: readonly string[]): Set<CopFeedEntityType> {
  const types = new Set<CopFeedEntityType>(['session'])
  for (const panel of panels) {
    switch (panel) {
      case 'map': types.add('marker'); types.add('poo'); types.add('asset'); break
      case 'cams': types.add('webcam'); break
      case 'event': types.add('timeline'); break
      case 'rfi': case 'questions': types.add('rfi'); break
      case 'claims': types.add('claim'); break
      case 'network': types.add('persona'); break
      case 'evidence': types.add('evidence'); types.add('submission'); types.add('tag'); types.add('upload'); break
    }
  }
  return types
}

// ── Per-IP limit for the public feed ─────────────────────────────

export const PUBLIC_CHANGES_PER_MINUTE = 60

/**
 * One poll of the public change feed by this client address. Fails closed without KV
 * or when the count can't be read. A failed counter write lets the request through:
 * KV accepts about one write per second per key, so several viewers behind one address
 * polling together would otherwise lock each other out.
 */
export async function takePublicChangesSlot(kv: KvLike | undefined, request: Request): Promise<'ok' | 'over' | 'unavailable'> {
  if (!kv) return 'unavailable'
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').trim() || 'no-address'
  const bucket = Math.floor(Date.now() / 60_000)
  const key = `quota:cop-public-changes:${await keyDigest(ip)}:${bucket}`
  let used: number
  try {
    used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
  } catch {
    return 'unavailable'
  }
  if (used >= PUBLIC_CHANGES_PER_MINUTE) return 'over'
  try {
    await kv.put(key, String(used + 1), { expirationTtl: 120 })
  } catch {
    // Counter write refused (per-key write rate): this request goes ahead uncounted.
  }
  return 'ok'
}

// ── Evidence form ────────────────────────────────────────────────

export interface PublicEvidenceForm {
  token: string
  title: string
  require_location: boolean
  require_contact: boolean
}

/**
 * The session's evidence form for a share that allows evidence: the newest active,
 * public, password-free, unexpired drop linked to this session. Never another drop.
 */
export async function publicEvidenceForm(db: D1Database, share: PublicShareRow): Promise<PublicEvidenceForm | null> {
  if (share.allow_evidence !== 1) return null
  const rows = await db.prepare(`
    SELECT share_token, title, require_location, require_contact, expires_at
    FROM survey_drops
    WHERE cop_session_id = ? AND status = 'active' AND intent = 'drop'
      AND access_level = 'public' AND password_hash IS NULL
    ORDER BY created_at DESC, rowid DESC
    LIMIT 10
  `).bind(share.cop_session_id).all<{ share_token: string; title: string; require_location: number; require_contact: number; expires_at: string | null }>()
  const now = Date.now()
  for (const row of rows.results ?? []) {
    if (row.expires_at) {
      const at = Date.parse(row.expires_at)
      if (!Number.isFinite(at) || at <= now) continue
    }
    return {
      token: row.share_token,
      title: row.title,
      require_location: row.require_location === 1,
      require_contact: row.require_contact === 1,
    }
  }
  return null
}

// ── Key questions and evidence for the payload ───────────────────

export interface PublicKeyRfi {
  id: string
  question: string
  status: string
  priority: string
  answer_count: number
}

/** Starred RFIs with their answer counts; empty before migration 0022. */
export async function publicKeyRfis(db: D1Database, sessionId: string): Promise<PublicKeyRfi[]> {
  try {
    const rows = await db.prepare(`
      SELECT r.id, r.question, r.status, r.priority,
        (SELECT COUNT(*) FROM cop_rfi_answers a WHERE a.rfi_id = r.id) AS answer_count
      FROM cop_rfis r
      WHERE r.cop_session_id = ? AND r.is_key = 1
      ORDER BY r.created_at ASC, r.rowid ASC
      LIMIT 50
    `).bind(sessionId).all<PublicKeyRfi>()
    return (rows.results ?? []).map((r) => ({ ...r, answer_count: Number(r.answer_count) || 0 }))
  } catch (error) {
    if (isMissingColumn(error)) return []
    throw error
  }
}

export interface PublicEvidenceItem {
  id: number
  title: string
  source_url: string | null
  credibility: string | null
  evidence_type: string | null
  source_channel: string | null
  created_at: string
}

const httpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * The session's evidence for a share showing the evidence panel: title, link (http(s)
 * only), credibility, type, where it came from and when. Never the description, which
 * for submitted tips can carry the submitter's contact details.
 */
export async function publicEvidence(db: D1Database, workspaceId: string): Promise<PublicEvidenceItem[]> {
  let rows: Record<string, unknown>[]
  try {
    rows = ((await db.prepare(`
      SELECT id, title, source_url, credibility, evidence_type, source_channel, created_at
      FROM evidence_items WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 100
    `).bind(workspaceId).all<Record<string, unknown>>()).results ?? [])
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    rows = ((await db.prepare(`
      SELECT id, title, source_url, credibility, evidence_type, created_at
      FROM evidence_items WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 100
    `).bind(workspaceId).all<Record<string, unknown>>()).results ?? [])
  }
  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title ?? ''),
    source_url: httpUrl(r.source_url),
    credibility: (r.credibility as string | null) ?? null,
    evidence_type: (r.evidence_type as string | null) ?? null,
    source_channel: (r.source_channel as string | null) ?? null,
    created_at: String(r.created_at ?? ''),
  }))
}
