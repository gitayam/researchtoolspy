-- Cross-product timeline handoff store (TL-05). See docs/api/timeline-handoff-design.md.
-- NOTE: no semicolon may appear inside a comment in this directory. Keep this file
-- pure ASCII as well: every other applied migration here is, and a multi-byte
-- character in a comment is the difference that made remote apply fail where local
-- apply and plain sqlite both succeeded. `wrangler d1
-- migrations apply` splits on the statement terminator without stripping comments, so
-- a stray one in
-- prose produces a fragment and the whole migration fails with SQLITE_ERROR
-- "incomplete input". This file did exactly that on its first apply.
-- A service credential stages a bounded lineage payload, and a human redeems it once. No
-- workspace or artifact is ever written by this table. Rows are never deleted, so a sweep
-- (functions/api/cron/cleanup-handoffs.ts) is about bytes, not rows. Forward-only, so no
-- applied migration is changed. Modelled directly on 0014_timeline_presentations.sql.
-- statement
CREATE TABLE timeline_handoffs (
  token TEXT PRIMARY KEY NOT NULL CHECK(length(token)=64 AND token NOT GLOB '*[^0-9a-f]*'),
  client_id TEXT NOT NULL,
  minted_by INTEGER NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  audience TEXT NOT NULL
    CHECK(audience IN ('researchtools-community.v1','researchtools-oidc-subject.v1')),
  audience_subject TEXT,
  origin_return_url TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
  payload TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed_at INTEGER,
  redeemed_by INTEGER REFERENCES users(id),
  revoked_at INTEGER,
  UNIQUE(client_id, request_key),
  CHECK((audience='researchtools-oidc-subject.v1') = (audience_subject IS NOT NULL)),
  CHECK(typeof(created_at)='integer' AND typeof(expires_at)='integer' AND expires_at > created_at),
  CHECK((redeemed_at IS NULL) = (redeemed_by IS NULL)),
  CHECK(payload IS NULL OR length(CAST(payload AS BLOB)) <= 65536)
);
-- statement
CREATE INDEX timeline_handoffs_client_active ON timeline_handoffs(client_id,redeemed_at,revoked_at,expires_at);
-- Insert guard: minted_by must be a live service principal whose client (client_id) holds
-- timeline.write at insert time. This is the 0013 service predicate
-- (schema/managed-migrations/0013_timeline_service_scopes.sql:46-66), reused verbatim except
-- that it is keyed on this table's (client_id, minted_by) instead of a revision's
-- (workspace_id, created_by) -- a direct SQL insert cannot forge a handoff any more than it
-- can forge a revision. Also enforces a per-client quota of unredeemed, unexpired,
-- unrevoked rows, the same idea as the 20-link presentation quota
-- (0014_timeline_presentations.sql:16), sized higher because link volume is higher.
-- statement
CREATE TRIGGER timeline_handoffs_insert_guard BEFORE INSERT ON timeline_handoffs BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM timeline_handoffs WHERE token=NEW.token OR (client_id=NEW.client_id AND request_key=NEW.request_key)) THEN RAISE(ABORT,'handoff_identity_exists') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM integration_clients c
 JOIN users u ON u.id=c.principal_user_id
 JOIN workspaces w ON w.id=c.workspace_id
 JOIN investigations i ON i.id=c.intake_investigation_id
 JOIN integration_client_tokens t ON t.client_id=c.id
 WHERE c.id=NEW.client_id AND u.id=NEW.minted_by
 AND c.environment IN ('development','staging','production')
 AND c.status='active' AND c.audience='researchtools-community-api.v1'
 AND c.maximum_visibility IN ('private','community','public')
 AND t.slot IN ('current','next') AND t.hash_version='hmac-sha256.v1'
 AND typeof(t.created_at)='integer' AND t.created_at BETWEEN 0 AND 9007199254740991
 AND typeof(t.not_before)='integer' AND t.not_before BETWEEN 0 AND 9007199254740991
 AND typeof(t.expires_at)='integer' AND t.expires_at BETWEEN 0 AND 9007199254740991
 AND t.created_at<=unixepoch() AND t.not_before<=unixepoch() AND t.expires_at>unixepoch() AND t.revoked_at IS NULL
 AND EXISTS (SELECT 1 FROM integration_client_token_scopes s WHERE s.token_id=t.id AND s.scope='timeline.write')
 AND u.role='service' AND u.is_active=1 AND u.username='service_'||c.id
 AND u.email='service+'||c.id||'@service.invalid' AND u.user_hash IS NULL AND u.account_hash IS NULL
 AND u.oidc_sub IS NULL AND u.oidc_provider IS NULL AND u.oidc_email IS NULL AND u.hashed_password='SERVICE_AUTH_DISABLED'
 AND w.id<>'1' AND w.owner_id=u.id AND w.type='TEAM' AND w.is_public=0
 AND i.workspace_id=w.id AND i.created_by=u.id AND i.status='active'
 AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.user_id=u.id)) THEN RAISE(ABORT,'handoff_authorization_denied') END;
  SELECT CASE WHEN (SELECT count(*) FROM timeline_handoffs WHERE client_id=NEW.client_id AND redeemed_at IS NULL AND revoked_at IS NULL AND expires_at>unixepoch())>=200 THEN RAISE(ABORT,'handoff_quota') END;
END;
-- Update guard: only three legal column changes, matching mint/redeem/revoke exactly.
-- redeemed_at and redeemed_by set together exactly once, revoked_at set exactly once,
-- payload moving to NULL and never back. Everything else is immutable once inserted.
-- statement
CREATE TRIGGER timeline_handoffs_update_guard BEFORE UPDATE ON timeline_handoffs BEGIN
  SELECT CASE WHEN
       NEW.token IS NOT OLD.token
    OR NEW.client_id IS NOT OLD.client_id
    OR NEW.minted_by IS NOT OLD.minted_by
    OR NEW.request_key IS NOT OLD.request_key
    OR NEW.audience IS NOT OLD.audience
    OR NEW.audience_subject IS NOT OLD.audience_subject
    OR NEW.origin_return_url IS NOT OLD.origin_return_url
    OR NEW.payload_hash IS NOT OLD.payload_hash
    OR NEW.created_at IS NOT OLD.created_at
    OR NEW.expires_at IS NOT OLD.expires_at
    OR (OLD.redeemed_at IS NOT NULL AND NEW.redeemed_at IS NOT OLD.redeemed_at)
    OR (OLD.redeemed_by IS NOT NULL AND NEW.redeemed_by IS NOT OLD.redeemed_by)
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
    OR (OLD.payload IS NULL AND NEW.payload IS NOT NULL)
    OR (OLD.payload IS NOT NULL AND NEW.payload IS NOT NULL AND NEW.payload IS NOT OLD.payload)
  THEN RAISE(ABORT,'handoff_immutable') END;
END;
-- statement
CREATE TRIGGER timeline_handoffs_delete_guard BEFORE DELETE ON timeline_handoffs BEGIN
  SELECT RAISE(ABORT,'handoff_immutable');
END;
