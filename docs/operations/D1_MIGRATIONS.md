# D1 migration operations

ResearchTools uses a forward-only Wrangler migration lane:

- `schema/managed-migrations/` contains every new migration Wrangler may apply.
- `schema/migrations/` is a historical archive only.
- `wrangler.toml` points both D1 bindings at the managed directory.
- Wrangler records applied managed files in `d1_migrations`.

The legacy archive is not replay-safe. It contains duplicate sequence numbers,
repeated `ALTER TABLE ... ADD COLUMN` statements, and incompatible definitions
such as the two `activity_feed` schemas. Never loop over or apply that directory
to local, staging, or production databases.

## Safety rules

1. Inspect pending migrations before any apply.
2. Export D1 and record a Time Travel restore point before production changes.
3. Apply migrations through `wrangler d1 migrations apply`; do not run managed
   SQL files individually.
4. Stop on the first error. Never treat an error as evidence that a migration
   was already applied.
5. Verify every affected table with `PRAGMA table_info`.
6. Deploy application code only after the schema verification passes.

Production migration execution requires explicit authorization. A code review
or local test does not authorize a production apply.

## Create a migration

Use the next four-digit sequence number:

```text
schema/managed-migrations/0005_short_description.sql
```

Each file must:

- make one cohesive, forward-only change;
- include a rollback comment;
- preserve compatibility with the currently deployed application;
- use lowercase snake_case names;
- avoid destructive table rebuilds unless separately approved and tested.

List local pending migrations without contacting production:

```bash
pnpm run migrate:list
```

For schema testing, import a schema-only D1 export into an isolated local
Wrangler state directory, then list and apply the managed migrations there.
Do not test an unverified migration against production first.

## Read-only production preview

The deploy dry run lists pending production migrations but never applies them or
deploys Pages:

```bash
./deploy.sh --dry-run
```

To list only the migration state:

```bash
pnpm run migrate:list:prod
```

Both commands use `scripts/list-managed-migrations.sh`, which checks for the
tracker table with read-only SQL before comparing its rows with local filenames.
It deliberately does not use Wrangler's native remote `migrations list`
command, because that command initializes `d1_migrations` when the table is
absent. `--skip-migrate` suppresses the migration listing as well as migration
application.

## Production backup and apply

Choose an off-peak window. From the repository root:

The normal `./deploy.sh` path performs this sequence automatically: build,
read-only migration preview, restricted temporary SQL export plus Time Travel
record, managed migration apply, schema preflight, and only then the Pages
deployment. It refuses to migrate if either backup artifact is empty.

The commands below are the manual equivalent for an approved migration-only
operation:

```bash
RT_D1_BACKUP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/researchtoolspy-d1.XXXXXX")
chmod 700 "$RT_D1_BACKUP_DIR"
RT_D1_BACKUP_FILE="$RT_D1_BACKUP_DIR/researchtoolspy-prod-before-migrations.sql"

pnpm exec wrangler d1 time-travel info researchtoolspy-prod
pnpm exec wrangler d1 export researchtoolspy-prod \
  --remote \
  --output="$RT_D1_BACKUP_FILE"

pnpm run migrate:list:prod
pnpm run migrate:prod
```

Keep the Time Travel bookmark or pre-migration UTC timestamp with the change
record. The SQL export contains production data: keep it outside the repository,
restrict access, and never commit or upload it to an unapproved location.

`pnpm run migrate:prod` is fail-fast. Wrangler applies and records managed
migrations in order. The first managed apply may create `d1_migrations`; it does
not need entries for files in the legacy archive because that archive is outside
the configured migration directory.

## Verification

After each production apply, run:

```bash
pnpm run migrate:list:prod

pnpm exec wrangler d1 execute researchtoolspy-prod --remote \
  --command="PRAGMA table_info(evidence_items);"
pnpm exec wrangler d1 execute researchtoolspy-prod --remote \
  --command="PRAGMA table_info(framework_sessions);"
pnpm exec wrangler d1 execute researchtoolspy-prod --remote \
  --command="PRAGMA table_info(evidence_actors);"
pnpm exec wrangler d1 execute researchtoolspy-prod --remote \
  --command="PRAGMA table_info(evidence_citations);"
```

The current managed lane requires:

- `evidence_items.eve_assessment`
- `framework_sessions.view_count`
- `framework_sessions.clone_count`
- `evidence_actors.auto_linked`
- `evidence_citations.citation_format` (canonical style field)
- `evidence_citations.citation_type`
- `evidence_citations.relevance_score`
- `evidence_citations.notes`
- `evidence_citations.created_by`
- the composite indexes listed in
  [`D1_INDEX_AUDIT.md`](D1_INDEX_AUDIT.md), including
  `idx_cop_collaborators_session_user`,
  `idx_cop_sessions_workspace_status_owner_updated`,
  `idx_framework_sessions_workspace_type_updated`,
  `idx_evidence_items_workspace_status_created`, and
  `idx_cop_activity_session_created`

For migration 0004, also run the read-only planner audit:

```bash
pnpm run audit:indexes:prod
```

Migration 0004 was applied to production on 2026-07-23. The immediate catalog
size is 553 indexes (the pre-migration 529 plus 24 additive indexes). Redundant
single-column indexes were intentionally not dropped by 0004.

Run `pnpm run validate:pre-deploy` after migrations and before deploying Pages.

## Rollback

For application-only failures, roll Pages back first and leave these additive
columns in place; older application versions ignore them.

For confirmed schema or data corruption, D1 Time Travel is the authoritative
whole-database rollback because it restores both schema and data consistently:

```bash
pnpm exec wrangler d1 time-travel restore researchtoolspy-prod \
  --timestamp="<PRE_MIGRATION_UTC_TIMESTAMP>"
```

Time Travel restores the whole database. Writes after the chosen timestamp are
lost, so stop application writes or coordinate the recovery window before using
it. Only remove columns with a separately reviewed reverse migration after
checking indexes, constraints, and deployed-code dependencies.

Migration-specific reverse order, if a targeted schema rollback is approved:

1. `0004`: drop the 24 indexes listed in its rollback comment.
2. `0003`: drop `evidence_citations.created_by`, `notes`, `relevance_score`,
   `citation_type`, then `evidence_actors.auto_linked`.
3. `0002`: drop `framework_sessions.clone_count`, then `view_count`.
4. `0001`: drop `idx_evidence_items_workspace_eve`, then
   `evidence_items.eve_assessment`.

Export the current database before any rollback, even if a pre-migration backup
already exists.
