# Scraping Production Deployment Runbook

This runbook covers production releases of the scraping surface. The canonical
application is Cloudflare Pages project `researchtoolspy`, served at
`https://researchtools.net`.

## Deployment topology

| Unit | Configuration | Deploy when |
|---|---|---|
| Pages UI and Functions | `wrangler.toml`, `deploy.sh` | UI, Pages Functions, bindings, or managed D1 schema changed |
| Browser renderer Worker | `workers/browser-renderer/wrangler.toml` | Renderer source or configuration changed |
| Cleanup cron Worker | `workers/cron/wrangler.toml` | Schedule, maintenance endpoints, or cron source changed |
| Container Worker | `containers/wrangler.toml` | Container images, Durable Objects, or container Worker source/configuration changed |

Deploy only changed units. A Pages scraping release does not require an
unrelated browser, cron, or container rollout.

## Account and release gates

Wrangler authentication currently exposes more than one Cloudflare account.
Because Cloudflare Pages rejects `account_id` in `wrangler.toml`, the canonical
account is selected by `deploy.sh` and `scripts/pre-deployment-check.sh` through
`CLOUDFLARE_ACCOUNT_ID`. Verify that the authenticated identity can access it
with `pnpm exec wrangler whoami`. The variable may still be exported explicitly
in CI or an emergency shell:

```bash
export CLOUDFLARE_ACCOUNT_ID="<researchtoolspy-account-id>"
```

From a clean `main` that matches `origin/main`:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/main
./scripts/list-managed-migrations.sh --remote
./scripts/pre-deployment-check.sh
```

The root pre-deployment check runs application, all-Pages-Function, standalone
Worker, and focused scraping type checks. Before deploying Container Worker
changes, install its isolated lockfile and run its separate compile gate:

```bash
npm --prefix containers ci --legacy-peer-deps
npm run type-check:containers
```

The pre-deployment check is read-only against production D1. If a managed
migration is pending, inspect it and its rollback notes before continuing. The
release script exports D1 and records Time Travel state before applying any
pending migration.

If the D1 schema snapshot is unavailable, the gate reports that single remote
dependency failure and skips per-object assertions. It must not misreport every
table and column as missing, and deployment remains fail-closed.

## Pages and Functions deployment

```bash
./deploy.sh
```

`deploy.sh` builds the client, copies `functions/` and the shared function
modules into `dist/`, validates the production schema, and deploys `dist/`.
Never deploy the repository root; doing so serves the development entry point.

Use `./deploy.sh --skip-migrate` only when schema rollout is deliberately
separated and the deployed Functions are compatible with the current schema.

## Post-deployment verification

```bash
curl -fsS -o /dev/null https://researchtools.net/
curl -fsS https://researchtools.net/api/health
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST -H 'content-type: application/json' \
  --data '{"url":"https://example.com"}' \
  https://researchtools.net/api/tools/analyze-url
pnpm exec wrangler pages deployment list --project-name=researchtoolspy
```

The unauthenticated analyzer probe must return `401`. Authenticated live scrape
tests are not a routine smoke check because they disclose a target to upstream
providers and may consume paid capacity.

When a migration creates scraping tables, verify those exact objects with a
read-only remote D1 query. Do not use a write probe merely to prove deployment.

## Logs and analytics

Tail a bounded slice of the active Functions deployment during verification:

```bash
pnpm exec wrangler pages deployment tail \
  --project-name=researchtoolspy \
  --environment=production \
  --format=pretty \
  --status=error
```

The protected `/api/cron/event-logs` endpoint is the durable application-error
sink. Pages tail output is transient and must not be treated as retained
analytics. The initial `SCRAPE_ANALYTICS` dataset covers accepted
`content-intelligence/analyze-url` extraction requests. Use the schema, baseline
queries, privacy rules, and rollout gates in
[`SCRAPING_OBSERVABILITY.md`](SCRAPING_OBSERVABILITY.md). Other scraping routes,
automated dashboards/alerts, and 14-day SLO evidence remain `SCRAPE-04` work; do
not extrapolate system-wide quality or cost from this first route.

## Rollback

For an application regression, identify the last known-good production commit
and deployment, rebuild that commit in an isolated clean worktree, and deploy
its `dist/` output. Do not delete the failed deployment until recovery is
verified.

For a migration regression, stop dependent traffic first and use the backup and
Time Travel record created by `deploy.sh`. Follow
[`D1_MIGRATIONS.md`](D1_MIGRATIONS.md); application rollback alone is
insufficient when the prior code is schema-incompatible.
