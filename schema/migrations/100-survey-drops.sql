-- Migration 100: Survey Drops — extend intake forms with access control, geo-gating, branding
-- Extends tables from migration 071

-- Extend intake forms
ALTER TABLE cop_intake_forms ADD COLUMN access_level TEXT DEFAULT 'public';
ALTER TABLE cop_intake_forms ADD COLUMN password_hash TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN allowed_countries TEXT DEFAULT '[]';
ALTER TABLE cop_intake_forms ADD COLUMN rate_limit_per_hour INTEGER DEFAULT 0;
ALTER TABLE cop_intake_forms ADD COLUMN custom_slug TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN expires_at TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN theme_color TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN logo_url TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN success_message TEXT;
ALTER TABLE cop_intake_forms ADD COLUMN redirect_url TEXT;

-- Extend submissions with geo enrichment + dedup
ALTER TABLE cop_submissions ADD COLUMN submitter_country TEXT;
ALTER TABLE cop_submissions ADD COLUMN submitter_city TEXT;
ALTER TABLE cop_submissions ADD COLUMN submitter_ip_hash TEXT;
ALTER TABLE cop_submissions ADD COLUMN content_hash TEXT;
ALTER TABLE cop_submissions ADD COLUMN updated_at TEXT;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_forms_slug
  ON cop_intake_forms(custom_slug) WHERE custom_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_rate_limit
  ON cop_submissions(intake_form_id, submitter_ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_content_hash
  ON cop_submissions(intake_form_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_submissions_country ON cop_submissions(submitter_country);
