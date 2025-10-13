# Database Schema Audit - October 13, 2025

**Status:** 🔍 IN PROGRESS
**Purpose:** Verify all tables referenced by API endpoints exist in production
**Triggered By:** Missing `evidence` table causing 500 errors

---

## Executive Summary

After discovering the missing `evidence` table, conducting comprehensive audit to identify any other table mismatches between API expectations and actual database schema.

---

## Tables Verified to Exist ✅

### Core Tables
- ✅ `evidence` - Created via migration 045 (Oct 13, 2025)
- ✅ `evidence_items` - 5 W's framework evidence
- ✅ `evidence_citations` - Citation tracking
- ✅ `evidence_actors` - Evidence-actor relationships
- ✅ `ach_analyses` - Analysis of Competing Hypotheses
- ✅ `ach_hypotheses` - ACH hypotheses
- ✅ `ach_scores` - ACH scoring matrix
- ✅ `ach_evidence_links` - ACH-evidence relationships
- ✅ `actors` - People, organizations, units
- ✅ `actor_behaviors` - Actor behavior patterns
- ✅ `actor_events` - Actor-event relationships
- ✅ `behaviors` - Behavior definitions
- ✅ `events` - Event tracking
- ✅ `event_evidence` - Event-evidence relationships
- ✅ `places` - Location tracking
- ✅ `relationships` - Entity relationships

### System Tables
- ✅ `activity_feed` - User activity tracking
- ✅ `comments` - Comment system
- ✅ `datasets` - Dataset management
- ✅ `framework_sessions` - Framework session tracking
- ✅ `framework_datasets` - Framework-dataset links
- ✅ `framework_evidence` - Framework-evidence links
- ✅ `guest_conversions` - Guest to user conversions
- ✅ `content_intelligence` - URL analysis (migration 044)

### Authentication & Users
- ✅ `users` - User accounts
- ✅ `hash_accounts` - Hash-based authentication
- ✅ `guest_sessions` - Guest session management
- ✅ `auth_logs` - Authentication audit trail
- ✅ `api_keys` - API key management

### Frameworks
- ✅ `pmesii_pt_analyses` - PMESII-PT framework
- ✅ `cog_analyses` - Center of Gravity
- ✅ `swot_analyses` - SWOT analysis
- ✅ `dime_analyses` - DIME framework
- ✅ `pest_analyses` - PEST analysis
- ✅ `framework_templates` - Framework templates
- ✅ `framework_analytics` - Usage analytics
- ✅ `framework_views` - View tracking
- ✅ `framework_exports` - Export history
- ✅ `framework_content_sources` - Content source tracking

### Content & Analysis
- ✅ `content_analysis` - Content analysis (legacy)
- ✅ `content_intelligence` - Content intelligence (new)
- ✅ `content_entities` - NER entities
- ✅ `content_qa` - Q&A pairs
- ✅ `content_chunks` - Content chunking
- ✅ `content_deduplication` - Duplicate detection

### Claims & Evidence
- ✅ `claims` - Claim tracking
- ✅ `claim_entity_mentions` - Entity mentions in claims
- ✅ `claim_evidence_links` - Claim-evidence relationships
- ✅ `claim_adjustments` - Claim modifications
- ✅ `claim_shares` - Claim sharing

### Investigations
- ✅ `investigations` - Investigation management
- ✅ `investigation_actors` - Investigation-actor links
- ✅ `investigation_events` - Investigation-event links
- ✅ `investigation_evidence` - Investigation-evidence links
- ✅ `investigation_activity` - Activity logging
- ✅ `investigation_activity_log` - Detailed logs

### Workspaces & Collaboration
- ✅ `workspaces` - Workspace management
- ✅ `workspace_members` - Workspace membership
- ✅ `workspace_invites` - Pending invitations
- ✅ `form_submissions` - Submissions tracking
- ✅ `feedback` - User feedback
- ✅ `data_exports` - Export management

### Notifications
- ✅ `comment_mentions` - @mentions in comments
- ✅ `comment_notifications` - Comment notifications

---

## Tables Referenced by APIs

### Analysis in Progress

**Method:** Scanning all API endpoint files for table references

**Files to Check:**
```bash
frontend-react/functions/api/*.ts
frontend-react/functions/api/**/*.ts
```

**Extraction Pattern:**
```regex
(FROM|INTO|UPDATE|JOIN) [a-z_]+
```

**Status:** Need to verify all referenced tables exist

---

## Table Naming Patterns

### Identified Patterns
1. **Singular**: `evidence`, `actor`, `event`, `source`, `place`
2. **Plural**: `actors`, `events`, `places`, `claims`, `users`
3. **Compound**: `evidence_items`, `content_intelligence`, `framework_sessions`
4. **Junction**: `actor_behaviors`, `event_evidence`, `claim_evidence_links`

### Naming Inconsistencies
- `evidence` vs `evidence_items` (both exist, serve different purposes)
- `content_analysis` vs `content_intelligence` (both exist, legacy vs new)
- `investigation_activity` vs `investigation_activity_log` (both exist)

**Recommendation:** Document the purpose and use case for each table to avoid confusion.

---

## Schema Validation Recommendations

### 1. Add Pre-Deployment Schema Checks

Create a validation script that runs before deployment:

```typescript
// scripts/validate-schema.ts
interface TableCheck {
  table: string
  apis: string[]
  required: boolean
}

const REQUIRED_TABLES: TableCheck[] = [
  { table: 'evidence', apis: ['/api/evidence', '/api/ach'], required: true },
  { table: 'actors', apis: ['/api/actors', '/api/actors/search'], required: true },
  { table: 'ach_analyses', apis: ['/api/ach'], required: true },
  // ... more tables
]

async function validateSchema(db: D1Database) {
  for (const check of REQUIRED_TABLES) {
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    ).bind(check.table).first()

    if (!result && check.required) {
      throw new Error(`Required table '${check.table}' not found (used by ${check.apis.join(', ')})`)
    }
  }
}
```

### 2. Add Automated Schema Tests

```typescript
// tests/schema.test.ts
describe('Database Schema', () => {
  it('should have all required tables', async () => {
    const tables = ['evidence', 'actors', 'ach_analyses', ...]
    for (const table of tables) {
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
      ).bind(table).first()
      expect(result).toBeDefined()
    }
  })

  it('should have correct schema for evidence table', async () => {
    const schema = await db.prepare(
      "PRAGMA table_info(evidence)"
    ).all()
    expect(schema.results).toContainEqual(
      expect.objectContaining({ name: 'title', type: 'TEXT', notnull: 1 })
    )
    // ... more field checks
  })
})
```

### 3. Document Table Purposes

Create `TABLES.md`:

```markdown
# Database Tables

## Evidence Tables

### `evidence`
**Purpose:** Flexible evidence storage for various types
**Used By:** Evidence API, ACH, Investigations
**Schema:** JSON-based with extensible fields
**Created:** Migration 045 (2025-10-13)

### `evidence_items`
**Purpose:** Structured 5 W's framework evidence
**Used By:** Analytical frameworks, structured analysis
**Schema:** Fixed fields (who, what, when, where, why, how)
**Created:** Migration 002 (2025-10-01)

...
```

---

## Next Steps

### Immediate (Today)
1. ✅ Fix missing `evidence` table
2. ⏳ Complete API endpoint table reference scan
3. ⏳ Verify all referenced tables exist
4. ⏳ Document any additional missing tables

### Short-Term (This Week)
1. Create table purpose documentation
2. Implement schema validation script
3. Add pre-deployment schema checks
4. Create automated schema tests

### Long-Term (This Month)
1. Integrate schema validation into CI/CD
2. Add migration dependency tracking
3. Create schema versioning system
4. Implement automated schema documentation

---

## Audit Checklist

- [x] List all tables in production database
- [x] Verify core entity tables exist
- [x] Verify framework tables exist
- [x] Verify relationship/junction tables exist
- [ ] Scan all API files for table references
- [ ] Cross-reference API expectations with actual schema
- [ ] Identify any additional missing tables
- [ ] Create migrations for missing tables
- [ ] Document table purposes and relationships
- [ ] Implement schema validation tests

---

## Production Database Stats

**Total Tables:** 92 (after evidence table fix)
**Database Size:** 45.02 MB
**Last Migration:** 045-create-evidence-table.sql
**Last Update:** 2025-10-13

**Table Categories:**
- Core Entities: 20 tables
- Frameworks: 12 tables
- Relationships: 15 tables
- Content & Analysis: 10 tables
- System & Auth: 10 tables
- Investigations: 8 tables
- Claims: 5 tables
- Workspaces: 5 tables
- Other: 7 tables

---

**Status:** 🔍 **AUDIT IN PROGRESS**
**Priority:** HIGH (Prevent future 500 errors)
**Owner:** Claude Code
**Date:** October 13, 2025
