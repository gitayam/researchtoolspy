-- Human-only private timeline foundation. Forward-only; no applied migration is changed.
-- Statements are separated by the explicit marker for trigger-safe local tests.
-- statement
CREATE TABLE timeline_artifacts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  id TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,id),
  UNIQUE(id)
);
-- statement
CREATE TABLE timeline_revisions (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence >= 0),
  expected_head TEXT,
  object_count INTEGER NOT NULL CHECK(object_count BETWEEN 0 AND 1000),
  change_count INTEGER NOT NULL CHECK(change_count BETWEEN 0 AND 10),
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,id),
  UNIQUE(workspace_id,artifact_id,sequence),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES timeline_artifacts(workspace_id,id),
  FOREIGN KEY(workspace_id,artifact_id,expected_head) REFERENCES timeline_revisions(workspace_id,artifact_id,id),
  CHECK((sequence=0 AND expected_head IS NULL AND object_count=0 AND change_count=0) OR (sequence>0 AND expected_head IS NOT NULL AND change_count>0))
);
-- statement
CREATE TABLE timeline_lineage_branches (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK(name='main'),
  head_revision_id TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,name),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES timeline_artifacts(workspace_id,id),
  FOREIGN KEY(workspace_id,artifact_id,head_revision_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id)
);
-- statement
CREATE TABLE timeline_objects (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind='event-candidate.v1'),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,id),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES timeline_artifacts(workspace_id,id)
);
-- statement
CREATE TABLE timeline_object_versions (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  id TEXT NOT NULL,
  schema_version TEXT NOT NULL CHECK(schema_version='event-candidate.v1'),
  tombstone INTEGER NOT NULL CHECK(tombstone IN (0,1)),
  payload_json TEXT,
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,object_id,id),
  FOREIGN KEY(workspace_id,artifact_id,object_id) REFERENCES timeline_objects(workspace_id,artifact_id,id),
  CHECK((tombstone=1 AND payload_json IS NULL) OR (tombstone=0 AND payload_json IS NOT NULL AND json_valid(payload_json)))
);
-- statement
CREATE TABLE timeline_revision_parents (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  parent_order INTEGER NOT NULL CHECK(parent_order=0),
  PRIMARY KEY(workspace_id,artifact_id,revision_id,parent_order),
  UNIQUE(workspace_id,artifact_id,revision_id,parent_id),
  FOREIGN KEY(workspace_id,artifact_id,revision_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id),
  FOREIGN KEY(workspace_id,artifact_id,parent_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id),
  CHECK(revision_id<>parent_id)
);
-- statement
CREATE TABLE timeline_revision_objects (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,revision_id,object_id),
  FOREIGN KEY(workspace_id,artifact_id,revision_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id),
  FOREIGN KEY(workspace_id,artifact_id,object_id,version_id) REFERENCES timeline_object_versions(workspace_id,artifact_id,object_id,id)
);
-- statement
CREATE TABLE timeline_revision_changes (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create','revise','tombstone')),
  before_version_id TEXT,
  after_version_id TEXT NOT NULL,
  PRIMARY KEY(workspace_id,artifact_id,revision_id,object_id),
  FOREIGN KEY(workspace_id,artifact_id,revision_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id),
  FOREIGN KEY(workspace_id,artifact_id,object_id,before_version_id) REFERENCES timeline_object_versions(workspace_id,artifact_id,object_id,id),
  FOREIGN KEY(workspace_id,artifact_id,object_id,after_version_id) REFERENCES timeline_object_versions(workspace_id,artifact_id,object_id,id),
  CHECK((operation='create' AND before_version_id IS NULL) OR (operation<>'create' AND before_version_id IS NOT NULL))
);
-- statement
CREATE TABLE timeline_idempotency (
  workspace_id TEXT NOT NULL,
  principal_id INTEGER NOT NULL REFERENCES users(id),
  resource TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  artifact_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK(json_valid(response_json)),
  response_status INTEGER NOT NULL CHECK(response_status IN (200,201)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,principal_id,resource,request_key),
  FOREIGN KEY(workspace_id,artifact_id,revision_id) REFERENCES timeline_revisions(workspace_id,artifact_id,id)
);
-- statement
CREATE TRIGGER timeline_revision_authorize BEFORE INSERT ON timeline_revisions BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM users u JOIN workspaces w ON w.id=NEW.workspace_id
    WHERE u.id=NEW.created_by AND u.is_active=1 AND lower(trim(u.role)) NOT IN ('guest','service')
      AND length(trim(u.role))>0 AND w.id<>'1' AND w.is_public=0
      AND (w.owner_id=u.id OR EXISTS (
        SELECT 1 FROM workspace_members m WHERE m.workspace_id=w.id AND m.user_id=u.id AND m.role IN ('EDITOR','ADMIN')
      ))
  ) THEN RAISE(ABORT,'timeline_authorization_denied') END);
  SELECT (CASE WHEN NEW.sequence>0 AND NOT EXISTS (
    SELECT 1 FROM timeline_lineage_branches b JOIN timeline_revisions r
      ON r.workspace_id=b.workspace_id AND r.artifact_id=b.artifact_id AND r.id=b.head_revision_id
    WHERE b.workspace_id=NEW.workspace_id AND b.artifact_id=NEW.artifact_id AND b.name='main'
      AND b.head_revision_id=NEW.expected_head AND r.sequence+1=NEW.sequence
  ) THEN RAISE(ABORT,'timeline_stale_head') END);
END;
-- statement
CREATE TRIGGER timeline_parent_guard BEFORE INSERT ON timeline_revision_parents BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM timeline_revisions r WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id
      AND r.id=NEW.revision_id AND r.expected_head=NEW.parent_id AND r.sequence>0
  ) THEN RAISE(ABORT,'timeline_invalid_parent') END);
END;
-- statement
CREATE TRIGGER timeline_version_no_resurrection BEFORE INSERT ON timeline_object_versions BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_object_versions v WHERE v.workspace_id=NEW.workspace_id AND v.artifact_id=NEW.artifact_id
      AND v.object_id=NEW.object_id AND v.tombstone=1
  ) THEN RAISE(ABORT,'timeline_object_deleted') END);
END;
-- statement
CREATE TRIGGER timeline_branch_cas BEFORE UPDATE ON timeline_lineage_branches BEGIN
  SELECT (CASE WHEN NEW.workspace_id<>OLD.workspace_id OR NEW.artifact_id<>OLD.artifact_id OR NEW.name<>OLD.name
    OR NOT EXISTS (SELECT 1 FROM timeline_revisions r WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id
      AND r.id=NEW.head_revision_id AND r.expected_head=OLD.head_revision_id)
    THEN RAISE(ABORT,'timeline_stale_head') END);
END;
-- statement
CREATE TRIGGER timeline_branch_complete_insert BEFORE INSERT ON timeline_lineage_branches BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM timeline_revisions r WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id AND r.id=NEW.head_revision_id
      AND r.object_count=(SELECT count(*) FROM timeline_revision_objects m WHERE m.workspace_id=r.workspace_id AND m.artifact_id=r.artifact_id AND m.revision_id=r.id)
      AND r.change_count=(SELECT count(*) FROM timeline_revision_changes c WHERE c.workspace_id=r.workspace_id AND c.artifact_id=r.artifact_id AND c.revision_id=r.id)
      AND (CASE WHEN r.sequence=0 THEN 0 ELSE 1 END)=(SELECT count(*) FROM timeline_revision_parents p WHERE p.workspace_id=r.workspace_id AND p.artifact_id=r.artifact_id AND p.revision_id=r.id)
  ) THEN RAISE(ABORT,'timeline_incomplete_revision') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revision_changes c JOIN timeline_revisions r ON r.workspace_id=c.workspace_id AND r.artifact_id=c.artifact_id AND r.id=c.revision_id
    JOIN timeline_object_versions v ON v.workspace_id=c.workspace_id AND v.artifact_id=c.artifact_id AND v.object_id=c.object_id AND v.id=c.after_version_id
    WHERE c.workspace_id=NEW.workspace_id AND c.artifact_id=NEW.artifact_id AND c.revision_id=NEW.head_revision_id AND (
      NOT EXISTS (SELECT 1 FROM timeline_revision_objects m WHERE m.workspace_id=c.workspace_id AND m.artifact_id=c.artifact_id AND m.revision_id=c.revision_id AND m.object_id=c.object_id AND m.version_id=c.after_version_id)
      OR c.before_version_id IS NOT (SELECT m.version_id FROM timeline_revision_objects m WHERE m.workspace_id=c.workspace_id AND m.artifact_id=c.artifact_id AND m.revision_id=r.expected_head AND m.object_id=c.object_id)
      OR (c.operation='tombstone')<>v.tombstone
    )
  ) THEN RAISE(ABORT,'timeline_invalid_change') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revision_objects m JOIN timeline_revisions r ON r.workspace_id=m.workspace_id AND r.artifact_id=m.artifact_id AND r.id=m.revision_id
    WHERE m.workspace_id=NEW.workspace_id AND m.artifact_id=NEW.artifact_id AND m.revision_id=NEW.head_revision_id
      AND m.version_id IS NOT (SELECT old.version_id FROM timeline_revision_objects old WHERE old.workspace_id=m.workspace_id AND old.artifact_id=m.artifact_id AND old.revision_id=r.expected_head AND old.object_id=m.object_id)
      AND NOT EXISTS (SELECT 1 FROM timeline_revision_changes c WHERE c.workspace_id=m.workspace_id AND c.artifact_id=m.artifact_id AND c.revision_id=m.revision_id AND c.object_id=m.object_id)
  ) THEN RAISE(ABORT,'timeline_unrecorded_change') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revisions r JOIN timeline_revision_objects old ON old.workspace_id=r.workspace_id AND old.artifact_id=r.artifact_id AND old.revision_id=r.expected_head
    WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id AND r.id=NEW.head_revision_id
      AND NOT EXISTS (SELECT 1 FROM timeline_revision_objects m WHERE m.workspace_id=old.workspace_id AND m.artifact_id=old.artifact_id AND m.revision_id=r.id AND m.object_id=old.object_id)
  ) THEN RAISE(ABORT,'timeline_missing_tombstone') END);
END;
-- statement
CREATE TRIGGER timeline_branch_complete_update BEFORE UPDATE ON timeline_lineage_branches BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM timeline_revisions r WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id AND r.id=NEW.head_revision_id
      AND r.object_count=(SELECT count(*) FROM timeline_revision_objects m WHERE m.workspace_id=r.workspace_id AND m.artifact_id=r.artifact_id AND m.revision_id=r.id)
      AND r.change_count=(SELECT count(*) FROM timeline_revision_changes c WHERE c.workspace_id=r.workspace_id AND c.artifact_id=r.artifact_id AND c.revision_id=r.id)
      AND (CASE WHEN r.sequence=0 THEN 0 ELSE 1 END)=(SELECT count(*) FROM timeline_revision_parents p WHERE p.workspace_id=r.workspace_id AND p.artifact_id=r.artifact_id AND p.revision_id=r.id)
  ) THEN RAISE(ABORT,'timeline_incomplete_revision') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revision_changes c JOIN timeline_revisions r ON r.workspace_id=c.workspace_id AND r.artifact_id=c.artifact_id AND r.id=c.revision_id
    JOIN timeline_object_versions v ON v.workspace_id=c.workspace_id AND v.artifact_id=c.artifact_id AND v.object_id=c.object_id AND v.id=c.after_version_id
    WHERE c.workspace_id=NEW.workspace_id AND c.artifact_id=NEW.artifact_id AND c.revision_id=NEW.head_revision_id AND (
      NOT EXISTS (SELECT 1 FROM timeline_revision_objects m WHERE m.workspace_id=c.workspace_id AND m.artifact_id=c.artifact_id AND m.revision_id=c.revision_id AND m.object_id=c.object_id AND m.version_id=c.after_version_id)
      OR c.before_version_id IS NOT (SELECT m.version_id FROM timeline_revision_objects m WHERE m.workspace_id=c.workspace_id AND m.artifact_id=c.artifact_id AND m.revision_id=r.expected_head AND m.object_id=c.object_id)
      OR (c.operation='tombstone')<>v.tombstone
    )
  ) THEN RAISE(ABORT,'timeline_invalid_change') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revision_objects m JOIN timeline_revisions r ON r.workspace_id=m.workspace_id AND r.artifact_id=m.artifact_id AND r.id=m.revision_id
    WHERE m.workspace_id=NEW.workspace_id AND m.artifact_id=NEW.artifact_id AND m.revision_id=NEW.head_revision_id
      AND m.version_id IS NOT (SELECT old.version_id FROM timeline_revision_objects old WHERE old.workspace_id=m.workspace_id AND old.artifact_id=m.artifact_id AND old.revision_id=r.expected_head AND old.object_id=m.object_id)
      AND NOT EXISTS (SELECT 1 FROM timeline_revision_changes c WHERE c.workspace_id=m.workspace_id AND c.artifact_id=m.artifact_id AND c.revision_id=m.revision_id AND c.object_id=m.object_id)
  ) THEN RAISE(ABORT,'timeline_unrecorded_change') END);
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revisions r JOIN timeline_revision_objects old ON old.workspace_id=r.workspace_id AND old.artifact_id=r.artifact_id AND old.revision_id=r.expected_head
    WHERE r.workspace_id=NEW.workspace_id AND r.artifact_id=NEW.artifact_id AND r.id=NEW.head_revision_id
      AND NOT EXISTS (SELECT 1 FROM timeline_revision_objects m WHERE m.workspace_id=old.workspace_id AND m.artifact_id=old.artifact_id AND m.revision_id=r.id AND m.object_id=old.object_id)
  ) THEN RAISE(ABORT,'timeline_missing_tombstone') END);
END;
-- statement
CREATE TRIGGER timeline_artifacts_immutable_update BEFORE UPDATE ON timeline_artifacts BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_artifacts_immutable_delete BEFORE DELETE ON timeline_artifacts BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revisions_immutable_update BEFORE UPDATE ON timeline_revisions BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revisions_immutable_delete BEFORE DELETE ON timeline_revisions BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_objects_immutable_update BEFORE UPDATE ON timeline_objects BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_objects_immutable_delete BEFORE DELETE ON timeline_objects BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_object_versions_immutable_update BEFORE UPDATE ON timeline_object_versions BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_object_versions_immutable_delete BEFORE DELETE ON timeline_object_versions BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_parents_immutable_update BEFORE UPDATE ON timeline_revision_parents BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_parents_immutable_delete BEFORE DELETE ON timeline_revision_parents BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_objects_immutable_update BEFORE UPDATE ON timeline_revision_objects BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_objects_immutable_delete BEFORE DELETE ON timeline_revision_objects BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_changes_immutable_update BEFORE UPDATE ON timeline_revision_changes BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_changes_immutable_delete BEFORE DELETE ON timeline_revision_changes BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_idempotency_immutable_update BEFORE UPDATE ON timeline_idempotency BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_idempotency_immutable_delete BEFORE DELETE ON timeline_idempotency BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_branch_no_delete BEFORE DELETE ON timeline_lineage_branches BEGIN
  SELECT RAISE(ABORT,'timeline_immutable');
END;
-- statement
CREATE TRIGGER timeline_revision_parents_sealed_insert BEFORE INSERT ON timeline_revision_parents BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revisions target JOIN timeline_lineage_branches b
      ON b.workspace_id=target.workspace_id AND b.artifact_id=target.artifact_id
    JOIN timeline_revisions head ON head.workspace_id=b.workspace_id AND head.artifact_id=b.artifact_id AND head.id=b.head_revision_id
    WHERE target.workspace_id=NEW.workspace_id AND target.artifact_id=NEW.artifact_id AND target.id=NEW.revision_id AND target.sequence<=head.sequence
  ) THEN RAISE(ABORT,'timeline_revision_sealed') END);
END;
-- statement
CREATE TRIGGER timeline_revision_objects_sealed_insert BEFORE INSERT ON timeline_revision_objects BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revisions target JOIN timeline_lineage_branches b
      ON b.workspace_id=target.workspace_id AND b.artifact_id=target.artifact_id
    JOIN timeline_revisions head ON head.workspace_id=b.workspace_id AND head.artifact_id=b.artifact_id AND head.id=b.head_revision_id
    WHERE target.workspace_id=NEW.workspace_id AND target.artifact_id=NEW.artifact_id AND target.id=NEW.revision_id AND target.sequence<=head.sequence
  ) THEN RAISE(ABORT,'timeline_revision_sealed') END);
END;
-- statement
CREATE TRIGGER timeline_revision_changes_sealed_insert BEFORE INSERT ON timeline_revision_changes BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_revisions target JOIN timeline_lineage_branches b
      ON b.workspace_id=target.workspace_id AND b.artifact_id=target.artifact_id
    JOIN timeline_revisions head ON head.workspace_id=b.workspace_id AND head.artifact_id=b.artifact_id AND head.id=b.head_revision_id
    WHERE target.workspace_id=NEW.workspace_id AND target.artifact_id=NEW.artifact_id AND target.id=NEW.revision_id AND target.sequence<=head.sequence
  ) THEN RAISE(ABORT,'timeline_revision_sealed') END);
END;
-- statement
CREATE TRIGGER timeline_artifacts_no_replace BEFORE INSERT ON timeline_artifacts BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_artifacts old WHERE old.id=NEW.id) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_revisions_no_replace BEFORE INSERT ON timeline_revisions BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_revisions old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.id=NEW.id OR (old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.sequence=NEW.sequence)) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_objects_no_replace BEFORE INSERT ON timeline_objects BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_objects old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.id=NEW.id) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_object_versions_no_replace BEFORE INSERT ON timeline_object_versions BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_object_versions old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.object_id=NEW.object_id AND old.id=NEW.id) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_revision_parents_no_replace BEFORE INSERT ON timeline_revision_parents BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_revision_parents old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.revision_id=NEW.revision_id AND old.parent_order=NEW.parent_order) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_revision_objects_no_replace BEFORE INSERT ON timeline_revision_objects BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_revision_objects old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.revision_id=NEW.revision_id AND old.object_id=NEW.object_id) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_revision_changes_no_replace BEFORE INSERT ON timeline_revision_changes BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_revision_changes old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.revision_id=NEW.revision_id AND old.object_id=NEW.object_id) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_idempotency_no_replace BEFORE INSERT ON timeline_idempotency BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_idempotency old WHERE old.workspace_id=NEW.workspace_id AND old.principal_id=NEW.principal_id AND old.resource=NEW.resource AND old.request_key=NEW.request_key) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_lineage_branches_no_replace BEFORE INSERT ON timeline_lineage_branches BEGIN
  SELECT (CASE WHEN EXISTS (SELECT 1 FROM timeline_lineage_branches old WHERE old.workspace_id=NEW.workspace_id AND old.artifact_id=NEW.artifact_id AND old.name=NEW.name) THEN RAISE(ABORT,'timeline_immutable') END);
END;
-- statement
CREATE TRIGGER timeline_change_no_resurrection BEFORE INSERT ON timeline_revision_changes BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_object_versions v WHERE v.workspace_id=NEW.workspace_id AND v.artifact_id=NEW.artifact_id
      AND v.object_id=NEW.object_id AND v.id=NEW.before_version_id AND v.tombstone=1
  ) THEN RAISE(ABORT,'timeline_object_deleted') END);
END;
