-- Migration 068: Add requester_name to RFIs and created_by_name to evidence
-- Enables collaborator attribution in the COP workspace

ALTER TABLE cop_rfis ADD COLUMN requester_name TEXT;
