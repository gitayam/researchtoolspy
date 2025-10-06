# Evidence System Migration Plan

**Created:** October 1, 2025
**Status:** ✅ Phase 1, 2 & 3 Complete - Phase 4 In Progress
**Priority:** Critical
**Last Updated:** October 1, 2025

---

## 🎯 Executive Summary

**Problem:** Current "Evidence" system is actually a "Dataset/Source Library" - it stores where information comes from, not the analyzed evidence itself.

**Solution:**
1. Rename current Evidence → Datasets (Phase 1)
2. Build true Evidence Items system (Phase 2-4)

---

## 📊 Conceptual Model

### Datasets (Current "Evidence")
**What:** Sources of information
**Examples:**
- Research papers, government databases, APIs
- News articles, census data, congressional records
- "Where the data comes from"

### Evidence Items (NEW)
**What:** Analyzed facts extracted from datasets
**Examples:**
- "Meeting between Person A and B at Embassy X on Jan 15, 2025"
- "HR 1234 proposed by Senator Y on date Z"
- "Shoes found at door during tactical operation"
- "Economic indicator changed by 15% in Q4"

### Citations (NEW)
**What:** Links evidence to datasets with context
**Examples:**
- Evidence Item #123 → Dataset #45, Page 12, Quote: "..."
- Proper citation format (APA, MLA, Chicago)

---

## 🗄️ Database Schema Changes

### Phase 1: Rename Evidence → Datasets

**Step 1:** Create new datasets table (copy of evidence)
```sql
CREATE TABLE datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  source TEXT NOT NULL,
  tags TEXT,
  metadata TEXT,
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Additional dataset-specific fields
  source_name TEXT,
  source_url TEXT,
  author TEXT,
  organization TEXT,
  publication_date TEXT,
  access_date TEXT,
  reliability_rating TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
)
```

**Step 2:** Migrate data from evidence to datasets
```sql
INSERT INTO datasets SELECT * FROM evidence
```

**Step 3:** Rename framework_evidence → framework_datasets
```sql
CREATE TABLE framework_datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
  UNIQUE(framework_id, dataset_id, section_key)
)

INSERT INTO framework_datasets (framework_id, dataset_id, section_key, relevance_note, created_at, created_by)
SELECT framework_id, evidence_id, section_key, relevance_note, created_at, created_by
FROM framework_evidence
```

**Step 4:** Drop old tables (after verification)
```sql
DROP TABLE framework_evidence
DROP TABLE evidence
```

### Phase 2: Create Evidence Items System

**Evidence Items Table:**
```sql
CREATE TABLE evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Core
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  summary TEXT,

  -- Classification
  evidence_type TEXT NOT NULL, -- observation, document_excerpt, statement, event, measurement, artifact
  category TEXT, -- tactical, operational, strategic

  -- 5 W's + How
  who_involved TEXT, -- JSON array
  what_happened TEXT,
  when_occurred TEXT, -- ISO timestamp or range
  where_occurred TEXT, -- JSON: {lat, lng, address, region}
  why_significant TEXT,
  how_obtained TEXT,

  -- Assessment
  reliability TEXT NOT NULL, -- A-F
  credibility TEXT NOT NULL, -- 1-6
  confidence_level TEXT, -- high, medium, low
  corroboration_count INTEGER DEFAULT 0,
  contradiction_count INTEGER DEFAULT 0,

  -- Relationships
  dataset_ids TEXT, -- JSON array
  related_evidence_ids TEXT, -- JSON
  contradicts_evidence_ids TEXT, -- JSON
  corroborates_evidence_ids TEXT, -- JSON

  -- Framework Categories
  pmesii_dimensions TEXT, -- JSON: [political, military, economic, social, infrastructure, information, physical_env, time]
  dime_domains TEXT, -- JSON: [diplomatic, information, military, economic]
  actor_types TEXT, -- JSON: [individual, organization, government, military, civilian]

  -- Metadata
  tags TEXT, -- JSON
  keywords TEXT, -- JSON
  sensitivity_level TEXT, -- public, sensitive, classified

  -- Tracking
  created_by INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  verified_by INTEGER,

  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
)
```

**Citations Table:**
```sql
CREATE TABLE evidence_citations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER NOT NULL,
  dataset_id INTEGER NOT NULL,
  page_number TEXT,
  quote TEXT,
  context TEXT,
  citation_format TEXT, -- APA, MLA, Chicago
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
)
```

**Framework Evidence Linking:**
```sql
CREATE TABLE framework_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  section_key TEXT,
  relevance_note TEXT,
  weight REAL DEFAULT 1.0, -- How important this evidence is
  supports BOOLEAN DEFAULT 1, -- Does it support or contradict
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER DEFAULT 1,
  FOREIGN KEY (framework_id) REFERENCES framework_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(id) ON DELETE CASCADE,
  UNIQUE(framework_id, evidence_id, section_key)
)
```

---

## 🔄 API Changes

### Phase 1: Rename Evidence API

**OLD:** `/api/evidence`
**NEW:** `/api/datasets`

**Transition Strategy:**
- Rename function file: `evidence.ts` → `datasets.ts`
- Keep `/api/evidence` as alias for backward compatibility (temporary)
- Update all frontend calls to use `/api/datasets`

**OLD:** `/api/framework-evidence`
**NEW:** `/api/framework-datasets`

### Phase 2: Create Evidence Items API

**NEW:** `/api/evidence-items`
- GET / - List evidence items (with filters)
- GET /:id - Get single evidence
- POST / - Create evidence
- PUT /:id - Update evidence
- DELETE /:id - Delete evidence
- POST /:id/citations - Add citation
- GET /:id/citations - Get citations
- GET /:id/related - Get related evidence
- POST /:id/corroborate - Mark as corroborating
- POST /:id/contradict - Mark as contradicting

**NEW:** `/api/framework-evidence`
- Links frameworks to evidence_items (not datasets)

---

## 🎨 UI/UX Changes

### Phase 1: Rename Components

**Navigation:**
```
OLD:
└── Evidence Collector

NEW:
└── Dataset Library
```

**Later (Phase 2):**
```
Evidence & Intelligence
├── Evidence Items (NEW - main analysis)
├── Dataset Library (renamed)
└── Citations (NEW)
```

**Components to Rename:**
1. `src/pages/EvidencePage.tsx` → `src/pages/DatasetPage.tsx`
2. `src/components/evidence/EvidenceForm.tsx` → `src/components/datasets/DatasetForm.tsx`
3. `src/components/evidence/EvidenceSelector.tsx` → `src/components/datasets/DatasetSelector.tsx`
4. `src/components/evidence/EvidenceBadge.tsx` → `src/components/datasets/DatasetBadge.tsx`
5. `src/types/evidence.ts` → `src/types/dataset.ts`

**Route Changes:**
```
OLD: /dashboard/evidence
NEW: /dashboard/datasets
```

### Phase 2: New Evidence Components

**Create:**
- `src/pages/EvidencePage.tsx` (NEW - for evidence items)
- `src/components/evidence/EvidenceItemForm.tsx`
- `src/components/evidence/EvidenceItemCard.tsx`
- `src/components/evidence/EvidenceDetail.tsx`
- `src/components/evidence/EvidenceTimeline.tsx`
- `src/components/evidence/EvidenceMap.tsx`
- `src/components/evidence/CitationManager.tsx`
- `src/types/evidence-item.ts`

---

## 📋 Implementation Checklist

### Phase 1: Rename & Restructure ✅ COMPLETE

#### Database
- [x] Create datasets table
- [x] Migrate data from evidence to datasets (3 records migrated)
- [x] Create framework_datasets table
- [x] Migrate data from framework_evidence
- [x] Verify data integrity
- [ ] Drop old tables (keeping for safety)

#### API
- [x] Rename /api/evidence → /api/datasets
- [x] Rename /api/framework-evidence → /api/framework-datasets
- [x] Update all API logic
- [x] Test all endpoints

#### Types
- [x] Create dataset.ts with new types
- [x] Update type definitions
- [x] Update imports across codebase

#### Components
- [x] Create DatasetForm
- [x] Create DatasetSelector
- [x] Create DatasetBadge
- [x] Update component logic
- [x] Update imports

#### Pages
- [x] Create DatasetPage
- [x] Update route configuration
- [x] Update navigation sidebar (added "Dataset Library")
- [x] Update all links

#### Framework Integration
- [x] Update GenericFrameworkForm to use datasets
- [x] Update all 13 frameworks to use dataset system
- [x] Test framework-dataset linking

#### Testing
- [x] Test dataset CRUD operations
- [x] Test dataset-framework linking
- [x] Test all UI interactions
- [x] Build successful with no TypeScript errors

### Phase 2: Evidence Items System ✅ COMPLETE

#### Database
- [x] Create evidence_items table with 5 W's + How fields
- [x] Create evidence_citations table
- [x] Deploy to production D1 database

#### API
- [x] Build /api/evidence-items (GET, POST, PUT, DELETE)
- [x] Build /api/evidence-citations (GET, POST, DELETE)
- [x] Implement filtering by type, level, status, priority
- [x] Test all endpoints

#### Types
- [x] Create evidence.ts with EvidenceItem types
- [x] Define EvidenceType, EvidenceLevel, PriorityLevel enums
- [x] Define citation types and interfaces

#### Components
- [x] Build comprehensive EvidenceItemForm with all fields
- [x] Update EvidencePage for evidence items
- [x] Integrate DatasetSelector for citations
- [x] Remove old Evidence components

#### Testing
- [x] Build successful with no TypeScript errors
- [x] All imports working correctly

### Phase 3: Enhanced Features ✅ COMPLETE
- [x] Build framework-evidence linking (link evidence items to frameworks)
- [x] Quick Evidence Creation feature in selector dialogs
- [ ] Enhanced citation display UI
- [ ] Evidence timeline view
- [ ] Evidence map view
- [ ] Corroboration/contradiction tracking
- [ ] Related evidence suggestions

### Phase 4: Integration & Polish (Next)
- [ ] Integrate evidence items with all 13 frameworks
- [ ] Add evidence search and filtering
- [ ] Add evidence export functionality
- [ ] Add evidence analytics dashboard
- [ ] User documentation
- [ ] Final testing

---

## 🎯 Success Metrics

### Phase 1 Complete ✅
- [x] All "Evidence" references changed to "Datasets"
- [x] Dataset CRUD fully functional
- [x] Dataset-Framework linking works
- [x] No UI breaks or regressions
- [x] Navigation and routes updated

### Phase 2 Complete ✅
- [x] Evidence items can be created with 5 W's + How
- [x] Evidence can cite datasets
- [x] Full assessment system (credibility, reliability, confidence, priority)
- [x] Evidence items page with filtering
- [x] Build successful

### Phase 3 Complete ✅
- [x] Evidence can be linked to frameworks
- [x] Quick Evidence Creation in selector dialogs
- [x] Context-aware pre-filling
- [x] Auto-selection of created evidence
- [ ] Enhanced citation display UI (moved to Phase 4)
- [ ] Evidence timeline view (moved to Phase 4)
- [ ] Corroboration/contradiction tracking (moved to Phase 4)

### Phase 4 Goals 🎯
- [ ] Full framework integration
- [ ] Analytics and reporting
- [ ] Export functionality
- [ ] User documentation

---

## 📈 System Architecture Status

```
✅ Datasets System (Phase 1)
   └── Information sources (where data comes from)
   └── Links to frameworks via framework_datasets table

✅ Evidence Items System (Phase 2)
   └── Analyzed facts (what the data tells us)
   └── 5 W's + How framework
   └── Cites datasets via evidence_citations table

✅ Framework Integration (Phase 3)
   └── Evidence items linked to frameworks via framework_evidence table
   └── Quick Evidence Creation in selector dialogs
   └── Context-aware pre-filling and auto-selection

📊 Analytics & Visualization (Phase 4)
   └── Timeline views
   └── Map views
   └── Relationship graphs
```

---

**Last Updated:** October 1, 2025
**Next Review:** After Phase 4 completion
