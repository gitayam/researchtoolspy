-- Align service-principal identity constraints with the production users table,
-- whose historical schema requires non-null unique username and email values.
-- These deterministic sentinels are identifiers only: service principals still
-- have no human mailbox, hash identity, OIDC identity, session, or usable password.
--
-- Rollback: this is intentionally forward-only because production's users table
-- cannot represent the null identity required by 0009. An application rollback
-- must set COMMUNITY_INTEGRATIONS_ENABLED=false and may leave these inert
-- sentinels/triggers in place; do not restore 0009's null-email trigger policy.

DROP TRIGGER IF EXISTS integration_clients_validate_insert;
DROP TRIGGER IF EXISTS integration_clients_validate_update;
DROP TRIGGER IF EXISTS integration_principal_guard_update;

UPDATE users
SET username = 'service_' || (
      SELECT c.id FROM integration_clients c WHERE c.principal_user_id = users.id
    ),
    email = 'service+' || (
      SELECT c.id FROM integration_clients c WHERE c.principal_user_id = users.id
    ) || '@service.invalid',
    oidc_provider = NULL,
    oidc_email = NULL
WHERE EXISTS (
  SELECT 1 FROM integration_clients c WHERE c.principal_user_id = users.id
);

CREATE TRIGGER integration_clients_validate_insert
BEFORE INSERT ON integration_clients
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN workspaces w ON w.id = NEW.workspace_id
    JOIN investigations i ON i.id = NEW.intake_investigation_id
    WHERE u.id = NEW.principal_user_id
      AND u.role = 'service'
      AND u.is_active = 1
      AND u.username = 'service_' || NEW.id
      AND u.email = 'service+' || NEW.id || '@service.invalid'
      AND u.user_hash IS NULL
      AND u.account_hash IS NULL
      AND u.oidc_sub IS NULL
      AND u.oidc_provider IS NULL
      AND u.oidc_email IS NULL
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

CREATE TRIGGER integration_clients_validate_update
BEFORE UPDATE OF id, community_id, workspace_id, intake_investigation_id, principal_user_id,
  environment, audience, maximum_visibility, status ON integration_clients
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1
    FROM users u
    JOIN workspaces w ON w.id = NEW.workspace_id
    JOIN investigations i ON i.id = NEW.intake_investigation_id
    WHERE u.id = NEW.principal_user_id
      AND u.role = 'service'
      AND u.is_active = 1
      AND u.username = 'service_' || NEW.id
      AND u.email = 'service+' || NEW.id || '@service.invalid'
      AND u.user_hash IS NULL
      AND u.account_hash IS NULL
      AND u.oidc_sub IS NULL
      AND u.oidc_provider IS NULL
      AND u.oidc_email IS NULL
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

CREATE TRIGGER integration_principal_guard_update
BEFORE UPDATE OF username, email, role, is_active, user_hash, account_hash, oidc_sub,
  oidc_provider, oidc_email, hashed_password ON users
WHEN EXISTS (SELECT 1 FROM integration_clients c WHERE c.principal_user_id = OLD.id)
  AND (
    NEW.username IS NOT 'service_' || (
      SELECT c.id FROM integration_clients c WHERE c.principal_user_id = OLD.id
    ) OR
    NEW.email IS NOT 'service+' || (
      SELECT c.id FROM integration_clients c WHERE c.principal_user_id = OLD.id
    ) || '@service.invalid' OR
    NEW.role IS NOT 'service' OR NEW.is_active IS NOT 1 OR NEW.user_hash IS NOT NULL OR
    NEW.account_hash IS NOT NULL OR NEW.oidc_sub IS NOT NULL OR
    NEW.oidc_provider IS NOT NULL OR NEW.oidc_email IS NOT NULL OR
    NEW.hashed_password IS NOT 'SERVICE_AUTH_DISABLED'
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid integration service principal update');
END;
