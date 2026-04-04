-- Migration 102: Add facts and changelog columns to survey_drops
-- facts: JSON array of {text, as_of} objects — structured situation facts
-- changelog: JSON array of {date, entry} objects — git-style change log

ALTER TABLE survey_drops ADD COLUMN facts TEXT DEFAULT '[]';
ALTER TABLE survey_drops ADD COLUMN changelog TEXT DEFAULT '[]';
