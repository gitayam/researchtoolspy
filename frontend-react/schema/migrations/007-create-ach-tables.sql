-- ACH (Analysis of Competing Hypotheses) Tables
-- Migration 007: Create ACH analysis system

-- ACH Analyses
CREATE TABLE IF NOT EXISTS ach_analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  question TEXT NOT NULL,
  analyst TEXT,
  organization TEXT,
  scale_type TEXT DEFAULT 'logarithmic' CHECK(scale_type IN ('logarithmic', 'linear')),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ach_analyses_user_id ON ach_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_status ON ach_analyses(status);
CREATE INDEX IF NOT EXISTS idx_ach_analyses_created_at ON ach_analyses(created_at DESC);

-- Hypotheses
CREATE TABLE IF NOT EXISTS ach_hypotheses (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  text TEXT NOT NULL,
  order_num INTEGER NOT NULL,
  rationale TEXT,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ach_hypotheses_analysis_id ON ach_hypotheses(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_hypotheses_order ON ach_hypotheses(ach_analysis_id, order_num);

-- Evidence Links (reuse Evidence Library)
CREATE TABLE IF NOT EXISTS ach_evidence_links (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  added_by TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  UNIQUE(ach_analysis_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_ach_evidence_links_analysis_id ON ach_evidence_links(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_evidence_links_evidence_id ON ach_evidence_links(evidence_id);

-- Scores
CREATE TABLE IF NOT EXISTS ach_scores (
  id TEXT PRIMARY KEY,
  ach_analysis_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  credibility INTEGER CHECK(credibility BETWEEN 1 AND 5),
  relevance INTEGER CHECK(relevance BETWEEN 1 AND 5),
  notes TEXT,
  scored_by TEXT,
  scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ach_analysis_id) REFERENCES ach_analyses(id) ON DELETE CASCADE,
  FOREIGN KEY (hypothesis_id) REFERENCES ach_hypotheses(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  UNIQUE(hypothesis_id, evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_ach_scores_analysis_id ON ach_scores(ach_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ach_scores_hypothesis_id ON ach_scores(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_ach_scores_evidence_id ON ach_scores(evidence_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_ach_analyses_timestamp
AFTER UPDATE ON ach_analyses
FOR EACH ROW
BEGIN
  UPDATE ach_analyses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
