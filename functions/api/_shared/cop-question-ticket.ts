/**
 * Question tickets: proof, without saying who, that one of a COP's collaborators opened
 * its evidence form from the workspace.
 *
 * A stranger's form offers only the questions they can already see (key questions, or
 * a share link's questions). A collaborator sees every question, so their form may
 * offer every open one — but drop-submit is anonymous and never reads who is calling
 * (E-11). So the workspace asks GET /api/cop/:id/question-ticket (collaborators only)
 * for a ticket and hands it to the form. The ticket is the session id and an expiry,
 * signed with a key derived from JWT_SECRET for this purpose only; it carries no user
 * id, so a submission made with it is as anonymous as any other.
 */

const LABEL = 'researchtools/cop-question-ticket/v1'
export const QUESTION_TICKET_TTL_SECONDS = 12 * 60 * 60
const TICKET_MAX_LENGTH = 512

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** HMAC key for tickets: HMAC(JWT_SECRET, LABEL), so a ticket and a session token never share a key. */
async function ticketKey(secret: string): Promise<CryptoKey> {
  const root = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const derived = await crypto.subtle.sign('HMAC', root, encoder.encode(LABEL))
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** A ticket for this session, valid QUESTION_TICKET_TTL_SECONDS; null without a secret. */
export async function signQuestionTicket(
  secret: string | undefined,
  sessionId: string,
  now = Date.now(),
): Promise<{ ticket: string; expiresAt: string } | null> {
  if (!secret) return null
  const exp = Math.floor(now / 1000) + QUESTION_TICKET_TTL_SECONDS
  const payload = toBase64Url(encoder.encode(JSON.stringify({ s: sessionId, e: exp })))
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await ticketKey(secret), encoder.encode(payload)))
  return { ticket: `${payload}.${toBase64Url(signature)}`, expiresAt: new Date(exp * 1000).toISOString() }
}

/** The session id a valid, unexpired ticket was issued for; null for anything else. */
export async function verifyQuestionTicket(secret: string | undefined, ticket: unknown, now = Date.now()): Promise<string | null> {
  if (!secret || typeof ticket !== 'string' || ticket.length > TICKET_MAX_LENGTH) return null
  const [payload, sig, extra] = ticket.split('.')
  if (!payload || !sig || extra !== undefined) return null
  const signature = fromBase64Url(sig)
  const body = fromBase64Url(payload)
  if (!signature || !body) return null
  const valid = await crypto.subtle.verify('HMAC', await ticketKey(secret), signature, encoder.encode(payload))
  if (!valid) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body)) as { s?: unknown; e?: unknown }
    if (typeof parsed.s !== 'string' || !parsed.s || typeof parsed.e !== 'number') return null
    return parsed.e * 1000 > now ? parsed.s : null
  } catch {
    return null
  }
}
