/**
 * Cloudflare Turnstile server-side verification (E-6a).
 *
 * `verifyTurnstile` POSTs the client token to Cloudflare's siteverify endpoint and
 * returns whether the challenge passed. It is FAIL-CLOSED by design:
 *   - missing/empty token  → false (no network call)
 *   - missing/empty secret → false (no network call)
 *   - any fetch / parse error → false
 *
 * Because the prod `TURNSTILE_SECRET` is not set yet, gated endpoints that call
 * this will currently reject every request — intended; they go live with E-6e once
 * the keys are configured.
 *
 * Cloudflare documented TEST secrets (for unit tests, no real network):
 *   always-passes: 1x0000000000000000000000000000000AA
 *   always-fails:  2x0000000000000000000000000000000AA
 *
 * `fetchImpl` is injectable so the verify can be unit-tested without a network.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileVerifyResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

/**
 * Verify a Turnstile token against the secret. Returns true ONLY when Cloudflare
 * responds `{ success: true }`. Fail-closed on every other path.
 *
 * @param token      the `cf-turnstile-response` value from the client widget
 * @param secret     the server-side TURNSTILE_SECRET
 * @param fetchImpl  injectable fetch (defaults to global `fetch`)
 * @param remoteIp   optional client IP to bind the verification to
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
  remoteIp?: string | null,
): Promise<boolean> {
  // Fail-closed: no token or no secret means we cannot verify → reject.
  if (typeof token !== 'string' || token.trim() === '') return false
  if (typeof secret !== 'string' || secret.trim() === '') return false

  try {
    const body = new FormData()
    body.append('secret', secret)
    body.append('response', token)
    if (remoteIp) body.append('remoteip', remoteIp)

    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body })
    if (!res || !res.ok) return false

    const result = (await res.json()) as TurnstileVerifyResponse
    return result?.success === true
  } catch {
    // Network / parse failure → fail-closed.
    return false
  }
}
