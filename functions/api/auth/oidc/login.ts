/**
 * GET /api/auth/oidc/login
 *
 * Initiates the OIDC Authorization Code flow by redirecting the user to
 * the Authentik authorization endpoint. A random state token is persisted
 * in KV with a 10-minute TTL to prevent CSRF.
 */

import type { Env } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.OIDC_CLIENT_ID || !env.OIDC_AUTHORIZATION_URL) {
    return Response.json(
      { error: 'OIDC is not configured on this server' },
      { status: 503, headers: JSON_HEADERS }
    )
  }

  if (!env.SESSIONS) {
    return Response.json(
      { error: 'Session store unavailable' },
      { status: 503, headers: JSON_HEADERS }
    )
  }

  // Generate CSRF-protection state token
  const state = crypto.randomUUID()

  // Generate PKCE code_verifier (43-128 chars of unreserved URI chars per RFC 7636)
  const verifierBytes = new Uint8Array(32)
  crypto.getRandomValues(verifierBytes)
  const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Derive code_challenge = BASE64URL(SHA256(code_verifier))
  const challengeBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier)
  )
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(challengeBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  // Persist state + code_verifier in KV with 10-minute TTL
  await env.SESSIONS.put(
    `oidc_state:${state}`,
    JSON.stringify({ created_at: Date.now(), code_verifier: codeVerifier }),
    { expirationTtl: 600 }
  )

  // Build redirect_uri from the incoming request origin
  const origin = new URL(request.url).origin
  const redirectUri = `${origin}/api/auth/oidc/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile groups',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const authorizationUrl = `${env.OIDC_AUTHORIZATION_URL}?${params.toString()}`

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl,
      'Cache-Control': 'no-store',
    },
  })
}

/** OPTIONS /api/auth/oidc/login -- CORS preflight */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
