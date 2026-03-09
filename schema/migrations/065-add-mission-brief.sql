-- Migration: Add mission_brief column to cop_sessions
-- Date: 2026-03-09
-- Description: Persist mission_brief field sent from frontend via PUT /api/cop/sessions/:id

ALTER TABLE cop_sessions ADD COLUMN mission_brief TEXT;
