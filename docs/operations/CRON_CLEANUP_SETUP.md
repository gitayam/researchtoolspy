# Scheduled Cleanup Setup

Pages Functions have **no native cron trigger**, so periodic maintenance (content-analysis
retention cleanup) is driven by a standalone Worker — `workers/cron/` — that calls a
secret-guarded endpoint on the Pages app.

```
researchtoolspy-cron (Worker, [triggers] crons)  --POST X-Cron-Secret-->  /api/cron/cleanup-content (Pages)
```

## Components
- **`functions/api/cron/cleanup-content.ts`** — cascade-safe global cleanup endpoint. Deletes only EXPIRED, UNSAVED `content_analysis` rows that are **not** referenced by `saved_links`, `content_qa`, `starbursting_sources`, or `claim_adjustments`. Guarded by `X-Cron-Secret` (NOT a session).
- **`workers/cron/`** — the scheduling Worker (`scheduled()` fires daily at 04:00 UTC and POSTs to the endpoint).

## One-time setup

### 1. Generate a shared secret
```bash
CRON_SECRET=$(openssl rand -hex 32)
echo "$CRON_SECRET"   # keep this; you'll paste it into BOTH places below
```

### 2. Set the secret on the Pages app (consumer side)
```bash
# from repo root
echo -n "$CRON_SECRET" | npx wrangler pages secret put CRON_SECRET --project-name=researchtoolspy
```

### 3. Deploy the cron Worker and set its secret (producer side)
```bash
cd workers/cron
echo -n "$CRON_SECRET" | npx wrangler secret put CRON_SECRET
npx wrangler deploy
```
The two `CRON_SECRET` values **must match** — the endpoint rejects mismatches with 401, and refuses to run at all (503) if its own secret is unset (fail-safe: no unauthenticated global delete).

## Verify (safe — no deletion)
```bash
# Dry-run count of deletable rows (requires the secret):
curl -s -X POST "https://researchtools.net/api/cron/cleanup-content?dry=1" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .
# => {"success":true,"dry_run":true,"deletable_count": N}

# Wrong/missing secret should 401:
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://researchtools.net/api/cron/cleanup-content?dry=1"   # => 401
```

## Run a real cleanup manually (idempotent, batched)
```bash
curl -s -X POST "https://researchtools.net/api/cron/cleanup-content" \
  -H "X-Cron-Secret: $CRON_SECRET" | jq .
# => {"success":true,"deleted_count":N,"batches_run":B,"remaining_deletable":R}
# Re-run while remaining_deletable > 0 (each run deletes up to BATCH_SIZE*MAX_BATCHES = 10k rows).
```

## Watch the scheduled runs
```bash
cd workers/cron && npx wrangler tail
# Look for: [cron] content cleanup ok: {...}
```

## Notes
- **Prerequisite for cleanup to delete anything:** rows must have `expires_at` set. New rows get `+7 days` on insert (`analyze-url.ts`); existing rows need the GATED backfill — see the [remediation plan](../plans/2026-06-13-tech-debt-remediation.md) Phase 1.4. Until the backfill runs, `deletable_count` will be ~0 even though the DB is full of legacy NULL-expiry rows.
- The schedule is **04:00 UTC daily**. Change in `workers/cron/wrangler.toml` `[triggers] crons`.
- To add more scheduled jobs later, extend `runMaintenance` calls in `workers/cron/src/index.ts` (e.g. resurrect the dead `_scheduled.ts` playbook-engine/sla-check jobs the same way).
