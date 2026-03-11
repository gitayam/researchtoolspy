-- Migration 074: Add skills and availability to collaborators for auto-assignment

ALTER TABLE cop_collaborators ADD COLUMN skills TEXT DEFAULT '[]';
ALTER TABLE cop_collaborators ADD COLUMN max_concurrent INTEGER DEFAULT 5;
ALTER TABLE cop_collaborators ADD COLUMN timezone TEXT;
ALTER TABLE cop_collaborators ADD COLUMN availability TEXT DEFAULT 'available';
