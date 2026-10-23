/**
 * One-time codes that let a Signal room link to a COP (migration 0027).
 *
 * The COP's owner, an editor or an admin makes a code (POST /api/cop/:id/room-link-codes)
 * and gives it to the room's organizer, who types "!cop link <code>"; the Signal bot
 * redeems it (POST /api/cop/room-link-codes/redeem). So a room is only linked with the
 * COP side's consent: the bot can open every COP it created, and any member can start a
 * breakout room.
 *
 * - A code is 10 characters from an alphabet without look-alikes (no I, O, 0, 1), drawn
 *   with crypto.getRandomValues (32 symbols: 5 bits each, no modulo bias): 50 bits.
 * - Only its SHA-256 is stored; the code is shown once. It lasts 24 hours and links one
 *   room: redeeming marks it used in the same UPDATE that checks it is unused and
 *   unexpired, so two redeems can't both succeed (D1's meta.changes / RETURNING).
 * - Redeeming makes the bot's principal an editor collaborator of the session (rooms
 *   write their captures there), invited by the code's issuer, who must still be the
 *   owner, an editor or an admin.
 */
import { requireCopEditor } from './auth-helpers'

export const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LINK_CODE_LENGTH = 10
export const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000
/** Unused, unexpired codes a session may hold at once. */
export const LINK_CODES_PER_SESSION = 10
/** Redeem attempts per integration client per UTC hour. */
export const LINK_CODE_REDEEMS_PER_HOUR = 30

const CODE_RE = new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`)

export function newLinkCode(): string {
  const bytes = new Uint8Array(LINK_CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => LINK_CODE_ALPHABET[b & 31]).join('')
}

/** A code as typed (any case, spaces or dashes between groups) → its canonical form, or null. */
export function normalizeLinkCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null
  const code = raw.toUpperCase().replace(/[\s-]+/g, '')
  return CODE_RE.test(code) ? code : null
}

export async function linkCodeHash(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function linkCodesTableMissing(error: unknown): boolean {
  return /no such table:?\s*(?:main\.)?cop_(?:room_link_codes|link_code_redeem_slots)\b/i
    .test(String(error instanceof Error ? error.message : error))
}

export type CreateLinkCodeResult =
  | { ok: true; id: string; code: string; expires_at: string }
  | { ok: false; status: 429; code: 'TOO_MANY_CODES'; error: string }

/** A new code for the session, issued by `userId` (the caller checked they may). */
export async function createLinkCode(db: D1Database, sessionId: string, userId: number): Promise<CreateLinkCodeResult> {
  const now = new Date()
  const open = await db.prepare(
    'SELECT COUNT(*) AS n FROM cop_room_link_codes WHERE cop_session_id = ? AND used_at IS NULL AND expires_at > ?'
  ).bind(sessionId, now.toISOString()).first<{ n: number }>()
  if (Number(open?.n ?? 0) >= LINK_CODES_PER_SESSION) {
    return {
      ok: false,
      status: 429,
      code: 'TOO_MANY_CODES',
      error: `This COP already has ${LINK_CODES_PER_SESSION} unused link codes; use one or wait for them to expire`,
    }
  }
  const code = newLinkCode()
  const id = `rlc-${crypto.randomUUID()}`
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString()
  await db.prepare(
    'INSERT INTO cop_room_link_codes (id, cop_session_id, code_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, sessionId, await linkCodeHash(code), userId, now.toISOString(), expiresAt).run()
  return { ok: true, id, code, expires_at: expiresAt }
}

/** One redeem attempt for this client this hour, taken atomically; false over the cap. */
export async function takeRedeemSlot(db: D1Database, clientId: string): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13)
  const slot = await db.prepare(`
    INSERT INTO cop_link_code_redeem_slots (client_id, hour, n) VALUES (?, ?, 1)
    ON CONFLICT (client_id, hour) DO UPDATE SET n = n + 1 WHERE n < ?
    RETURNING n
  `).bind(clientId, hour, LINK_CODE_REDEEMS_PER_HOUR).first<{ n: number }>()
  return Boolean(slot)
}

export type RedeemResult =
  | { ok: true; sessionId: string; issuer: number; collaboratorId: string | null }
  | { ok: false; status: 404; code: 'LINK_CODE_INVALID'; error: string }

const INVALID: RedeemResult = {
  ok: false,
  status: 404,
  code: 'LINK_CODE_INVALID',
  error: 'That link code is unknown, already used or expired',
}

/**
 * Use a code once for the service `principalUserId` of `clientId`: the session it was
 * made for, its issuer (still allowed to share the COP), and the bot made an editor.
 */
export async function redeemLinkCode(
  db: D1Database,
  input: { code: string; clientId: string; principalUserId: number },
): Promise<RedeemResult> {
  const hash = await linkCodeHash(input.code)
  const now = new Date().toISOString()
  const pending = await db.prepare(
    'SELECT cop_session_id, created_by FROM cop_room_link_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?'
  ).bind(hash, now).first<{ cop_session_id: string; created_by: number }>()
  if (!pending) return INVALID
  // The issuer must still be allowed to share this COP when the code is used.
  if (!(await requireCopEditor(db, pending.cop_session_id, Number(pending.created_by)))) return INVALID

  const used = await db.prepare(`
    UPDATE cop_room_link_codes SET used_at = ?, used_by_service = ?
    WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?
    RETURNING cop_session_id, created_by
  `).bind(now, input.clientId, hash, now).first<{ cop_session_id: string; created_by: number }>()
  if (!used) return INVALID // Someone else redeemed it in between.

  const sessionId = String(used.cop_session_id)
  const issuer = Number(used.created_by)
  const session = await db.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
    .bind(sessionId).first<{ created_by: number }>()
  if (!session) return INVALID
  let collaboratorId: string | null = null
  if (String(session.created_by) !== String(input.principalUserId)) {
    const existing = await db.prepare(
      'SELECT id, role FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ? ORDER BY id LIMIT 1'
    ).bind(sessionId, input.principalUserId).first<{ id: string; role: string | null }>()
    if (existing) {
      collaboratorId = String(existing.id)
      const role = String(existing.role ?? '').trim().toLowerCase()
      if (role !== 'editor' && role !== 'admin') {
        await db.prepare('UPDATE cop_collaborators SET role = ? WHERE id = ? AND cop_session_id = ?')
          .bind('editor', existing.id, sessionId).run()
      }
    } else {
      collaboratorId = `col-${crypto.randomUUID()}`
      await db.prepare(
        'INSERT INTO cop_collaborators (id, cop_session_id, user_id, role, invited_by, accepted_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(collaboratorId, sessionId, input.principalUserId, 'editor', issuer, now).run()
    }
  }
  return { ok: true, sessionId, issuer, collaboratorId }
}
