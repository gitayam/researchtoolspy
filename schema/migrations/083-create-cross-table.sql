-- Migration 083: Cross Table — decision matrices with multiple scoring methods,
-- weighting (manual/AHP), sensitivity analysis, and Delphi collaboration.

CREATE TABLE IF NOT EXISTS cross_tables (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'blank',
  config TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scoring', 'complete')),
  is_public INTEGER NOT NULL DEFAULT 0,
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_tables_user ON cross_tables(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_tables_status ON cross_tables(user_id, status);

CREATE TABLE IF NOT EXISTS cross_table_scores (
  id TEXT PRIMARY KEY,
  cross_table_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  col_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  score REAL,
  confidence REAL DEFAULT 1.0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(cross_table_id, row_id, col_id, user_id, round),
  FOREIGN KEY (cross_table_id) REFERENCES cross_tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cross_table_scores_table ON cross_table_scores(cross_table_id);
CREATE INDEX IF NOT EXISTS idx_cross_table_scores_user ON cross_table_scores(cross_table_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cross_table_scores_round ON cross_table_scores(cross_table_id, round);

CREATE TABLE IF NOT EXISTS cross_table_scorers (
  id TEXT PRIMARY KEY,
  cross_table_id TEXT NOT NULL,
  user_id INTEGER,
  invite_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'scoring', 'submitted')),
  invited_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE(cross_table_id, user_id),
  FOREIGN KEY (cross_table_id) REFERENCES cross_tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cross_table_scorers_table ON cross_table_scorers(cross_table_id);
CREATE INDEX IF NOT EXISTS idx_cross_table_scorers_token ON cross_table_scorers(invite_token);
