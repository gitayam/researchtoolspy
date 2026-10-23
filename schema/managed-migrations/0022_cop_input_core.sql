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

CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_canonical
  ON evidence_items(workspace_id, canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cop_rfis_session_key ON cop_rfis(cop_session_id, is_key);

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
