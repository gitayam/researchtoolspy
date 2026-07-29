-- Read-only D1 index audit.
-- Safe for local or remote execution: every statement is SELECT or EXPLAIN.

-- Inventory. sqlite_autoindex rows have NULL SQL and are counted separately.
SELECT
  COUNT(*) AS total_indexes,
  SUM(CASE WHEN sql IS NULL THEN 1 ELSE 0 END) AS implicit_indexes,
  SUM(CASE WHEN lower(coalesce(sql, '')) LIKE '%workspace_id%' THEN 1 ELSE 0 END)
    AS explicit_workspace_indexes
FROM sqlite_schema
WHERE type = 'index';

-- Ordered index columns for the audited hot tables.
SELECT
  m.name AS table_name,
  il.name AS index_name,
  il.[unique] AS is_unique,
  il.partial,
  group_concat(ii.name, ',') AS indexed_columns
FROM sqlite_schema AS m
JOIN pragma_index_list(m.name) AS il
JOIN pragma_index_info(il.name) AS ii
WHERE m.type = 'table'
  AND m.name IN (
    'actors',
    'behaviors',
    'content_analysis',
    'cop_activity',
    'cop_collaborators',
    'cop_sessions',
    'cop_tasks',
    'events',
    'evidence_items',
    'framework_sessions',
    'places',
    'relationships',
    'sources',
    'workspace_members',
    'workspaces'
  )
GROUP BY m.name, il.name, il.[unique], il.partial
ORDER BY m.name, il.name;

-- Redundant content-analysis indexes. After migration 0005, the wider
-- left-prefix composites must serve both single-column and workspace-qualified
-- predicates.
EXPLAIN QUERY PLAN
SELECT id
FROM content_analysis
WHERE content_hash = '__index_audit__';

EXPLAIN QUERY PLAN
SELECT id
FROM content_analysis
WHERE content_hash = '__index_audit__'
  AND workspace_id = '__index_audit__';

EXPLAIN QUERY PLAN
SELECT id
FROM content_analysis
WHERE user_id = -1;

EXPLAIN QUERY PLAN
SELECT id
FROM content_analysis
WHERE user_id = -1
  AND workspace_id = '__index_audit__';

-- Authorization probes.
EXPLAIN QUERY PLAN
SELECT 1
FROM cop_collaborators
WHERE cop_session_id = '__index_audit__'
  AND user_id = -1;

EXPLAIN QUERY PLAN
SELECT workspace_id
FROM workspace_members
WHERE user_id = -1
LIMIT 1;

-- Session and workspace lists.
EXPLAIN QUERY PLAN
SELECT *
FROM cop_sessions
WHERE workspace_id = '__index_audit__'
  AND status = 'ACTIVE'
  AND created_by = -1
ORDER BY updated_at DESC
LIMIT 200;

EXPLAIN QUERY PLAN
SELECT *
FROM cop_sessions
WHERE created_by = -1
  AND status = 'ACTIVE'
ORDER BY updated_at DESC
LIMIT 200;

EXPLAIN QUERY PLAN
SELECT *
FROM workspaces
WHERE owner_id = -1
  AND id NOT LIKE 'cop-%'
ORDER BY created_at DESC;

-- Framework and evidence lists.
EXPLAIN QUERY PLAN
SELECT id, title, framework_type, status, created_at, updated_at
FROM framework_sessions
WHERE workspace_id = '__index_audit__'
ORDER BY updated_at DESC
LIMIT 50;

EXPLAIN QUERY PLAN
SELECT id, title, framework_type, status, created_at, updated_at
FROM framework_sessions
WHERE workspace_id = '__index_audit__'
  AND framework_type = 'deception'
ORDER BY updated_at DESC
LIMIT 50;

EXPLAIN QUERY PLAN
SELECT *
FROM evidence_items
WHERE workspace_id = '__index_audit__'
ORDER BY created_at DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM evidence_items
WHERE workspace_id = '__index_audit__'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 100;

-- Entity lists.
EXPLAIN QUERY PLAN
SELECT *
FROM actors
WHERE workspace_id = '__index_audit__'
  AND type = 'PERSON'
ORDER BY created_at DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM sources
WHERE workspace_id = '__index_audit__'
  AND type = 'OSINT'
ORDER BY created_at DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM events
WHERE workspace_id = '__index_audit__'
  AND event_type = 'INCIDENT'
  AND date_start >= '2099-01-01'
ORDER BY date_start DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM places
WHERE workspace_id = '__index_audit__'
  AND place_type = 'CITY'
ORDER BY created_at DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM behaviors
WHERE workspace_id = '__index_audit__'
  AND behavior_type = 'TTP'
ORDER BY created_at DESC
LIMIT 500;

EXPLAIN QUERY PLAN
SELECT *
FROM relationships
WHERE workspace_id = '__index_audit__'
  AND relationship_type = 'RELATED_TO'
ORDER BY created_at DESC
LIMIT 500;

-- COP activity and task lists.
EXPLAIN QUERY PLAN
SELECT *
FROM cop_activity
WHERE cop_session_id = '__index_audit__'
ORDER BY created_at DESC
LIMIT 50;

EXPLAIN QUERY PLAN
SELECT *
FROM cop_tasks
WHERE cop_session_id = '__index_audit__'
  AND status = 'todo'
ORDER BY
  CASE priority
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  created_at DESC
LIMIT 500;
