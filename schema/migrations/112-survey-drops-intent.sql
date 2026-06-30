-- Migration 112: Survey Drops — add intent column to distinguish surveys from anonymous tip-lines
-- E-11: journalist drop-spot mode

ALTER TABLE survey_drops ADD COLUMN intent TEXT NOT NULL DEFAULT 'survey' CHECK(intent IN ('survey', 'drop'));

CREATE INDEX IF NOT EXISTS idx_survey_drops_intent ON survey_drops(intent);
