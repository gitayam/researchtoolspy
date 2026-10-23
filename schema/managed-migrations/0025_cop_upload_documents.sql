-- 0025_cop_upload_documents.sql
-- COP uploads may also hold documents and audio (chat-to-COP roadmap 1.4).
--
-- 0023 limited cop_uploads.content_type to images and PDF with a CHECK constraint,
-- which SQLite cannot alter, so the table is rebuilt with the wider list. The list
-- matches what functions/api/_shared/document-sniff.ts accepts (typed from the bytes);
-- these files are stored as uploaded and served only as downloads. Rows are copied
-- unchanged; nothing references cop_uploads by foreign key.
--
-- Until this runs, a document or audio upload answers 415 UNSUPPORTED_FILE ("not
-- available on this server yet") and images/PDFs work as before.

PRAGMA defer_foreign_keys=ON;

CREATE TABLE cop_uploads_0025 (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'text/plain', 'text/csv', 'text/markdown',
        'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/wav', 'audio/mp4'
    )),
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

INSERT INTO cop_uploads_0025 (id, cop_session_id, r2_key, content_type, bytes, width, height, sha256, original_name,
    evidence_id, source_channel, created_by, created_at, archived_at)
SELECT id, cop_session_id, r2_key, content_type, bytes, width, height, sha256, original_name,
    evidence_id, source_channel, created_by, created_at, archived_at
FROM cop_uploads;

DROP TABLE cop_uploads;
ALTER TABLE cop_uploads_0025 RENAME TO cop_uploads;
CREATE INDEX IF NOT EXISTS idx_cop_uploads_session ON cop_uploads(cop_session_id);
