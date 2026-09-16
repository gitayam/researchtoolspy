-- Remove the trigger and views that migration 113-drop-dead-tables.sql orphaned.
--
-- 113 dropped framework_analytics, framework_votes and framework_ratings, but
-- SQLite lets a table be dropped while triggers and views that reference it
-- survive. Those survivors then fail when the OTHER table they are attached to
-- is used, because SQLite resolves a trigger program and a view body when the
-- statement is prepared, not when it runs.
--
-- Concretely: update_framework_comment_count fires AFTER INSERT ON comments and
-- writes to the dropped framework_analytics, so EVERY insert into comments has
-- been failing in production with
--   no such table: main.framework_analytics
-- That is the whole commenting feature, for every entity_type -- the trigger
-- body's own WHERE NEW.entity_type IN (...) filter is a run-time test and never
-- gets the chance to spare a non-framework comment from the prepare-time error.
--
-- The two views are dead weight rather than a live fault: no application code
-- selects from them (they are referenced only by the migration that created
-- them, 022-library-voting-rating.sql), but they cannot be queried at all and
-- would mislead the next person who found them in the schema.
--
-- Counter-check for the future: probe every table with
--   EXPLAIN INSERT INTO <t> DEFAULT VALUES
-- against a mirror of the production schema. Prepare-time trigger resolution
-- makes that fail loudly for exactly this class of breakage, which is how this
-- was found. scripts/check-sql-schema.py does it as part of the SQL sweep.
--
-- Rollback: recreate from 023-notifications-and-activity-feed.sql (trigger) and
-- 022-library-voting-rating.sql (views) -- but recreate their backing tables
-- first, or this same fault comes straight back.

DROP TRIGGER IF EXISTS update_framework_comment_count;
DROP VIEW IF EXISTS framework_vote_counts;
DROP VIEW IF EXISTS framework_rating_stats;
