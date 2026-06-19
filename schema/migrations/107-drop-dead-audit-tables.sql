-- Drop dead "audit" tables that implied coverage that did not exist (both 0 rows in prod).
-- The single canonical audit/observability trail is event_logs (migration 105), written via
-- logEvent(). auth_logs had no reader/writer in code; settings_audit_log had only a best-effort
-- write in settings/hash/backup.ts, now rerouted to event_logs (level 'audit').
DROP TABLE IF EXISTS auth_logs;
DROP TABLE IF EXISTS settings_audit_log;
