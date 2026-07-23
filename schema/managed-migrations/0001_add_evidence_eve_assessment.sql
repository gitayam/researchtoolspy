-- Persist EVE deception assessments on canonical evidence records.
-- Rollback:
--   DROP INDEX idx_evidence_items_workspace_eve;
--   ALTER TABLE evidence_items DROP COLUMN eve_assessment;

ALTER TABLE evidence_items ADD COLUMN eve_assessment TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_items_workspace_eve
  ON evidence_items(workspace_id)
  WHERE eve_assessment IS NOT NULL;
