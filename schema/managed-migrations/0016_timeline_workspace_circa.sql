-- Admit timeline-workspace.v3 (approximate/circa recorded dates) to the durable store.
--
-- v3 shipped in the local workspace, export/import and browser draft, but the durable
-- CHECK constraints admitted only v1/v2. prepareTimelineSave sends kind=schemaVersion
-- verbatim, so marking a date circa promoted the workspace to v3 and the private save
-- failed with a generic 400. Authoring worked; keeping it did not.
--
-- Structure mirrors 0015 exactly, for the reasons that migration documents: no old table
-- is RENAMED, so dependent foreign keys and external triggers keep their original names,
-- and PRAGMA defer_foreign_keys lets the two mutually-referencing tables be restored
-- before commit. Verified against live production before writing: these two tables carry
-- 8 triggers and 2 PRIMARY KEY auto-indexes, and the only foreign key pointing at
-- timeline_objects comes from timeline_object_versions, which is rebuilt alongside it.
--
-- Execute the ENTIRE migration in ONE atomic D1 transaction (managed apply or D1 batch),
-- never separate prepare().run() calls. A failed statement must roll back the whole
-- migration, including these temporary ordinary backup tables. All historical bytes
-- remain unchanged; only the admitted family widens. No payload or content hash is
-- rewritten. No destructive down migration: retain history and roll application forward.
-- statement
PRAGMA defer_foreign_keys=ON;
-- statement
CREATE TABLE timeline_objects_0016_backup AS SELECT * FROM timeline_objects;
-- statement
CREATE TABLE timeline_versions_0016_backup AS SELECT * FROM timeline_object_versions;
-- statement
DROP TABLE timeline_object_versions;
-- statement
DROP TABLE timeline_objects;
-- statement
CREATE TABLE timeline_objects (
  workspace_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('event-candidate.v1','timeline-workspace.v1','timeline-workspace.v2','timeline-workspace.v3')),
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
  schema_version TEXT NOT NULL CHECK(schema_version IN ('event-candidate.v1','timeline-workspace.v1','timeline-workspace.v2','timeline-workspace.v3')),
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
INSERT INTO timeline_objects SELECT * FROM timeline_objects_0016_backup;
-- statement
INSERT INTO timeline_object_versions SELECT * FROM timeline_versions_0016_backup;
-- statement
DROP TABLE timeline_versions_0016_backup;
-- statement
DROP TABLE timeline_objects_0016_backup;
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
CREATE TRIGGER timeline_version_no_resurrection BEFORE INSERT ON timeline_object_versions BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM timeline_object_versions v WHERE v.workspace_id=NEW.workspace_id AND v.artifact_id=NEW.artifact_id
      AND v.object_id=NEW.object_id AND v.tombstone=1
  ) THEN RAISE(ABORT,'timeline_object_deleted') END);
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
CREATE TRIGGER timeline_version_kind BEFORE INSERT ON timeline_object_versions BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM timeline_objects o WHERE o.workspace_id=NEW.workspace_id AND o.artifact_id=NEW.artifact_id
      AND o.id=NEW.object_id AND (o.kind=NEW.schema_version OR (o.kind IN ('timeline-workspace.v1','timeline-workspace.v2','timeline-workspace.v3') AND NEW.schema_version IN ('timeline-workspace.v1','timeline-workspace.v2','timeline-workspace.v3')))
  ) THEN RAISE(ABORT,'timeline_kind_mismatch') END);
END;
