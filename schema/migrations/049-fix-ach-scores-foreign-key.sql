-- Fix ach_scores to reference evidence_items instead of evidence table
-- SQLite doesn't support ALTER TABLE to modify foreign keys, so we need to recreate the table

-- Step 1: Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS ach_scores_new (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  credibility INTEGER,
  relevance INTEGER,
  notes TEXT,
  scored_by TEXT,
  scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (hypothesis_id) REFERENCES ach_hypotheses(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  UNIQUE(hypothesis_id, evidence_id)
);

-- Step 2: Copy existing data (if any)
INSERT INTO ach_scores_new (id, ach_analysis_id, hypothesis_id, evidence_id, score, credibility, relevance, notes, scored_by, scored_at)
SELECT id, ach_analysis_id, hypothesis_id, evidence_id, score, credibility, relevance, notes, scored_by, scored_at
FROM ach_scores;

-- Step 3: Drop old table
DROP TABLE ach_scores;

-- Step 4: Rename new table to original name
ALTER TABLE ach_scores_new RENAME TO ach_scores;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ach_scores_analysis_id ON ach_scores(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_scores_hypothesis_id ON ach_scores(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_ach_scores_evidence_id ON ach_scores(evidence_id);
