/**
 * GET /api/auth/oidc/callback
 *
 * Handles the OAuth2 Authorization Code callback from Authentik.
 *
 * Flow:
 *  1. Validate state parameter against KV (CSRF protection)
 *  2. Exchange authorization code for tokens at Authentik token endpoint
 *  3. Fetch user info from Authentik userinfo endpoint
 *  4. Find-or-create local user in D1, linking OIDC subject
 *  5. Issue internal JWT and redirect to the frontend with token in URL params
 */

import type { Env } from '../../_shared/auth-helpers'
import { JSON_HEADERS, optionsResponse } from '../../_shared/api-utils'
import { generateToken } from '../../../utils/jwt'

/** Shape of the Authentik userinfo response (subset we care about) */
interface OIDCUserInfo {
  sub: string
  email?: string
  preferred_username?: string
  name?: string
  given_name?: string
  family_name?: string
  groups?: string[]
}

/**
 * Map OIDC groups to local roles.
 * Authentik groups are checked in priority order.
 */
function mapGroupsToRole(groups: string[] | undefined): string {
  if (!groups || groups.length === 0) return 'user'
  const g = groups.map(s => s.toLowerCase())
  if (g.includes('admins') || g.includes('admin') || g.includes('researchtools-admins')) return 'admin'
  if (g.includes('analysts') || g.includes('analyst') || g.includes('researchtools-analysts')) return 'analyst'
  if (g.includes('users') || g.includes('researchtools-users')) return 'user'
  return 'user'
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  try {
    // ---- 0. Pre-flight checks ----
    if (!env.OIDC_CLIENT_ID || !env.OIDC_TOKEN_URL || !env.OIDC_USERINFO_URL || !env.OIDC_CLIENT_SECRET) {
      return redirectWithError(url.origin, 'OIDC is not fully configured on this server')
    }
    if (!env.SESSIONS || !env.DB || !env.JWT_SECRET) {
      return redirectWithError(url.origin, 'Server dependencies unavailable')
    }

    // ---- 1. Extract and validate query params ----
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      const desc = url.searchParams.get('error_description') || error
      console.error('[OIDC] Authorization error from provider:', desc)
      return redirectWithError(url.origin, desc)
    }

    if (!code || !state) {
      return redirectWithError(url.origin, 'Missing authorization code or state parameter')
    }

    // ---- 2. Verify state (CSRF protection) ----
    const stateKey = `oidc_state:${state}`
    const storedState = await env.SESSIONS.get(stateKey)
    if (!storedState) {
      return redirectWithError(url.origin, 'Invalid or expired state. Please try logging in again.')
    }
    // Delete immediately -- one-time use
    await env.SESSIONS.delete(stateKey)

    // ---- 3. Exchange code for tokens ----
    const redirectUri = `${url.origin}/api/auth/oidc/callback`

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.OIDC_CLIENT_ID,
      client_secret: env.OIDC_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    })

    const tokenResponse = await fetch(env.OIDC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    })

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('[OIDC] Token exchange failed:', tokenResponse.status, errText)
      return redirectWithError(url.origin, 'Failed to exchange authorization code')
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string
      id_token?: string
      token_type: string
      expires_in?: number
    }

    if (!tokenData.access_token) {
      console.error('[OIDC] No access_token in token response')
      return redirectWithError(url.origin, 'Invalid token response from provider')
    }

    // ---- 4. Fetch userinfo ----
    const userinfoResponse = await fetch(env.OIDC_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userinfoResponse.ok) {
      const errText = await userinfoResponse.text()
      console.error('[OIDC] Userinfo fetch failed:', userinfoResponse.status, errText)
      return redirectWithError(url.origin, 'Failed to fetch user information')
    }

    const userInfo = (await userinfoResponse.json()) as OIDCUserInfo

    if (!userInfo.sub) {
      console.error('[OIDC] Userinfo missing sub claim')
      return redirectWithError(url.origin, 'Invalid user information from provider')
    }

    // ---- 5. Find or create local user ----
    const db = env.DB

    // 5a. Try by oidc_sub first (returning user)
    let user = await db.prepare(
      'SELECT id, username, full_name, role, email FROM users WHERE oidc_sub = ?'
    ).bind(userInfo.sub).first<{
      id: number
      username: string
      full_name: string | null
      role: string
      email: string | null
    }>()

    if (user) {
      // Sync username, role, email, and name from OIDC on every login
      const oidcRole = mapGroupsToRole(userInfo.groups)
      const oidcUsername = userInfo.preferred_username || user.username
      const oidcFullName = userInfo.name || user.full_name
      await db.prepare(
        'UPDATE users SET username = ?, full_name = ?, role = ?, oidc_email = ?, oidc_provider = ? WHERE id = ?'
      ).bind(
        oidcUsername,
        oidcFullName,
        oidcRole,
        userInfo.email || null,
        'authentik',
        user.id
      ).run()
      // Reflect updated values for the JWT and frontend payload
      user.username = oidcUsername
      user.full_name = oidcFullName
      user.role = oidcRole
      user.email = userInfo.email || user.email
    }

    // 5b. Try by email (link existing hash-auth user who registered with same email)
    // Only auto-link if the OIDC provider has verified the email address
    if (!user && userInfo.email && userInfo.email_verified !== false) {
      user = await db.prepare(
        'SELECT id, username, full_name, role, email FROM users WHERE email = ? AND oidc_sub IS NULL'
      ).bind(userInfo.email).first<{
        id: number
        username: string
        full_name: string | null
        role: string
        email: string | null
      }>()

      if (user) {
        // Link OIDC identity to existing user + sync role/username from groups
        const oidcRole = mapGroupsToRole(userInfo.groups)
        const oidcUsername = userInfo.preferred_username || user.username
        const oidcFullName = userInfo.name || user.full_name
        await db.prepare(
          'UPDATE users SET oidc_sub = ?, oidc_provider = ?, oidc_email = ?, username = ?, full_name = ?, role = ? WHERE id = ?'
        ).bind(
          userInfo.sub,
          'authentik',
          userInfo.email,
          oidcUsername,
          oidcFullName,
          oidcRole,
          user.id
        ).run()
        user.username = oidcUsername
        user.full_name = oidcFullName
        user.role = oidcRole
        user.email = userInfo.email || user.email
      }
    }

    // 5c. Create new user
    if (!user) {
      const username = userInfo.preferred_username || userInfo.email || `oidc_${userInfo.sub.substring(0, 8)}`
      const fullName = userInfo.name
        || [userInfo.given_name, userInfo.family_name].filter(Boolean).join(' ')
        || username
      const email = userInfo.email || `${userInfo.sub}@oidc.local`
      const oidcRole = mapGroupsToRole(userInfo.groups)

      const insertResult = await db.prepare(`
        INSERT INTO users (username, email, full_name, hashed_password, user_hash, created_at, is_active, is_verified, role, oidc_sub, oidc_provider, oidc_email)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'authentik', ?)
        RETURNING id, username, full_name, role, email
      `).bind(
        username,
        email,
        fullName,
        'OIDC_AUTH',
        `oidc_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`,
        new Date().toISOString(),
        oidcRole,
        userInfo.sub,
        userInfo.email || null
      ).first<{
        id: number
        username: string
        full_name: string | null
        role: string
        email: string | null
      }>()

      if (!insertResult) {
        console.error('[OIDC] Failed to create user for sub:', userInfo.sub)
        return redirectWithError(url.origin, 'Failed to create user account')
      }

      user = insertResult
    }

    // ---- 6. Generate internal JWT ----
    const jwt = await generateToken(
      {
        sub: user.id,
        name: user.full_name || user.username,
        role: user.role,
      },
      env.JWT_SECRET
    )

    // ---- 7. Redirect to frontend with token ----
    // Fetch user_hash for X-User-Hash header compatibility
    const userHashRow = await db.prepare(
      'SELECT user_hash FROM users WHERE id = ?'
    ).bind(user.id).first<{ user_hash: string | null }>()

    const userPayload = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      email: user.email,
      account_hash: userHashRow?.user_hash || null,
    }

    const userEncoded = btoa(JSON.stringify(userPayload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const frontendUrl = new URL('/auth/callback', url.origin)
    frontendUrl.searchParams.set('token', jwt)
    frontendUrl.searchParams.set('user', userEncoded)

    return new Response(null, {
      status: 302,
      headers: {
        Location: frontendUrl.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[OIDC] Callback error:', err)
    const origin = new URL(request.url).origin
    return redirectWithError(origin, 'An unexpected error occurred during authentication')
  }
}

/** Build a redirect to the frontend error page with an error message */
function redirectWithError(origin: string, message: string): Response {
  const errorUrl = new URL('/auth/callback', origin)
  errorUrl.searchParams.set('error', message)
  return new Response(null, {
    status: 302,
    headers: {
      Location: errorUrl.toString(),
      'Cache-Control': 'no-store',
    },
  })
}

/** OPTIONS /api/auth/oidc/callback -- CORS preflight */
export const onRequestOptions: PagesFunction<Env> = async () => {
  return optionsResponse()
}
