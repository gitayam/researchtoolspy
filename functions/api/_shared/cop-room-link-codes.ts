/**
 * One-time codes that let a Signal room link to a COP (migration 0027).
 *
 * The COP's owner or an admin collaborator makes a code (POST /api/cop/:id/room-link-codes)
 * and gives it to the room's organizer, who types "!cop link <code>"; the Signal bot
 * redeems it (POST /api/cop/room-link-codes/redeem). So a room is only linked with the
 * COP side's consent: the bot can open every COP it created, and any member can start a
 * breakout room. Linking a room grants the bot access, and granting access is the
 * owner's call (functions/api/cop/[id]/collaborators.ts), shared here with admins.
 *
 * - A code is 10 characters from an alphabet without look-alikes (no I, O, 0, 1), drawn
 *   with crypto.getRandomValues (32 symbols: 5 bits each, no modulo bias): 50 bits.
 * - Only its SHA-256 is stored; the code is shown once. It lasts 24 hours and links one
 *   room. The owner or an admin can revoke every open code of the COP at once.
 * - Redeeming is one db.batch() (one transaction): an UPDATE marks the code used only if
 *   it is unused, unrevoked and unexpired, its issuer may still link rooms, and the bot
 *   has no lower role on the COP; then the bot's principal is added as an editor only if
 *   that UPDATE changed a row and it is neither the owner nor already a collaborator. A
 *   code is never spent without its collaborator write, and two redeems (of one code, or
 *   of two codes for one COP) leave one collaborator row.
 * - An existing collaborator row is never changed: a bot that is a viewer stays one (the
 *   owner changes that in ResearchTools) and its code stays unspent.
 */
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LINK_CODE_LENGTH = 10
export const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000
/** Unused, unexpired codes a session may hold at once. */
export const LINK_CODES_PER_SESSION = 10
/**
 * Redeem attempts per integration client per UTC hour. The bot serves many rooms and
 * limits each sender itself; this is the server's backstop against guessing (50-bit
 * codes, at most 10 open per COP).
 */
export const LINK_CODE_REDEEMS_PER_HOUR = 300

const CODE_RE = new RegExp(`^[${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}}$`)

/** A code that can still be redeemed: binds `now` once. */
const OPEN_CODE = 'used_at IS NULL AND revoked_at IS NULL AND expires_at > ?'
/** A collaborator role that may write (as requireCopEditor reads it). */
const WRITE_ROLE = (alias: string) => `lower(trim(coalesce(${alias}.role, ''))) IN ('editor', 'admin')`

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

/**
 * Whether `userId` may link Signal rooms to the session (make or revoke its codes, and
 * stand behind a code when it is redeemed): its owner or an admin collaborator. Never an
 * editor or a viewer.
 */
export async function mayLinkRooms(db: D1Database, sessionId: string, userId: number): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 AS ok FROM cop_sessions s
    WHERE s.id = ? AND (
      s.created_by = ?
      OR EXISTS (
        SELECT 1 FROM cop_collaborators c
        WHERE c.cop_session_id = s.id AND c.user_id = ? AND lower(trim(coalesce(c.role, ''))) = 'admin'
      )
    )
  `).bind(sessionId, userId, userId).first<{ ok: number }>()
  return Boolean(row)
}

export type CreateLinkCodeResult =
  | { ok: true; id: string; code: string; expires_at: string }
  | { ok: false; status: 429; code: 'TOO_MANY_CODES'; error: string }

/** A new code for the session, issued by `userId` (the caller checked they may). */
export async function createLinkCode(db: D1Database, sessionId: string, userId: number): Promise<CreateLinkCodeResult> {
  const now = new Date()
  const open = await db.prepare(
    `SELECT COUNT(*) AS n FROM cop_room_link_codes WHERE cop_session_id = ? AND ${OPEN_CODE}`
  ).bind(sessionId, now.toISOString()).first<{ n: number }>()
  if (Number(open?.n ?? 0) >= LINK_CODES_PER_SESSION) {
    return {
      ok: false,
      status: 429,
      code: 'TOO_MANY_CODES',
      error: `This COP already has ${LINK_CODES_PER_SESSION} unused link codes; use one, revoke them, or wait for them to expire`,
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

/** Revoke every open code of the session (the caller checked `userId` may); how many. */
export async function revokeOpenLinkCodes(db: D1Database, sessionId: string, userId: number): Promise<number> {
  const now = new Date().toISOString()
  const result = await db.prepare(
    `UPDATE cop_room_link_codes SET revoked_at = ?, revoked_by = ? WHERE cop_session_id = ? AND ${OPEN_CODE}`
  ).bind(now, userId, sessionId, now).run()
  return Number(result.meta?.changes ?? 0)
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
  | { ok: true; sessionId: string; issuer: number; codeId: string; collaboratorId: string | null; added: boolean }
  | { ok: false; status: 404; code: 'LINK_CODE_INVALID'; error: string }
  | { ok: false; status: 409; code: 'BOT_ROLE_TOO_LOW'; error: string }

const INVALID: RedeemResult = {
  ok: false,
  status: 404,
  code: 'LINK_CODE_INVALID',
  error: 'That link code is unknown, already used or expired',
}

function roleTooLow(role: string): RedeemResult {
  const what = role === 'viewer' ? 'a viewer' : 'a collaborator without edit rights'
  return {
    ok: false,
    status: 409,
    code: 'BOT_ROLE_TOO_LOW',
    error: `The bot is ${what} on this COP; the owner can change that in ResearchTools`,
  }
}

/** The bot's collaborator rows on the session: none, one that may write, or only lower ones (the first such role). */
async function botStanding(db: D1Database, sessionId: string, principalUserId: number): Promise<
  { kind: 'owner' } | { kind: 'none' } | { kind: 'writer'; id: string } | { kind: 'lower'; role: string }
> {
  const session = await db.prepare('SELECT created_by FROM cop_sessions WHERE id = ?')
    .bind(sessionId).first<{ created_by: number }>()
  if (session && String(session.created_by) === String(principalUserId)) return { kind: 'owner' }
  const rows = (await db.prepare(
    'SELECT id, role FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ? ORDER BY id'
  ).bind(sessionId, principalUserId).all<{ id: string; role: string | null }>()).results ?? []
  if (rows.length === 0) return { kind: 'none' }
  const writer = rows.find((r) => ['editor', 'admin'].includes(String(r.role ?? '').trim().toLowerCase()))
  if (writer) return { kind: 'writer', id: String(writer.id) }
  return { kind: 'lower', role: String(rows[0].role ?? '').trim().toLowerCase() }
}

/**
 * Use a code once for the service `principalUserId` of `clientId`: the session it was
 * made for and its issuer (still the owner or an admin). The bot is added as an editor
 * when it isn't the owner or a collaborator yet; an editor or admin bot links without a
 * collaborator write; a bot with a lower role is refused (409) and the code stays unspent.
 */
export async function redeemLinkCode(
  db: D1Database,
  input: { code: string; clientId: string; principalUserId: number },
): Promise<RedeemResult> {
  const hash = await linkCodeHash(input.code)
  const now = new Date().toISOString()
  const principal = input.principalUserId
  const pending = await db.prepare(
    `SELECT id, cop_session_id, created_by FROM cop_room_link_codes WHERE code_hash = ? AND ${OPEN_CODE}`
  ).bind(hash, now).first<{ id: string; cop_session_id: string; created_by: number }>()
  if (!pending) return INVALID
  const sessionId = String(pending.cop_session_id)
  const issuer = Number(pending.created_by)
  // The issuer must still be allowed to link rooms when the code is used.
  if (!(await mayLinkRooms(db, sessionId, issuer))) return INVALID
  const before = await botStanding(db, sessionId, principal)
  if (before.kind === 'lower') return roleTooLow(before.role)

  // One transaction. The UPDATE re-checks everything above, so a change in between
  // (the code used or revoked, the issuer demoted, the bot added as a viewer) leaves the
  // code unspent; the INSERT runs only after the UPDATE changed a row (changes() = 1)
  // and only when the bot is neither the owner nor a collaborator by then.
  const collaboratorId = `col-${crypto.randomUUID()}`
  const [spent, added] = await db.batch([
    db.prepare(`
      UPDATE cop_room_link_codes SET used_at = ?, used_by_service = ?
      WHERE code_hash = ? AND ${OPEN_CODE}
        AND EXISTS (
          SELECT 1 FROM cop_sessions s
          WHERE s.id = cop_room_link_codes.cop_session_id AND (
            s.created_by = cop_room_link_codes.created_by
            OR EXISTS (
              SELECT 1 FROM cop_collaborators a
              WHERE a.cop_session_id = s.id AND a.user_id = cop_room_link_codes.created_by
                AND lower(trim(coalesce(a.role, ''))) = 'admin'
            )
          )
        )
        AND (
          EXISTS (SELECT 1 FROM cop_sessions o WHERE o.id = cop_room_link_codes.cop_session_id AND o.created_by = ?)
          OR NOT EXISTS (SELECT 1 FROM cop_collaborators c WHERE c.cop_session_id = cop_room_link_codes.cop_session_id AND c.user_id = ?)
          OR EXISTS (
            SELECT 1 FROM cop_collaborators w
            WHERE w.cop_session_id = cop_room_link_codes.cop_session_id AND w.user_id = ? AND ${WRITE_ROLE('w')}
          )
        )
      RETURNING cop_session_id, created_by
    `).bind(now, input.clientId, hash, now, principal, principal, principal),
    db.prepare(`
      INSERT INTO cop_collaborators (id, cop_session_id, user_id, role, invited_by, accepted_at)
      SELECT ?, ?, ?, 'editor', ?, ?
      WHERE changes() = 1
        AND NOT EXISTS (SELECT 1 FROM cop_sessions WHERE id = ? AND created_by = ?)
        AND NOT EXISTS (SELECT 1 FROM cop_collaborators WHERE cop_session_id = ? AND user_id = ?)
    `).bind(collaboratorId, sessionId, principal, issuer, now, sessionId, principal, sessionId, principal),
  ])

  const used = (spent.results ?? [])[0] as { cop_session_id?: unknown } | undefined
  if (!used || String(used.cop_session_id) !== sessionId) {
    // Not spent. Say why only when the code is still open and the bot's role is the reason.
    const still = await db.prepare(`SELECT 1 AS ok FROM cop_room_link_codes WHERE code_hash = ? AND ${OPEN_CODE}`)
      .bind(hash, new Date().toISOString()).first<{ ok: number }>()
    if (still) {
      const standing = await botStanding(db, sessionId, principal)
      if (standing.kind === 'lower') return roleTooLow(standing.role)
    }
    return INVALID
  }
  if (Number(added.meta?.changes ?? 0) === 1) {
    return { ok: true, sessionId, issuer, codeId: String(pending.id), collaboratorId, added: true }
  }
  const after = await botStanding(db, sessionId, principal)
  return {
    ok: true,
    sessionId,
    issuer,
    codeId: String(pending.id),
    collaboratorId: after.kind === 'writer' ? after.id : null,
    added: false,
  }
}
