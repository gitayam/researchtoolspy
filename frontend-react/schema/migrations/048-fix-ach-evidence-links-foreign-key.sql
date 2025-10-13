-- Fix ach_evidence_links to reference evidence_items instead of evidence table
-- SQLite doesn't support ALTER TABLE to modify foreign keys, so we need to recreate the table

-- Step 1: Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS ach_evidence_links_new (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  added_by TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  UNIQUE(ach_analysis_id, evidence_id)
);

-- Step 2: Copy existing data (if any)
INSERT INTO ach_evidence_links_new (id, ach_analysis_id, evidence_id, added_by, added_at)
SELECT id, ach_analysis_id, evidence_id, added_by, added_at
FROM ach_evidence_links;

-- Step 3: Drop old table
DROP TABLE ach_evidence_links;

-- Step 4: Rename new table to original name
ALTER TABLE ach_evidence_links_new RENAME TO ach_evidence_links;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ach_evidence_links_analysis_id ON ach_evidence_links(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_evidence_links_evidence_id ON ach_evidence_links(evidence_id);
