-- Evidence filed under questions (RFIs, key questions) and tasks.
--
-- An RFI is a line of inquiry, not a one-shot answer: evidence keeps arriving and
-- analysts file it under the questions it bears on, as support, contradiction or
-- context, without answering or closing the question. Hypotheses keep their own
-- cop_hypothesis_evidence links and claims their claim_evidence_links.
--
-- cop_evidence_links: one row per (evidence, question/task). evidence_id is the
--   evidence_items id as text (as cop_item_tags.target_id). The routes check IN SQL
--   that both ends belong to the session (evidence: evidence_items.cop_session_id,
--   see functions/api/_shared/cop-input.ts evidenceInSession) before linking
--   (functions/api/_shared/cop-evidence-links.ts). Rows follow their session on
--   delete; the evidence, RFI and task delete routes remove their links.
-- survey_drops.question_picker: when the form is linked to a COP, its public form
--   offers "Which question is this about?" listing that COP's key questions (starred
--   RFIs); auto-ingest files the tip under the chosen one. Off by default.

CREATE TABLE IF NOT EXISTS cop_evidence_links (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    evidence_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('rfi', 'task')),
    target_id TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT 'supports' CHECK (relation IN ('supports', 'contradicts', 'context')),
    note TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (evidence_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_cop_evidence_links_target ON cop_evidence_links(cop_session_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_cop_evidence_links_evidence ON cop_evidence_links(cop_session_id, evidence_id);

ALTER TABLE survey_drops ADD COLUMN question_picker INTEGER NOT NULL DEFAULT 0;
