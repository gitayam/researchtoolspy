-- Migration 113: Drop confirmed-dead tables (TD-06 schema sprawl cleanup)
-- Each table verified: row count = 0 AND no references in functions/ or src/ TypeScript files
-- Only schema/migrations SQL references exist (CREATE TABLE definitions)
-- Applied 2026-06-30

-- ach_collaborators: 0 rows, only referenced in migrations 013/052 (CREATE TABLE)
DROP TABLE IF EXISTS ach_collaborators;

-- api_keys: 0 rows, only referenced in d1-schema.sql (CREATE TABLE), no TS code uses it
DROP TABLE IF EXISTS api_keys;

-- cop_submissions: 0 rows, only referenced in migrations 071/100/101 (CREATE TABLE)
-- Note: distinct from cop_sessions and cop_rfis which are live
DROP TABLE IF EXISTS cop_submissions;

-- entity_ratings: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Superseded by library_ratings (separate table, also empty but TS-referenced)
DROP TABLE IF EXISTS entity_ratings;

-- entity_votes: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Superseded by library_votes (separate table, also empty but TS-referenced)
DROP TABLE IF EXISTS entity_votes;

-- evidence_social_media: 0 rows, only referenced in migration 006 (CREATE TABLE)
-- Social media evidence is stored in evidence_items instead
DROP TABLE IF EXISTS evidence_social_media;

-- framework_analytics: 0 rows, only referenced in migration 023 (CREATE TABLE)
-- Analytics were never implemented; framework_views also dead (but TS-referenced)
DROP TABLE IF EXISTS framework_analytics;

-- framework_content_sources: 0 rows, only referenced in migrations 026/026-d1-compatible (CREATE TABLE)
-- Content entity linking was redesigned; content_chunks/content_entities are the live path (TS-referenced, empty)
DROP TABLE IF EXISTS framework_content_sources;

-- framework_exports: 0 rows, only referenced in d1-schema.sql (CREATE TABLE)
-- Export functionality moved to data_exports (TS-referenced, empty) and cop_exports (TS-referenced, empty)
DROP TABLE IF EXISTS framework_exports;

-- framework_ratings: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Ratings moved to library_ratings (TS-referenced, empty)
DROP TABLE IF EXISTS framework_ratings;

-- framework_templates: 0 rows, only referenced in d1-schema.sql (CREATE TABLE)
-- Template concept was not implemented in any endpoint
DROP TABLE IF EXISTS framework_templates;

-- framework_views: 0 rows, only referenced in migration 023 (CREATE TABLE)
-- View tracking was never wired up; library_views is the current table (TS-referenced, empty)
DROP TABLE IF EXISTS framework_views;

-- framework_votes: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Votes moved to library_votes (TS-referenced, empty)
DROP TABLE IF EXISTS framework_votes;

-- guest_sessions: 0 rows, only referenced in migration 004 (CREATE TABLE)
-- Guest access uses hash_accounts pattern instead; guest_conversions table handles the conversion (TS-referenced)
DROP TABLE IF EXISTS guest_sessions;

-- library_collection_items: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Library collections feature was never fully built out
DROP TABLE IF EXISTS library_collection_items;

-- library_collections: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Library collections feature was never fully built out
DROP TABLE IF EXISTS library_collections;

-- library_framework_tags: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Tag system for library was never populated; library_tags also dead (schema-only)
DROP TABLE IF EXISTS library_framework_tags;

-- library_items: 0 rows, only referenced in migrations 005/022/029 (CREATE TABLE)
-- Superseded by library_frameworks (TS-referenced, empty)
DROP TABLE IF EXISTS library_items;

-- library_tags: 0 rows, only referenced in migration 022 (CREATE TABLE)
-- Tagging system not implemented
DROP TABLE IF EXISTS library_tags;

-- rate_limits: 0 rows, only referenced in migration 004 (CREATE TABLE)
-- Rate limiting moved to Cloudflare-level controls; no TS code queries this table
DROP TABLE IF EXISTS rate_limits;

-- research_analysis: 0 rows, NO references anywhere in functions/, src/, or schema/
-- Completely orphaned table with no known purpose
DROP TABLE IF EXISTS research_analysis;

-- research_tool_results: 0 rows, only referenced in d1-schema.sql (CREATE TABLE)
-- Research tool result caching not implemented in any endpoint
DROP TABLE IF EXISTS research_tool_results;

-- social_media_analytics: 0 rows, only referenced in migration 006 (CREATE TABLE)
-- Analytics aggregation for social media was never implemented; social_media_jobs/posts are TS-referenced
DROP TABLE IF EXISTS social_media_analytics;

-- social_media_monitors: 0 rows, only referenced in migration 006 (CREATE TABLE)
-- Monitor/alert system for social media was never implemented
DROP TABLE IF EXISTS social_media_monitors;

-- suggestion_analytics: 0 rows, only referenced in migration 027 (CREATE TABLE)
-- Suggestion analytics tracking was never implemented
DROP TABLE IF EXISTS suggestion_analytics;
