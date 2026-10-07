#!/usr/bin/env node
/**
 * Provision a scoped `rt_svc_` service client: the operator path the
 * community-integrations plan calls for and nothing else implemented.
 *
 * Writes reviewable SQL to a file and prints the plaintext token ONCE. It never
 * touches a database itself; the operator applies the file:
 *
 *   INTEGRATION_TOKEN_HASH_KEY=... node scripts/provision-service-client.mjs \
 *     --client-id dta_admin_portal_01 --community-id faydta \
 *     --scope community.research.execute --days 365 --out /tmp/dta-client.sql
 *   source ./scripts/cloudflare-account.sh
 *   npx wrangler d1 execute researchtoolspy-prod --remote --file=/tmp/dta-client.sql
 *
 * The stored digest is HMAC-SHA-256 under INTEGRATION_TOKEN_HASH_KEY, the same
 * derivation as functions/api/_shared/service-auth.ts deriveIntegrationTokenHash.
 * Cloudflare will not reveal a Workers secret, so the key must come from the
 * operator's own record of it. A digest made with the wrong key produces a
 * token that is refused with invalid_service_token, and nothing else breaks.
 *
 * The inserts satisfy integration_clients_validate_insert (migrations 0009,
 * 0010): a NEW dedicated users row with role 'service', the deterministic
 * service_<id> username and service+<id>@service.invalid email, no hash/OIDC
 * identity, the SERVICE_AUTH_DISABLED password sentinel; a private TEAM
 * workspace it owns; an active intake investigation it created; and no
 * workspace membership.
 *
 * To rotate: run again with --slot next, deploy the new token to the caller,
 * then revoke the old slot. To revoke: UPDATE integration_client_tokens SET
 * revoked_at = unixepoch() WHERE client_id = '<id>' AND slot = '<slot>'.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const SCOPES = new Set([
  'community.events.write', 'community.jobs.read', 'community.artifacts.read',
  'community.projections.read', 'community.claims.execute', 'community.research.execute',
  'community.cop.write', 'community.behavior.write', 'community.feeds.manage',
  'community.webhooks.manage', 'timeline.read', 'timeline.write',
])
const CLIENT_ID = /^[a-z0-9][a-z0-9_-]{15,63}$/
const OPAQUE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function fail(message) {
  console.error(`provision-service-client: ${message}`)
  process.exit(2)
}

function parseArgs(argv) {
  const out = { scopes: [], days: 365, environment: 'production', visibility: 'private', slot: 'current', existing: false }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = argv[i + 1]
    switch (flag) {
      case '--client-id': out.clientId = value; i += 1; break
      case '--community-id': out.communityId = value; i += 1; break
      case '--scope': out.scopes.push(value); i += 1; break
      case '--days': out.days = Number(value); i += 1; break
      case '--environment': out.environment = value; i += 1; break
      case '--visibility': out.visibility = value; i += 1; break
      case '--slot': out.slot = value; i += 1; break
      case '--out': out.out = value; i += 1; break
      case '--token-only': out.existing = true; break
      default: fail(`unknown argument ${flag}`)
    }
  }
  return out
}

const sql = value => `'${String(value).replace(/'/g, "''")}'`

const args = parseArgs(process.argv.slice(2))
const key = process.env.INTEGRATION_TOKEN_HASH_KEY ?? ''
if (key.length < 32) fail('INTEGRATION_TOKEN_HASH_KEY must be set in the environment (at least 32 characters).')
if (!CLIENT_ID.test(args.clientId ?? '')) fail('--client-id must match [a-z0-9][a-z0-9_-]{15,63}.')
if (!args.existing && !OPAQUE.test(args.communityId ?? '')) fail('--community-id is required: letters, digits, . _ : -')
if (!args.scopes.length || args.scopes.some(scope => !SCOPES.has(scope))) fail(`--scope is required, one or more of: ${[...SCOPES].join(', ')}`)
if (!Number.isInteger(args.days) || args.days < 1 || args.days > 730) fail('--days must be an integer from 1 to 730.')
if (!['development', 'staging', 'production'].includes(args.environment)) fail('--environment must be development, staging, or production.')
if (!['private', 'community', 'public'].includes(args.visibility)) fail('--visibility must be private, community, or public.')
if (!['current', 'next'].includes(args.slot)) fail('--slot must be current or next.')
if (!args.out) fail('--out <file.sql> is required; the SQL is written there for review, never executed.')

const clientId = args.clientId
const secret = randomBytes(32).toString('base64url')
if (secret.length !== 43) fail('internal: secret did not encode to 43 characters')
const token = `rt_svc_${clientId}.${secret}`
const digest = createHmac('sha256', key).update(`rt-service-token.v1\0${clientId}\0${secret}`).digest('hex')
const tokenId = `tok${randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9_-]/g, '')}`.slice(0, 40)
const workspaceId = `svc-ws-${clientId}`.replace(/_/g, '-')
const investigationId = `svc-intake-${clientId}`.replace(/_/g, '-')
const username = `service_${clientId}`
const email = `service+${clientId}@service.invalid`
const principal = `(SELECT id FROM users WHERE username = ${sql(username)})`

const statements = []
statements.push(`-- Service client ${clientId}, generated ${new Date().toISOString()}.`)
statements.push(`-- Scopes: ${args.scopes.join(', ')}. Slot: ${args.slot}. Expires in ${args.days} days.`)
statements.push('-- Contains a digest only; the plaintext token was printed once and is not in this file.')
if (!args.existing) {
  statements.push(`INSERT INTO users (username, email, full_name, hashed_password, user_hash, account_hash, is_active, is_verified, role)
VALUES (${sql(username)}, ${sql(email)}, ${sql(`Service: ${clientId}`)}, 'SERVICE_AUTH_DISABLED', NULL, NULL, 1, 0, 'service');`)
  statements.push(`INSERT INTO workspaces (id, name, description, type, owner_id, is_public)
VALUES (${sql(workspaceId)}, ${sql(`Service workspace: ${clientId}`)}, 'Private workspace for a scoped integration client.', 'TEAM', ${principal}, 0);`)
  statements.push(`INSERT INTO investigations (id, workspace_id, created_by, title, description, type, status)
VALUES (${sql(investigationId)}, ${sql(workspaceId)}, ${principal}, ${sql(`Intake: ${clientId}`)}, 'System intake investigation for a scoped integration client.', 'general_topic', 'active');`)
  statements.push(`INSERT INTO integration_clients (id, community_id, workspace_id, intake_investigation_id, principal_user_id, environment, maximum_visibility, status)
VALUES (${sql(clientId)}, ${sql(args.communityId)}, ${sql(workspaceId)}, ${sql(investigationId)}, ${principal}, ${sql(args.environment)}, ${sql(args.visibility)}, 'active');`)
}
statements.push(`INSERT INTO integration_client_tokens (id, client_id, slot, secret_hash, hash_version, expires_at)
VALUES (${sql(tokenId)}, ${sql(clientId)}, ${sql(args.slot)}, ${sql(digest)}, 'hmac-sha256.v1', unixepoch() + ${args.days * 86400});`)
for (const scope of [...new Set(args.scopes)].sort()) {
  statements.push(`INSERT INTO integration_client_token_scopes (token_id, scope) VALUES (${sql(tokenId)}, ${sql(scope)});`)
}

writeFileSync(args.out, `${statements.join('\n\n')}\n`, { mode: 0o600 })
console.error(`Wrote ${args.out}. Review it, then apply with wrangler d1 execute --remote --file.`)
console.error('The token below is shown once. Store it as the caller’s secret now; it cannot be recovered.')
console.log(token)
