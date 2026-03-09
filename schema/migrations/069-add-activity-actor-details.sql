-- Migration 069: Add actor_name and details to cop_activity
-- Enables collaborator attribution in the activity timeline

ALTER TABLE cop_activity ADD COLUMN actor_name TEXT;
ALTER TABLE cop_activity ADD COLUMN details TEXT;
