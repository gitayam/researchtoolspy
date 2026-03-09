-- Migration 061: Add is_blocker flag to cop_rfis
-- Blockers are an urgency dimension orthogonal to the open/answered/accepted/closed lifecycle.
-- An RFI can be open+blocker or answered+blocker (still blocking until accepted).

ALTER TABLE cop_rfis ADD COLUMN is_blocker INTEGER DEFAULT 0;
