# Automated Cleanup Cron Job

## Overview

This project includes an automated cleanup system that runs daily at 3 AM UTC to remove expired content analyses and old guest sessions from the database.

## Implementation

### Files

1. **`functions/_worker.js`** - Advanced Worker that handles scheduled events
2. **`wrangler.toml`** - Cron trigger configuration
3. **`functions/api/content-intelligence/cleanup.ts`** - Manual cleanup endpoint (still available)

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

The cron trigger cannot be tested locally with `wrangler pages dev`. To test:

1. **Test the cleanup logic manually**:
```bash
# Deploy to preview
npm run build
wrangler pages deploy dist

# Trigger manually
curl https://[preview-url]/api/content-intelligence/cleanup
```

2. **Test cron in production**:
```bash
# View cron schedules
wrangler pages deployment list --project-name=researchtoolspy

# Check logs
wrangler pages deployment tail --project-name=researchtoolspy
```

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

The cron job is automatically deployed with the Pages project:

```bash
npm run build
wrangler pages deploy dist --project-name=researchtoolspy
```

Verify deployment:
```bash
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
