-- Migration 086: Make cop_claims.url nullable for manual text claims
-- The original schema had url TEXT NOT NULL, but manual claims have no URL.

CREATE TABLE cop_claims_new (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT,
  url TEXT,
  url_title TEXT,
  url_domain TEXT,
  claim_text TEXT NOT NULL,
  category TEXT,
  confidence INTEGER DEFAULT 50,
  summary TEXT,
  status TEXT DEFAULT 'unverified',
  evidence_item_id INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO cop_claims_new SELECT * FROM cop_claims;
DROP TABLE cop_claims;
ALTER TABLE cop_claims_new RENAME TO cop_claims;

CREATE INDEX IF NOT EXISTS idx_cop_claims_session ON cop_claims(cop_session_id);
