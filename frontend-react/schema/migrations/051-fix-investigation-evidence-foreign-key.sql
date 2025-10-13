-- Fix investigation_evidence to reference evidence_items instead of evidence table
-- SQLite doesn't support ALTER TABLE to modify foreign keys, so we need to recreate the table

-- Step 1: Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS investigation_evidence_new (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  evidence_id INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  added_by INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

-- Step 2: Copy existing data (if any)
INSERT INTO investigation_evidence_new (id, investigation_id, evidence_id, added_at, added_by, notes)
SELECT id, investigation_id, evidence_id, added_at, added_by, notes
FROM investigation_evidence;

-- Step 3: Drop old table
DROP TABLE investigation_evidence;

-- Step 4: Rename new table to original name
ALTER TABLE investigation_evidence_new RENAME TO investigation_evidence;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_investigation_evidence_investigation ON investigation_evidence(investigation_id);
CREATE INDEX IF NOT EXISTS idx_investigation_evidence_evidence ON investigation_evidence(evidence_id);
