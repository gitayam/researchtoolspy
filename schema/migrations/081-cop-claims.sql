-- Migration 081: COP Claims — persist extracted claims per session
-- Claims are extracted from URLs via AI and stored for future reference.
-- Verified claims can be promoted to evidence_items.

CREATE TABLE IF NOT EXISTS cop_claims (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  url TEXT NOT NULL,
  url_title TEXT,
  url_domain TEXT,
  claim_text TEXT NOT NULL,
  category TEXT,
  confidence INTEGER DEFAULT 50,
  status TEXT DEFAULT 'unverified' CHECK(status IN ('unverified', 'verified', 'disputed', 'false')),
  evidence_item_id INTEGER,
  summary TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cop_claims_session ON cop_claims(cop_session_id);
CREATE INDEX IF NOT EXISTS idx_cop_claims_workspace ON cop_claims(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cop_claims_status ON cop_claims(cop_session_id, status);
