-- Migration 110: D-E8 phase 0 — add canonical-evidence columns to evidence_items
--
-- D-E8 makes `evidence_items` the single canonical evidence table, collapsing the
-- (empty: 0 rows) `evidence` and `research_evidence` tables onto it. Those tables'
-- writers carry a few fields with no existing home in `evidence_items`:
--   * a JSON grab-bag (research_evidence.chain_of_custody/entities/category, the
--     `evidence` source/frameworks/sats blobs, etc.)  -> `metadata`
--   * the Research Workspace per-question linkage                -> `research_question_id`
--   * the investigation-packet linkage                          -> `investigation_packet_id`
-- These are ADDITIVE, nullable columns (the 99 existing rows get NULL). They let the
-- D-E8-3 repoint preserve the research-question linkage rather than degrade it.
--
-- NOTE: SQLite has no `ADD COLUMN IF NOT EXISTS`. This repo re-runs every migration
-- on each deploy and tolerates per-statement errors, so a duplicate-column error on
-- re-run is expected and harmless (the first apply is what counts).

ALTER TABLE evidence_items ADD COLUMN metadata TEXT;
ALTER TABLE evidence_items ADD COLUMN research_question_id TEXT;
ALTER TABLE evidence_items ADD COLUMN investigation_packet_id TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_items_research_question
  ON evidence_items(research_question_id) WHERE research_question_id IS NOT NULL;
