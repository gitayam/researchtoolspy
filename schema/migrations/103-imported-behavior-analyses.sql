-- 103-imported-behavior-analyses.sql
--
-- Public intake table for behavior analyses produced by external consumers
-- (signal-bot, bcw-mcp, future MCP integrations). Lets a Signal user produce
-- an analysis via !bcw and get back a shareable URL — closes C-6 of the
-- 2026-04-27 cross-repo team-review.
--
-- Auth model: bot-API-key intake (Authorization: Bearer <BOT_INTAKE_API_KEY>).
-- Storage: TTL'd via expires_at; nightly cron sweep removes expired rows
-- (cron job is separate from this migration).
-- Read access: public via /api/frameworks/behavior/shared/<id> — no auth,
-- but only the UUID can fetch (no enumeration). view_count tracks reads
-- for telemetry/abuse signal.
--
-- Design spec: irregularchat-monorepo:docs/superpowers/specs/2026-04-27-bcw-operational-frame-design.md
-- (Section D — researchtoolspy footprint; the round-trip path was deferred
-- in the original ship and lands here.)

CREATE TABLE IF NOT EXISTS imported_behavior_analyses (
  id              TEXT    PRIMARY KEY,           -- UUID v4
  source          TEXT    NOT NULL,              -- 'signal-bot' | 'bcw-mcp' | 'mcp-other'
  payload_kind    TEXT    NOT NULL,              -- 'l1' | 'frame' | 'l2' | 'pipeline'
  payload         TEXT    NOT NULL,              -- JSON body as-stored
  source_user_hint TEXT,                         -- Optional display label (Signal source name) — NOT auth
  created_at      INTEGER NOT NULL,              -- Unix epoch seconds
  expires_at      INTEGER NOT NULL,              -- Unix epoch seconds
  view_count      INTEGER NOT NULL DEFAULT 0,
  last_viewed_at  INTEGER
);

-- Index for the nightly TTL sweep
CREATE INDEX IF NOT EXISTS idx_imported_behavior_expires
  ON imported_behavior_analyses(expires_at);

-- Index for source-level telemetry queries (e.g. "how many signal-bot
-- imports per day")
CREATE INDEX IF NOT EXISTS idx_imported_behavior_source_created
  ON imported_behavior_analyses(source, created_at);
