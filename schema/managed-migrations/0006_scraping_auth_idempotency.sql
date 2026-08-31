-- Scope paid scrape runs to trusted identities and make evidence imports idempotent.
--
-- Rollback (only after reverting all route code that reads these tables):
--   DROP TABLE IF EXISTS cop_scrape_imports;
--   DROP TABLE IF EXISTS cop_scrape_requests;
--   DROP TABLE IF EXISTS cop_scrape_runs;

CREATE TABLE IF NOT EXISTS cop_scrape_runs (
  run_id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  scraper_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  dataset_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (requested_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_scrape_runs_owner
  ON cop_scrape_runs(cop_session_id, requested_by, created_at DESC);

-- A reservation is committed before the paid provider call. Identical retries
-- observe the existing state instead of starting another chargeable run.
CREATE TABLE IF NOT EXISTS cop_scrape_requests (
  request_id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  request_fingerprint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('initiating', 'started', 'failed')),
  run_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cop_session_id, workspace_id, requested_by, request_fingerprint, idempotency_key),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (run_id) REFERENCES cop_scrape_runs(run_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cop_scrape_requests_owner
  ON cop_scrape_requests(cop_session_id, requested_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS cop_scrape_imports (
  id TEXT PRIMARY KEY,
  cop_session_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  item_key TEXT NOT NULL,
  provider_item_id TEXT,
  canonical_url TEXT,
  run_id TEXT NOT NULL,
  evidence_item_id INTEGER,
  imported_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (cop_session_id, workspace_id, provider, item_key),
  FOREIGN KEY (cop_session_id) REFERENCES cop_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (run_id) REFERENCES cop_scrape_runs(run_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_item_id) REFERENCES evidence_items(id) ON DELETE SET NULL,
  FOREIGN KEY (imported_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cop_scrape_imports_evidence
  ON cop_scrape_imports(evidence_item_id);
