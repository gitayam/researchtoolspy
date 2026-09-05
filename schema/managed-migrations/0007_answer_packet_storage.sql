-- Durable, workspace-owned evidence lineage for source-grounded Answer Packets.
-- Additive and backward-compatible: deployed handlers may ignore every new table/column.
--
-- Rollback (only after reverting all code that reads these objects):
--   DROP INDEX IF EXISTS idx_answer_packets_expiry;
--   DROP INDEX IF EXISTS idx_answer_packets_investigation;
--   DROP INDEX IF EXISTS idx_source_claim_links_claim;
--   DROP INDEX IF EXISTS idx_source_claim_links_passage;
--   DROP INDEX IF EXISTS idx_source_passages_artifact;
--   DROP INDEX IF EXISTS idx_source_artifacts_expiry;
--   DROP INDEX IF EXISTS idx_source_artifacts_investigation;
--   DROP TABLE IF EXISTS answer_packet_claims;
--   DROP TABLE IF EXISTS answer_packets;
--   DROP TABLE IF EXISTS source_claim_links;
--   DROP TABLE IF EXISTS source_passages;
--   DROP TABLE IF EXISTS source_artifacts;
-- SQLite cannot safely drop the three additive link columns without rebuilding
-- their legacy tables; leave nullable columns in place during an application rollback.

CREATE TABLE IF NOT EXISTS source_artifacts (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = 'source-artifact.v1'),
  workspace_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('web','pdf','social','archive','upload','supplied')),
  source_identity TEXT NOT NULL,
  canonical_url TEXT,
  final_url TEXT,
  object_key TEXT,
  title TEXT NOT NULL,
  author TEXT,
  published_at TEXT,
  observed_at TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  content_type TEXT NOT NULL,
  language TEXT,
  provenance_json TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (workspace_id, investigation_id, source_identity, content_hash),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_source_artifacts_investigation
  ON source_artifacts(workspace_id, investigation_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_artifacts_expiry
  ON source_artifacts(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS source_passages (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = 'source-passage.v1'),
  artifact_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
  end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
  text TEXT NOT NULL,
  text_hash TEXT NOT NULL CHECK (length(text_hash) = 64),
  heading TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (artifact_id, start_offset, end_offset),
  FOREIGN KEY (artifact_id) REFERENCES source_artifacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_passages_artifact
  ON source_passages(artifact_id, start_offset, end_offset);

CREATE TABLE IF NOT EXISTS source_claim_links (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = 'claim-evidence.v1'),
  workspace_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  passage_id TEXT NOT NULL,
  stance TEXT NOT NULL CHECK (stance IN ('supports','contradicts','contextualizes')),
  relevance REAL NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  rationale TEXT,
  linked_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (claim_id, passage_id, stance),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (passage_id) REFERENCES source_passages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_claim_links_passage ON source_claim_links(passage_id);
CREATE INDEX IF NOT EXISTS idx_source_claim_links_claim ON source_claim_links(claim_id, stance);

CREATE TABLE IF NOT EXISTS answer_packets (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = 'answer-packet.v1'),
  workspace_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  primary_artifact_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  limitations_json TEXT NOT NULL DEFAULT '[]',
  collection_gaps_json TEXT NOT NULL DEFAULT '[]',
  generated_at TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_artifact_id) REFERENCES source_artifacts(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_answer_packets_investigation
  ON answer_packets(workspace_id, investigation_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_answer_packets_expiry
  ON answer_packets(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS answer_packet_claims (
  id TEXT PRIMARY KEY,
  packet_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('supported','disputed','insufficient')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_link_ids_json TEXT NOT NULL DEFAULT '[]',
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  UNIQUE (packet_id, ordinal),
  FOREIGN KEY (packet_id) REFERENCES answer_packets(id) ON DELETE CASCADE
);

ALTER TABLE content_analysis ADD COLUMN source_artifact_id TEXT REFERENCES source_artifacts(id) ON DELETE SET NULL;
ALTER TABLE evidence_items ADD COLUMN source_artifact_id TEXT REFERENCES source_artifacts(id) ON DELETE SET NULL;
ALTER TABLE claim_evidence_links ADD COLUMN source_passage_id TEXT REFERENCES source_passages(id) ON DELETE SET NULL;
