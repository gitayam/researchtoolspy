import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'
import type { D1Database } from '@cloudflare/workers-types'
import { getUserFromRequest, type Env as UserAuthEnv } from '../../../functions/api/_shared/auth-helpers'
import { generateToken } from '../../../functions/utils/jwt'
import {
  IntegrationAuthError,
  deriveIntegrationTokenHash,
  getIntegrationPrincipalFromRequest,
} from '../../../functions/api/_shared/service-auth'

const migration = readFileSync(
  new URL('../../../schema/managed-migrations/0009_community_service_auth.sql', import.meta.url),
  'utf8',
)
const identityCompatibilityMigration = readFileSync(
  new URL('../../../schema/managed-migrations/0010_service_principal_identity_compat.sql', import.meta.url),
  'utf8',
)
const CLIENT_ID = 'community_client_01'
const CURRENT_SECRET = 'A'.repeat(43)
const NEXT_SECRET = 'B'.repeat(43)
const HASH_KEY = 'integration-test-key-material-0000000000000000'
const NOW = 1_800_000_000

const BASE_SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    user_hash TEXT,
    account_hash TEXT,
    oidc_sub TEXT,
    oidc_provider TEXT,
    oidc_email TEXT,
    is_active INTEGER NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL
  );
  CREATE TABLE investigations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    status TEXT NOT NULL
  );
`

function asD1Database(sqlite: DatabaseSync): D1Database {
  return {
    prepare: (sql: string) => {
      const statement = sqlite.prepare(sql)
      const prepared = (bindings: unknown[] = []): Record<string, unknown> => ({
        bind: (...values: unknown[]) => prepared(values),
        all: async () => ({ success: true, results: statement.all(...bindings) }),
        first: async () => statement.get(...bindings) ?? null,
        run: async () => ({ success: true, meta: {}, results: [], ...statement.run(...bindings) }),
      })
      return prepared()
    },
  } as unknown as D1Database
}

async function createDatabase(): Promise<{ sqlite: DatabaseSync; db: D1Database }> {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(BASE_SCHEMA)
  sqlite.exec(migration)
  sqlite.exec(identityCompatibilityMigration)
  const db = asD1Database(sqlite)
  await db.prepare(`
    INSERT INTO users
      (id, username, email, full_name, hashed_password, user_hash, account_hash,
       oidc_sub, oidc_provider, oidc_email, is_active, role)
    VALUES (73, ?, ?, 'Integration Service', 'SERVICE_AUTH_DISABLED', NULL, NULL,
      NULL, NULL, NULL, 1, 'service')
  `).bind(`service_${CLIENT_ID}`, `service+${CLIENT_ID}@service.invalid`).run()
  await db.prepare(`
    INSERT INTO workspaces (id, owner_id, type, is_public)
    VALUES ('workspace-test', 73, 'TEAM', 0)
  `).run()
  await db.prepare(`
    INSERT INTO investigations (id, workspace_id, created_by, status)
    VALUES ('investigation-test', 'workspace-test', 73, 'active')
  `).run()
  await db.prepare(`
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id,
       environment, maximum_visibility, status)
    VALUES (?, 'community-test', 'workspace-test', 'investigation-test', 73,
      'production', 'community', 'active')
  `).bind(CLIENT_ID).run()

  const currentHash = await deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, CURRENT_SECRET)
  const nextHash = await deriveIntegrationTokenHash(HASH_KEY, CLIENT_ID, NEXT_SECRET)
  await db.prepare(`
    INSERT INTO integration_client_tokens
      (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
    VALUES ('token_identifier_00000001', ?, 'current', ?, ?, ?, ?)
  `).bind(CLIENT_ID, currentHash, NOW - 100, NOW - 100, NOW + 3600).run()
  await db.prepare(`
    INSERT INTO integration_client_tokens
      (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
    VALUES ('token_identifier_00000002', ?, 'next', ?, ?, ?, ?)
  `).bind(CLIENT_ID, nextHash, NOW - 100, NOW - 100, NOW + 3600).run()
  await db.prepare(`
    INSERT INTO integration_client_token_scopes (token_id, scope) VALUES
      ('token_identifier_00000001', 'community.events.write'),
      ('token_identifier_00000001', 'community.projections.read'),
      ('token_identifier_00000002', 'community.jobs.read')
  `).run()
  return { sqlite, db }
}

function request(secret: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request('https://researchtools.net/api/integrations/capabilities', {
    headers: {
      Authorization: `Bearer rt_svc_${CLIENT_ID}.${secret}`,
      ...extraHeaders,
    },
  })
}

function env(db: D1Database, overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    ENVIRONMENT: 'production',
    INTEGRATION_TOKEN_HASH_KEY: HASH_KEY,
    ...overrides,
  }
}

async function expectAuthError(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  try {
    await promise
    throw new Error('Expected service authentication to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrationAuthError)
    expect((error as IntegrationAuthError).code).toBe(code)
    expect((error as IntegrationAuthError).status).toBe(status)
  }
}

test.describe('community service authentication @smoke', () => {
  test('@smoke reserves every rt_svc_ bearer before legacy session and hash auth', async () => {
    let dbCalls = 0
    let sessionCalls = 0
    const legacyEnv = {
      DB: { prepare: () => { dbCalls += 1; throw new Error('must not query') } },
      SESSIONS: { get: async () => { sessionCalls += 1; return JSON.stringify({ user_id: 99 }) } },
    } as unknown as UserAuthEnv
    const malformed = new Request('https://researchtools.net/api/anything', {
      headers: {
        Authorization: 'Bearer   rt_svc_malformed',
        'X-User-Hash': 'valid-user-hash-00000001',
        'X-Guest-Session': 'guest_018f47ce-f8f4-7ad5-9f6d-83e61296f891',
      },
    })

    await expect(getUserFromRequest(malformed, legacyEnv)).resolves.toBeNull()
    for (const authorization of [
      `Bearer RT_SVC_${CLIENT_ID}.${CURRENT_SECRET}`,
      `Bearer \u00a0rt_svc_${CLIENT_ID}.${CURRENT_SECRET}`,
      `\tBearer\trt_svc_${CLIENT_ID}.${CURRENT_SECRET}`,
      ` Bearer  rt_svc_${CLIENT_ID}.${CURRENT_SECRET}`,
    ]) {
      const variant = new Request('https://researchtools.net/api/anything', {
        headers: {
          Authorization: authorization,
          'X-User-Hash': 'valid-user-hash-00000001',
        },
      })
      await expect(getUserFromRequest(variant, legacyEnv)).resolves.toBeNull()
    }
    expect(dbCalls).toBe(0)
    expect(sessionCalls).toBe(0)
  })

  test('@smoke a service-role JWT cannot enter legacy user routes or raw-hash provisioning', async () => {
    let dbCalls = 0
    const jwtSecret = 'jwt-test-secret-material-0000000000000000'
    const token = await generateToken({ sub: 73, role: 'service' }, jwtSecret)
    const legacyEnv = {
      JWT_SECRET: jwtSecret,
      DB: { prepare: () => { dbCalls += 1; throw new Error('must not query or provision') } },
    } as unknown as UserAuthEnv
    const jwtRequest = new Request('https://researchtools.net/api/anything', {
      headers: { Authorization: `Bearer ${token}` },
    })

    await expect(getUserFromRequest(jwtRequest, legacyEnv)).resolves.toBeNull()
    expect(dbCalls).toBe(0)
  })

  test('@smoke authenticates current and next slots with scopes derived only from D1', async () => {
    const { sqlite, db } = await createDatabase()
    try {
      const current = await getIntegrationPrincipalFromRequest(request(CURRENT_SECRET), env(db), { nowEpochSeconds: NOW })
      const next = await getIntegrationPrincipalFromRequest(request(NEXT_SECRET), env(db), { nowEpochSeconds: NOW })
      expect(current).toMatchObject({
        clientId: CLIENT_ID,
        tokenId: 'token_identifier_00000001',
        principalUserId: 73,
        communityId: 'community-test',
        workspaceId: 'workspace-test',
        investigationId: 'investigation-test',
        maximumVisibility: 'community',
      })
      expect(current?.scopes).toEqual(['community.events.write', 'community.projections.read'])
      expect(next?.tokenId).toBe('token_identifier_00000002')
      expect(next?.scopes).toEqual(['community.jobs.read'])
    } finally {
      sqlite.close()
    }
  })

  test('@smoke invalid, expired, revoked, disabled, and wrong-environment tokens fail closed', async () => {
    const { sqlite, db } = await createDatabase()
    try {
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request('C'.repeat(43)), env(db), { nowEpochSeconds: NOW }),
        'invalid_service_token',
        401,
      )
      await db.prepare("UPDATE integration_client_tokens SET expires_at = ? WHERE slot = 'current'")
        .bind(NOW).run()
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(CURRENT_SECRET), env(db), { nowEpochSeconds: NOW }),
        'expired_service_token',
        401,
      )
      await db.prepare("UPDATE integration_client_tokens SET revoked_at = ? WHERE slot = 'next'")
        .bind(NOW).run()
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(NEXT_SECRET), env(db), { nowEpochSeconds: NOW }),
        'invalid_service_token',
        401,
      )
      await db.prepare("UPDATE integration_clients SET status = 'disabled' WHERE id = ?").bind(CLIENT_ID).run()
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(NEXT_SECRET), env(db), { nowEpochSeconds: NOW }),
        'invalid_service_token',
        401,
      )
      await db.prepare("UPDATE integration_clients SET status = 'active' WHERE id = ?").bind(CLIENT_ID).run()
      await db.prepare("UPDATE integration_client_tokens SET revoked_at = NULL WHERE slot = 'next'").run()
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(NEXT_SECRET), env(db, { ENVIRONMENT: 'staging' }), { nowEpochSeconds: NOW }),
        'invalid_service_token',
        401,
      )
    } finally {
      sqlite.close()
    }
  })

  test('@smoke rejects workspace substitution and maps missing auth configuration to retryable 503', async () => {
    const { sqlite, db } = await createDatabase()
    try {
      await expectAuthError(
        getIntegrationPrincipalFromRequest(
          request(CURRENT_SECRET, { 'X-Workspace-ID': 'workspace-other' }),
          env(db),
          { nowEpochSeconds: NOW },
        ),
        'workspace_denied',
        403,
      )
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(CURRENT_SECRET), env(db, { INTEGRATION_TOKEN_HASH_KEY: undefined })),
        'auth_datastore_unavailable',
        503,
      )
    } finally {
      sqlite.close()
    }
  })

  test('@smoke malformed or unsupported supplied authorization never becomes anonymous', async () => {
    const { sqlite, db } = await createDatabase()
    try {
      const malformed = new Request('https://researchtools.net/api/integrations/capabilities', {
        headers: { Authorization: `Bearer rt_svc_${CLIENT_ID}.${CURRENT_SECRET}.extra` },
      })
      const userBearer = new Request('https://researchtools.net/api/integrations/capabilities', {
        headers: { Authorization: 'Bearer ordinary-user-session-token' },
      })
      await expectAuthError(getIntegrationPrincipalFromRequest(malformed, env(db)), 'invalid_service_token', 401)
      await expectAuthError(getIntegrationPrincipalFromRequest(userBearer, env(db)), 'authentication_required', 401)
    } finally {
      sqlite.close()
    }
  })

  test('@smoke unsuccessful or malformed D1 results are retryable datastore failures', async () => {
    for (const result of [
      { success: false, results: [] },
      { success: true },
      { success: true, results: null },
    ]) {
      const db = {
        prepare: () => ({ bind: () => ({ all: async () => result }) }),
      } as unknown as D1Database
      await expectAuthError(
        getIntegrationPrincipalFromRequest(request(CURRENT_SECRET), env(db)),
        'auth_datastore_unavailable',
        503,
      )
    }

    const throwingDb = {
      prepare: () => ({ bind: () => ({ all: async () => { throw new Error('D1 unavailable') } }) }),
    } as unknown as D1Database
    await expectAuthError(
      getIntegrationPrincipalFromRequest(request(CURRENT_SECRET), env(throwingDb)),
      'auth_datastore_unavailable',
      503,
    )
  })
})
