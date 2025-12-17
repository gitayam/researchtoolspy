# Database Migrations

## Overview
This directory contains database migration files for the Cloudflare D1 database. Migrations are numbered sequentially and should be applied in order.

## Migration Files

### 004-add-public-access.sql (Phase 4A - October 1, 2025)
Adds public access support for frameworks, datasets, and evidence items.

**Changes:**
- Adds `is_public` and `shared_by_user_id` columns to `datasets` table
- Adds `is_public` and `shared_by_user_id` columns to `evidence_items` table
- Adds `is_public` and `shared_publicly_at` columns to `framework_sessions` table
- Creates `guest_sessions` table for tracking anonymous users
- Creates `rate_limits` table for guest rate limiting
- Creates `guest_conversions` table for conversion tracking
- Adds appropriate indexes for performance

**Purpose:**
Enable public access to frameworks and tools without requiring authentication. Hash-based authentication becomes optional for users who want to save their work or collaborate.

## Running Migrations

### Development (Local D1)
```bash
# Apply migration to local D1 database
npx wrangler d1 execute researchtoolspy-db --local --file=./schema/migrations/004-add-public-access.sql

# Verify tables
npx wrangler d1 execute researchtoolspy-db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Production (Remote D1)
```bash
# Apply migration to production D1 database
npx wrangler d1 execute researchtoolspy-db --remote --file=./schema/migrations/004-add-public-access.sql

# Verify in production
npx wrangler d1 execute researchtoolspy-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

### Check Migration Status
```bash
# Check if migration has been applied (look for new columns)
npx wrangler d1 execute researchtoolspy-db --remote --command="PRAGMA table_info(datasets);"

# Check for is_public column in result
```

## Rollback Strategy

If you need to rollback migration 004:

```sql
-- Rollback 004-add-public-access.sql
DROP TABLE IF EXISTS guest_conversions;
DROP TABLE IF NOT EXISTS rate_limits;
DROP TABLE IF EXISTS guest_sessions;

-- Note: ALTER TABLE DROP COLUMN is not supported in SQLite
-- To remove columns, you would need to:
-- 1. Create new table without the columns
-- 2. Copy data
-- 3. Drop old table
-- 4. Rename new table
-- This is complex and should only be done if absolutely necessary
```

## Best Practices

1. **Test Locally First**: Always test migrations on local D1 before applying to production
2. **Backup**: Create a backup of production data before running migrations
3. **Monitor**: Watch for errors during migration execution
4. **Verify**: Always verify migration success by checking table structure
5. **Document**: Update this README when adding new migrations

## Migration Naming Convention

Format: `XXX-descriptive-name.sql`

- `XXX`: Three-digit sequential number (001, 002, 003, etc.)
- `descriptive-name`: Short kebab-case description of what the migration does
- `.sql`: SQL file extension

Example: `004-add-public-access.sql`

## Database Connection Info

**Local D1**:
- Database Name: `researchtoolspy-db`
- Location: `.wrangler/state/d1/`

**Production D1**:
- Database Name: `researchtoolspy-db`
- Database ID: (found in wrangler.toml)

## Troubleshooting

### Migration Fails
1. Check SQL syntax
2. Verify table/column names
3. Check for foreign key constraints
4. Review error message carefully

### Column Already Exists
If you see "duplicate column name" error, the migration may have already been applied. Check table structure to verify.

### Permission Issues
Ensure you have the correct Cloudflare API token and account access.

## Next Migrations

Planned migrations:
- 005: Add full-text search indexes
- 006: Add collaboration features (sharing, comments)
- 007: Add analytics tracking tables
