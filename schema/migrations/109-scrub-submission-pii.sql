-- Migration 109: Scrub submitter PII from research form submissions (E-1)
--
-- Privacy directive: a normal form creator must NEVER be able to capture or see
-- a submitter's IP address or user-agent. The public submit handler
-- (functions/api/research/submit/[hashId].ts) no longer captures these values,
-- but historical rows may still hold them. Null them out.
--
-- The columns are intentionally KEPT (not dropped) for schema compatibility;
-- new inserts always store NULL.

UPDATE form_submissions
SET submitter_ip = NULL,
    user_agent = NULL;
