-- Apply the complete migration and tracker in one atomic D1 transaction.
-- No credentials are provisioned. Rollback requires compatible application code;
-- never silently remove scopes or history. Existing production catalog must match
-- the rehearsed prefix, including indexes/triggers on the rebuilt scope table.
-- statement
PRAGMA defer_foreign_keys=ON;
-- statement
CREATE TABLE integration_scope_0013_backup AS SELECT * FROM integration_client_token_scopes;
-- statement
DROP TABLE integration_client_token_scopes;
-- statement
CREATE TABLE integration_client_token_scopes (
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
    'community.webhooks.manage',
    'timeline.read',
    'timeline.write'
  )),
  PRIMARY KEY (token_id, scope),
  FOREIGN KEY (token_id) REFERENCES integration_client_tokens(id) ON DELETE CASCADE
);
-- statement
INSERT INTO integration_client_token_scopes SELECT * FROM integration_scope_0013_backup;
-- statement
DROP TABLE integration_scope_0013_backup;
-- statement
DROP TRIGGER timeline_revision_authorize;
-- statement
CREATE TRIGGER timeline_revision_authorize BEFORE INSERT ON timeline_revisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM users u JOIN workspaces w ON w.id=NEW.workspace_id
    WHERE u.id=NEW.created_by AND u.is_active=1 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND length(trim(u.role))>0 AND w.id<>'1' AND w.is_public=0
      AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN ('EDITOR','ADMIN')
      ))
  ) AND NOT EXISTS (SELECT 1 FROM integration_clients c
 JOIN users u ON u.id=c.principal_user_id
 JOIN workspaces w ON w.id=c.workspace_id
 JOIN investigations i ON i.id=c.intake_investigation_id
 JOIN integration_client_tokens t ON t.client_id=c.id
 WHERE c.workspace_id=NEW.workspace_id AND u.id=NEW.created_by
 AND c.environment IN ('development','staging','production')
 AND c.status='active' AND c.audience='researchtools-community-api.v1'
 AND c.maximum_visibility IN ('private','community','public')
 AND t.slot IN ('current','next') AND t.hash_version='hmac-sha256.v1'
 AND t.created_at<=unixepoch() AND t.not_before<=unixepoch() AND t.expires_at>unixepoch() AND t.revoked_at IS NULL
 AND EXISTS (SELECT 1 FROM integration_client_token_scopes s WHERE s.token_id=t.id AND s.scope='timeline.write')
 AND u.role='service' AND u.is_active=1 AND u.username='service_'||c.id
 AND u.email='service+'||c.id||'@service.invalid' AND u.user_hash IS NULL AND u.account_hash IS NULL
 AND u.oidc_sub IS NULL AND u.oidc_provider IS NULL AND u.oidc_email IS NULL AND u.hashed_password='SERVICE_AUTH_DISABLED'
 AND w.id<>'1' AND w.owner_id=u.id AND w.type='TEAM' AND w.is_public=0
 AND i.workspace_id=w.id AND i.created_by=u.id AND i.status='active'
 AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.user_id=u.id)) THEN RAISE(ABORT,'timeline_authorization_denied') END);
  SELECT (CASE WHEN NEW.sequence>0 AND NOT EXISTS (
    SELECT 1 FROM timeline_lineage_branches b JOIN timeline_revisions r
      ON r.workspace_id=b.workspace_id AND r.artifact_id=b.artifact_id AND r.id=b.head_revision_id
    WHERE b.workspace_id=NEW.workspace_id AND b.artifact_id=NEW.artifact_id AND b.name='main'
      AND b.head_revision_id=NEW.expected_head AND r.sequence+1=NEW.sequence
  ) THEN RAISE(ABORT,'timeline_stale_head') END);
END;
