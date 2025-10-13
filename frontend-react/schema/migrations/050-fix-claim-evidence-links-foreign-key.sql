-- Fix claim_evidence_links to reference evidence_items instead of evidence table
-- SQLite doesn't support ALTER TABLE to modify foreign keys, so we need to recreate the table

-- Step 1: Create new table with correct foreign key
CREATE TABLE IF NOT EXISTS claim_evidence_links_new (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,

  -- Relationship details
  relationship TEXT NOT NULL,
  relevance_score INTEGER DEFAULT 50,
  confidence INTEGER DEFAULT 50,
  notes TEXT,

  -- Metadata
  linked_by TEXT NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE
);

-- Step 2: Copy existing data (if any)
INSERT INTO claim_evidence_links_new (id, claim_adjustment_id, evidence_id, relationship, relevance_score, confidence, notes, linked_by, created_at)
SELECT id, claim_adjustment_id, evidence_id, relationship, relevance_score, confidence, notes, linked_by, created_at
FROM claim_evidence_links;

-- Step 3: Drop old table
DROP TABLE claim_evidence_links;

-- Step 4: Rename new table to original name
ALTER TABLE claim_evidence_links_new RENAME TO claim_evidence_links;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_claim ON claim_evidence_links(claim_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_links_evidence ON claim_evidence_links(evidence_id);
