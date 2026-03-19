# Automated Cleanup Cron Job

## Overview

This project includes an automated cleanup system that runs daily at 3 AM UTC to remove expired content analyses and old guest sessions from the database.

## Implementation

### Files

1. **`workers/cleanup-cron/worker.js`** - Standalone Cloudflare Worker for cron
2. **`workers/cleanup-cron/wrangler.toml`** - Worker configuration with cron trigger
3. **`functions/api/content-intelligence/cleanup.ts`** - Cleanup endpoint (called by Worker)

### Architecture

The cleanup system uses a **two-component architecture**:

1. **Cleanup Worker** (`workers/cleanup-cron/`) - Scheduled Worker that runs on cron
2. **Cleanup Endpoint** (`functions/api/content-intelligence/cleanup.ts`) - Pages Function that performs the actual cleanup

Why this architecture?
- Cloudflare Pages doesn't support cron triggers directly
- Separating concerns: Worker handles scheduling, Pages Function handles logic
- Cleanup endpoint remains manually callable for testing/emergencies

### What Gets Cleaned Up

#### Content Analyses (Daily)
```sql
DELETE FROM content_analysis
WHERE expires_at IS NOT NULL
  AND expires_at < datetime('now')
  AND (is_saved = FALSE OR is_saved IS NULL)
```

Removes:
- Expired analyses (past their `expires_at` timestamp)
- Only unsaved analyses (user-saved analyses are preserved indefinitely)
- Frees up database space (~100KB per analysis on average)

#### Guest Sessions (Daily)
```sql
DELETE FROM guest_sessions
WHERE created_at < datetime('now', '-30 days')
```

Removes:
- Guest sessions older than 30 days
- Helps with GDPR compliance
- Prevents guest session table bloat

## Schedule

The cron job runs **daily at 3:00 AM UTC** using the cron expression:
```
0 3 * * *
```

This timing is chosen because:
- Low traffic time for most users
- Gives analyses a full day to be used before cleanup
- Predictable maintenance window

## Monitoring

### Cloudflare Dashboard

View cron execution logs in:
1. Cloudflare Dashboard → Pages → researchtoolspy
2. Functions → Logs
3. Filter by "[Cron]" prefix

### Manual Trigger

You can manually trigger cleanup anytime via:

```bash
# Using curl
curl -X POST https://researchtoolspy.pages.dev/api/content-intelligence/cleanup

# Or via browser
https://researchtoolspy.pages.dev/api/content-intelligence/cleanup
```

The endpoint returns:
```json
{
  "success": true,
  "deleted_count": 84,
  "message": "Successfully deleted 84 expired content analyses"
}
```

## Expected Impact

Based on database audit (October 17, 2025):
- **Initial cleanup**: ~84 expired analyses
- **Daily cleanup**: 5-15 analyses (estimated)
- **Database space saved**: ~6-8MB initially, ~500KB-1.5MB daily
- **Guest sessions**: 0-5 daily (low traffic currently)

## Logs Format

The cron job logs include:

```
[Cron] Starting scheduled cleanup task at 2025-10-17T03:00:00.000Z
[Cron] Successfully deleted 12 expired content analyses
[Cron] Successfully deleted 3 old guest sessions
```

Errors are logged as:
```
[Cron] Cleanup error: [error message]
```

## Retention Policy

| Data Type | Retention |
|-----------|-----------|
| Saved analyses | Indefinite (never deleted) |
| Unsaved analyses | Until `expires_at` (typically 7 days) |
| Guest sessions | 30 days from creation |
| Saved links | Indefinite |
| Framework sessions | Indefinite |
| ACH analyses | Indefinite |

## Troubleshooting

### Cron Not Running

Check:
1. Cloudflare Pages dashboard → Settings → Functions
2. Verify `[triggers]` section in `wrangler.toml`
3. Check Cloudflare Workers plan (cron requires paid plan or Workers Free with limits)

### Analyses Not Being Deleted

Possible causes:
1. Analyses are marked as `is_saved = TRUE` (intentionally preserved)
2. `expires_at` is NULL (no expiration set)
3. `expires_at` is in the future (not yet expired)
4. Database connection issue (check logs)

### Testing Locally

#### Test the Cleanup Endpoint

```bash
# Start local Pages dev server
npm run dev

# In another terminal, call the cleanup endpoint
curl -X POST http://localhost:8788/api/content-intelligence/cleanup
```

#### Test the Worker Locally

```bash
# Navigate to worker directory
cd workers/cleanup-cron

# Test locally (note: cron trigger won't fire locally)
wrangler dev

# In another terminal, manually trigger the scheduled handler
# (This requires using the Workers API directly)
```

**Note**: Cron triggers cannot be tested locally. You must deploy to preview/production to test scheduled execution.

## Configuration Changes

### Change Schedule

Edit `wrangler.toml`:
```toml
[triggers]
crons = ["0 3 * * *"]  # Daily at 3 AM UTC
```

Common patterns:
- Every hour: `"0 * * * *"`
- Every 6 hours: `"0 */6 * * *"`
- Twice daily: `["0 3 * * *", "0 15 * * *"]`

### Change Retention Period

Edit `functions/_worker.js`:
```javascript
// Change from 30 days to 60 days
WHERE created_at < datetime('now', '-60 days')
```

## Deployment

### Deploy the Cleanup Worker

The cron Worker must be deployed separately from the Pages project:

```bash
# Navigate to worker directory
cd workers/cleanup-cron

# Deploy the worker
wrangler deploy

# Verify deployment
wrangler tail researchtoolspy-cleanup-cron
```

### Deploy the Pages Project

The cleanup endpoint is deployed with the Pages project:

```bash
# From frontend-react directory
npm run build
wrangler pages deploy dist --project-name=researchtoolspy
```

### First-Time Setup

1. **Deploy the Worker** (one-time):
   ```bash
   cd workers/cleanup-cron
   wrangler deploy
   ```

2. **Verify cron schedule**:
   ```bash
   wrangler deployments list
   ```

3. **Test manually** (before waiting for cron):
   ```bash
   # Option 1: Call endpoint directly
   curl -X POST https://researchtoolspy.pages.dev/api/content-intelligence/cleanup

   # Option 2: Trigger worker manually (if supported)
   wrangler tail researchtoolspy-cleanup-cron
   ```

4. **Monitor logs**:
   ```bash
   # Worker logs
   wrangler tail researchtoolspy-cleanup-cron

   # Pages logs
   wrangler pages deployment tail --project-name=researchtoolspy
   ```

## Resources

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Pages Advanced Mode](https://developers.cloudflare.com/pages/platform/functions/advanced-mode/)
- [Cron Expression Reference](https://crontab.guru/)

## Related Issues

This addresses issue #2 from `DATABASE_ISSUES_AND_IMPROVEMENTS.md`:
- **Priority**: MEDIUM
- **Impact**: 84 expired analyses ready for deletion
- **Space**: ~6-8MB database cleanup
- **Status**: ✅ IMPLEMENTED
