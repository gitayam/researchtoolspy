import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from '@playwright/test'

const migration = readFileSync(
  new URL('../../../schema/managed-migrations/0009_community_service_auth.sql', import.meta.url),
  'utf8',
)
const identityCompatibilityMigration = readFileSync(
  new URL('../../../schema/managed-migrations/0010_service_principal_identity_compat.sql', import.meta.url),
  'utf8',
)

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
    is_public INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (owner_id) REFERENCES users(id)
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
    status TEXT NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(BASE_SCHEMA)
  db.exec(migration)
  db.exec(identityCompatibilityMigration)
  return db
}

function createNullablePredecessorDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  const predecessorSchema = BASE_SCHEMA
    .replace('username TEXT NOT NULL UNIQUE', 'username TEXT')
    .replace('email TEXT NOT NULL UNIQUE', 'email TEXT')
  db.exec(predecessorSchema)
  db.exec(migration)
  return db
}

function seedValidBinding(db: DatabaseSync): void {
  db.prepare(`
    INSERT INTO users
      (id, username, email, full_name, hashed_password, user_hash, account_hash,
       oidc_sub, oidc_provider, oidc_email, is_active, role)
    VALUES (73, 'service_community_client_01',
      'service+community_client_01@service.invalid', 'Integration Service',
      'SERVICE_AUTH_DISABLED', NULL, NULL, NULL, NULL, NULL, 1, 'service')
  `).run()
  db.prepare(`
    INSERT INTO workspaces (id, owner_id, type, is_public)
    VALUES ('workspace-test', 73, 'TEAM', 0)
  `).run()
  db.prepare(`
    INSERT INTO investigations (id, workspace_id, created_by, status)
    VALUES ('investigation-test', 'workspace-test', 73, 'active')
  `).run()
}

function insertClient(db: DatabaseSync): void {
  db.prepare(`
    INSERT INTO integration_clients
      (id, community_id, workspace_id, intake_investigation_id, principal_user_id,
       environment, maximum_visibility, status)
    VALUES
      ('community_client_01', 'community-test', 'workspace-test', 'investigation-test', 73,
       'production', 'community', 'active')
  `).run()
}

test.describe('community service auth migration @smoke', () => {
  test('@smoke keeps trigger CASE expressions compatible with the D1 remote splitter', () => {
    // D1's remote splitter can mistake an unparenthesized CASE ... END for the
    // end of CREATE TRIGGER and submit an incomplete statement.
    expect(migration).not.toMatch(/\bSELECT\s+CASE\b/i)
    expect(migration.match(/\bSELECT\s+\(CASE\b/gi)).toHaveLength(2)
    expect(identityCompatibilityMigration).not.toMatch(/\bSELECT\s+CASE\b/i)
    expect(identityCompatibilityMigration.match(/\bSELECT\s+\(CASE\b/gi)).toHaveLength(2)
  })

  test('@smoke upgrades an existing nullable-identity client to exact sentinels', () => {
    const db = createNullablePredecessorDatabase()
    try {
      db.prepare(`
        INSERT INTO users
          (id, username, email, full_name, hashed_password, user_hash, account_hash,
           oidc_sub, oidc_provider, oidc_email, is_active, role)
        VALUES (73, NULL, NULL, 'Integration Service', 'SERVICE_AUTH_DISABLED', NULL, NULL,
          NULL, 'legacy-provider', 'legacy-service@example.test', 1, 'service')
      `).run()
      db.prepare(`
        INSERT INTO workspaces (id, owner_id, type, is_public)
        VALUES ('workspace-test', 73, 'TEAM', 0)
      `).run()
      db.prepare(`
        INSERT INTO investigations (id, workspace_id, created_by, status)
        VALUES ('investigation-test', 'workspace-test', 73, 'active')
      `).run()
      insertClient(db)

      db.exec(identityCompatibilityMigration)

      expect(db.prepare('SELECT username, email, oidc_provider, oidc_email FROM users WHERE id = 73').get()).toEqual({
        username: 'service_community_client_01',
        email: 'service+community_client_01@service.invalid',
        oidc_provider: null,
        oidc_email: null,
      })
      expect(() => db.prepare("UPDATE users SET email = 'other@service.invalid' WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
    } finally {
      db.close()
    }
  })

  test('@smoke creates a constrained client, two-slot token, and exact-scope model', () => {
    const db = createDatabase()
    try {
      seedValidBinding(db)
      insertClient(db)
      const now = 1_800_000_000
      db.prepare(`
        INSERT INTO integration_client_tokens
          (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
        VALUES (?, 'community_client_01', 'current', ?, ?, ?, ?)
      `).run('token_identifier_00000001', 'a'.repeat(64), now, now, now + 3600)
      db.prepare(`
        INSERT INTO integration_client_tokens
          (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
        VALUES (?, 'community_client_01', 'next', ?, ?, ?, ?)
      `).run('token_identifier_00000002', 'b'.repeat(64), now, now, now + 3600)

      db.prepare(`
        INSERT INTO integration_client_token_scopes (token_id, scope)
        VALUES ('token_identifier_00000001', 'community.events.write')
      `).run()
      expect(() => db.prepare(`
        INSERT INTO integration_client_token_scopes (token_id, scope)
        VALUES ('token_identifier_00000001', 'community.*')
      `).run()).toThrow()
      expect(() => db.prepare(`
        INSERT INTO integration_client_tokens
          (id, client_id, slot, secret_hash, created_at, not_before, expires_at)
        VALUES (?, 'community_client_01', 'next', ?, ?, ?, ?)
      `).run('token_identifier_00000003', 'c'.repeat(64), now, now, now + 3600)).toThrow()
      expect(() => db.prepare(`
        UPDATE integration_client_tokens SET not_before = expires_at
        WHERE id = 'token_identifier_00000001'
      `).run()).toThrow()
      expect(() => db.prepare(`
        UPDATE integration_clients SET community_id = '-invalid-leading-character'
        WHERE id = 'community_client_01'
      `).run()).toThrow()
      expect(() => db.prepare(`
        UPDATE integration_client_tokens SET id = '-invalid-token-identifier-01'
        WHERE id = 'token_identifier_00000002'
      `).run()).toThrow()

      const columns = db.prepare('PRAGMA table_info(integration_client_tokens)').all() as Array<{ name: string }>
      expect(columns.map(column => column.name)).not.toContain('secret')
      expect(columns.map(column => column.name)).toContain('secret_hash')
    } finally {
      db.close()
    }
  })

  test('@smoke rejects human, login-capable, public, and incoherent service bindings', () => {
    const invalidMutations = [
      "UPDATE users SET role = 'researcher' WHERE id = 73",
      "UPDATE users SET email = 'service@example.test' WHERE id = 73",
      "UPDATE users SET oidc_sub = 'oidc-linked-service' WHERE id = 73",
      "UPDATE users SET oidc_provider = 'oidc' WHERE id = 73",
      "UPDATE users SET oidc_email = 'service@example.test' WHERE id = 73",
      "UPDATE workspaces SET is_public = 1 WHERE id = 'workspace-test'",
      "UPDATE investigations SET status = 'archived' WHERE id = 'investigation-test'",
    ]
    for (const sql of invalidMutations) {
      const db = createDatabase()
      try {
        seedValidBinding(db)
        db.prepare(sql).run()
        expect(() => insertClient(db)).toThrow(/invalid integration service binding/)
      } finally {
        db.close()
      }
    }
  })

  test('@smoke reverse guards prevent a valid service binding from drifting into a human identity', () => {
    const db = createDatabase()
    try {
      seedValidBinding(db)
      insertClient(db)
      db.prepare(`
        INSERT INTO users
          (id, username, email, full_name, hashed_password, user_hash, account_hash,
           oidc_sub, oidc_provider, oidc_email, is_active, role)
        VALUES (74, 'human', 'human@example.test', 'Human', 'hash', NULL, NULL,
          NULL, NULL, NULL, 1, 'researcher')
      `).run()

      expect(() => db.prepare("UPDATE users SET role = 'researcher' WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
      expect(() => db.prepare("UPDATE users SET email = 'service@example.test' WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
      expect(() => db.prepare("UPDATE users SET hashed_password = NULL WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
      expect(() => db.prepare("UPDATE users SET oidc_sub = 'oidc-linked-service' WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
      expect(() => db.prepare("UPDATE users SET oidc_provider = 'oidc' WHERE id = 73").run())
        .toThrow(/invalid integration service principal update/)
      expect(() => db.prepare("UPDATE users SET role = 'service' WHERE id = 74").run())
        .toThrow(/service principals must be provisioned as new users/)
      expect(() => db.prepare("UPDATE workspaces SET is_public = 1 WHERE id = 'workspace-test'").run())
        .toThrow(/invalid integration workspace update/)
      expect(() => db.prepare("UPDATE workspaces SET type = 'PERSONAL' WHERE id = 'workspace-test'").run())
        .toThrow(/invalid integration workspace update/)
      expect(() => db.prepare("UPDATE workspaces SET owner_id = 74 WHERE id = 'workspace-test'").run())
        .toThrow(/invalid integration workspace update/)
      expect(() => db.prepare("UPDATE investigations SET status = 'archived' WHERE id = 'investigation-test'").run())
        .toThrow(/invalid integration investigation update/)
      expect(() => db.prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, role)
        VALUES ('service-member', 'workspace-test', 73, 'ADMIN')
      `).run()).toThrow(/integration service principal cannot be a workspace member/)
    } finally {
      db.close()
    }
  })
})
