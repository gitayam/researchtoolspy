-- Event log sink for production observability.
-- Pages Functions console.* output is NOT visible in `wrangler pages deployment tail`,
-- so warn/error/refusal events are written here instead (the documented workaround).
-- Low-volume by design (errors + model refusals only, never per-request) and pruned
-- daily by the cron worker (see functions/api/cron/cleanup-content.ts) to bound growth.

CREATE TABLE IF NOT EXISTS event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL,            -- 'error' | 'warn' | 'refusal'
  source TEXT NOT NULL,           -- endpoint or module that emitted the event
  message TEXT NOT NULL,
  context TEXT,                   -- optional JSON blob (truncated)
  user_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_event_logs_created ON event_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_event_logs_level ON event_logs(level);
