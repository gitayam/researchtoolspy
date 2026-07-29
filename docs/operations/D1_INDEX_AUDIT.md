# D1 composite and covering index audit

> Audited 2026-07-23 against the production schema, seven days of D1 insights,
> the Pages Functions query source, and `EXPLAIN QUERY PLAN`; post-rollout
> observation and the narrow cleanup were completed 2026-07-28.

## Conclusion

ResearchTools is not built around unscoped full-table scans. Tenant-owned hot
tables carry `workspace_id`, the common workspace predicates use indexes, and
access helpers perform row-level ownership or membership probes.

The gap was the second column. Several list endpoints used a single-column
workspace, type, status, or session index and then built a temporary B-tree for
recency ordering or filtered the selected index. That is inexpensive at the
current row counts, but it does not preserve the same cost curve if one tenant
or one table grows by orders of magnitude.

Managed migration
[`0004_add_hot_path_composite_indexes.sql`](../../schema/managed-migrations/0004_add_hot_path_composite_indexes.sql)
adds the high-confidence composite indexes. It is additive: redundant
single-column indexes remain until production plans and D1 insights have been
observed after rollout.

## Rollout status

Migration 0004 was applied through the backed-up managed production path on
2026-07-23. The live catalog reached the expected 553 indexes, all 24 new
indexes were present, and representative production plans selected the new
exact composites.

Five days of post-0004 insights showed 81 `content_analysis` inserts at 13
average rows written and 2.828 ms average duration. A repeated live audit still
selected the 0004 composites for every representative hot path. The source has
no `INDEXED BY` dependency on the two old content indexes, and the replacement
definitions have the same leading columns:

- `content_hash` → `idx_content_analysis_hash_workspace(content_hash, workspace_id)`;
- `user_id` → `idx_content_analysis_user_workspace(user_id, workspace_id)`.

Migration 0005 therefore removed only `idx_content_analysis_hash` and
`idx_content_analysis_user` through a fresh backed-up production release on
2026-07-28. The live catalog now contains 551 indexes; single-column hash and
user predicates select the wider covering indexes. Fresh post-0005 traffic is
still needed to quantify the write reduction. Other potential redundant
indexes remain separately gated.

## Production baseline

The live database had 529 indexes at audit time, including 140 implicit SQLite
indexes. There are two useful ways to count "workspace indexes":

- the historical migration archive contains 65 `CREATE INDEX` declaration
  lines whose index names indicate workspace scoping, including duplicates and
  declarations for schema states that are no longer live;
- production has 39 actual indexes whose indexed columns include
  `workspace_id`.

This distinction explains why source-level counts around 64 do not exactly
match the live catalog. Neither number indicates that the remaining indexes
cause full-table scans; primary keys, foreign-key probes, user ownership,
session IDs, share tokens, and other non-workspace access paths need their own
indexes.

Current production volume is small:

| Table | Rows |
|---|---:|
| `content_analysis` | 351 |
| `framework_sessions` | 121 |
| `evidence_items` | 99 |
| `activity_feed` | 47 |
| `event_logs` | 39 |
| `events` | 34 |
| `actors` | 31 |
| `cop_activity` | 31 |
| `cop_sessions` | 30 |
| `workspace_members` | 18 |
| `cop_tasks` | 15 |
| `relationships` | 14 |

A seven-day insight window therefore reflects low-volume behavior, not a load
test. Notable results were:

- `content_analysis` insert: 263 runs, 13 average rows written, 1.748 ms
  average;
- workspace relationship list: 7 runs, 1 average row read, 0.508 ms average;
- user/public framework list: 12 runs, 52 average rows read, 2.801 ms average;
- global content cleanup delete: 7 runs, 811 average rows read, 20.885 ms
  average.

## Query-plan findings

Before migration 0004, the live planner used an index seek for every
workspace-scoped example below. The issue was the remaining filter or sort:

| Query shape | Live plan before 0004 | Index supplied by 0004 |
|---|---|---|
| collaborator access by session + user | user index, then session filter | `cop_session_id, user_id` (covering) |
| COP sessions by workspace + status + owner, newest first | status index + filter + temp sort | `workspace_id, status, created_by, updated_at DESC` |
| frameworks by workspace, newest first | workspace index + temp sort | `workspace_id, updated_at DESC` |
| frameworks by workspace + type, newest first | workspace index + filter + temp sort | `workspace_id, framework_type, updated_at DESC` |
| evidence by workspace + status, newest first | workspace index + filter + temp sort | `workspace_id, status, created_at DESC` |
| actor/source/place/behavior by workspace + type | type or workspace index + filter + temp sort | `workspace_id, type-column, created_at DESC` |
| events by workspace + type/date | workspace index + filter + temp sort | `workspace_id, event_type, date_start DESC` |
| relationships by workspace + type, newest first | workspace index + filter + temp sort | `workspace_id, relationship_type, created_at DESC` |
| COP activity by session, newest first | session index + temp sort | `cop_session_id, created_at DESC` |
| COP tasks by session + status | status index + session filter + temp sort | `cop_session_id, status`; custom priority sort remains |

Against a schema-only clone of production, migration 0004 changed the
representative plans to exact composite searches and removed the temporary
sorts. The collaborator probe became:

```text
SEARCH cop_collaborators USING COVERING INDEX
idx_cop_collaborators_session_user (cop_session_id=? AND user_id=?)
```

The COP task endpoint is an intentional exception. Its ordering uses a
`CASE priority ...` expression, so the new composite narrows the session/status
rows but SQLite still builds a temporary B-tree. Removing that sort requires a
stored `priority_rank`, a matching expression index, or a query/data-model
change.

## Covering-index decisions

Covering indexes are used only where the selected data is naturally narrow:

- `cop_collaborators(cop_session_id, user_id)` covers `SELECT 1`;
- `workspace_members(user_id, workspace_id)` covers the user's workspace-ID
  lookup;
- existing primary/unique indexes continue to serve single-row ID lookups.

The entity, framework, evidence, and relationship endpoints use `SELECT *` or
return many columns. Making those indexes covering would duplicate large text
and JSON values, increase storage, and amplify every write. Their composites
therefore cover predicates and ordering, not the response payload.

`verifyCopSessionAccess` itself needs no wider session index:
`cop_sessions.id` already resolves one row. Adding
`(id, workspace_id, created_by, is_public)` would save at most one table-row
lookup while duplicating the primary key across every session.

## Deferred work

These items need post-rollout telemetry rather than speculative indexes:

1. Review the remaining single workspace/session indexes that are left-prefix
   covered by 0004. Do not drop type-only indexes merely because a
   `(workspace_id, type, ...)` index exists: SQLite cannot use that composite
   for a type-only predicate. Every further removal needs its own planner/source
   evidence and backed-up migration.
2. Decide whether relationship source/target filters justify
   `(workspace_id, source_entity_id, created_at)` and
   `(workspace_id, target_entity_id, created_at)`.
3. Treat `%term%` searches separately. Ordinary B-tree indexes cannot optimize
   leading-wildcard `LIKE`; use FTS if those searches become hot.
4. Revisit public-or-owner queries. An `OR` across `is_public` and owner/workspace
   branches may still require a merge and sort even when both branches are
   indexed; a bounded `UNION ALL` rewrite may be better at high volume.
5. Do not add a composite for every optional filter combination. Add one when
   insights show a material row-read ratio or latency regression for that exact
   query shape.

## Repeat the audit

The audit SQL contains only `SELECT` and `EXPLAIN` statements.

```bash
# Local D1
pnpm run audit:indexes

# Production D1 (read-only)
pnpm run audit:indexes:prod
```

After production migration and during an observation window:

```bash
pnpm run migrate:list:prod
pnpm run audit:indexes:prod
pnpm exec wrangler d1 insights researchtoolspy-prod \
  --time-period=7d \
  --sort-type=sum \
  --sort-by=reads \
  --limit=100
```

Compare `avgRowsRead`, `avgRowsWritten`, duration, and query plan. Do not remove
the old single-column indexes until the observation window includes real use of
the affected endpoints.
