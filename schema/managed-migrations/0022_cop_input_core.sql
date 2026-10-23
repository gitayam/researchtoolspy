-- COP input core: provenance, canonical links, key questions as starred RFIs, and
-- evidence submission through a share link.
--
-- - source_channel / source_ref: where an item came from ('web', 'signal', 'drop',
--   'scrape', 'api'), set by the server from the caller (functions/api/_shared/cop-input.ts).
-- - evidence_items.canonical_url: the link without fragment, tracking parameters or a
--   trailing slash; the COP evidence POST answers a duplicate with the existing item.
-- - cop_rfis.is_key: a starred RFI is a key question. The session's key_questions list
--   stays, rewritten from the starred RFIs, so older readers see the same list.
-- - cop_shares.allow_evidence: the share link offers the session's evidence form.
-- - evidence_items.cop_session_id: the COP session an evidence item belongs to.
--   evidence_items is workspace-wide, and a COP often shares its owner's main
--   workspace, so "the COP's evidence" is decided by this column: set on every COP
--   evidence insert, and backfilled below from the session's own records. A row
--   without it counts as the session's only when the session has a workspace of its
--   own (workspace_id = session id).
--
-- The change feed (GET /api/cop/:id/changes) pages cop_events by rowid; the existing
-- idx_cop_events_session(cop_session_id) already orders a session's rows by rowid, so
-- no new events index is needed.
--
-- The routes tolerate this migration being pending: they skip the new columns and
-- write as before. The ALTERs run once (managed migrations); the backfills below are
-- written so running them again changes nothing.

ALTER TABLE evidence_items ADD COLUMN source_channel TEXT;
ALTER TABLE evidence_items ADD COLUMN source_ref TEXT;
ALTER TABLE evidence_items ADD COLUMN canonical_url TEXT;
ALTER TABLE cop_markers ADD COLUMN source_channel TEXT;
ALTER TABLE cop_markers ADD COLUMN source_ref TEXT;
ALTER TABLE cop_rfis ADD COLUMN source_channel TEXT;
ALTER TABLE cop_rfis ADD COLUMN source_ref TEXT;
ALTER TABLE cop_rfis ADD COLUMN is_key INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cop_tasks ADD COLUMN source_channel TEXT;
ALTER TABLE cop_tasks ADD COLUMN source_ref TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN source_channel TEXT;
ALTER TABLE cop_timeline_entries ADD COLUMN source_ref TEXT;
ALTER TABLE cop_claims ADD COLUMN source_channel TEXT;
ALTER TABLE cop_claims ADD COLUMN source_ref TEXT;
ALTER TABLE cop_hypotheses ADD COLUMN source_channel TEXT;
ALTER TABLE cop_hypotheses ADD COLUMN source_ref TEXT;
ALTER TABLE cop_shares ADD COLUMN allow_evidence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE evidence_items ADD COLUMN cop_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_canonical
  ON evidence_items(workspace_id, canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cop_rfis_session_key ON cop_rfis(cop_session_id, is_key);
CREATE INDEX IF NOT EXISTS idx_evidence_items_cop_session ON evidence_items(cop_session_id) WHERE cop_session_id IS NOT NULL;

-- Evidence a COP created before this column: its session is known from records the
-- server wrote when the COP created the item, and only when that session's workspace is
-- the item's workspace:
--   - the creation event (evidence.created / evidence.imported, whose entity_id is the
--     new row's id). Never other evidence events: evidence.tagged carried an id the
--     client chose, so tagging a library item doesn't make it the COP's.
--   - the system timeline line written when the COP created the item (source_type
--     'system', action 'created'); never a line a client wrote.
--   - metadata the claim-promote (origin 'verified_claim') and scrape (scrape_provider)
--     routes wrote.
UPDATE evidence_items
SET cop_session_id = (
  SELECT s.id FROM cop_events e JOIN cop_sessions s ON s.id = e.cop_session_id
  WHERE e.entity_type = 'evidence' AND e.event_type IN ('evidence.created', 'evidence.imported')
    AND e.entity_id = CAST(evidence_items.id AS TEXT)
    AND s.workspace_id = evidence_items.workspace_id
  ORDER BY e.rowid ASC LIMIT 1
)
WHERE cop_session_id IS NULL
  AND EXISTS (
    SELECT 1 FROM cop_events e JOIN cop_sessions s ON s.id = e.cop_session_id
    WHERE e.entity_type = 'evidence' AND e.event_type IN ('evidence.created', 'evidence.imported')
      AND e.entity_id = CAST(evidence_items.id AS TEXT)
      AND s.workspace_id = evidence_items.workspace_id
  );

UPDATE evidence_items
SET cop_session_id = (
  SELECT s.id FROM cop_timeline_entries t JOIN cop_sessions s ON s.id = t.cop_session_id
  WHERE t.entity_type = 'evidence' AND t.source_type = 'system' AND t.action = 'created'
    AND t.entity_id = CAST(evidence_items.id AS TEXT)
    AND s.workspace_id = evidence_items.workspace_id
  ORDER BY t.rowid ASC LIMIT 1
)
WHERE cop_session_id IS NULL
  AND EXISTS (
    SELECT 1 FROM cop_timeline_entries t JOIN cop_sessions s ON s.id = t.cop_session_id
    WHERE t.entity_type = 'evidence' AND t.source_type = 'system' AND t.action = 'created'
      AND t.entity_id = CAST(evidence_items.id AS TEXT)
      AND s.workspace_id = evidence_items.workspace_id
  );

UPDATE evidence_items
SET cop_session_id = json_extract(metadata, '$.cop_session_id')
WHERE cop_session_id IS NULL
  AND json_valid(metadata)
  AND json_type(metadata, '$.cop_session_id') = 'text'
  AND (json_extract(metadata, '$.origin') = 'verified_claim' OR json_type(metadata, '$.scrape_provider') = 'text')
  AND EXISTS (
    SELECT 1 FROM cop_sessions s
    WHERE s.id = json_extract(evidence_items.metadata, '$.cop_session_id')
      AND s.workspace_id = evidence_items.workspace_id
  );

-- Key questions → starred RFIs. Questions compare lowercased, with line breaks and tabs
-- as spaces, doubled spaces collapsed and trailing "?" or spaces dropped (the same rule
-- as normalizeQuestion in functions/api/_shared/cop-input.ts, for ordinary input).

-- 1. An RFI that already asks a key question is starred.
UPDATE cop_rfis
SET is_key = 1
WHERE is_key = 0
  AND EXISTS (
    SELECT 1
    FROM cop_sessions s, json_each(CASE WHEN json_valid(s.key_questions) THEN s.key_questions ELSE '[]' END) q
    WHERE s.id = cop_rfis.cop_session_id
      AND q.type = 'text'
      AND rtrim(replace(replace(replace(replace(lower(trim(q.value)), char(13), ' '), char(10), ' '), char(9), ' '), '  ', ' '), '? ')
        = rtrim(replace(replace(replace(replace(lower(trim(cop_rfis.question)), char(13), ' '), char(10), ' '), char(9), ' '), '  ', ' '), '? ')
  );

-- 2. A key question without an RFI becomes an open, high-priority, starred RFI.
INSERT INTO cop_rfis (
  id, cop_session_id, question, priority, status, is_blocker, created_by, requester_name,
  created_at, updated_at, is_key, source_channel
)
SELECT
  'rfi-' || lower(hex(randomblob(6))),
  s.id,
  trim(q.value),
  'high',
  'open',
  0,
  s.created_by,
  'Key question',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  1,
  'web'
FROM cop_sessions s, json_each(CASE WHEN json_valid(s.key_questions) THEN s.key_questions ELSE '[]' END) q
WHERE q.type = 'text'
  AND length(trim(q.value)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM cop_rfis r
    WHERE r.cop_session_id = s.id
      AND rtrim(replace(replace(replace(replace(lower(trim(r.question)), char(13), ' '), char(10), ' '), char(9), ' '), '  ', ' '), '? ')
        = rtrim(replace(replace(replace(replace(lower(trim(q.value)), char(13), ' '), char(10), ' '), char(9), ' '), '  ', ' '), '? ')
  );
