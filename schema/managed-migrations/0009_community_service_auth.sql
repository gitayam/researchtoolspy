-- Scoped, non-interactive service identities for community integrations.
-- This migration creates no clients, principals, or credentials and is inert
-- until an operator provisions them and explicitly enables integration features.
--
-- Rollback (after reverting every integration route that reads these objects):
--   DROP TRIGGER IF EXISTS integration_service_role_insert_only;
--   DROP TRIGGER IF EXISTS integration_investigation_guard_update;
--   DROP TRIGGER IF EXISTS integration_workspace_guard_update;
--   DROP TRIGGER IF EXISTS integration_principal_guard_update;
--   DROP TRIGGER IF EXISTS integration_service_no_membership_update;
--   DROP TRIGGER IF EXISTS integration_service_no_membership_insert;
--   DROP TRIGGER IF EXISTS integration_clients_validate_update;
--   DROP TRIGGER IF EXISTS integration_clients_validate_insert;
--   DROP TABLE IF EXISTS integration_client_token_scopes;
--   DROP TABLE IF EXISTS integration_client_tokens;
--   DROP TABLE IF EXISTS integration_clients;
--   DROP INDEX IF EXISTS idx_investigations_service_binding;

CREATE UNIQUE INDEX IF NOT EXISTS idx_investigations_service_binding
  ON investigations(id, workspace_id, created_by);

CREATE TABLE IF NOT EXISTS integration_clients (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 16 AND 64)
    CHECK (id GLOB '[a-z0-9]*')
    CHECK (id NOT GLOB '*[^a-z0-9_-]*'),
  community_id TEXT NOT NULL
    CHECK (length(community_id) BETWEEN 1 AND 128)
    CHECK (community_id GLOB '[A-Za-z0-9]*')
    CHECK (community_id NOT GLOB '*[^A-Za-z0-9._:-]*'),
  workspace_id TEXT NOT NULL
    CHECK (workspace_id <> '1')
    CHECK (length(workspace_id) BETWEEN 1 AND 128)
    CHECK (workspace_id GLOB '[A-Za-z0-9]*')
    CHECK (workspace_id NOT GLOB '*[^A-Za-z0-9._:-]*'),
  intake_investigation_id TEXT NOT NULL
    CHECK (length(intake_investigation_id) BETWEEN 1 AND 128)
    CHECK (intake_investigation_id GLOB '[A-Za-z0-9]*')
    CHECK (intake_investigation_id NOT GLOB '*[^A-Za-z0-9._:-]*'),
  principal_user_id INTEGER NOT NULL UNIQUE,
  environment TEXT NOT NULL
    CHECK (environment IN ('development', 'staging', 'production')),
  audience TEXT NOT NULL DEFAULT 'researchtools-community-api.v1'
    CHECK (audience = 'researchtools-community-api.v1'),
  maximum_visibility TEXT NOT NULL
    CHECK (maximum_visibility IN ('private', 'community', 'public')),
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  FOREIGN KEY (principal_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (intake_investigation_id, workspace_id, principal_user_id)
    REFERENCES investigations(id, workspace_id, created_by) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_integration_clients_binding
  ON integration_clients(community_id, workspace_id, status);

CREATE TABLE IF NOT EXISTS integration_client_tokens (
  id TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 22 AND 64)
    CHECK (id GLOB '[A-Za-z0-9]*')
    CHECK (id NOT GLOB '*[^A-Za-z0-9_-]*'),
  client_id TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('current', 'next')),
  secret_hash TEXT NOT NULL UNIQUE
    CHECK (length(secret_hash) = 64)
    CHECK (secret_hash NOT GLOB '*[^a-f0-9]*'),
  hash_version TEXT NOT NULL DEFAULT 'hmac-sha256.v1'
    CHECK (hash_version = 'hmac-sha256.v1'),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  not_before INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  last_used_at INTEGER,
  UNIQUE (client_id, slot),
  CHECK (not_before >= created_at),
  CHECK (not_before < expires_at),
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (last_used_at IS NULL OR last_used_at >= created_at),
  FOREIGN KEY (client_id) REFERENCES integration_clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integration_client_tokens_expiry
  ON integration_client_tokens(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS integration_client_token_scopes (
  token_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN (
    'community.events.write',
    'community.jobs.read',
    'community.artifacts.read',
    'community.projections.read',
    'community.claims.execute',
    'community.research.execute',
    'community.cop.write',
    'community.behavior.write',
    'community.feeds.manage',
    'community.webhooks.manage'
  )),
  PRIMARY KEY (token_id, scope),
  FOREIGN KEY (token_id) REFERENCES integration_client_tokens(id) ON DELETE CASCADE
);

-- A service principal is a non-login user that owns one private TEAM workspace
-- and its system intake investigation. It is never a human workspace member.
CREATE TRIGGER IF NOT EXISTS integration_clients_validate_insert
BEFORE INSERT ON integration_clients
BEGIN
  -- Parenthesize CASE because D1's remote statement splitter otherwise treats
  -- its END token as the end of the trigger body and submits incomplete SQL.
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN workspaces w ON w.id = NEW.workspace_id
    JOIN investigations i ON i.id = NEW.intake_investigation_id
    WHERE u.id = NEW.principal_user_id
      AND u.role = 'service'
      AND u.is_active = 1
      AND u.user_hash IS NULL
      AND u.account_hash IS NULL
      AND u.email IS NULL
      AND u.oidc_sub IS NULL
      AND u.hashed_password = 'SERVICE_AUTH_DISABLED'
      AND w.owner_id = u.id
      AND w.type = 'TEAM'
      AND w.is_public = 0
      AND w.id <> '1'
      AND i.workspace_id = w.id
      AND i.created_by = u.id
      AND i.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id)
  ) THEN RAISE(ABORT, 'invalid integration service binding') END);
END;

CREATE TRIGGER IF NOT EXISTS integration_clients_validate_update
BEFORE UPDATE OF workspace_id, intake_investigation_id, principal_user_id, environment, audience,
  maximum_visibility, status ON integration_clients
BEGIN
  -- Keep CASE parenthesized for D1 remote migration compatibility.
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN workspaces w ON w.id = NEW.workspace_id
    JOIN investigations i ON i.id = NEW.intake_investigation_id
    WHERE u.id = NEW.principal_user_id
      AND u.role = 'service'
      AND u.is_active = 1
      AND u.user_hash IS NULL
      AND u.account_hash IS NULL
      AND u.email IS NULL
      AND u.oidc_sub IS NULL
      AND u.hashed_password = 'SERVICE_AUTH_DISABLED'
      AND w.owner_id = u.id
      AND w.type = 'TEAM'
      AND w.is_public = 0
      AND w.id <> '1'
      AND i.workspace_id = w.id
      AND i.created_by = u.id
      AND i.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id)
  ) THEN RAISE(ABORT, 'invalid integration service binding') END);
END;

CREATE TRIGGER IF NOT EXISTS integration_service_no_membership_insert
BEFORE INSERT ON workspace_members
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.principal_user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'integration service principal cannot be a workspace member');
END;

-- A service principal must be a newly inserted dedicated row. Converting a
-- formerly interactive user could leave already-issued browser credentials live.
CREATE TRIGGER IF NOT EXISTS integration_service_role_insert_only
BEFORE UPDATE OF role ON users
WHEN NEW.role = 'service' AND OLD.role IS NOT 'service'
BEGIN
  SELECT RAISE(ABORT, 'service principals must be provisioned as new users');
END;

CREATE TRIGGER IF NOT EXISTS integration_service_no_membership_update
BEFORE UPDATE OF user_id ON workspace_members
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.principal_user_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'integration service principal cannot be a workspace member');
END;

CREATE TRIGGER IF NOT EXISTS integration_principal_guard_update
BEFORE UPDATE OF role, is_active, user_hash, account_hash, email, oidc_sub, hashed_password ON users
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.principal_user_id = OLD.id)
  AND (
    NEW.role IS NOT 'service' OR NEW.is_active IS NOT 1 OR NEW.user_hash IS NOT NULL OR
    NEW.account_hash IS NOT NULL OR NEW.email IS NOT NULL OR NEW.oidc_sub IS NOT NULL OR
    NEW.hashed_password IS NOT 'SERVICE_AUTH_DISABLED'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid integration service principal update');
END;

CREATE TRIGGER IF NOT EXISTS integration_workspace_guard_update
BEFORE UPDATE OF id, owner_id, type, is_public ON workspaces
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.workspace_id = OLD.id)
  AND (
    NEW.id IS NOT OLD.id OR NEW.owner_id IS NOT OLD.owner_id OR
    NEW.type IS NOT 'TEAM' OR NEW.is_public IS NOT 0 OR NEW.id = '1'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid integration workspace update');
END;

CREATE TRIGGER IF NOT EXISTS integration_investigation_guard_update
BEFORE UPDATE OF id, workspace_id, created_by, status ON investigations
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.intake_investigation_id = OLD.id)
  AND (
    NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR
    NEW.created_by IS NOT OLD.created_by OR NEW.status IS NOT 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid integration investigation update');
END;
