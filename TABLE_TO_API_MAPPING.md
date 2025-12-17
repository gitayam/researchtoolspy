# Table-to-API Mapping Documentation

**Purpose**: Prevent schema mismatches by documenting which API endpoints use which database tables and fields.

**Last Updated**: October 13, 2025

---

## Critical Tables and Their APIs

### 1. evidence_items (Primary Evidence System)

**Status**: ✅ ACTIVE - This is the main evidence table used by the application

**Used By**:
- `GET /api/evidence-items` - List all evidence items
- `POST /api/evidence-items` - Create new evidence item
- `PUT /api/evidence-items?id=xxx` - Update evidence item
- `DELETE /api/evidence-items?id=xxx` - Delete evidence item
- `GET /api/ach?id=xxx` - ACH analysis (JOINs for evidence details)
- `POST /api/ach/evidence` - Link evidence to ACH (validates evidence exists)

**Key Fields**:
```typescript
{
  id: INTEGER PRIMARY KEY
  title: TEXT (required)
  description: TEXT (required)
  summary: TEXT
  evidence_type: TEXT (required)
  evidence_level: TEXT
  who_involved: TEXT  // 5W1H fields
  what_happened: TEXT
  when_occurred: TEXT
  where_occurred: TEXT
  why_significant: TEXT
  how_obtained: TEXT
  credibility: TEXT (required)  // Maps to credibility_score in ACH
  reliability: TEXT (required)
  confidence_level: TEXT
  priority: TEXT
  related_evidence_ids: TEXT (JSON array)
  contradicts_evidence_ids: TEXT (JSON array)
  corroborates_evidence_ids: TEXT (JSON array)
  tags: TEXT (JSON array)
  keywords: TEXT (JSON array)
  sensitivity_level: TEXT
  status: TEXT (default: 'draft')
  source_name: TEXT  // Maps to 'source' in ACH
  source_url: TEXT
  source_id: TEXT
  source_content_id: INTEGER
  source_paragraph: INTEGER
  extracted_from_content: BOOLEAN
  category: TEXT
  is_public: INTEGER (default: 0)
  shared_by_user_id: INTEGER
  created_by: INTEGER (default: 1)
  created_at: TEXT
  updated_at: TEXT
  updated_by: INTEGER
  verified_at: TEXT
  verified_by: INTEGER
}
```

**Field Mappings for ACH**:
- `description` → `evidence_content`
- `source_name` → `source`
- `when_occurred` → `date`
- `credibility` → `credibility_score`

**Frontend Components Using**:
- `ACHEvidenceManager.tsx` - Loads and creates evidence
- `EvidenceItemForm.tsx` - Create/edit form
- `EvidenceSelector.tsx` - Browse and select evidence

---

### 2. evidence (Legacy Table - DO NOT USE)

**Status**: ⚠️ DEPRECATED - Created by migration 045, currently empty

**WARNING**: This table exists but is NOT used by the application. All evidence operations should use `evidence_items` instead.

**Rows**: 0 (empty)

**Why It Exists**: Created to fix initial schema errors, but frontend already used `evidence_items`. Kept for potential future consolidation.

**Action**: DO NOT reference this table in new code. Use `evidence_items` instead.

---

### 3. ach_analyses (ACH Framework)

**Used By**:
- `GET /api/ach` - List all ACH analyses
- `GET /api/ach?id=xxx` - Get specific ACH with hypotheses, evidence, scores
- `POST /api/ach` - Create new ACH analysis
- `PUT /api/ach?id=xxx` - Update ACH analysis
- `DELETE /api/ach?id=xxx` - Delete ACH analysis
- `POST /api/ach/evidence` - Link evidence (validates analysis exists)
- `DELETE /api/ach/evidence?id=xxx` - Unlink evidence (validates ownership)

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  user_id: TEXT (required)
  workspace_id: TEXT (required)  // Workspace isolation
  title: TEXT (required)
  description: TEXT
  question: TEXT (required)
  analyst: TEXT
  organization: TEXT
  scale_type: TEXT ('logarithmic' | 'linear')
  status: TEXT ('draft' | 'in_progress' | 'completed')
  is_public: INTEGER (default: 0)  // Added in migration 047
  published_to_library: INTEGER
  library_published_at: TEXT
  original_workspace_id: TEXT
  fork_parent_id: TEXT
  investigation_id: TEXT
  created_at: TEXT
  updated_at: TEXT
}
```

**Workspace Isolation**:
All ACH queries filter by `workspace_id = ? OR is_public = 1` to ensure proper multi-tenancy.

---

### 4. ach_hypotheses

**Used By**:
- `GET /api/ach?id=xxx` - Included in ACH analysis response
- `POST /api/ach/hypotheses` - Create hypothesis
- `PUT /api/ach/hypotheses?id=xxx` - Update hypothesis
- `DELETE /api/ach/hypotheses?id=xxx` - Delete hypothesis

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  ach_analysis_id: TEXT (foreign key)
  text: TEXT (required)  // Hypothesis statement
  order_num: INTEGER  // Display order
  rationale: TEXT
  source: TEXT
  created_at: TEXT
}
```

---

### 5. ach_evidence_links

**Used By**:
- `GET /api/ach?id=xxx` - JOINs with evidence_items for evidence details
- `POST /api/ach/evidence` - Create link
- `DELETE /api/ach/evidence?id=xxx` - Delete link

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  ach_analysis_id: TEXT (foreign key to ach_analyses)
  evidence_id: INTEGER (foreign key to evidence_items)  // IMPORTANT: Links to evidence_items, not evidence!
  added_by: TEXT
  added_at: TEXT
}
```

**JOIN Query Example**:
```sql
SELECT
  ael.id as link_id,
  ael.evidence_id,
  e.title as evidence_title,
  e.description as evidence_content,
  e.source_name as source,
  e.when_occurred as date,
  e.credibility as credibility_score
FROM ach_evidence_links ael
JOIN evidence_items e ON ael.evidence_id = e.id
WHERE ael.ach_analysis_id = ?
```

---

### 6. ach_scores

**Used By**:
- `GET /api/ach?id=xxx` - Included in ACH analysis response
- `POST /api/ach/scores` - Save scoring
- `PUT /api/ach/scores?id=xxx` - Update scores

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  ach_analysis_id: TEXT (foreign key)
  hypothesis_id: TEXT (foreign key)
  evidence_link_id: TEXT (foreign key)  // Links to ach_evidence_links
  score: INTEGER  // Consistency score
  rationale: TEXT
  created_at: TEXT
  updated_at: TEXT
}
```

---

### 7. content_intelligence

**Used By**:
- `GET /api/content-intelligence` - List content analyses
- `POST /api/content-intelligence` - Create new analysis
- `GET /api/content-intelligence?id=xxx` - Get specific analysis
- `DELETE /api/content-intelligence?id=xxx` - Delete analysis
- `POST /api/frameworks/swot-auto-populate` - Auto-populate SWOT from content

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  url: TEXT (required)
  title: TEXT
  content: TEXT
  summary: TEXT
  extracted_text: TEXT
  sentiment: TEXT (JSON)
  named_entities: TEXT (JSON)
  topics: TEXT (JSON)
  key_facts: TEXT (JSON)
  credibility_indicators: TEXT (JSON)
  bias_indicators: TEXT (JSON)
  emotional_language: TEXT (JSON)
  claims: TEXT (JSON)
  relationships: TEXT (JSON)
  timeline_events: TEXT (JSON)
  metadata: TEXT (JSON)
  processing_status: TEXT ('pending' | 'processing' | 'completed' | 'failed')
  error_message: TEXT
  processed_at: TEXT
  created_at: TEXT
  updated_at: TEXT
  workspace_id: TEXT
}
```

**Migration**: Created in migration 044

---

### 8. actors

**Used By**:
- `GET /api/actors` - List all actors
- `POST /api/actors` - Create actor
- `PUT /api/actors?id=xxx` - Update actor
- `DELETE /api/actors?id=xxx` - Delete actor

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  name: TEXT (required)
  type: TEXT (required)  // 'person' | 'organization' | 'group'
  description: TEXT
  role: TEXT
  affiliation: TEXT
  capabilities: TEXT (JSON)
  intentions: TEXT
  resources: TEXT (JSON)
  workspace_id: TEXT (required)
  created_at: TEXT
  updated_at: TEXT
}
```

---

### 9. workspaces

**Used By**:
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create workspace
- All APIs with workspace_id parameter

**Key Fields**:
```typescript
{
  id: TEXT PRIMARY KEY (UUID)
  name: TEXT (required)
  description: TEXT
  owner_id: INTEGER (foreign key to users)
  created_at: TEXT
  updated_at: TEXT
}
```

**Multi-Tenancy**: Nearly all tables have a `workspace_id` field for data isolation.

---

### 10. users & hash_accounts

**Used By**:
- `GET /api/auth` - Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- All APIs via `getUserIdOrDefault()` helper

**Key Fields (users)**:
```typescript
{
  id: INTEGER PRIMARY KEY
  email: TEXT
  created_at: TEXT
  updated_at: TEXT
}
```

**Key Fields (hash_accounts)**:
```typescript
{
  id: INTEGER PRIMARY KEY
  hash: TEXT (required)  // Client-side hashed password
  user_id: INTEGER (foreign key)
  created_at: TEXT
}
```

---

## API Helper Functions

### getUserIdOrDefault()
**Location**: `functions/api/_shared/auth-helpers.ts`

**Purpose**: Extract user ID from session or return default user

**Usage**:
```typescript
const userId = await getUserIdOrDefault(context.request, context.env)
```

**Tables Used**: `hash_accounts`, `users`, Sessions KV

---

## Schema Evolution History

### Migration 044 (Oct 13, 2025)
- **Created**: `content_intelligence` table
- **Impact**: Content Intelligence API now functional

### Migration 045 (Oct 13, 2025)
- **Created**: `evidence` table (20 columns)
- **Status**: DEPRECATED - Not used by application
- **Lesson**: Should have checked existing `evidence_items` table first

### Migration 046 (Oct 13, 2025)
- **Added to evidence**: `date`, `credibility_score`, `reliability`
- **Status**: Fields added but table not used

### Migration 047 (Oct 13, 2025)
- **Added to ach_analyses**: `is_public` field
- **Impact**: Workspace isolation and public sharing now works

### Fix Commit (Oct 13, 2025)
- **Changed**: ACH APIs from `evidence` → `evidence_items`
- **Impact**: ACH evidence linking now works correctly

---

## Common Schema Mistakes to Avoid

### ❌ Wrong Table Reference
```typescript
// WRONG: Using 'evidence' table
const evidence = await db.prepare('SELECT * FROM evidence WHERE id = ?')

// CORRECT: Using 'evidence_items' table
const evidence = await db.prepare('SELECT * FROM evidence_items WHERE id = ?')
```

### ❌ Field Name Mismatch
```typescript
// WRONG: Field doesn't exist in evidence_items
SELECT e.content FROM evidence_items e

// CORRECT: Use 'description' field
SELECT e.description as content FROM evidence_items e
```

### ❌ Missing Workspace Isolation
```typescript
// WRONG: No workspace filtering
SELECT * FROM ach_analyses WHERE user_id = ?

// CORRECT: Include workspace isolation
SELECT * FROM ach_analyses WHERE user_id = ? AND (workspace_id = ? OR is_public = 1)
```

### ❌ JOIN to Wrong Table
```typescript
// WRONG: Joining to deprecated 'evidence' table
FROM ach_evidence_links ael
JOIN evidence e ON ael.evidence_id = e.id

// CORRECT: Join to 'evidence_items'
FROM ach_evidence_links ael
JOIN evidence_items e ON ael.evidence_id = e.id
```

---

## Testing Schema Compatibility

### Before Deploying New APIs

1. **Check Table Exists**:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='table_name';
```

2. **Verify Fields Exist**:
```sql
PRAGMA table_info(table_name);
```

3. **Test JOIN Queries**:
```sql
-- Test your JOIN locally first
SELECT * FROM table1 t1
JOIN table2 t2 ON t1.foreign_key = t2.id
LIMIT 1;
```

4. **Run Schema Validation**:
```bash
npm run validate-schema
```

5. **Run Pre-Deployment Checks**:
```bash
./scripts/pre-deployment-check.sh
```

---

## Quick Reference: Table Status

| Table | Status | Rows (Prod) | Primary API | Notes |
|-------|--------|-------------|-------------|-------|
| evidence_items | ✅ ACTIVE | 6 | /api/evidence-items | Main evidence system |
| evidence | ⚠️ DEPRECATED | 0 | (none) | Do not use |
| ach_analyses | ✅ ACTIVE | 4 | /api/ach | ACH framework |
| ach_hypotheses | ✅ ACTIVE | ~8 | /api/ach/hypotheses | ACH hypotheses |
| ach_evidence_links | ✅ ACTIVE | 0 | /api/ach/evidence | Links evidence to ACH |
| ach_scores | ✅ ACTIVE | 0 | /api/ach/scores | ACH scoring |
| content_intelligence | ✅ ACTIVE | ? | /api/content-intelligence | Content analysis |
| actors | ✅ ACTIVE | ? | /api/actors | Actor tracking |
| workspaces | ✅ ACTIVE | 1+ | /api/workspaces | Multi-tenancy |
| users | ✅ ACTIVE | 1+ | /api/auth | Authentication |
| hash_accounts | ✅ ACTIVE | 1+ | /api/auth | Password storage |

---

## Maintenance Guidelines

### When Adding New API Endpoints

1. Document which tables the API uses in this file
2. List all fields the API queries
3. Note any JOINs and foreign key relationships
4. Add validation to `scripts/validate-schema.ts`
5. Update pre-deployment checks if needed

### When Creating New Migrations

1. Update this document with new tables/fields
2. Update `REQUIRED_TABLES` in `scripts/validate-schema.ts`
3. Test migration locally before deploying to production
4. Verify with `--remote` flag that schema matches expectations

### When Modifying Existing APIs

1. Check this document for current table usage
2. Verify field names match database schema
3. Test locally with actual production data structure
4. Run schema validation before deploying

---

## Related Documentation

- `scripts/validate-schema.ts` - Automated schema validation
- `scripts/pre-deployment-check.sh` - Pre-deployment checklist
- `INFRASTRUCTURE_UPGRADE_2025-10-13.md` - Infrastructure capacity
- `ACH_FIX_COMPLETE_2025-10-13.md` - ACH schema fix details
- `DATABASE_AUDIT_2025-10-13.md` - Full database audit

---

**Last Incident**: October 13, 2025 - ACH evidence linking failure due to wrong table reference
**Resolution**: Changed ACH APIs from `evidence` to `evidence_items`
**Prevention**: This mapping document + schema validation scripts

---

Generated: October 13, 2025
Maintained by: Development Team
