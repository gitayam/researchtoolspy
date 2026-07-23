-- Preserve automatic/manual actor-link provenance and evidence citation metadata.
-- citation_format remains the canonical citation style column.
-- Rollback:
--   ALTER TABLE evidence_citations DROP COLUMN created_by;
--   ALTER TABLE evidence_citations DROP COLUMN notes;
--   ALTER TABLE evidence_citations DROP COLUMN relevance_score;
--   ALTER TABLE evidence_citations DROP COLUMN citation_type;
--   ALTER TABLE evidence_actors DROP COLUMN auto_linked;

ALTER TABLE evidence_actors
  ADD COLUMN auto_linked INTEGER NOT NULL DEFAULT 0
  CHECK (auto_linked IN (0, 1));

ALTER TABLE evidence_citations
  ADD COLUMN citation_type TEXT NOT NULL DEFAULT 'primary';

ALTER TABLE evidence_citations
  ADD COLUMN relevance_score INTEGER NOT NULL DEFAULT 5
  CHECK (relevance_score BETWEEN 1 AND 10);

ALTER TABLE evidence_citations
  ADD COLUMN notes TEXT;

ALTER TABLE evidence_citations
  ADD COLUMN created_by INTEGER;
