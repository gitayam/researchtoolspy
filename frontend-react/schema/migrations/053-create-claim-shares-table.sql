-- Migration 053: Create claim_shares table for public claim sharing
-- This enables users to create public shareable links for specific claims

CREATE TABLE IF NOT EXISTS claim_shares (
  id TEXT PRIMARY KEY,
  claim_adjustment_id TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_adjustment_id) REFERENCES claim_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups by share token
CREATE INDEX IF NOT EXISTS idx_claim_shares_token ON claim_shares(share_token);

-- Index for finding shares by claim
CREATE INDEX IF NOT EXISTS idx_claim_shares_claim ON claim_shares(claim_adjustment_id);

-- Index for finding shares by user
CREATE INDEX IF NOT EXISTS idx_claim_shares_user ON claim_shares(created_by);
