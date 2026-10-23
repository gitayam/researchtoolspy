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
import {
  evidenceInSession, isMissingColumn, UNVERIFIED_TIP_LABEL, unreviewedTipEvidence, type EvidenceSessionScope,
} from './cop-input'
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

/**
 * The change-feed entity types a share's panels show. Never assets, team activity
 * (collaborators, exports, alerts: 'activity'), shares or playbooks.
 */
export function publicFeedTypes(panels: readonly string[]): Set<CopFeedEntityType> {
  const types = new Set<CopFeedEntityType>(['session'])
  for (const panel of panels) {
    switch (panel) {
      case 'map': types.add('marker'); types.add('poo'); break
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

/**
 * Entity types whose ids a public feed never shows: a tag id names the tag, and
 * submissions and uploads are not listed on a share. Their events still say that
 * something changed (entity_id null), so the view refetches.
 */
export const PUBLIC_REDACTED_ID_TYPES: ReadonlySet<CopFeedEntityType> = new Set(['tag', 'submission', 'upload'])

// ── Per-IP limit for the public feed ─────────────────────────────

export const PUBLIC_CHANGES_PER_MINUTE = 60

/**
 * One poll of the public change feed by this client address. Fails closed without KV
 * or when the count can't be read. A failed counter write lets the request through:
 * KV accepts about one write per second per key, so several viewers behind one address
 * polling together would otherwise lock each other out.
 */
export async function takePublicChangesSlot(kv: KvLike | undefined, request: Request): Promise<'ok' | 'over' | 'unavailable'> {
  return takePublicSlot(kv, request, 'cop-public-changes', PUBLIC_CHANGES_PER_MINUTE, 60, { allowUncountedWrite: true })
}

/**
 * One use of a public (sign-in free) action by this client address (CF-Connecting-IP,
 * set by Cloudflare; never X-Forwarded-For), stored as a digest. Fails closed without
 * KV or when the count can't be read; a failed counter write fails closed too unless
 * `allowUncountedWrite` (reads that many viewers behind one address poll together).
 */
export async function takePublicSlot(
  kv: KvLike | undefined,
  request: Request,
  name: string,
  limit: number,
  windowSeconds: number,
  options: { allowUncountedWrite?: boolean } = {},
): Promise<'ok' | 'over' | 'unavailable'> {
  if (!kv) return 'unavailable'
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').trim() || 'no-address'
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds)
  const key = `quota:${name}:${await keyDigest(ip)}:${bucket}`
  let used: number
  try {
    used = Number.parseInt((await kv.get(key)) ?? '0', 10) || 0
  } catch {
    return 'unavailable'
  }
  if (used >= limit) return 'over'
  try {
    await kv.put(key, String(used + 1), { expirationTtl: Math.max(60, windowSeconds * 2) })
  } catch {
    // Counter write refused (KV's per-key write rate).
    if (!options.allowUncountedWrite) return 'unavailable'
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
 * The session's evidence form for a share that allows evidence (see sessionEvidenceForm).
 */
export async function publicEvidenceForm(db: D1Database, share: PublicShareRow): Promise<PublicEvidenceForm | null> {
  if (share.allow_evidence !== 1) return null
  return sessionEvidenceForm(db, share.cop_session_id)
}

/**
 * A session's evidence form: the newest active, public, password-free, unexpired drop
 * linked to this session AND made by someone who manages it (the session owner or a
 * current editor/admin collaborator). Anyone can create a drop and point it at a
 * session id, so a drop from anybody else is never offered as the COP's form.
 */
export async function sessionEvidenceForm(db: D1Database, sessionId: string): Promise<PublicEvidenceForm | null> {
  const rows = await db.prepare(`
    SELECT d.share_token, d.title, d.require_location, d.require_contact, d.expires_at
    FROM survey_drops d
    JOIN cop_sessions s ON s.id = d.cop_session_id
    WHERE d.cop_session_id = ? AND d.status = 'active' AND d.intent = 'drop'
      AND d.access_level = 'public' AND d.password_hash IS NULL
      AND (
        d.created_by = s.created_by
        OR EXISTS (
          SELECT 1 FROM cop_collaborators c
          WHERE c.cop_session_id = s.id AND c.user_id = d.created_by AND lower(c.role) IN ('editor', 'admin')
        )
      )
    ORDER BY d.created_at DESC, d.rowid DESC
    LIMIT 10
  `).bind(sessionId).all<{ share_token: string; title: string; require_location: number; require_contact: number; expires_at: string | null }>()
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
 * only), credibility, type, where it came from and when. Only this COP's evidence
 * (evidenceInSession), never everything in its workspace. Never the description, which
 * for submitted tips can carry the submitter's contact details; and a drop-form tip no
 * editor has reviewed yet shows as "Unverified tip" without its link.
 */
export async function publicEvidence(db: D1Database, scope: EvidenceSessionScope): Promise<PublicEvidenceItem[]> {
  const clause = evidenceInSession(scope)
  let rows: Record<string, unknown>[]
  try {
    rows = ((await db.prepare(`
      SELECT id, title, source_url, credibility, evidence_type, source_channel, created_at
      FROM evidence_items WHERE ${clause.sql} ORDER BY created_at DESC, id DESC LIMIT 100
    `).bind(...clause.binds).all<Record<string, unknown>>()).results ?? [])
  } catch (error) {
    if (!isMissingColumn(error)) throw error
    rows = ((await db.prepare(`
      SELECT id, title, source_url, credibility, evidence_type, created_at
      FROM evidence_items WHERE ${clause.legacySql} ORDER BY created_at DESC, id DESC LIMIT 100
    `).bind(...clause.legacyBinds).all<Record<string, unknown>>()).results ?? [])
  }
  return rows.map((r) => {
    const unreviewed = unreviewedTipEvidence(r)
    return {
      id: Number(r.id),
      title: unreviewed ? UNVERIFIED_TIP_LABEL : String(r.title ?? ''),
      source_url: unreviewed ? null : httpUrl(r.source_url),
      credibility: (r.credibility as string | null) ?? null,
      evidence_type: (r.evidence_type as string | null) ?? null,
      source_channel: (r.source_channel as string | null) ?? null,
      created_at: String(r.created_at ?? ''),
    }
  })
}
