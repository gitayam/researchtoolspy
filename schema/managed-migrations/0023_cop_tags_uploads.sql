-- COP tags, uploads and evidence-form ingest.
--
-- cop_tags: one vocabulary per session. name is what people see; name_key (the
--   lower-cased name) keeps `#Protest` and `protest` one tag.
-- cop_item_tags: tag <-> item links for any COP item type. The routes check IN SQL
--   that target_id belongs to the session (evidence: to its workspace) before
--   linking (functions/api/_shared/cop-tags.ts).
-- cop_uploads: files added to a COP. Bytes live in R2 under cop/<session>/<uuid>,
--   metadata (EXIF/GPS, XMP, IPTC, comments) already stripped; the public
--   /api/uploads route only serves uploads/* keys, so it cannot reach these.
-- survey_drops.auto_ingest: a submission to a form linked to a COP becomes
--   unverified evidence at once (default on); 0 keeps it in the review inbox.
-- survey_responses.auto_ingested / linked_marker_id / ingested_evidence_id: what
--   auto-ingest created (ingested_evidence_id is set only by ingest and never by a
--   relink), so a reviewer's reject takes back exactly that and nothing else.
-- survey_drop_ingest_slots: the per-form, per-UTC-hour auto-ingest count. A slot is
--   taken with one INSERT … ON CONFLICT DO UPDATE … WHERE n < cap RETURNING, so
--   concurrent tips can't pass the cap together.
--
-- The cop_* tables follow their session on delete (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS cop_tags (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    color TEXT,
    category TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_tags_session_key ON cop_tags(cop_session_id, name_key);

CREATE TABLE IF NOT EXISTS cop_item_tags (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES cop_tags(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN (
        'evidence', 'marker', 'rfi', 'task', 'timeline', 'claim', 'hypothesis',
        'persona', 'asset', 'webcam', 'upload', 'submission'
    )),
    target_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai', 'rule', 'drop', 'chat')),
    confidence INTEGER,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cop_item_tags_unique ON cop_item_tags(tag_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_cop_item_tags_target ON cop_item_tags(cop_session_id, target_type, target_id);

CREATE TABLE IF NOT EXISTS cop_uploads (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
    bytes INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    sha256 TEXT,
    original_name TEXT,
    evidence_id TEXT,
    source_channel TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cop_uploads_session ON cop_uploads(cop_session_id);

ALTER TABLE survey_drops ADD COLUMN auto_ingest INTEGER NOT NULL DEFAULT 1;
ALTER TABLE survey_responses ADD COLUMN auto_ingested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE survey_responses ADD COLUMN linked_marker_id TEXT;
ALTER TABLE survey_responses ADD COLUMN ingested_evidence_id TEXT;

CREATE TABLE IF NOT EXISTS survey_drop_ingest_slots (
    survey_id TEXT NOT NULL,
    hour TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (survey_id, hour)
);
