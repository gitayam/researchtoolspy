-- Migration 111: D-E8 phase 5 (FINAL) — drop the legacy evidence tables
--
-- `evidence_items` is now the single canonical evidence store (D-E8-0..4). The
-- two parallel tables below are EMPTY in prod (0 rows, verified pre-migration)
-- and NOTHING reads or writes them anymore:
--   * `evidence`           — its writer (ach/from-content-intelligence) was
--                            repointed in D-E8-1, all read-joins in D-E8-2, and
--                            the singular /api/evidence CRUD endpoint was retired
--                            to 410 Gone in D-E8-4. A comprehensive grep of
--                            functions/ + src/ finds zero remaining SQL against it.
--   * `research_evidence`  — its add/list/process handlers were repointed to
--                            evidence_items via the shared mapping module in D-E8-3.
--
-- Link-table FKs (ach_evidence_links, claim_evidence_links, framework_evidence,
-- evidence_citations, event_evidence) already target evidence_items, so dropping
-- these orphan tables removes no live relationships.
--
-- NOTE: this repo re-runs every migration on each deploy and tolerates
-- per-statement errors, so DROP ... IF EXISTS is idempotent on re-run.

DROP TABLE IF EXISTS evidence;
DROP TABLE IF EXISTS research_evidence;
