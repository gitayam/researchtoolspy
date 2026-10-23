-- Team votes on filed evidence, and the question a tipster chose, checked at submission.
--
-- cop_evidence_link_votes: one 👍 (1) or 👎 (-1) per collaborator per filing — a vote
--   says "this evidence helps (or doesn't help) answer this question", so it is on the
--   cop_evidence_links row, not on the evidence item. Only the COP's owner and
--   collaborators vote (PUT /api/cop/:id/evidence-links/:linkId/vote); share viewers
--   see the counts. The route checks the link belongs to the session IN SQL. Votes go
--   with their filing (unfiling, deleting the evidence or the question) and session.
-- survey_responses.question_rfi_id / question_relation: the question a drop-form
--   submission was filed under, written only by drop-submit after checking it against
--   the questions that form offered in its context (the standalone link, a share link,
--   or a collaborator's workspace); ingest files the tip under it. Rows from before
--   this migration keep using the `_question` answer, checked again at ingest.

CREATE TABLE IF NOT EXISTS cop_evidence_link_votes (
    id TEXT PRIMARY KEY,
    cop_session_id TEXT NOT NULL REFERENCES cop_sessions(id) ON DELETE CASCADE,
    link_id TEXT NOT NULL REFERENCES cop_evidence_links(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    value INTEGER NOT NULL CHECK (value IN (-1, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cop_evidence_link_votes_session ON cop_evidence_link_votes(cop_session_id, link_id);

ALTER TABLE survey_responses ADD COLUMN question_rfi_id TEXT;
ALTER TABLE survey_responses ADD COLUMN question_relation TEXT;
