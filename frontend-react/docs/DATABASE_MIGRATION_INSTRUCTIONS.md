# Database Migration Instructions

**Issue:** SWOT auto-population failing with "no such table: content_intelligence"

**Root Cause:** Table naming inconsistency between migration files and API endpoints:
- Migration 014 creates table named `content_analysis`
- Some APIs query `content_intelligence`
- Some APIs query `content_analysis`

**Solution:** Run migration 044 to rename table and sync all APIs

---

## Quick Fix Instructions

### Step 1: Run the Migration

```bash
cd frontend-react

# For LOCAL development database:
wrangler d1 execute researchtoolspy-dev --file=schema/migrations/044-rename-content-analysis-to-intelligence.sql

# For PRODUCTION database (use --remote flag):
wrangler d1 execute researchtoolspy-prod --file=schema/migrations/044-rename-content-analysis-to-intelligence.sql --remote
```

### Step 2: Verify Migration Success

```bash
# Check that content_intelligence table exists
wrangler d1 execute researchtoolspy-dev --command="SELECT name FROM sqlite_master WHERE type='table' AND name='content_intelligence';"

# Check row count
wrangler d1 execute researchtoolspy-dev --command="SELECT COUNT(*) as count FROM content_intelligence;"
```

**Expected Output:**
```
name
content_intelligence

count
0 (or number of migrated rows)
```

### Step 3: Test Auto-Population

1. Go to Content Intelligence (`/tools/content-intelligence`)
2. Analyze a URL (use "Full" mode)
3. Wait for analysis to complete
4. Navigate to SWOT Analysis → Create New
5. Click "Auto-Populate from Content"
6. Select the analyzed content
7. Should work now! ✅

---

## Alternative: Quick SQL Fix (If Migration Fails)

If the migration script fails, manually create the table:

```bash
# Connect to database
wrangler d1 execute researchtoolspy-dev --command="
CREATE TABLE IF NOT EXISTS content_intelligence (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    user_hash TEXT,
    url TEXT NOT NULL UNIQUE,
    url_normalized TEXT,
    content_hash TEXT,
    title TEXT,
    description TEXT,
    author TEXT,
    publish_date TEXT,
    domain TEXT,
    is_social_media BOOLEAN DEFAULT FALSE,
    social_platform TEXT,
    main_content TEXT,
    summary TEXT,
    word_count INTEGER,
    word_frequency TEXT,
    top_10_words TEXT,
    top_10_phrases TEXT,
    key_entities TEXT,
    sentiment_overall REAL,
    sentiment_score REAL,
    sentiment_confidence REAL,
    sentiment_emotions TEXT,
    keyphrases TEXT,
    topics TEXT,
    claims TEXT,
    archive_urls TEXT,
    bypass_urls TEXT,
    social_metadata TEXT,
    processing_mode TEXT,
    processing_duration_ms INTEGER,
    gpt_model_used TEXT,
    analysis_version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT 0,
    public_token TEXT UNIQUE,
    public_share_count INTEGER DEFAULT 0,
    expires_at TEXT,
    loading_status TEXT DEFAULT 'pending',
    loading_progress INTEGER DEFAULT 0,
    loading_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

CREATE INDEX idx_content_intelligence_user ON content_intelligence(user_id);
CREATE INDEX idx_content_intelligence_url ON content_intelligence(url);
CREATE INDEX idx_content_intelligence_hash ON content_intelligence(content_hash);
"
```

---

## Understanding the Issue

### What Happened?

1. **Migration 014** (`014-content-intelligence.sql`) created table `content_analysis`
2. **API inconsistency:**
   - `content-library.ts` queries `content_analysis` ✅
   - `swot-auto-populate.ts` queries `content_intelligence` ❌
3. Result: SWOT auto-population fails with "no such table" error

### The Fix

Migration 044 creates `content_intelligence` table with updated schema:
- Migrates data from `content_analysis` (if exists)
- Uses TEXT for IDs (UUID compatibility)
- Includes all recent additions (sentiment, keyphrases, topics, claims)
- Creates proper indexes
- Adds update trigger

---

## For Production Deployment

### Pre-Deployment Checklist

- [ ] Test migration on local database first
- [ ] Backup production database (if possible)
- [ ] Run migration during low-traffic period
- [ ] Verify row counts match before/after
- [ ] Test auto-population feature after migration
- [ ] Monitor error logs for 24 hours

### Running in Production

```bash
# 1. Backup first (Cloudflare doesn't have native backup, so document state)
wrangler d1 execute researchtoolspy-prod --command="SELECT COUNT(*) FROM content_analysis;" --remote

# 2. Run migration
wrangler d1 execute researchtoolspy-prod --file=schema/migrations/044-rename-content-analysis-to-intelligence.sql --remote

# 3. Verify
wrangler d1 execute researchtoolspy-prod --command="SELECT COUNT(*) FROM content_intelligence;" --remote

# 4. Test auto-population on production URL
```

---

## Troubleshooting

### Error: "table content_intelligence already exists"

**Cause:** Migration ran successfully before

**Solution:** Check if table has data:
```bash
wrangler d1 execute researchtoolspy-dev --command="SELECT COUNT(*) FROM content_intelligence;"
```

If it has data, migration worked! If not, drop and recreate:
```bash
wrangler d1 execute researchtoolspy-dev --command="DROP TABLE IF EXISTS content_intelligence;"
# Then re-run migration
```

### Error: "no such table: content_analysis"

**Cause:** Old table doesn't exist (fresh database)

**Solution:** Migration will create new table anyway. This is safe to ignore.

### Content Library Still Broken

**Cause:** Content library API still queries old table name

**Solution:** Update `/api/content-library.ts`:
```typescript
// Change line 44 from:
FROM content_analysis

// To:
FROM content_intelligence
```

---

## Long-Term Fix (TODO for maintainers)

1. **Audit all API endpoints** for table name references
2. **Standardize on `content_intelligence`** everywhere
3. **Update migration 014** to use correct name from start
4. **Add database schema tests** to catch inconsistencies
5. **Document table naming conventions**

---

## Files Modified

- `schema/migrations/044-rename-content-analysis-to-intelligence.sql` (NEW)
- `docs/DATABASE_MIGRATION_INSTRUCTIONS.md` (NEW)

## Files That Need Updates

- `functions/api/content-library.ts` - Change `content_analysis` → `content_intelligence`
- Any other files querying `content_analysis` table

---

**Questions?** Check the Lessons Learned doc or contact the development team.
