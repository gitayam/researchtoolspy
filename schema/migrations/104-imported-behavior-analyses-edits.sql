-- 104-imported-behavior-analyses-edits.sql
--
-- Adds edit-tracking columns to imported_behavior_analyses to support the
-- conversational-edit feature: user replies to a bot analysis message with
-- a natural-language edit instruction; bot applies via AI and PUTs the
-- updated payload back. This migration adds the auditable trail so we can
-- cap edits per analysis and surface edit history if needed.
--
-- Companion to:
-- - PUT /api/frameworks/behavior/shared/<id> (update handler)
-- - signal-bot's `!bcw edit <instruction>` command form

ALTER TABLE imported_behavior_analyses ADD COLUMN edit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE imported_behavior_analyses ADD COLUMN last_edited_at INTEGER;
