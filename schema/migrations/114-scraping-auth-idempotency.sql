-- Migration 114: Scope analysis caches and make COP scrape ingestion auditable/idempotent.

-- The legacy content_deduplication table is keyed only by content_hash. Keep it
-- for compatibility, but use this owner/workspace-scoped cache for new reads.
CREATE TABLE IF NOT EXISTS content_analysis_cache (
  content_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  workspace_key TEXT NOT NULL DEFAULT '',
  canonical_content_id INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 1,
  total_access_count INTEGER NOT NULL DEFAULT 1,
  first_analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (content_hash, user_id, workspace_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (canonical_content_id) REFERENCES content_analysis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_cache_canonical
  ON content_analysis_cache(canonical_content_id);

INSERT OR IGNORE INTO content_analysis_cache (
  content_hash, user_id, workspace_key, canonical_content_id,
  duplicate_count, total_access_count, first_analyzed_at, last_accessed_at
)
SELECT
  content_hash,
  user_id,
  COALESCE(workspace_id, ''),
  id,
  1,
  COALESCE(access_count, 1),
  COALESCE(created_at, datetime('now')),
  COALESCE(last_accessed_at, created_at, datetime('now'))
FROM content_analysis
WHERE content_hash IS NOT NULL AND user_id IS NOT NULL
ORDER BY id ASC;

-- Persist the trusted identity and COP scope for each upstream run. GET polling
-- must resolve a row by run_id + session + authenticated requester before using
-- the caller-supplied run_id against Apify.
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

-- The route writes the stable import key into evidence_items.metadata. This
-- unique partial index makes repeated polls and repeat runs idempotent even when
-- requests race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_items_scrape_import_key
  ON evidence_items(json_extract(metadata, '$.scrape_import_key'))
  WHERE json_extract(metadata, '$.scrape_import_key') IS NOT NULL;
