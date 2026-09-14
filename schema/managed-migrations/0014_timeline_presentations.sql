CREATE TABLE timeline_presentations (
  token TEXT PRIMARY KEY NOT NULL CHECK(length(token)=64 AND token NOT GLOB '*[^0-9a-f]*'),
  owner_id INTEGER NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
  payload TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(owner_id,request_key),
  CHECK ((revoked_at IS NULL AND payload IS NOT NULL AND length(CAST(payload AS BLOB))<=524288) OR (revoked_at IS NOT NULL AND payload IS NULL))
);
CREATE INDEX timeline_presentations_owner_active ON timeline_presentations(owner_id,revoked_at,created_at);
CREATE TRIGGER timeline_presentations_insert_guard BEFORE INSERT ON timeline_presentations BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM timeline_presentations WHERE token=NEW.token OR (owner_id=NEW.owner_id AND request_key=NEW.request_key)) THEN RAISE(ABORT,'presentation_identity_exists') END;
  SELECT CASE WHEN NEW.revoked_at IS NOT NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.owner_id AND is_active=1 AND length(trim(role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0 AND lower(trim(role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) NOT IN ('guest','service')) THEN RAISE(ABORT,'presentation_owner_unavailable') END;
  SELECT CASE WHEN (SELECT count(*) FROM timeline_presentations WHERE owner_id=NEW.owner_id AND revoked_at IS NULL)>=20 THEN RAISE(ABORT,'presentation_quota') END;
END;
CREATE TRIGGER timeline_presentations_update_guard BEFORE UPDATE ON timeline_presentations BEGIN
  SELECT CASE WHEN NEW.token IS NOT OLD.token OR NEW.owner_id IS NOT OLD.owner_id OR NEW.request_key IS NOT OLD.request_key OR NEW.payload_hash IS NOT OLD.payload_hash OR NEW.created_at IS NOT OLD.created_at
    OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.payload IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=OLD.owner_id AND is_active=1 AND length(trim(role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279)))>0 AND lower(trim(role,char(9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279))) NOT IN ('guest','service')) THEN RAISE(ABORT,'presentation_immutable') END;
END;
CREATE TRIGGER timeline_presentations_delete_guard BEFORE DELETE ON timeline_presentations BEGIN
  SELECT RAISE(ABORT,'presentation_immutable');
END;
