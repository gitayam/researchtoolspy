-- Migration 064: Add COP hypotheses tables for ACH (Analysis of Competing Hypotheses)

CREATE TABLE IF NOT EXISTS cop_hypotheses (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  confidence INTEGER DEFAULT 50,
  created_by INTEGER NOT NULL,
  workspace_id TEXT NOT NULL DEFAULT '1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_hypotheses_session ON cop_hypotheses(cop_session_id);

CREATE TABLE IF NOT EXISTS cop_hypothesis_evidence (
  id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL,
  evidence_id TEXT,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'supporting',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hypothesis_id) REFERENCES cop_hypotheses(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_hyp_ev_hypothesis ON cop_hypothesis_evidence(hypothesis_id);
