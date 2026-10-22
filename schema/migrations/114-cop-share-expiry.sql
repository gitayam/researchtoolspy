-- Optional expiry for COP share links.
--
-- POST /api/cop/:id/shares accepts `expires_at` (ISO 8601) and GET
-- /api/cop/public/:token refuses a link whose expiry has passed. Both tolerate
-- this column being absent: until it is applied, a request asking for an expiry
-- gets a 503 and existing links behave as before (no expiry).
--
-- Apply explicitly (not part of a deploy):
--   npx wrangler d1 execute researchtoolspy-prod --remote --file=schema/migrations/114-cop-share-expiry.sql
ALTER TABLE cop_shares ADD COLUMN expires_at TEXT;
