/**
 * Operator-only, one-time bridge when the integration HMAC key is retained only
 * as a Cloudflare secret. Bind SERVICE_CLIENT_BOOTSTRAP_KEY temporarily, call
 * once, then delete that binding. Without the binding this route is inert.
 *
 * This route intentionally provisions only DTA's private research principal.
 * The response contains the plaintext credential once and must never be logged.
 */
import { deriveIntegrationTokenHash } from '../_shared/service-auth'

interface Env {
  DB: D1Database
  INTEGRATION_TOKEN_HASH_KEY?: string
  SERVICE_CLIENT_BOOTSTRAP_KEY?: string
}

const CLIENT_ID = 'dta_admin_portal_01'
const COMMUNITY_ID = 'faydta'
const SCOPE = 'community.research.execute'
const DAYS = 365

function response(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

function randomBase64Url(bytes: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...buffer)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function matches(candidate: string | null, expected: string): Promise<boolean> {
  if (!candidate || candidate.length !== expected.length) return false
  const [left, right] = await Promise.all([candidate, expected].map(async value =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))))
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i]
  return diff === 0
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const bootstrapKey = env.SERVICE_CLIENT_BOOTSTRAP_KEY
  if (!bootstrapKey || bootstrapKey.length < 43 || !env.INTEGRATION_TOKEN_HASH_KEY) {
    return response({ error: 'not_found' }, 404)
  }
  if (!(await matches(request.headers.get('X-Service-Client-Bootstrap-Key'), bootstrapKey))) {
    return response({ error: 'forbidden' }, 403)
  }

  try {
    const existing = await env.DB.prepare('SELECT id FROM integration_clients WHERE id = ?')
      .bind(CLIENT_ID).first()
    if (existing) return response({ error: 'already_provisioned' }, 409)

    const secret = randomBase64Url(32)
    const token = `rt_svc_${CLIENT_ID}.${secret}`
    const digest = await deriveIntegrationTokenHash(env.INTEGRATION_TOKEN_HASH_KEY, CLIENT_ID, secret)
    const tokenId = `tok${randomBase64Url(18)}`
    const workspaceId = `svc-ws-${CLIENT_ID.replace(/_/g, '-')}`
    const investigationId = `svc-intake-${CLIENT_ID.replace(/_/g, '-')}`
    const username = `service_${CLIENT_ID}`
    const principal = `(SELECT id FROM users WHERE username = '${username}')`

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO users
        (username, email, full_name, hashed_password, user_hash, account_hash, is_active, is_verified, role)
        VALUES (?, ?, ?, 'SERVICE_AUTH_DISABLED', NULL, NULL, 1, 0, 'service')`)
        .bind(username, `service+${CLIENT_ID}@service.invalid`, `Service: ${CLIENT_ID}`),
      env.DB.prepare(`INSERT INTO workspaces (id, name, description, type, owner_id, is_public)
        VALUES (?, ?, 'Private workspace for a scoped integration client.', 'TEAM', ${principal}, 0)`)
        .bind(workspaceId, `Service workspace: ${CLIENT_ID}`),
      env.DB.prepare(`INSERT INTO investigations
        (id, workspace_id, created_by, title, description, type, status)
        VALUES (?, ?, ${principal}, ?, 'System intake investigation for a scoped integration client.', 'general_topic', 'active')`)
        .bind(investigationId, workspaceId, `Intake: ${CLIENT_ID}`),
      env.DB.prepare(`INSERT INTO integration_clients
        (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
        VALUES (?, ?, ?, ?, ${principal}, 'production', 'private', 'active')`)
        .bind(CLIENT_ID, COMMUNITY_ID, workspaceId, investigationId),
      env.DB.prepare(`INSERT INTO integration_client_tokens
        (id, client_id, slot, secret_hash, hash_version, expires_at)
        VALUES (?, ?, 'current', ?, 'hmac-sha256.v1', unixepoch() + ?)`)
        .bind(tokenId, CLIENT_ID, digest, DAYS * 86400),
      env.DB.prepare('INSERT INTO integration_client_token_scopes (token_id, scope) VALUES (?, ?)')
        .bind(tokenId, SCOPE),
    ])

    return response({ token, clientId: CLIENT_ID, scope: SCOPE, expiresInDays: DAYS }, 201)
  } catch {
    return response({ error: 'provisioning_failed' }, 503)
  }
}
